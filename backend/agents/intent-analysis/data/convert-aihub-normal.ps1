param(
    [string]$InputRoot = "C:\Users\khm35\Downloads\25.금융분야 고객상담 데이터",
    [string]$OutputRoot = "$PSScriptRoot\processed\aihub-normal-finance",
    [int]$ChunkSize = 2000
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.IO.Compression.FileSystem

$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
$sourceUrl = "https://aihub.or.kr/aihubdata/data/view.do?currMenu=115&dataSetSn=71926&topMenu=100"

function Protect-Text([AllowNull()][string]$Text) {
    if ([string]::IsNullOrEmpty($Text)) { return $Text }

    $protected = $Text
    $protected = [regex]::Replace($protected, '(?<!\d)01[016789]-?\d{3,4}-?\d{4}(?!\d)', '[PHONE]')
    $protected = [regex]::Replace($protected, '(?<!\d)\d{6}-[1-4]\d{6}(?!\d)', '[RRN]')
    $protected = [regex]::Replace($protected, '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', '[EMAIL]')
    $protected = [regex]::Replace($protected, 'https?://[^\s"''<>]+', '[URL]')
    $protected = [regex]::Replace($protected, '(?<!\d)(?:\d[ -]?){10,16}(?!\d)', '[ACCOUNT_OR_NUMBER]')
    return $protected
}

function Get-NormalAction([string]$Category, [string]$Topic) {
    $key = "$Category|$Topic"
    $map = @{
        '은행|거래내역/잔액조회' = 'transaction_or_balance_inquiry'
        '은행|중계요청/착오송금' = 'erroneous_transfer_support'
        '은행|자동이체조회' = 'automatic_transfer_management'
        '은행|만기,연장/해지,수신' = 'deposit_maturity_or_termination'
        '은행|금융거래한도/비대면한도계좌' = 'transaction_limit_management'
        '은행|이자/연체금액' = 'interest_or_overdue_payment'
        '은행|부수거래금리감면' = 'preferential_rate_management'
        '은행|대출문의(만기/연장/조회등)' = 'loan_inquiry_or_management'
        '은행|환전문의' = 'currency_exchange'
        '보험|자동차보험상담' = 'vehicle_insurance_management'
        '보험|자동차사고접수' = 'accident_report'
        '보험|계약내용변경/해지' = 'insurance_contract_management'
        '보험|기타계약관련문의' = 'insurance_inquiry'
        '보험|보험금청구/확인' = 'insurance_claim'
        '보험|보험금청구' = 'insurance_claim'
        '증권|HTS/MTS' = 'trading_app_support'
        '증권|계좌관리' = 'securities_account_management'
        '증권|신용거래/담보대출' = 'credit_or_collateral_loan'
        '증권|자금이체/계좌제한' = 'funds_transfer_or_account_restriction'
        '증권|절세형금융상품' = 'tax_advantaged_product'
        '증권|주식주문' = 'stock_order'
        '증권|증권계좌조회' = 'securities_account_inquiry'
        '증권|해외주문' = 'overseas_order'
    }

    if ($map.ContainsKey($key)) { return $map[$key] }
    return 'general_financial_consultation'
}

function Write-JsonChunk([string]$Directory, [string]$Prefix, [int]$Index, [object[]]$Records) {
    if ($Records.Count -eq 0) { return $null }

    [System.IO.Directory]::CreateDirectory($Directory) | Out-Null
    $name = '{0}-{1:D4}.json' -f $Prefix, $Index
    $path = Join-Path $Directory $name
    $document = [ordered]@{
        schema_version = '1.0.0'
        dataset = 'AI Hub 금융분야 고객상담 데이터'
        record_count = $Records.Count
        records = $Records
    }
    [System.IO.File]::WriteAllText($path, ($document | ConvertTo-Json -Depth 15), $utf8NoBom)
    return [ordered]@{
        file = $path.Substring($OutputRoot.Length + 1).Replace('\', '/')
        record_count = $Records.Count
        bytes = (Get-Item -LiteralPath $path).Length
    }
}

if (-not (Test-Path -LiteralPath $InputRoot)) {
    throw "AI Hub 데이터 폴더를 찾을 수 없습니다: $InputRoot"
}

[System.IO.Directory]::CreateDirectory($OutputRoot) | Out-Null
$conversationDir = Join-Path $OutputRoot 'conversations'
$qaDir = Join-Path $OutputRoot 'qa'

$zipDefinitions = @(
    @{ Name = 'TL_은행.zip'; Split = 'training'; Domain = 'bank' },
    @{ Name = 'TL_보험.zip'; Split = 'training'; Domain = 'insurance' },
    @{ Name = 'TL_증권.zip'; Split = 'training'; Domain = 'securities' },
    @{ Name = 'VL_은행.zip'; Split = 'validation'; Domain = 'bank' },
    @{ Name = 'VL_보험.zip'; Split = 'validation'; Domain = 'insurance' },
    @{ Name = 'VL_증권.zip'; Split = 'validation'; Domain = 'securities' }
)

$manifestParts = @()
$totalConversations = 0
$totalConversationEntries = 0
$totalQa = 0
$globalSourceSplits = @{}
$overlapSources = [System.Collections.Generic.HashSet[string]]::new()

foreach ($definition in $zipDefinitions) {
    $zipFile = Get-ChildItem -LiteralPath $InputRoot -Recurse -File -Filter $definition.Name | Select-Object -First 1
    if ($null -eq $zipFile) { throw "필수 라벨 ZIP을 찾을 수 없습니다: $($definition.Name)" }

    Write-Host "처리 중: $($definition.Name)"
    $zip = [System.IO.Compression.ZipFile]::OpenRead($zipFile.FullName)
    $seenSources = [System.Collections.Generic.HashSet[string]]::new()
    $conversationBuffer = [System.Collections.Generic.List[object]]::new()
    $qaBuffer = [System.Collections.Generic.List[object]]::new()
    $conversationChunks = @()
    $qaChunks = @()
    $conversationChunkIndex = 1
    $qaChunkIndex = 1
    $partConversationCount = 0
    $partSourceEntryCount = 0
    $partQaCount = 0

    try {
        foreach ($entry in $zip.Entries) {
            if (-not $entry.Name.EndsWith('.json', [System.StringComparison]::OrdinalIgnoreCase)) { continue }

            $stream = $entry.Open()
            $reader = [System.IO.StreamReader]::new($stream, [System.Text.Encoding]::UTF8)
            try {
                $item = $reader.ReadToEnd() | ConvertFrom-Json
            }
            finally {
                $reader.Dispose()
                $stream.Dispose()
            }

            $sourceId = [string]$item.source.source_id
            $category = [string]$item.consulting.consulting_category
            $topic = [string]$item.consulting.consulting_topic
            $effectiveSplit = $definition.Split

            if ($globalSourceSplits.ContainsKey($sourceId) -and $globalSourceSplits[$sourceId] -ne $definition.Split) {
                $effectiveSplit = 'excluded_overlap'
                $overlapSources.Add($sourceId) | Out-Null
            }
            elseif (-not $globalSourceSplits.ContainsKey($sourceId)) {
                $globalSourceSplits[$sourceId] = $definition.Split
            }

            $isNewSourceInPart = $seenSources.Add($sourceId)
            if ($isNewSourceInPart) {
                $partSourceEntryCount++
            }

            if ($isNewSourceInPart -and $effectiveSplit -ne 'excluded_overlap') {
                $conversationBuffer.Add([ordered]@{
                    schema_version = '1.0.0'
                    source_id = $sourceId
                    split = $effectiveSplit
                    domain = $definition.Domain
                    source = [ordered]@{
                        institution = [string]$item.source.source_institution
                        date = [string]$item.source.source_date
                        client_gender = [string]$item.source.client_gender
                        client_age = [string]$item.source.client_age
                        consulting_client = [string]$item.source.consulting_client
                        consulting_client_type = if ($null -eq $item.source.consulting_client_type) { $null } else { [string]$item.source.consulting_client_type }
                        source_length = [int]$item.source.source_length
                    }
                    consulting = [ordered]@{
                        category = $category
                        topic = $topic
                        summary = Protect-Text ([string]$item.consulting.consulting_summary)
                        content = Protect-Text ([string]$item.source.consulting_content)
                    }
                    control_label = [ordered]@{
                        fraud = $false
                        intent_class = 'normal_financial_service'
                        channel = @('phone')
                        impersonation = @('none')
                        interaction_context = 'official_financial_customer_service'
                        interaction_direction = 'customer_to_financial_institution'
                        action_requester = 'customer'
                        action_target = 'financial_institution'
                        risk_signals = @()
                        attack_stage = 'not_applicable'
                        label_source = 'dataset_role_assumption'
                    }
                })
                $partConversationCount++

                if ($conversationBuffer.Count -ge $ChunkSize) {
                    $chunk = Write-JsonChunk $conversationDir "$($definition.Split)-$($definition.Domain)" $conversationChunkIndex $conversationBuffer.ToArray()
                    $conversationChunks += $chunk
                    $conversationBuffer.Clear()
                    $conversationChunkIndex++
                }
            }

            foreach ($qa in @($item.qa_data)) {
                if ($null -eq $qa) { continue }
                $normalAction = Get-NormalAction $category ([string]$qa.qa_topic)
                $qaBuffer.Add([ordered]@{
                    schema_version = '1.0.0'
                    record_id = [string]$qa.qa_id
                    source_id = $sourceId
                    split = $effectiveSplit
                    domain = $definition.Domain
                    normal_intent = [ordered]@{
                        fraud = $false
                        intent_class = 'normal_financial_service'
                        financial_category = $category
                        financial_topic = [string]$qa.qa_topic
                        financial_purpose = Protect-Text ([string]$qa.consulting_purpose)
                        channel = @('phone')
                        impersonation = @('none')
                        requested_action = @($normalAction)
                        interaction_context = 'official_financial_customer_service'
                        interaction_direction = 'customer_to_financial_institution'
                        action_requester = 'customer'
                        action_target = 'financial_institution'
                        risk_signals = @()
                        attack_stage = 'not_applicable'
                        label_source = 'aihub_financial_consultation_metadata'
                        partition_status = if ($effectiveSplit -eq 'excluded_overlap') { 'excluded_cross_split_overlap' } else { 'included' }
                    }
                    annotation = [ordered]@{
                        task_category = [string]$qa.task_category
                        consulting_situation = [string]$qa.consulting_situation
                        qa_topic = [string]$qa.qa_topic
                        consulting_purpose = Protect-Text ([string]$qa.consulting_purpose)
                        core_financial_terms = Protect-Text ([string]$qa.core_financial_terms)
                        input_length = [int]$qa.input_length
                    }
                    instruction = Protect-Text ([string]$qa.instruction)
                    conversation = [ordered]@{
                        customer_question = Protect-Text ([string]$qa.input.question)
                        official_answer = Protect-Text ([string]$qa.input.answer)
                        customer_follow_up_question = Protect-Text ([string]$qa.input.follow_up_question)
                    }
                    expected_output = Protect-Text ([string]$qa.output)
                })
                $partQaCount++

                if ($qaBuffer.Count -ge $ChunkSize) {
                    $chunk = Write-JsonChunk $qaDir "$($definition.Split)-$($definition.Domain)" $qaChunkIndex $qaBuffer.ToArray()
                    $qaChunks += $chunk
                    $qaBuffer.Clear()
                    $qaChunkIndex++
                }
            }
        }
    }
    finally {
        $zip.Dispose()
    }

    if ($conversationBuffer.Count -gt 0) {
        $conversationChunks += Write-JsonChunk $conversationDir "$($definition.Split)-$($definition.Domain)" $conversationChunkIndex $conversationBuffer.ToArray()
    }
    if ($qaBuffer.Count -gt 0) {
        $qaChunks += Write-JsonChunk $qaDir "$($definition.Split)-$($definition.Domain)" $qaChunkIndex $qaBuffer.ToArray()
    }

    $totalConversations += $partConversationCount
    $totalConversationEntries += $partSourceEntryCount
    $totalQa += $partQaCount
    $manifestParts += [ordered]@{
        source_zip = $definition.Name
        split = $definition.Split
        domain = $definition.Domain
        source_entries = $partSourceEntryCount
        conversations = $partConversationCount
        qa_records = $partQaCount
        conversation_chunks = $conversationChunks
        qa_chunks = $qaChunks
    }
}

$manifest = [ordered]@{
    schema_version = '1.0.0'
    dataset = 'AI Hub 금융분야 고객상담 데이터 — 정상 금융대화 대조군'
    source_url = $sourceUrl
    generated_at = (Get-Date).ToString('o')
    purpose = '정상 금융 목적의 대화와 사기성 행동 유도 대화의 차이를 비교하기 위한 정상 대조군'
    source_scope = [ordered]@{
        downloaded_label_records = $totalQa
        official_total_label_records = 100000
        note = '현재 다운로드 폴더에 포함된 Training 80,000건과 Validation 10,000건만 변환함'
    }
    labels = [ordered]@{
        fraud = $false
        intent_class = 'normal_financial_service'
        interaction_context = 'official_financial_customer_service'
        interaction_direction = 'customer_to_financial_institution'
        label_caution = 'fraud=false는 데이터셋의 정상 금융상담 대조군 역할에 따른 데이터셋 수준 라벨이며 개별 사례를 사람이 재판정한 결과가 아님'
    }
    totals = [ordered]@{
        conversation_source_entries = $totalConversationEntries
        conversations = $totalConversations
        qa_records = $totalQa
        cross_split_overlap_sources = $overlapSources.Count
    }
    parts = $manifestParts
}

$manifestPath = Join-Path $OutputRoot 'manifest.json'
[System.IO.File]::WriteAllText($manifestPath, ($manifest | ConvertTo-Json -Depth 12), $utf8NoBom)
Write-Host "완료: 대화 $totalConversations 건, QA $totalQa 건"
Write-Host "매니페스트: $manifestPath"
