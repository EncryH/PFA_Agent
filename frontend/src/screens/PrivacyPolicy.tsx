// 개인정보처리방침 — 개인정보 보호법 제30조 및 개인정보보호위원회 「개인정보 처리방침 작성지침」(2026.4.)에 따라 작성.
// 실제 구현(로컬 저장·마스킹 후 외부 전송·가족 공유 범위·D등급 자동 송금정지)에 맞춰 항목을 채웠다.

import { PageHeader } from "../shared/ui";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl p-5">
      <p className="text-[15px] font-bold text-gray-900 mb-3">{title}</p>
      <div className="text-[13px] text-gray-600 leading-relaxed flex flex-col gap-2">{children}</div>
    </div>
  );
}

export default function PrivacyPolicy({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-col gap-4 pb-10">
      <PageHeader title="개인정보처리방침" onBack={onBack} />

      <div className="bg-[var(--ac-50)] rounded-2xl p-4">
        <p className="text-[12px] text-[var(--ac-700)] leading-relaxed">
          안심동행 AI(이하 "회사")는 「개인정보 보호법」 제30조에 따라 이용자의 개인정보를 보호하고
          관련 고충을 신속·원활히 처리할 수 있도록 다음과 같이 개인정보 처리방침을 수립·공개합니다.
          본 방침은 한결은행(부모 앱)·나눔은행(자녀 앱)에서 제공하는 안심동행 AI 서비스 전반에 적용됩니다.
        </p>
      </div>

      <Section title="제1조 (개인정보의 처리 목적)">
        <p>회사는 다음 목적을 위해 개인정보를 처리하며, 목적이 변경되는 경우 「개인정보 보호법」 제18조에 따라 별도 동의 등 필요한 조치를 이행합니다.</p>
        <ol className="list-decimal list-inside flex flex-col gap-1">
          <li>금융거래(계좌 조회·송금) 처리 및 본인확인</li>
          <li>전기통신금융사기(보이스피싱) 의심거래 탐지 및 대응 — 상대방(전화번호·링크·기관명) 검증, 이상행동 감지, AI 기반 송금 의도 분석</li>
          <li>안심동행(가족 보호) 기능 제공 — 이용자가 가족 연동을 신청한 경우에 한함</li>
          <li>피해 발생 시 골든타임 대응 지원 — 지급정지·112 신고·피해구제 신청 안내</li>
          <li>고객센터 문의(1:1 문의·전화 상담) 접수 및 응대</li>
          <li>부정이용 방지 및 서비스 품질 개선</li>
        </ol>
      </Section>

      <Section title="제2조 (처리하는 개인정보의 항목)">
        <p className="font-semibold text-gray-700">① 계좌·송금 정보 (필수)</p>
        <p>계좌번호, 은행명, 잔액, 거래내역 / 수취인 성명·계좌번호·은행명, 송금액, 송금 일시</p>
        <p className="font-semibold text-gray-700 mt-1">② 이용자가 직접 입력하는 정보</p>
        <p>상대방 검증 시 조회하는 전화번호·링크(URL)·기관명 / AI 송금 의도 상담 중 답변 내용(연락 경로, 요구받은 행동 등) / 고객센터 1:1 문의 내용</p>
        <p className="font-semibold text-gray-700 mt-1">③ 선택 항목 (안심동행 가족 보호 기능 이용 시)</p>
        <p>가족 연동 여부, 보호 단계 설정값, 위험 거래 알림 정보(위험 등급, 감지된 위험 신호, AI 상담 요약, 송금액·수취 계좌)</p>
        <p className="text-[12px] text-gray-400">※ 계좌 잔액·전체 거래내역·소비 패턴은 어떤 보호 단계에서도 가족에게 제공되지 않습니다.</p>
        <p className="font-semibold text-gray-700 mt-1">④ 자동 수집 항목</p>
        <p>서비스 접속·이용 기록, 기기 내 로컬 저장소(localStorage) 저장 값</p>
        <p className="text-[12px] text-gray-400 mt-1">
          ①·②·④ 항목은 「개인정보 보호법」 제15조제1항제4호(계약 체결·이행)에 따라 별도 동의 없이 처리됩니다.
          ③ 안심동행 가족 보호 기능은 이용자(부모)가 가족 연동을 직접 신청하는 경우에만, 그 동의를 받아 처리합니다.
        </p>
      </Section>

      <Section title="제3조 (개인정보의 처리 및 보유 기간)">
        <p>회사는 법령에 따른 보유기간 또는 정보주체로부터 동의받은 기간 내에서 개인정보를 처리·보유합니다.</p>
        <ol className="list-decimal list-inside flex flex-col gap-1">
          <li>전기통신금융사기 의심거래 임시조치(지급정지 등)·본인확인조치 기록: 「전기통신금융사기 피해 방지 및 피해금 환급에 관한 특별법」 제2조의5에 따라 조치 종료일로부터 5년간 보존</li>
          <li>안심동행 위험 알림·가족 확인 기록: 가족 연동 해제 시까지 (단, 분쟁·피해 대응 근거자료로 필요한 경우 제1호와 동일하게 5년간 보존)</li>
          <li>AI 상담(송금 의도 분석) 대화 기록: 이용자 기기(localStorage)에만 저장되며, 이용자가 직접 삭제하거나 브라우저 데이터를 삭제할 때까지 보관</li>
          <li>상대방 검증(전화번호·링크·기관명) 조회 이력: 서버에 별도 보관하지 않으며 조회 완료 즉시 파기</li>
          <li>고객센터 1:1 문의 내역: 답변 완료 후 3년간 보관 후 파기</li>
        </ol>
      </Section>

      <Section title="제4조 (개인정보의 제3자 제공)">
        <p>
          회사는 정보주체의 동의, 법률의 특별한 규정 등 「개인정보 보호법」 제17조·제18조에 해당하는 경우에만
          개인정보를 제3자에게 제공합니다.
        </p>
        <p>
          이용자(부모)가 안심동행 가족 보호 기능을 직접 신청(가족 연동)한 경우, 위험 거래 발생 시 위험 등급·송금액·
          수취 계좌·감지된 위험 신호 요약 등 최소한의 정보만 연동된 가족에게 제공됩니다. 잔액·전체 거래내역은
          제공하지 않으며, 이용자는 언제든지 가족 연동을 해제해 정보 제공을 중단할 수 있습니다.
        </p>
      </Section>

      <Section title="제5조 (개인정보 처리업무 위탁 및 국외 이전)">
        <p>회사는 서비스 제공을 위해 아래와 같이 업무를 위탁하거나, 이용자의 조회 요청에 따라 아래 기관에 정보를 전달합니다.</p>
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-[11px] border-collapse min-w-[560px]">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-100">
                <th className="py-1.5 pr-2 font-medium">수탁자 · 이전받는 자</th>
                <th className="py-1.5 pr-2 font-medium">업무 내용</th>
                <th className="py-1.5 pr-2 font-medium">이전 항목</th>
                <th className="py-1.5 pr-2 font-medium">이전 국가</th>
                <th className="py-1.5 font-medium">보유·이용 기간</th>
              </tr>
            </thead>
            <tbody className="text-gray-600">
              {[
                ["Google LLC (Gemini API)", "AI 기반 송금 의도 분석·상담 응답 생성", "마스킹 처리된 상담 대화 내용", "미국 등 Google 서버 운영국", "요청 처리 즉시 미보관"],
                ["Google LLC (Safe Browsing API)", "문자 메시지 내 링크의 악성 URL 여부 확인", "조회 URL", "미국 등 Google 서버 운영국", "조회 완료 즉시 미보관"],
                ["네이버클라우드(주) (NAVER API HUB)", "전화번호의 공개 웹문서 기반 위험·공식 정황 확인", "조회 전화번호", "대한민국", "조회 완료 즉시 미보관"],
                ["예금보험공사", "금융회사 공식 연락처 확인", "조회 전화번호·기관명", "대한민국", "조회 완료 즉시 미보관"],
                ["금융위원회(공공데이터포털)", "금융회사 등록 정보 확인", "조회 기관명", "대한민국", "조회 완료 즉시 미보관"],
              ].map((row) => (
                <tr key={row[0]} className="border-b border-gray-50 align-top">
                  {row.map((cell, i) => <td key={i} className="py-2 pr-2">{cell}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          AI 상담 중 입력된 주민등록번호·전화번호·이메일·링크·계좌번호 등은 정규식 기반으로 치환·마스킹하고,
          수취 계좌는 원문 대신 해시값으로 대체한 뒤에만 국외 수탁자(Google)로 전송합니다.
        </p>
        <p>
          회사는 「개인정보 보호법」 제28조의8에 따라 국외 이전이 필요한 경우 이전 항목·이전받는 자·이전 국가·
          이전 일시 및 방법·보유기간·거부 방법을 고지하고 동의를 받거나, 법령이 정한 예외 사유에 해당하는
          경우에 한하여 이전합니다.
        </p>
      </Section>

      <Section title="제6조 (정보주체와 법정대리인의 권리·의무 및 행사방법)">
        <p>정보주체는 회사에 대해 언제든지 다음의 권리를 행사할 수 있습니다.</p>
        <ol className="list-decimal list-inside flex flex-col gap-1">
          <li>개인정보 열람 요구 (제35조)</li>
          <li>오류 등이 있을 경우 정정 요구 (제36조)</li>
          <li>삭제 요구 (제36조)</li>
          <li>처리정지 요구 (제37조)</li>
        </ol>
        <p>
          권리 행사는 「개인정보 보호법 시행령」 제41조제1항에 따라 서면·전자우편·팩스 등으로 하실 수 있으며,
          앱 내 "고객센터 &gt; 1:1 문의"를 통해서도 요청하실 수 있습니다. 회사는 요청에 대해 지체없이 조치합니다.
          안심동행 가족 보호 이용 시 부모(정보주체)는 언제든지 가족 연동을 해제할 수 있습니다.
        </p>
      </Section>

      <Section title="제7조 (자동화된 결정에 관한 사항)">
        <p>
          회사는 「개인정보 보호법」 제37조의2에 따라 완전히 자동화된 시스템(AI)으로 개인정보를 처리하여
          이루어지는 결정에 관한 사항을 다음과 같이 안내합니다.
        </p>
        <ol className="list-decimal list-inside flex flex-col gap-1">
          <li>
            회사는 송금 시도 시 AI가 상대방 검증 결과·거래 패턴·상담 응답을 분석해 위험 등급을 산정하고,
            위험 등급이 가장 높은 경우(D등급) 정보주체의 별도 조작 없이 해당 송금을 일정 시간 자동으로
            정지(쿨다운)하는 자동화된 결정을 수행합니다. 이는 전기통신금융사기가 의심되는 거래로부터 이용자의
            재산을 보호하기 위한 목적으로, 송금을 시도하는 모든 이용자를 대상으로 이루어집니다.
          </li>
          <li>
            자동화된 결정에는 상대방 전화번호·URL·기관명의 검증 결과, 송금 금액, AI 상담 중 응답 내용(연락 경로,
            요구받은 행동 등)이 주요 정보로 활용되며, 이 정보들의 위험도 조합에 따라 자동 정지 여부가 결정됩니다.
          </li>
          <li>
            자동 정지는 사전에 설정된 지연 시간 동안 유지되며, 이 기간 동안 안심동행 가족 보호가 연동된 경우
            보호자 확인을, 연동되지 않은 경우 은행 상담원 확인을 거쳐야 송금을 진행할 수 있습니다.
          </li>
          <li>회사는 자동화된 결정 과정에서 민감정보 또는 14세 미만 아동의 개인정보를 처리하지 않습니다.</li>
          <li>
            정보주체는 자동 정지 조치에 대해 설명을 요구하거나, 은행 상담원 확인을 거쳐 정지 해제를 요청할 수
            있습니다. 다만 이 조치는 정보주체 본인의 재산을 보호하기 위한 조치이므로, 다른 사람의 생명·신체·
            재산상 이익을 부당하게 침해할 우려가 없는 범위에서만 거부 요청이 반영됩니다. 요청은 아래 개인정보
            보호책임자 연락처 또는 앱 내 "고객센터 &gt; 1:1 문의"로 하실 수 있습니다.
          </li>
        </ol>
      </Section>

      <Section title="제8조 (개인정보의 파기)">
        <p>회사는 보유기간 경과, 처리목적 달성 등으로 개인정보가 불필요해진 경우 지체없이 파기합니다.</p>
        <ol className="list-decimal list-inside flex flex-col gap-1">
          <li>전자적 파일: 기록을 재생할 수 없는 기술적 방법으로 삭제</li>
          <li>기기 로컬 저장소(localStorage) 보관 정보: 이용자가 앱 내 삭제 기능을 실행하거나 브라우저 데이터를 삭제하는 즉시 파기</li>
        </ol>
      </Section>

      <Section title="제9조 (개인정보의 안전성 확보조치)">
        <p>회사는 「개인정보 보호법」 제29조에 따라 다음과 같은 조치를 취하고 있습니다.</p>
        <ol className="list-decimal list-inside flex flex-col gap-1">
          <li>관리적 조치: 내부관리계획 수립·시행, 담당자 교육</li>
          <li>기술적 조치: 접근권한 관리, 상대방 검증·AI 상담 시 계좌번호·전화번호 등 마스킹 처리 후 외부 전송, 통신 구간 암호화(HTTPS)</li>
          <li>물리적 조치: 전산설비 접근 통제</li>
        </ol>
      </Section>

      <Section title="제10조 (개인정보 자동 수집 장치)">
        <p>
          회사는 이용자 기기의 브라우저 로컬 저장소(localStorage)를 이용해 송금 진행 상태·상담 기록·연동 설정을
          저장합니다. 쿠키와 달리 서버로 자동 전송되지 않으며 이용자의 기기 안에만 남습니다. 이용자는 브라우저
          설정에서 저장된 데이터를 언제든지 삭제할 수 있습니다.
        </p>
      </Section>

      <Section title="제11조 (개인정보 보호책임자)">
        <p>회사는 개인정보 처리에 관한 업무를 총괄하고 불만처리·피해구제를 지원하기 위해 개인정보 보호책임자를 지정하고 있습니다.</p>
        <div className="rounded-xl bg-gray-50 p-3.5 mt-1">
          <p>성명·직책: 임서준 · 개인정보보호책임자(CPO)</p>
          <p>연락처: 1588-5000 (평일 09:00~18:00, 주말·공휴일 휴무)</p>
          <p>이메일: seojun0007@naver.com</p>
        </div>
      </Section>

      <Section title="제12조 (권익침해 구제방법)">
        <p>정보주체는 아래 기관에 개인정보 침해에 대한 신고나 상담을 하실 수 있습니다.</p>
        <ul className="list-disc list-inside flex flex-col gap-1">
          <li>개인정보 침해신고센터 : (국번없이) 118 · privacy.kisa.or.kr</li>
          <li>개인정보 분쟁조정위원회 : 1833-6972 · kopico.go.kr</li>
          <li>대검찰청 사이버범죄수사단 : (국번없이) 1301 · spo.go.kr</li>
          <li>경찰청 사이버수사국 : (국번없이) 182 · ecrm.cyber.go.kr</li>
        </ul>
      </Section>

      <Section title="제13조 (개인정보 처리방침의 변경)">
        <p>
          이 개인정보 처리방침은 시행일부터 적용되며, 법령 및 방침에 따른 내용 추가·삭제·정정이 있는 경우
          변경사항의 시행 7일 전부터 공지사항을 통해 고지합니다.
        </p>
        <p className="text-gray-400">공고일자 : 2026년 9월 2일&nbsp;&nbsp;·&nbsp;&nbsp;시행일자 : 2026년 9월 2일</p>
      </Section>
    </div>
  );
}
