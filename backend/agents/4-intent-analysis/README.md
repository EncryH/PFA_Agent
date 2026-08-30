# 4단계 사기 송금 의도 분석

송금 목적을 대화로 확인하고, 유사 금융사기·정상 금융상담 근거와 비교해 위험 신호를 추출하는 에이전트다. Gemini는 신호와 설명을 구조화하고, 최종 점수와 송금 보류 여부는 서버 규칙 엔진이 결정한다.

> 핵심 원칙: **Rules decide, AI explains.**
> RAG는 모델을 추가 학습하는 기능이 아니라, 현재 대화와 가까운 근거를 검색해 Gemini 입력에 보강하는 기능이다.

## 전체 설계

![사기 송금 의도 분석 파이프라인](./assets/intent-analysis-pipeline.png)

그림은 최종 목표 아키텍처다. 현재는 **개인정보 전처리 → JSON·PDF RAG Vector Search → Gemini 분석 → 규칙 엔진 → 근거 기반 Gemini 답변 → 출력 검증**까지 구현됐다.

| 구성 | 현재 상태 |
|---|---|
| 개인정보 전처리 | 구현 |
| JSON 사례 Vector Search | 구현 |
| Gemini 근거 결합·구조화 분석 | 구현 |
| 판정 후 맞춤형 자연어 답변 | 구현 |
| 출처 노출·과장·필수 행동 검증 | 구현 |
| 규칙 엔진 위험도·보류 판정 | 구현 |
| PDF 8개 페이지 단위 RAG | 구현 |
| Knowledge Graph | 예정 |
| 개인 거래 패턴 Text2SQL | 예정 |

## 현재 실행 로직

1. **입력 수신**
   송금 금액·신규 수취인 여부·통화 중 여부와 부모님-AI 대화를 받는다.

2. **개인정보 전처리**
   전화번호, 주민번호, 계좌 형태의 긴 번호, 이메일, URL을 마스킹한다. 수취인·계좌 원문은 Gemini와 검색기에 전달하지 않는다.

3. **검색 질문 생성**
   마스킹한 사용자 답변에 `고액 송금`, `처음 보내는 계좌`, `통화 중` 같은 거래 문맥을 결합한다.

4. **RAG Vector Search**
   `gemini-embedding-001`로 질문 임베딩을 만들고 로컬 벡터 인덱스에서 다음 자료를 검색한다.
   - KISA 사기 문맥 후보
   - AI Hub 정상 금융상담 대조군
   - 공식 금융사기 PDF 8종 페이지 근거 Top 4

   같은 상담의 여러 청크는 가장 유사한 1개만 남긴다. 벡터 검색 결과가 부족하면 IDF 키워드 검색으로 채우고, 임베딩 API나 인덱스가 없으면 전체 검색을 키워드 방식으로 자동 전환한다.

5. **Gemini 구조화 분석**
   송금 정보, 전체 대화, 사기·정상 사례와 공식 문서 근거를 함께 전달한다. 공식 문서에는 기관·문서명·PDF 페이지가 붙는다. Gemini는 다음 항목만 JSON으로 반환한다.
   - 송금 목적·요청자·연락 경로
   - 사칭 대상·공격 단계·요구 행동
   - 확인된 위험 신호와 대화 근거 표현
   - 답변 간 모순과 추가 확인 질문
   - 실제 판단에 사용한 검색 근거 ID

6. **규칙 엔진 판정**
   Gemini가 추출한 신호를 중복 제거한 뒤 서버 규칙으로 점수를 계산한다. 거래 패턴 점수는 최대 40점까지 보조하지만, 대화에서 위험 신호가 하나도 확인되지 않으면 최종 점수는 0점이다.

   - `50점 이상`: HIGH
   - `30~49점`: MEDIUM
   - `0~29점`: LOW
   - 명백한 HIGH는 필요한 근거가 채워지면 두 번째 답변부터 판정할 수 있다.
   - 질문 횟수보다 근거 충족 여부를 우선한다. 4턴은 권장 범위이며, 근거가 부족하면 질문을 이어간다.
   - 모델 오류에 따른 무한 반복만 막기 위해 8턴을 비상 상한으로 둔다.

7. **근거 공백 질문 선택**
   RAG 사례 비교에 필요한 요청자·연락 경로·요구 행동과 규칙 엔진의 대응 분기 정보를 확인한다. 앱 설치·링크 클릭·인증정보 제공·이전 송금 여부처럼 피해 대응을 바꾸는 정보가 비어 있으면 먼저 묻는다. 거래 화면이 이미 아는 금액·신규 수취인·계좌 표시는 다시 묻지 않는다.

