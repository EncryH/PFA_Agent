# 3단계 데이터셋 구조

Git에는 전처리된 입력과 실행에 필요한 결과만 둔다. PDF·ZIP 등 원본은 팀 공유 저장소에서 별도로 관리한다.

```text
datasets/
├─ README.md
├─ SOURCES.md        # 원본 출처와 재생성 기준
├─ rag/
│  ├─ input/         # 개인정보를 제거한 RAG 입력 JSON
│  ├─ cases/         # 정제·검수·학습용 데이터와 경량 지식그래프 정의
│  └─ runtime/       # 실제 검색 Corpus와 생성 Vector·Graph 인덱스
└─ text2sql/          # 사용자 거래 패턴 조회용 DB·스키마
```

- 원본 PDF·ZIP은 저장소에 커밋하지 않는다.
- `input/`은 원본을 변환한 입력 데이터이며 수동으로 수정하지 않는다.
- 변환·검사·Corpus 생성 코드는 `../scripts/`에 둔다.
- 대용량 생성물과 검색 인덱스는 필요할 때 재생성한다.
- `cases/fraud-knowledge-graph.json`은 사기 유형·신호·진행 단계·대응 행동의 검수 가능한 원본 정의다.
- 실제 그래프 데이터는 Neo4j AuraDB Free에 저장하며 Git에는 검수 가능한 원본 JSON만 둔다.

## Text2SQL 가상 거래내역

- `text2sql/synthetic-users.csv`: `demo-parent-01`~`03` 가상 사용자 3명
- `text2sql/synthetic-transactions.csv`: 최근 12개월 거래 1,005건
- `text2sql/schema.sql`: Supabase PostgreSQL 테이블·인덱스·RLS·Data API 차단

CSV는 다음 명령으로 동일하게 재생성할 수 있다.

```powershell
node backend/agents/3-intent-analysis/scripts/generate-synthetic-transactions.mjs
```

## Neo4j 지식그래프 적재

AuraDB Free 인스턴스를 만든 뒤 루트 `.env`에 `NEO4J_URI`, `NEO4J_USERNAME`, `NEO4J_PASSWORD`를 설정하고 실행한다.

```powershell
node --env-file=.env backend/agents/3-intent-analysis/scripts/seed-neo4j-graph.mjs
```

적재 스크립트는 `MERGE`를 사용하므로 같은 데이터로 다시 실행해도 노드가 중복 생성되지 않는다.
다음 명령은 AuraDB의 노드·관계 개수와 기관사칭 진행 경로를 원본 JSON과 읽기 전용으로 대조한다.

```powershell
node --env-file=.env backend/agents/3-intent-analysis/scripts/check-neo4j-graph.mjs
```

## 로컬 벡터 인덱스 생성

루트 `.env`의 `GEMINI_API_KEY`를 사용해 실행용 Corpus를 임베딩한다.

```powershell
node --env-file=.env backend/agents/3-intent-analysis/scripts/build-vector-index.mjs
```

검색 결과를 빠르게 확인하려면 다음 명령을 사용한다.

```powershell
node --env-file=.env backend/agents/3-intent-analysis/scripts/check-vector-search.mjs "검찰이 안전계좌로 옮기라고 했어요"
```

`--full`을 붙이면 검색 근거를 포함한 Gemini 의도 분석까지 함께 확인한다.

생성 위치는 `rag/runtime/vector/intent-vector-index.json`이며 Git에는 포함하지 않는다.
실행 중 중단돼도 같은 Corpus·모델·차원이라면 완료된 청크 다음부터 이어서 생성한다.

- 기본 임베딩 모델: `gemini-embedding-001`
- 기본 차원: `768`
- 선택 환경변수: `GEMINI_EMBEDDING_MODEL`, `GEMINI_EMBEDDING_DIMENSIONS`, `VECTOR_RAG_MIN_SIMILARITY`
