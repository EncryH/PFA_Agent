"""공식 PDF 8종을 페이지 단위 RAG JSON으로 변환한다.

원본 PDF는 저장소 밖에 둔다. 기본 추출은 pypdf를 사용하고, 텍스트 레이어가
없는 페이지는 --gemini-image-summary 옵션을 준 경우에만 Gemini가 이미지에
보이는 금융사기 관련 내용을 요약한다. 이 결과는 원문 OCR이 아니라 검수 대상
요약임을 메타데이터에 명확히 남긴다.
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import io
import json
import os
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

from pypdf import PdfReader


AGENT_ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = Path(__file__).resolve().parents[4]
DEFAULT_MANIFEST = AGENT_ROOT / "datasets" / "rag" / "input" / "pdf-manifest.json"
DEFAULT_OUTPUT = AGENT_ROOT / "datasets" / "rag" / "input" / "pdf-pages.json"
MIN_TEXT_LENGTH = 40


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="PDF 8종 페이지 단위 RAG 데이터 생성")
    parser.add_argument(
        "--source-dir",
        default=os.environ.get("PDF_SOURCE_DIR", str(Path.home() / "OneDrive" / "Desktop")),
        help="원본 PDF가 있는 폴더",
    )
    parser.add_argument("--manifest", default=str(DEFAULT_MANIFEST))
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT))
    parser.add_argument(
        "--gemini-image-summary",
        action="store_true",
        help="텍스트 레이어가 없는 페이지를 Gemini 이미지 요약으로 보완",
    )
    return parser.parse_args()


def load_dotenv(path: Path) -> None:
    if not path.exists():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key.strip(), value)


def normalize_text(value: str | None) -> str:
    text = unicodedata.normalize("NFKC", value or "").replace("\x00", "")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n[ \t]+", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def relevant_page_indexes(pages: list[dict], selection: dict) -> set[int]:
    if selection.get("mode") == "all_text_pages":
        return {page["index"] for page in pages if len(page["text"]) >= MIN_TEXT_LENGTH}

    keywords = [normalize_text(keyword).lower() for keyword in selection.get("keywords", [])]
    neighbors = max(0, int(selection.get("neighbor_pages", 0)))
    matched = {
        page["index"]
        for page in pages
        if any(keyword in page["text"].lower() for keyword in keywords)
    }
    selected: set[int] = set()
    for index in matched:
        for candidate in range(max(0, index - neighbors), min(len(pages), index + neighbors + 1)):
            if len(pages[candidate]["text"]) >= MIN_TEXT_LENGTH:
                selected.add(candidate)
    return selected


def render_page_as_jpeg(pdf_path: Path, page_index: int) -> bytes:
    import pypdfium2 as pdfium

    document = pdfium.PdfDocument(str(pdf_path))
    try:
        image = document[page_index].render(scale=1.6).to_pil().convert("RGB")
        if image.width > 1800:
            ratio = 1800 / image.width
            image = image.resize((1800, max(1, int(image.height * ratio))))
        buffer = io.BytesIO()
        image.save(buffer, format="JPEG", quality=84, optimize=True)
        return buffer.getvalue()
    finally:
        document.close()


def gemini_image_summary(pdf_path: Path, page_index: int, api_key: str, model: str) -> str:
    image_data = base64.b64encode(render_page_as_jpeg(pdf_path, page_index)).decode("ascii")
    prompt = (
        "이 이미지는 한국 공식기관이 발행한 금융사기 PDF의 한 페이지입니다. "
        "이미지에서 실제로 읽을 수 있는 내용만 사용해 RAG 검색용 한국어 텍스트를 작성하세요. "
        "금융사기 유형, 접근 경로, 사칭 대상, 요구 행동, 송금 유도 문구, 위험 징후, 예방 방법, "
        "피해 대응이 있으면 빠뜨리지 마세요. 장식과 페이지 번호는 제외하고, 보이지 않는 사실은 "
        "추가하지 마세요. 문장형 평문으로 최대 1800자만 출력하세요."
    )
    payload = {
        "contents": [{
            "role": "user",
            "parts": [
                {"text": prompt},
                {"inlineData": {"mimeType": "image/jpeg", "data": image_data}},
            ],
        }],
        "generationConfig": {
            "temperature": 0,
            "maxOutputTokens": 2500,
            "thinkingConfig": {"thinkingLevel": "minimal"},
        },
    }
    endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
    request = urllib.request.Request(
        endpoint,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    for attempt in range(4):
        try:
            with urllib.request.urlopen(request, timeout=120) as response:
                data = json.load(response)
            parts = data.get("candidates", [{}])[0].get("content", {}).get("parts", [])
            return normalize_text("\n".join(part.get("text", "") for part in parts))
        except urllib.error.HTTPError as error:
            if error.code not in {429, 503} or attempt == 3:
                detail = error.read().decode("utf-8", errors="replace")[:300]
                raise RuntimeError(f"Gemini 이미지 요약 실패({error.code}): {detail}") from error
            time.sleep(2 ** (attempt + 1))
    return ""


def extract_document(document: dict, source_dir: Path, use_gemini: bool, api_key: str, model: str) -> tuple[list[dict], dict]:
    pdf_path = source_dir / document["file_name"]
    if not pdf_path.exists():
        raise FileNotFoundError(f"PDF 원본 없음: {pdf_path}")

    reader = PdfReader(str(pdf_path))
    page_labels = getattr(reader, "page_labels", []) or []
    pages: list[dict] = []
    image_summary_pages = 0
    image_summary_failures: list[int] = []

    for index, page in enumerate(reader.pages):
        try:
            text = normalize_text(page.extract_text())
        except Exception as error:  # 손상된 한 페이지가 전체 변환을 막지 않게 한다.
            print(f"[pdf] {document['document_id']} p.{index + 1} 텍스트 추출 실패: {error}", file=sys.stderr)
            text = ""

        extraction_method = "pypdf_text_layer"
        review_status = "official_source_extracted"
        if len(text) < MIN_TEXT_LENGTH and use_gemini:
            try:
                text = gemini_image_summary(pdf_path, index, api_key, model)
                if len(text) >= MIN_TEXT_LENGTH:
                    extraction_method = "gemini_image_summary"
                    review_status = "official_source_llm_summary_needs_review"
                    image_summary_pages += 1
            except Exception as error:
                image_summary_failures.append(index + 1)
                print(f"[pdf] {document['document_id']} p.{index + 1} 이미지 요약 실패: {error}", file=sys.stderr)

        pages.append({
            "index": index,
            "page": index + 1,
            "page_label": str(page_labels[index]) if index < len(page_labels) else str(index + 1),
            "text": text,
            "extraction_method": extraction_method,
            "review_status": review_status,
        })
        if (index + 1) % 20 == 0 or index + 1 == len(reader.pages):
            print(f"[pdf] {document['document_id']} {index + 1}/{len(reader.pages)}")

    selected = relevant_page_indexes(pages, document.get("selection", {}))
    records = []
    for page in pages:
        if page["index"] not in selected:
            continue
        text_hash = hashlib.sha256(page["text"].encode("utf-8")).hexdigest()
        records.append({
            "id": f"{document['document_id']}:p{page['page']:04d}",
            "kind": "official_fraud_document",
            "source_dataset": "official_financial_fraud_pdf_8",
            "review_status": page["review_status"],
            "document_id": document["document_id"],
            "title": document["title"],
            "publisher": document["publisher"],
            "source_file": document["file_name"],
            "source_url": document["source_url"],
            "usage": document["usage"],
            "page": page["page"],
            "page_label": page["page_label"],
            "total_pages": len(reader.pages),
            "extraction_method": page["extraction_method"],
            "text_sha256": text_hash,
            "text": page["text"],
        })

    summary = {
        "document_id": document["document_id"],
        "file_name": document["file_name"],
        "source_sha256": sha256_file(pdf_path),
        "total_pages": len(reader.pages),
        "text_layer_pages": sum(page["extraction_method"] == "pypdf_text_layer" and len(page["text"]) >= MIN_TEXT_LENGTH for page in pages),
        "image_summary_pages": image_summary_pages,
        "selected_pages": len(records),
        "unusable_pages": sum(len(page["text"]) < MIN_TEXT_LENGTH for page in pages),
        "image_summary_failures": image_summary_failures,
        "selection_mode": document.get("selection", {}).get("mode", "all_text_pages"),
    }
    return records, summary


def main() -> None:
    args = parse_args()
    source_dir = Path(args.source_dir).expanduser().resolve()
    manifest_path = Path(args.manifest).resolve()
    output_path = Path(args.output).resolve()
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))

    load_dotenv(PROJECT_ROOT / ".env")
    api_key = os.environ.get("GEMINI_API_KEY", "")
    model = os.environ.get("GEMINI_OCR_MODEL") or os.environ.get("GEMINI_MODEL") or "gemini-3.6-flash"
    if args.gemini_image_summary and not api_key:
        raise RuntimeError("--gemini-image-summary 사용 시 루트 .env의 GEMINI_API_KEY가 필요합니다")

    records: list[dict] = []
    document_summaries: list[dict] = []
    for document in manifest["documents"]:
        extracted, summary = extract_document(document, source_dir, args.gemini_image_summary, api_key, model)
        records.extend(extracted)
        document_summaries.append(summary)

    output = {
        "schema_version": "1.0.0",
        "dataset_name": manifest["dataset_name"],
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "generation": {
            "source_directory_stored": False,
            "manifest": manifest_path.name,
            "text_extractor": "pypdf",
            "image_summary_enabled": args.gemini_image_summary,
            "image_summary_model": model if args.gemini_image_summary else None,
            "minimum_text_characters": MIN_TEXT_LENGTH,
        },
        "cautions": [
            "원본 PDF는 저장소에 포함하지 않으며 파일명·해시·공식 URL만 기록한다.",
            "PDF 페이지 번호는 PDF 뷰어 기준이며 인쇄된 면 번호와 다를 수 있다.",
            "gemini_image_summary 페이지는 원문 OCR이 아닌 이미지 기반 요약이므로 검수 전 직접 인용하지 않는다.",
            "공식 문서 검색 결과는 설명 근거이며 최종 위험도는 현재 대화의 규칙 신호로 판정한다."
        ],
        "summary": {
            "documents": len(manifest["documents"]),
            "selected_pages": len(records),
            "image_summary_pages": sum(item["image_summary_pages"] for item in document_summaries),
            "unusable_pages": sum(item["unusable_pages"] for item in document_summaries),
        },
        "documents": document_summaries,
        "records": records,
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"output": str(output_path), **output["summary"]}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
