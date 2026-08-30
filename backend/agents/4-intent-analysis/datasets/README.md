# 4단계 데이터셋 구조

Git에는 전처리된 입력과 실행에 필요한 결과만 둔다. PDF·ZIP 등 원본은 팀 공유 저장소에서 별도로 관리한다.

```text
datasets/
├─ README.md
├─ SOURCES.md        # 원본 출처와 재생성 기준
├─ rag/
│  ├─ input/         # 개인정보를 제거한 RAG 입력 JSON
│  ├─ cases/         # 정제·검수·학습용 데이터
│  └─ runtime/       # 실제 검색 Corpus와 생성 인덱스
└─ text2sql/          # 사용자 거래 패턴 조회용 DB·스키마
```

- 원본 PDF·ZIP은 저장소에 커밋하지 않는다.
- `input/`은 원본을 변환한 입력 데이터이며 수동으로 수정하지 않는다.
- 변환·검사·Corpus 생성 코드는 `../scripts/`에 둔다.
- 대용량 생성물과 검색 인덱스는 필요할 때 재생성한다.

## 로컬 벡터 인덱스 생성

루트 `.env`의 `GEMINI_API_KEY`를 사용해 실행용 Corpus를 임베딩한다.

```powershell
node backend/agents/4-intent-analysis/scripts/build-vector-index.mjs
```

검색 결과를 빠르게 확인하려면 다음 명령을 사용한다.

```powershell
node backend/agents/4-intent-analysis/scripts/check-vector-search.mjs "검찰이 안전계좌로 옮기라고 했어요"
```

`--full`을 붙이면 검색 근거를 포함한 Gemini 의도 분석까지 함께 확인한다.

생성 위치는 `rag/runtime/vector/intent-vector-index.json`이며 Git에는 포함하지 않는다.
실행 중 중단돼도 같은 Corpus·모델·차원이라면 완료된 청크 다음부터 이어서 생성한다.

- 기본 임베딩 모델: `gemini-embedding-001`
- 기본 차원: `768`
- 선택 환경변수: `GEMINI_EMBEDDING_MODEL`, `GEMINI_EMBEDDING_DIMENSIONS`, `VECTOR_RAG_MIN_SIMILARITY`
