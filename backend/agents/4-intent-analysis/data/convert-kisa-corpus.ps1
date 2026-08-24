param(
    [string]$Set1Zip = "C:\Users\khm35\Downloads\과학기술정보통신부_스팸해킹피싱 전화상담 데이터셋 1종_20250923.zip",
    [string]$Set2Zip = "C:\Users\khm35\Downloads\과학기술정보통신부_스팸해킹피싱 전화상담 데이터셋 2종_20250923.zip",
    [string]$Set3Zip = "C:\Users\khm35\Downloads\과학기술정보통신부_스팸해킹피싱 전화상담 데이터셋 3종_20250923.zip",
    [string]$OutputRoot = "$PSScriptRoot\processed\kisa-corpus"
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.IO.Compression.FileSystem

$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
$sha256 = [System.Security.Cryptography.SHA256]::Create()
$keywords = @(
    "보이스피싱", "피싱", "스미싱", "송금", "계좌", "검찰", "경찰",
    "금융", "앱", "수수료", "안전계좌", "해킹", "개인정보", "문자", "링크"
)

$definitions = @(
    [ordered]@{
        set = 1
        zip_path = $Set1Zip
        source_url = "https://www.data.go.kr/data/15150829/fileData.do"
    },
    [ordered]@{
        set = 2
        zip_path = $Set2Zip
        source_url = "https://www.data.go.kr/data/15150830/fileData.do"
    },
    [ordered]@{
        set = 3
        zip_path = $Set3Zip
        source_url = "https://www.data.go.kr/data/15150832/fileData.do"
    }
)

function Protect-SensitiveText([AllowNull()][string]$Text) {
    if ([string]::IsNullOrEmpty($Text)) { return $Text }

    $protected = $Text
    $protected = [regex]::Replace($protected, '(?<!\d)\d{6}-[1-4]\d{6}(?!\d)', '[RRN]')
    $protected = [regex]::Replace($protected, '(?<!\d)0\d{1,3}-\d{3,4}-\d{4}(?!\d)', '[PHONE]')
    $protected = [regex]::Replace($protected, '(?i)\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b', '[EMAIL]')
    $protected = [regex]::Replace($protected, '(?i)https?://\S+|www\.\S+', '[URL]')
    $protected = [regex]::Replace($protected, '(?<!\d)(?:\d[ -]?){10,16}(?!\d)', '[ACCOUNT_OR_NUMBER]')
    $protected = [regex]::Replace($protected, '(?<!\d)(?:\d{1,3}\.){3}\d{1,3}(?!\d)', '[IP]')
    $protected = [regex]::Replace($protected, '(?m)^(상담센터|민원 담당)\s+[가-힣]{2,4}', '$1 [COUNSELOR]')
    return $protected.Trim()
}

function Get-Hash([string]$Text) {
    return [Convert]::ToHexString($sha256.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($Text))).ToLowerInvariant()
}

function Get-NormalizedText([string]$Text) {
    $normalized = $Text.Normalize().ToLowerInvariant()
    $normalized = [regex]::Replace($normalized, '\[(phone|rrn|email|url|account_or_number|ip|counselor)\]', '[redacted]')
    $normalized = [regex]::Replace($normalized, '[\s\p{P}\p{S}]+', '')
    return $normalized
}

function Write-PrettyJson([string]$Path, [object]$Value) {
    $directory = Split-Path -Parent $Path
    [System.IO.Directory]::CreateDirectory($directory) | Out-Null
    [System.IO.File]::WriteAllText($Path, ($Value | ConvertTo-Json -Depth 15), $utf8NoBom)
}

foreach ($definition in $definitions) {
    if (-not (Test-Path -LiteralPath $definition.zip_path)) {
        throw "KISA $($definition.set)종 ZIP 파일을 찾을 수 없습니다: $($definition.zip_path)"
    }
}

$allRecords = [System.Collections.Generic.List[object]]::new()
$setDocuments = @{}

