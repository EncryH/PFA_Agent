# AGENTS.md

## Codex 작업 규칙

- 사용자에게 보이는 설명, 문서 요약, 기획서/제안서 문장은 한국어를 기본으로 한다.
- 작업 트리는 이미 변경된 상태일 수 있다고 가정한다. 사용자의 다른 변경사항을 되돌리거나 덮어쓰지 않는다.
- 파일을 수정하기 전에는 관련 문서, 이미지, 템플릿, 기존 산출물 구조를 먼저 확인한다.
- 요청 범위에 맞게 변경을 좁게 유지한다. 단, 기획서/스펙의 일관성을 위해 필요한 연결 수정은 함께 수행한다.
- 검색은 `rg` 또는 `rg --files`를 우선 사용한다.
- 수동 파일 수정은 가능한 한 패치 방식으로 수행한다.
- HWPX 원본, 압축해제 폴더, 이미지 산출물은 사용자가 명시적으로 요청하지 않는 한 삭제하지 않는다.
- 사용자가 명시적으로 요청하지 않는 한 `git reset --hard`, `git checkout --` 같은 파괴적인 git 명령을 실행하지 않는다.
- 문서 작업에서는 원본 템플릿 구조를 보존하고, 변경 의도와 확인 결과를 짧게 요약한다.
- UI/UX 산출물은 금융 앱답게 신뢰감, 명확성, 접근성, 개인정보 보호, 실제 업무 흐름을 우선한다.
- 마케팅식 과장보다 심사위원/사용자가 바로 이해할 수 있는 문제 정의, 핵심 기능, 차별점, 구현 가능성을 우선한다.

## Second Vault 동기화

### 목적

- 이 프로젝트는 AI_Challenge 작업 중 장기적으로 재사용할 기획, 스펙, UX, 심사 전략 지식을 `C:\second`에 동기화한다.
- Second에는 대화 전체나 작업 전체가 아니라, 나중에 다시 판단과 유지보수에 도움이 되는 요약 지식만 저장한다.
- 작업 종료 시 항상 Second 업데이트 여부를 점검하고, 최종 답변에 `second 파일 업데이트 완료` 또는 `second 파일에 새로 저장할 내용은 없음`을 명시한다.

### 작업 시작 시 확인할 Second 파일

- 의미 있는 작업을 시작할 때는 아래 가벼운 컨텍스트만 먼저 확인한다.
  - `C:\second\wiki\overview.md`
  - `C:\second\wiki\index.md`
  - `C:\second\wiki\patterns\작업스타일.md`
  - `C:\second\wiki\patterns\Second운영규칙.md`
  - `C:\second\wiki\experiences\AI_Challenge.md`
- `C:\second` 전체나 `raw\memories` 전체를 읽지 않는다.
- 추가 정보가 필요하면 `index.md`를 보고 직접 관련 있는 wiki 페이지 1~3개만 고른다.
- 원본 검증이 필요할 때만 특정 `raw\memories` 파일을 읽는다.

### AI_Challenge에서 Second에 저장할 내용

아래 항목은 작업 마지막에 Second 저장 후보로 본다.

