param(
  [Parameter(Mandatory = $true)]
  [string]$ZipPath,

  [string]$OutputPath = (Join-Path $PSScriptRoot "processed\kisa-consultations.json")
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.IO.Compression.FileSystem

$keywords = @(
  "보이스피싱", "피싱", "스미싱", "송금", "계좌", "검찰", "경찰",
  "금융", "앱", "수수료", "안전계좌", "해킹", "개인정보", "문자", "링크"
)

function Protect-SensitiveText([string]$Text) {
  $protected = $Text
  $protected = $protected -replace '(?<!\d)\d{6}-[1-4]\d{6}(?!\d)', '[RRN]'
  $protected = $protected -replace '(?<!\d)0\d{1,3}-\d{3,4}-\d{4}(?!\d)', '[PHONE]'
  $protected = $protected -replace '(?i)\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b', '[EMAIL]'
  $protected = $protected -replace '(?i)https?://\S+|www\.\S+', '[URL]'
  $protected = $protected -replace '(?m)^(상담센터|민원 담당)\s+[가-힣]{2,4}', '$1 [COUNSELOR]'
  return $protected.Trim()
}

if (-not (Test-Path -LiteralPath $ZipPath)) {
  throw "ZIP 파일을 찾을 수 없습니다: $ZipPath"
}

$records = [System.Collections.Generic.List[object]]::new()
$zip = [IO.Compression.ZipFile]::OpenRead($ZipPath)

try {
  foreach ($entry in ($zip.Entries | Where-Object { $_.Name -like '*.synth' } | Sort-Object Name)) {
    $reader = [IO.StreamReader]::new($entry.Open(), [Text.Encoding]::UTF8, $true)
    try {
      $transcript = Protect-SensitiveText $reader.ReadToEnd()
    }
    finally {
      $reader.Dispose()
    }

    $matchedKeywords = @($keywords | Where-Object { $transcript.Contains($_) })
    $records.Add([ordered]@{
      id = [IO.Path]::GetFileNameWithoutExtension($entry.Name)
      source_file = $entry.Name
      transcript = $transcript
      matched_keywords = $matchedKeywords
      annotation = [ordered]@{
        reviewed = $false
        relevant_to_transfer_intent = $null
        fraud_type = $null
        signals = @()
      }
    })
  }
}
finally {
  $zip.Dispose()
}

$dataset = [ordered]@{
  dataset_name = "과학기술정보통신부 스팸·해킹·피싱 전화상담 데이터셋 3종"
  project_name = "KISA 피싱 전화상담 합성데이터"
  source_format = ".synth plain text"
  source_period = "2023-06~2023-12"
  source_reference_date = "2025-09-23"
  converted_at = (Get-Date).ToString("o")
  redaction_applied = $true
  record_count = $records.Count
  records = $records
}

$outputDirectory = Split-Path -Parent $OutputPath
New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
$dataset | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $OutputPath -Encoding utf8NoBOM

Write-Output "Converted $($records.Count) records to $OutputPath"