foreach ($definition in $definitions) {
    $records = [System.Collections.Generic.List[object]]::new()
    $zip = [System.IO.Compression.ZipFile]::OpenRead($definition.zip_path)
    try {
        foreach ($entry in ($zip.Entries | Where-Object { $_.Name -like '*.synth' } | Sort-Object Name)) {
            $reader = [System.IO.StreamReader]::new($entry.Open(), [System.Text.Encoding]::UTF8, $true)
            try {
                $transcript = Protect-SensitiveText $reader.ReadToEnd()
            }
            finally {
                $reader.Dispose()
            }

            $sourceId = [System.IO.Path]::GetFileNameWithoutExtension($entry.Name)
            $normalizedTranscript = Get-NormalizedText $transcript
            $record = [ordered]@{
                schema_version = '1.0.0'
                record_id = "kisa-$($definition.set)-$sourceId"
                source_id = $sourceId
                source_set = [int]$definition.set
                source_file = $entry.Name
                source_url = $definition.source_url
                synthetic = $true
                transcript = $transcript
                matched_keywords = @($keywords | Where-Object { $transcript.Contains($_) })
                deduplication = [ordered]@{
                    content_hash_sha256 = Get-Hash $transcript
                    normalized_content_hash_sha256 = Get-Hash $normalizedTranscript
                    duplicate_of = $null
                }
                annotation = [ordered]@{
                    reviewed = $false
                    relevant_to_transfer_intent = $null
                    fraud = $null
                    fraud_type = @()
                    channel = @()
                    impersonation = @()
                    requested_action = @()
                    risk_signals = @()
                    attack_stage = 'unknown'
                }
            }
            $records.Add($record)
            $allRecords.Add($record)
        }
    }
    finally {
        $zip.Dispose()
    }

    $setDocuments[[int]$definition.set] = [ordered]@{
        schema_version = '1.0.0'
        dataset_name = "과학기술정보통신부 스팸·해킹·피싱 전화상담 데이터셋 $($definition.set)종"
        project_name = 'KISA 전화상담 합성데이터 통합 Corpus'
        source_format = '.synth plain text'
        source_period = '2023-06~2023-12'
        source_reference_date = '2025-09-23'
        source_url = $definition.source_url
        synthetic = $true
        redaction_applied = $true
        record_count = $records.Count
        records = $records
    }
}

$idDuplicateGroups = @($allRecords | Group-Object { $_.source_id } | Where-Object Count -gt 1)
$exactDuplicateGroups = @($allRecords | Group-Object { $_.deduplication.content_hash_sha256 } | Where-Object Count -gt 1)
$normalizedDuplicateGroups = @($allRecords | Group-Object { $_.deduplication.normalized_content_hash_sha256 } | Where-Object Count -gt 1)

foreach ($group in $normalizedDuplicateGroups) {
    $ordered = @($group.Group | Sort-Object source_set, source_id)
    $canonicalId = $ordered[0].record_id
    foreach ($duplicate in ($ordered | Select-Object -Skip 1)) {
        $duplicate.deduplication.duplicate_of = $canonicalId
    }
}

$uniqueRecords = @($allRecords | Where-Object { $null -eq $_.deduplication.duplicate_of } | Sort-Object source_set, source_id)
$duplicateDetails = @($normalizedDuplicateGroups | ForEach-Object {
    [ordered]@{
        normalized_content_hash_sha256 = $_.Name
        records = @($_.Group | Sort-Object source_set, source_id | ForEach-Object { $_.record_id })
    }
})

[System.IO.Directory]::CreateDirectory($OutputRoot) | Out-Null
foreach ($setNumber in 1..3) {
    Write-PrettyJson (Join-Path $OutputRoot "kisa-set-$setNumber.json") $setDocuments[$setNumber]
}

$integratedDocument = [ordered]@{
    schema_version = '1.0.0'
    dataset_name = '과학기술정보통신부 스팸·해킹·피싱 전화상담 통합 KISA Corpus'
    source_sets = @(1, 2, 3)
    source_period = '2023-06~2023-12'
    source_reference_date = '2025-09-23'
    synthetic = $true
    redaction_applied = $true
    total_source_records = $allRecords.Count
    unique_record_count = $uniqueRecords.Count
    records = $uniqueRecords
}
Write-PrettyJson (Join-Path $OutputRoot 'kisa-integrated-corpus.json') $integratedDocument

$manifest = [ordered]@{
    schema_version = '1.0.0'
    dataset_name = '통합 KISA 전화상담 Corpus 매니페스트'
    generated_at = (Get-Date).ToString('o')
    source_sets = @($definitions | ForEach-Object {
        [ordered]@{
            set = $_.set
            zip_file = [System.IO.Path]::GetFileName($_.zip_path)
            source_url = $_.source_url
            record_count = $setDocuments[[int]$_.set].record_count
        }
    })
    deduplication = [ordered]@{
        criteria = @(
            'source_id exact match',
            'protected transcript SHA-256 exact match',
            'whitespace and punctuation normalized transcript SHA-256 match'
        )
        duplicate_id_groups = $idDuplicateGroups.Count
        exact_content_duplicate_groups = $exactDuplicateGroups.Count
        normalized_content_duplicate_groups = $normalizedDuplicateGroups.Count
        duplicate_details = $duplicateDetails
    }
    totals = [ordered]@{
        source_records = $allRecords.Count
        unique_records = $uniqueRecords.Count
        removed_as_duplicates = $allRecords.Count - $uniqueRecords.Count
    }
    files = @(
        'kisa-set-1.json',
        'kisa-set-2.json',
        'kisa-set-3.json',
        'kisa-integrated-corpus.json',
        'near-duplicate-report.json'
    )
}
Write-PrettyJson (Join-Path $OutputRoot 'manifest.json') $manifest

Write-Host "완료: 원본 $($allRecords.Count)건, 고유 $($uniqueRecords.Count)건"
Write-Host "ID 중복 그룹: $($idDuplicateGroups.Count)"
Write-Host "원문 중복 그룹: $($exactDuplicateGroups.Count)"
Write-Host "정규화 중복 그룹: $($normalizedDuplicateGroups.Count)"
Write-Host "출력 경로: $OutputRoot"