| 분류 | 저장할 내용 | 기본 저장 위치 |
|---|---|---|
| 문제 정의 | 해결하려는 금융/AI 문제, 대상 사용자, 사용 시나리오가 확정되거나 바뀐 경우 | `wiki\experiences\AI_Challenge.md` |
| 서비스 콘셉트 | 서비스명, 핵심 가치, 차별점, 기능 범위, MVP 방향 | `wiki\experiences\AI_Challenge.md` |
| 기능 스펙 | 금융 AI 기능, 추천/분석/상담 흐름, 데이터 입력/출력, 예외 처리 정책 | `wiki\experiences\AI_Challenge.md` |
| UX/UI | 모바일/웹 흐름, 화면 구조, 벤치마크, 시각 콘셉트, 접근성 원칙 | `wiki\experiences\AI_Challenge.md` 또는 `wiki\patterns\작업스타일.md` |
| 문서 산출물 | 기획서/제안서/스펙 템플릿 구조, 제출본 구성, 심사 기준 대응 | `wiki\experiences\AI_Challenge.md` |
| 기술/구현 | AI 모델 사용 방식, 데이터 처리, 개인정보 보호, 금융 보안, 배포/프로토타입 전략 | `wiki\experiences\AI_Challenge.md` |
| 심사 전략 | 평가 포인트, 강점/리스크, 발표 서사, 데모 우선순위 | `wiki\experiences\AI_Challenge.md` |
| 반복 문제 | 문서 변환/HWPX 편집/이미지 산출/UX 반복에서 다시 만날 가능성이 높은 해결책 | `wiki\experiences\AI_Challenge.md`와 `wiki\log.md` |
| 유지보수 원칙 | 앞으로 AI_Challenge 작업에서 지켜야 할 검증 루틴, 금지사항, 파일 관리 규칙 | `wiki\experiences\AI_Challenge.md` 또는 `wiki\patterns\Second운영규칙.md` |

### 저장하지 않을 내용

- 단순 오타 수정
- 이미지 파일명 확인 같은 일회성 탐색
- 임시 문장 후보, 폐기한 카피, 폐기한 화면 아이디어
- 한 번 실패하고 바로 해결된 문서 변환/빌드 로그
- 전체 git diff나 세세한 파일 변경 목록
- 비밀값, API 키, 토큰, 비밀번호, 개인 인증 정보
- 금융 계좌/주민등록/소득 등 민감정보 원문
- 이미 Second에 같은 의미로 저장된 중복 정보

### 작업 종료 시 체크리스트

작업이 끝나면 아래 순서로 판단한다.

1. 이번 작업이 AI_Challenge의 장기 기획/스펙/UX/심사 전략 지식인가?
2. 2주 뒤에도 다시 참고할 가능성이 높은가?
3. 문제 정의, 서비스 콘셉트, 기능 스펙, UX/UI, 문서 산출물, 구현 전략, 심사 전략 중 하나에 해당하는가?
4. 이미 `C:\second`에 같은 의미로 저장되어 있지 않은가?
5. 민감정보가 포함되어 있지 않은가?

위 질문 중 2개 이상이 `예`이면 Second 업데이트를 수행한다. 애매하면 저장하지 말고 사용자에게 확인한다.

### 업데이트 방식

- 기본 업데이트 대상은 `C:\second\wiki\experiences\AI_Challenge.md`이다.
- 모든 의미 있는 업데이트는 `C:\second\wiki\log.md`에 append-only로 짧게 기록한다.
- 큰 방향 변화가 있으면 `C:\second\wiki\overview.md`도 함께 갱신한다.
- 새로운 AI_Challenge 세부 페이지가 생기면 `C:\second\wiki\index.md`에 링크를 추가한다.
- `raw\memories`의 기존 파일은 원본이므로 수정하지 않는다.
- `C:\second` 쓰기 권한이 막히면 다른 위치에 복사본을 만들지 말고 권한 승인을 요청한다.

### `wiki\log.md` 기록 템플릿

```md
## [YYYY-MM-DD] codex | AI_Challenge 작업 요약

- 작업 주제:
- 확정된 결정:
- 영향 범위:
- 검증 결과:
- 다음에 다시 볼 포인트:

---
```

### 최종 답변 형식

- 변경 요약과 검증 결과를 먼저 말한다.
- Second에 저장했다면 `second 파일 업데이트 완료`라고 쓴다.
- 저장할 내용이 없으면 `second 파일에 새로 저장할 내용은 없음`이라고 쓴다.
- 저장이 필요하지만 권한이 막혔다면 `second 파일 업데이트 필요 - 권한 필요`라고 쓴다.
