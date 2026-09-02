# 데이터 출처

원본 파일은 Git에 포함하지 않는다. 팀 공유 저장소의 원본을 `../scripts/`로 변환해 `rag/input/`과 `rag/runtime/`을 재생성한다.

## PDF 8개

1. `guide_pdf.pdf`

2. `[FSI Intelligence Report] Operation BlackEcho (KOR).pdf`

3. `사기 예방 백과사전.pdf`

4. `[한국금융소비자보호재단] 보이스피싱 알아야 막을 수 있다! 피해 사례와 예방법.pdf`

5. `보험연구원(KIRI).pdf`

6. `[최종본_내지]_가상자산_연계_투자사기_사례집_240417.pdf`

7. `[pdf]전자금융범죄.pdf`

   `보이스피싱_피해자의_심리분석을_통한_피해예방연구_2024년도_대검찰청_연구용역보고서.pdf`

- 금융투자협회 「행복 금융투자 길라잡이」: https://www.kofia.or.kr/files/www/guide_pdf.pdf
- 금융보안원 「Operation BlackEcho」: https://www.fsec.or.kr/bbs/detail?bbsNo=11611&menuNo=244
- 전국은행연합회 「사기 예방 백과사전」: https://www.bankit.kr/newsroom/detail/2463
- 한국금융소비자보호재단 「보이스피싱 알아야 막을 수 있다!」: https://kfcpf.or.kr/front/finance/bookView.do?enIdx=1055
- 보험연구원 「중고령소비자의 금융역량 진단과 강화방안」: https://www.kiri.or.kr/pdf/%EC%A0%84%EB%AC%B8%EC%9E%90%EB%A3%8C/nre2026-04.pdf
- 금융감독원·DAXA 「가상자산 연계 투자사기 사례집」: https://kdaxa.org/ebook/index.html
- 법제처 「전자금융범죄」: https://easylaw.go.kr/CSP/CnpClsMain.laf?ccfNo=4&cciNo=1&cnpClsNo=3&csmSeq=1592&popMenu=ov
- 대검찰청·한국형사법무정책연구원 「보이스피싱 피해자의 심리분석을 통한 피해예방연구」: https://nsp.nanet.go.kr/plan/subject/detail.do?nationalPlanControlNo=PLAN0000061129

PDF 8종은 페이지 단위로 추출해 기관·문서명·PDF 페이지·공식 URL과 함께 Vector RAG 입력으로 사용한다. 텍스트 레이어가 없는 페이지의 Gemini 이미지 요약은 검수 필요 상태로 구분하며, 향후 Knowledge Graph 입력에도 같은 출처 메타데이터를 사용한다.

## JSON 5개

1. KISA 스팸·해킹·피싱 전화상담 기반 합성데이터 1종
2. KISA 스팸·해킹·피싱 전화상담 기반 합성데이터 2종
3. KISA 스팸·해킹·피싱 전화상담 기반 합성데이터 3종
4. KISA 118 전화상담 가명정보
5. AI Hub 금융분야 고객상담 데이터

- KISA 합성데이터: https://www.data.go.kr/data/15150832/fileData.do
- KISA 118 가명정보: https://www.data.go.kr/data/15156112/fileData.do
- AI Hub 금융분야 고객상담: https://aihub.or.kr/aihubdata/data/view.do?currMenu=115&dataSetSn=71926&topMenu=100
