param(
    [string]$SourceZip = "C:\Users\khm35\Downloads\한국인터넷진흥원_전화상담 가명정보 현황_20251208.zip",
    [string]$ExistingCorpus = "$PSScriptRoot\..\datasets\rag\input\kisa-corpus\kisa-integrated-corpus.json",
    [string]$OutputPath = "$PSScriptRoot\..\datasets\rag\input\kisa-auxiliary-consultations.json"
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.IO.Compression.FileSystem

$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
$sha256 = [System.Security.Cryptography.SHA256]::Create()

$patterns = [ordered]@{
    fraud = '보이스피싱|피싱|스미싱|사기'
    direct_transfer = '송금|이체|입금|돈을 보내|금액을 보내'
    account = '계좌|통장'
    advance_fee_or_safe_account = '선입금|수수료|안전계좌|안전 계좌|보호계좌|보호 계좌'
    app_install = '앱.{0,12}설치|어플.{0,12}설치'
    remote_control = '원격제어|원격 제어'
    url_click = '링크.{0,12}(누르|클릭|접속)|주소.{0,12}(누르|클릭|접속)'
    identity_information = '주민등록|신분증|운전면허증|개인정보|개인 정보'
    otp_or_authentication = 'OTP|오티피|인증번호|인증 번호|비밀번호'
    agency_impersonation = '검찰|경찰|금융감독원|금감원|국세청|정부기관|공공기관'
    financial_impersonation = '은행|카드회사|카드사|금융기관'
    family_impersonation = '아들|딸|손자|손녀|가족|지인'
    post_incident = '당했|피해.{0,8}(발생|입었)|이미.{0,10}(보냈|송금|이체)|송금했|이체했|입금했'
    freeze_or_recovery = '지급정지|지급 정지|피해구제|피해 구제|환급|되찾|돌려받'
    report_or_response = '신고|사이버수사대|재발급|차단|대처|조치'
}

function Protect-SensitiveText([AllowNull()][string]$Text) {
    if ([string]::IsNullOrEmpty($Text)) { return $Text }

    $protected = $Text
    $protected = [regex]::Replace($protected, '(?<!\d)\d{6}[- ]?[1-4]\d{6}(?!\d)', '[RRN]')
    $protected = [regex]::Replace($protected, '(?<!\d)0\d{1,3}[- ]?\d{3,4}[- ]?\d{4}(?!\d)', '[PHONE]')
    $protected = [regex]::Replace($protected, '(?i)\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b', '[EMAIL]')
    $protected = [regex]::Replace($protected, '(?i)https?://\S+|www\.\S+', '[URL]')
    $protected = [regex]::Replace($protected, '(?<!\d)(?:\d[ -]?){10,16}(?!\d)', '[ACCOUNT_OR_NUMBER]')
    $protected = [regex]::Replace($protected, '(?<!\d)(?:\d{1,3}\.){3}\d{1,3}(?!\d)', '[IP]')
    $protected = [regex]::Replace($protected, '(?m)^(상담센터|상담팀|민원 담당)\s+[가-힣]{2,4}', '$1 [COUNSELOR]')
    return $protected.Trim()
}

function Get-Hash([string]$Text) {
    return [Convert]::ToHexString(
        $sha256.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($Text))
    ).ToLowerInvariant()
}

function Get-NormalizedText([string]$Text) {
    $normalized = $Text.Normalize().ToLowerInvariant()
    $normalized = [regex]::Replace(
        $normalized,
        '\[(phone|rrn|email|url|account_or_number|ip|counselor)\]',
        '[redacted]'
    )
    return [regex]::Replace($normalized, '[\s\p{P}\p{S}]+', '')
}

