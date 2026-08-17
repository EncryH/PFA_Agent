// 공식 사례·기사·영상은 이후 evidence catalog를 추가해 연결한다.
// 현재는 LLM이 임의 URL이나 실제 사건을 만들어내지 못하도록 빈 결과만 반환한다.
export function retrieveOfficialContent() {
  return {
    status: "not_configured",
    items: [],
  };
}