8. **근거 기반 사용자 답변 생성**
   규칙 엔진이 확정한 판정, 사용자의 실제 표현, 선택된 RAG 근거를 두 번째 Gemini 호출에 전달한다. 사용자가 말한 요청자·연락 경로·송금 이유·요구 행동을 연결해 자연스럽게 설명하되 내부 문서명과 페이지는 노출하지 않는다.

9. **출력 검증**
   사기 확정 표현, 내부 출처 노출, 과도한 길이, 필수 안전 행동 누락을 검사한다. 검증에 실패하거나 Gemini가 응답하지 않으면 고정 안전 문구를 폴백으로 사용한다.

10. **결과 반환**
   맞춤형 사용자 안내와 함께 의심 유형, 점수, 신호, 검색 근거, 공식 확인 자료를 구조화해 반환한다. Gemini 장애 시에도 명시적인 위험 표현은 로컬 규칙으로 추출한다.

## 현재 RAG 데이터

| 항목 | 내용 |
|---|---|
| 실행 Corpus | 1,541건 |
| 사기 문맥 후보 | 391건 |
| 정상 금융대화 대조군 | 400건 |
| 공식 PDF | 8개 문서, 750쪽 |
| PDF 이미지 요약 보완 | 56쪽, 검수 필요 표시 |
| 벡터 청크 | 1,700개(JSON 825 + PDF 875) |
| 임베딩 | `gemini-embedding-001`, 768차원 |
| 청크 크기 | 최대 1,400자, 160자 중첩 |
| 기본 유사도 하한 | 0.32 |

검색된 KISA 자료는 자동 후보·미검수 사례가 포함되므로 실제 피해 사건이나 정답 라벨로 단정하지 않는다. 텍스트 레이어가 없는 PDF 56쪽은 Gemini 이미지 요약으로 보완하고 `official_source_llm_summary_needs_review`로 구분한다. 위험도는 검색 점수가 아니라 현재 대화에서 확인된 신호로 결정한다.

## 주요 파일

```text
4-intent-analysis/
├─ agent.js                    # 4단계 실행 진입점
├─ intent.js                   # 전체 대화·검색·판정 흐름
├─ sanitize.js                 # 개인정보 마스킹
├─ llm/gemini.js               # Gemini 구조화 출력
├─ retrieval/
│  ├─ gemini-embeddings.js     # 문서·질문 임베딩
│  ├─ vector-search.js         # 코사인 유사도 검색·중복 제거
│  └─ rag.js                   # 벡터 검색과 키워드 폴백 결합
├─ rules/
│  ├─ signals.js               # 신호별 점수와 보류 기준
│  └─ fraud-types.js           # 사기 유형 분류
├─ datasets/                   # 입력·사례·실행 Corpus
├─ scripts/                    # Corpus·벡터 인덱스 생성·점검
│  └─ extract-pdf-rag.py       # 원본 PDF 8종 페이지 추출·이미지 요약 보완
└─ test/                       # 단위·평가 테스트
```

## 실행·검증

저장소 루트에서 실행한다.

```powershell
# 저장소 밖 원본 PDF를 페이지 단위 JSON으로 변환
& 'C:\Users\khm35\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' `
  backend/agents/4-intent-analysis/scripts/extract-pdf-rag.py `
  --source-dir '원본 PDF 폴더' --gemini-image-summary

# JSON·PDF 실행 Corpus 생성
node backend/agents/4-intent-analysis/scripts/build-runtime-rag.mjs

# 로컬 벡터 인덱스 생성
node backend/agents/4-intent-analysis/scripts/build-vector-index.mjs

# 벡터 검색 확인
node backend/agents/4-intent-analysis/scripts/check-vector-search.mjs "검찰이 안전계좌로 옮기라고 했어요"

# 벡터 검색부터 Gemini 판정까지 확인
node backend/agents/4-intent-analysis/scripts/check-vector-search.mjs --full

# 단위 테스트
node --test backend/agents/4-intent-analysis/test/intent-analysis.test.mjs
```

필수 환경변수는 루트 `.env`의 `GEMINI_API_KEY`다. 모델·차원·유사도 기준은 `GEMINI_EMBEDDING_MODEL`, `GEMINI_EMBEDDING_DIMENSIONS`, `VECTOR_RAG_MIN_SIMILARITY`로 조정할 수 있다.

벡터 인덱스는 `datasets/rag/runtime/vector/`에 생성되며 Git에는 포함하지 않는다.