function Test-Pattern([string]$Text, [string]$Pattern) {
    return [regex]::IsMatch($Text, $Pattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
}

function Add-Unique([System.Collections.Generic.List[string]]$Target, [string]$Value) {
    if (-not $Target.Contains($Value)) { $Target.Add($Value) }
}

if (-not (Test-Path -LiteralPath $SourceZip)) {
    throw "원본 ZIP을 찾을 수 없습니다: $SourceZip"
}
if (-not (Test-Path -LiteralPath $ExistingCorpus)) {
    throw "기존 KISA 300건 Corpus를 찾을 수 없습니다: $ExistingCorpus"
}

$existingRecords = (Get-Content -LiteralPath $ExistingCorpus -Raw | ConvertFrom-Json).records
$existingExactHashes = [System.Collections.Generic.HashSet[string]]::new(
    [string[]]@($existingRecords | ForEach-Object { $_.deduplication.content_hash_sha256 })
)
$existingNormalizedHashes = [System.Collections.Generic.HashSet[string]]::new(
    [string[]]@($existingRecords | ForEach-Object { $_.deduplication.normalized_content_hash_sha256 })
)

$records = [System.Collections.Generic.List[object]]::new()
$zip = [System.IO.Compression.ZipFile]::OpenRead($SourceZip)
try {
    $entries = @($zip.Entries | Where-Object { $_.Name -like '*.txt' } | ForEach-Object {
        $match = [regex]::Match($_.Name, '\((\d+)\)')
        [pscustomobject]@{
            entry = $_
            source_number = if ($match.Success) { [int]$match.Groups[1].Value } else { 999999 }
        }
    } | Sort-Object source_number)

    foreach ($item in $entries) {
        $reader = [System.IO.StreamReader]::new($item.entry.Open(), [System.Text.Encoding]::UTF8, $true)
        try {
            $rawTranscript = $reader.ReadToEnd()
        }
        finally {
            $reader.Dispose()
        }

        $transcript = Protect-SensitiveText $rawTranscript
        $signals = [ordered]@{}
        foreach ($name in $patterns.Keys) {
            $signals[$name] = Test-Pattern $transcript $patterns[$name]
        }

        $stage4Candidate = (
            $signals.direct_transfer -or
            $signals.advance_fee_or_safe_account -or
            ($signals.fraud -and $signals.account)
        )
        $stage6Candidate = $signals.post_incident -or $signals.freeze_or_recovery
        $contextCandidate = (
            $signals.agency_impersonation -or
            $signals.financial_impersonation -or
            $signals.family_impersonation -or
            $signals.app_install -or
            $signals.remote_control -or
            $signals.url_click -or
            $signals.identity_information -or
            $signals.otp_or_authentication
        )
        $normalOrIrrelevantCandidate = -not (
            $signals.fraud -or
            $stage4Candidate -or
            $stage6Candidate -or
            $contextCandidate
        )

        $candidateUses = [System.Collections.Generic.List[string]]::new()
        if ($stage4Candidate) { Add-Unique $candidateUses 'stage_4_intent_risk_candidate' }
        if ($stage6Candidate) { Add-Unique $candidateUses 'stage_6_golden_time_candidate' }
        if ($contextCandidate) { Add-Unique $candidateUses 'stage_1_2_context_candidate' }
        if ($normalOrIrrelevantCandidate) { Add-Unique $candidateUses 'normal_or_irrelevant_control_candidate' }
        if ($candidateUses.Count -eq 0) { Add-Unique $candidateUses 'other_security_consultation' }

        if ($stage4Candidate) {
            $primaryBucket = 'stage_4_intent_risk_candidate'
        }
        elseif ($stage6Candidate) {
            $primaryBucket = 'stage_6_golden_time_candidate'
        }
        elseif ($normalOrIrrelevantCandidate) {
            $primaryBucket = 'normal_or_irrelevant_control_candidate'
        }
        else {
            $primaryBucket = 'security_context_candidate'
        }

        $requestedActionCandidates = [System.Collections.Generic.List[string]]::new()
        if ($signals.direct_transfer -or $signals.advance_fee_or_safe_account) { Add-Unique $requestedActionCandidates 'transfer' }
        if ($signals.app_install) { Add-Unique $requestedActionCandidates 'install_app' }
        if ($signals.remote_control) { Add-Unique $requestedActionCandidates 'remote_control' }
        if ($signals.identity_information) { Add-Unique $requestedActionCandidates 'submit_personal_information' }
        if ($signals.otp_or_authentication) { Add-Unique $requestedActionCandidates 'share_otp' }
        if ($signals.url_click) { Add-Unique $requestedActionCandidates 'click_url' }

        $riskSignalCandidates = [System.Collections.Generic.List[string]]::new()
        if ($signals.agency_impersonation) { Add-Unique $riskSignalCandidates 'AGENCY_IMPERSONATION' }
        if ($signals.advance_fee_or_safe_account) { Add-Unique $riskSignalCandidates 'PREPAY_CONTRADICTION' }
        if ($signals.app_install) { Add-Unique $riskSignalCandidates 'APP_INSTALLATION_REQUEST' }
        if ($signals.remote_control -or $signals.otp_or_authentication) { Add-Unique $riskSignalCandidates 'CREDENTIAL_REQUEST' }
        if ($signals.url_click) { Add-Unique $riskSignalCandidates 'MALICIOUS_URL' }
        if ($signals.identity_information) { Add-Unique $riskSignalCandidates 'PERSONAL_DATA_REQUEST' }

        $channelCandidates = [System.Collections.Generic.List[string]]::new()
        if (Test-Pattern $transcript '전화|통화') { Add-Unique $channelCandidates 'phone' }
        if (Test-Pattern $transcript '문자|메시지') { Add-Unique $channelCandidates 'sms' }
        if (Test-Pattern $transcript '이메일|메일') { Add-Unique $channelCandidates 'email' }
        if ($signals.url_click) { Add-Unique $channelCandidates 'web' }
        if ($signals.app_install -or $signals.remote_control) { Add-Unique $channelCandidates 'app' }

        $normalizedTranscript = Get-NormalizedText $transcript
        $exactHash = Get-Hash $transcript
        $normalizedHash = Get-Hash $normalizedTranscript

        $records.Add([ordered]@{
            schema_version = '1.0.0'
            record_id = "kisa-aux-{0:D4}" -f $item.source_number
            source_number = $item.source_number
            source_file = $item.entry.Name
            source_dataset = '한국인터넷진흥원 전화상담 합성데이터 982건'
            source_url = 'https://www.data.go.kr/data/15156112/fileData.do'
            source_reference_date = '2025-12-08'
            synthetic = $true
            redaction_applied = $true
            transcript = $transcript
            transcript_character_count = $transcript.Length
            candidate_classification = [ordered]@{
                primary_bucket = $primaryBucket
                candidate_uses = @($candidateUses)
                heuristic_signals = $signals
                requested_action_candidates = @($requestedActionCandidates)
                risk_signal_candidates = @($riskSignalCandidates)
                channel_candidates = @($channelCandidates)
            }
            extraction = [ordered]@{
                status = 'needs_review'
                incident_text = $null
                note = '화자 라벨이 없어 피해자 진술과 상담원 조언을 자동 분리하지 않음'
            }
            annotation = [ordered]@{
                review_status = 'needs_review'
                training_eligible = $false
                fraud = $null
                fraud_type = @()
                channel = @()
                impersonation = @()
                requested_action = @()
                risk_signals = @()
                attack_stage = 'unknown'
            }
            deduplication = [ordered]@{
                content_hash_sha256 = $exactHash
                normalized_content_hash_sha256 = $normalizedHash
                exact_overlap_with_existing_kisa_300 = $existingExactHashes.Contains($exactHash)
                normalized_overlap_with_existing_kisa_300 = $existingNormalizedHashes.Contains($normalizedHash)
            }
        })
    }
}
finally {
    $zip.Dispose()
    $sha256.Dispose()
}

$exactDuplicateGroups = @($records | Group-Object { $_.deduplication.content_hash_sha256 } | Where-Object Count -gt 1)
$normalizedDuplicateGroups = @($records | Group-Object { $_.deduplication.normalized_content_hash_sha256 } | Where-Object Count -gt 1)

$bucketCounts = [ordered]@{}
foreach ($bucket in @(
    'stage_4_intent_risk_candidate',
    'stage_6_golden_time_candidate',
    'security_context_candidate',
    'normal_or_irrelevant_control_candidate'
)) {
    $bucketCounts[$bucket] = @($records | Where-Object { $_.candidate_classification.primary_bucket -eq $bucket }).Count
}

$usageCounts = [ordered]@{}
foreach ($usage in @(
    'stage_4_intent_risk_candidate',
    'stage_6_golden_time_candidate',
    'stage_1_2_context_candidate',
    'normal_or_irrelevant_control_candidate',
    'other_security_consultation'
)) {
    $usageCounts[$usage] = @($records | Where-Object { $_.candidate_classification.candidate_uses -contains $usage }).Count
}

$document = [ordered]@{
    schema_version = '1.0.0'
    dataset_name = '안심동행 AI KISA 전화상담 보조 Corpus'
    purpose = 'AI 송금 의도 분석과 골든타임 대응을 위한 보조 후보 데이터. 자동 분류는 정답 라벨이 아님.'
    source = [ordered]@{
        provider = '한국인터넷진흥원'
        source_file = [System.IO.Path]::GetFileName($SourceZip)
        source_url = 'https://www.data.go.kr/data/15156112/fileData.do'
        source_reference_date = '2025-12-08'
        source_record_count = 982
        source_format = 'TXT, 상담 대화 1건당 파일 1개'
        source_derivation = 'KISA 비정형 전화상담 음성의 STT 텍스트를 기반으로 개인정보를 포함하지 않도록 만든 합성데이터'
        synthetic = $true
    }
    processing = [ordered]@{
        sensitive_pattern_redaction = $true
        speaker_or_incident_extraction = 'not_applied_due_to_missing_speaker_labels'
        classification_method = 'keyword_and_rule_based_candidate_routing'
        human_review_required = $true
        direct_model_training_allowed = $false
    }
    summary = [ordered]@{
        total_records = $records.Count
        primary_bucket_counts = $bucketCounts
        candidate_usage_counts = $usageCounts
        internal_exact_duplicate_groups = $exactDuplicateGroups.Count
        internal_normalized_duplicate_groups = $normalizedDuplicateGroups.Count
        exact_overlap_with_existing_kisa_300 = @($records | Where-Object { $_.deduplication.exact_overlap_with_existing_kisa_300 }).Count
        normalized_overlap_with_existing_kisa_300 = @($records | Where-Object { $_.deduplication.normalized_overlap_with_existing_kisa_300 }).Count
        review_status = 'all_records_need_review'
        training_eligible_records = 0
    }
    records = @($records)
}

$outputDirectory = Split-Path -Parent $OutputPath
[System.IO.Directory]::CreateDirectory($outputDirectory) | Out-Null
[System.IO.File]::WriteAllText(
    $OutputPath,
    ($document | ConvertTo-Json -Depth 20),
    $utf8NoBom
)

Write-Host "생성 완료: $OutputPath"
Write-Host "전체 레코드: $($records.Count)"
Write-Host "4단계 의도 분석 1차 후보: $($usageCounts.stage_4_intent_risk_candidate)"
Write-Host "6단계 사후 대응 1차 후보: $($usageCounts.stage_6_golden_time_candidate)"
Write-Host "정상·무관 대조 후보: $($usageCounts.normal_or_irrelevant_control_candidate)"
Write-Host "기존 300건 정규화 중복: $(@($records | Where-Object { $_.deduplication.normalized_overlap_with_existing_kisa_300 }).Count)"
