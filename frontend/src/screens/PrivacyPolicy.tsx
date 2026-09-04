// 개인정보처리방침 — 현재 프로토타입의 실제 처리 흐름과 목표 공동 허브 구조를 구분해 공개한다.

import { useEffect, useState } from "react";
import { clearAnsimLocalData } from "../shared/privacyStorage";
import { PageHeader } from "../shared/ui";

function Section({ id, title, children, open = false }: {
  id: string;
  title: string;
  children: React.ReactNode;
  open?: boolean;
}) {
  return (
    <details id={id} open={open} className="group scroll-mt-4 rounded-2xl bg-white p-5">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[15px] font-bold text-gray-900 [&::-webkit-details-marker]:hidden">
        <span>{title}</span>
        <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 shrink-0 text-gray-400 transition-transform group-open:rotate-180" aria-hidden="true">
          <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>
      <div className="mt-4 flex flex-col gap-2.5 text-[13px] leading-relaxed text-gray-600">{children}</div>
    </details>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl bg-gray-50 px-3.5 py-3 text-[12px] leading-relaxed text-gray-500">{children}</div>;
}

function PolicyTable({ headers, rows, minWidth = "min-w-[640px]" }: {
  headers: string[];
  rows: string[][];
  minWidth?: string;
}) {
  return (
    <div className="-mx-1 overflow-x-auto">
      <table className={`w-full ${minWidth} border-collapse text-[11px]`}>
        <thead>
          <tr className="border-b border-gray-100 text-left align-top text-gray-400">
            {headers.map((header) => <th key={header} className="py-2 pr-3 font-medium last:pr-0">{header}</th>)}
          </tr>
        </thead>
        <tbody className="text-gray-600">
          {rows.map((row) => (
            <tr key={row.join("|")} className="border-b border-gray-50 align-top">
              {row.map((cell, index) => <td key={`${index}-${cell}`} className="whitespace-pre-line py-2.5 pr-3 last:pr-0">{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <a href={href} target="_blank" rel="noreferrer" className="font-semibold text-[var(--ac-600)] underline underline-offset-2">{children}</a>;
}

const summaryCards = [
  ["실제 금융 연동", "없음 · 합성 시연 데이터"],
  ["기기 저장", "브라우저 localStorage"],
  ["외부 처리", "AI·검증·관리형 DB"],
  ["자체 AI 학습", "이용자 정보 미사용"],
];

const navigation = [
  ["처리 항목", "items"], ["보유·삭제", "retention"], ["가족 공유", "family"],
  ["외부 서비스", "external"], ["AI 처리", "ai"], ["권리 행사", "rights"],
];

export default function PrivacyPolicy({ onBack }: { onBack: () => void }) {
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleted, setDeleted] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  const deleteAllLocalData = () => {
    clearAnsimLocalData();
    setDeleteConfirm(false);
    setDeleted(true);
  };

  const revealSection = (id: string) => {
    const section = document.getElementById(id) as HTMLDetailsElement | null;
    if (!section) return;
    section.open = true;
  };

  return (
    <div className="flex flex-col gap-4 pb-10">
      <PageHeader title="개인정보처리방침" onBack={onBack} />

      <div className="rounded-2xl bg-[var(--ac-50)] p-4">
        <p className="text-[13px] font-bold leading-relaxed text-[var(--ac-700)]">
          안심동행 AI 운영팀(이하 “운영팀”)은 이용자가 어떤 정보를 왜 처리하는지 쉽게 확인할 수 있도록 공개합니다.
        </p>
        <p className="mt-2 text-[11px] leading-relaxed text-[var(--ac-600)]">
          이 방침은 현재 공개된 공모전 검증용 프로토타입에 적용됩니다. 한결은행·나눔은행은 가상 금융회사이며,
          금융보안원 또는 실제 금융회사가 운영·보증·제휴한 서비스가 아닙니다.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {summaryCards.map(([label, value]) => (
          <div key={label} className="rounded-xl border border-gray-100 bg-white px-3 py-3">
            <p className="text-[10px] text-gray-400">{label}</p>
            <p className="mt-1 text-[12px] font-semibold text-gray-800">{value}</p>
          </div>
        ))}
      </div>

      <nav aria-label="개인정보처리방침 바로가기" className="rounded-2xl bg-white p-4">
        <p className="mb-2 text-[12px] font-bold text-gray-700">바로 확인하기</p>
        <div className="flex flex-wrap gap-2">
          {navigation.map(([label, id]) => (
            <a key={id} href={`#${id}`} onClick={() => revealSection(id)} className="rounded-full bg-gray-100 px-3 py-1.5 text-[11px] font-semibold text-gray-600 active:scale-95">{label}</a>
          ))}
        </div>
      </nav>

      <section className="rounded-2xl border border-[var(--ac-100)] bg-white p-5">
        <h2 className="text-[15px] font-bold text-gray-900">현재 구현과 목표 구조를 구분합니다</h2>
        <div className="mt-3 grid gap-3">
          <div className="rounded-xl bg-gray-50 p-4">
            <p className="text-[12px] font-bold text-gray-800">현재 공모전 프로토타입</p>
            <p className="mt-1 text-[11px] leading-relaxed text-gray-500">하나의 브라우저에서 부모·자녀 역할을 바꾸어 시연합니다. 실제 계좌·거래원장·통화·문자·가족 기기·112·금융기관 접수 시스템과 연결되지 않습니다.</p>
          </div>
          <div className="rounded-xl bg-[var(--ac-50)] p-4">
            <p className="text-[12px] font-bold text-[var(--ac-700)]">목표 공동 허브 모델 · 제안 구조</p>
            <p className="mt-1 text-[11px] leading-relaxed text-[var(--ac-600)]">금융보안 분야의 공동 허브를 중심으로 참여 금융회사가 같은 안심동행 AI를 제공하고, 서로 다른 금융회사를 이용하는 부모와 자녀도 양측 확인·동의 후 연결하는 구조를 제안합니다. 실제 도입 시 각 금융회사의 처리 책임, 허브의 수탁 범위, 금융회사 간 제공 항목과 보유기간은 계약과 법률 검토를 거쳐 별도로 고지합니다.</p>
          </div>
        </div>
      </section>

      <Section id="purpose" title="제1조 처리 목적과 서비스 범위" open>
        <p>운영팀은 이용자가 직접 선택한 기능을 제공하기 위해 필요한 범위에서 정보를 처리합니다.</p>
        <ol className="flex list-inside list-decimal flex-col gap-1.5 pl-1">
          <li>송금 입력정보와 평소 거래패턴을 이용한 보이스피싱 위험 분석</li>
          <li>전화번호·URL·기관명의 공개 정보와 위험 여부 확인</li>
          <li>AI 상담, 송금 의도 분석, 관련 공식 금융사기 자료 제공</li>
          <li>가족 연결·보호 단계·위험 알림·가족 확인 흐름 시연</li>
          <li>금융사기 피해 대응 순서, 모의 신청서와 체크리스트 제공</li>
          <li>기기 내 문의내역·모의 포트폴리오·접근성 설정 유지</li>
          <li>서비스 오류 확인, 보안 유지와 부정 이용 방지</li>
        </ol>
        <Note>실제 잔액 조회·송금·한도 변경·예적금 해지·기관 신고를 수행하지 않습니다. 실제 금융서비스와 연결하기 전 처리방침과 필요한 동의 절차를 먼저 갱신합니다.</Note>
      </Section>

      <Section id="items" title="제2조 처리 항목·방법·법적 근거" open>
        <PolicyTable headers={["기능", "처리 항목", "처리 위치·방법", "처리 근거"]} rows={[
          ["송금 위험 분석", "은행명, 출금계좌, 수취인명·계좌, 송금액, 입력 시각\n파생값: 신규 수취인, 금액 구간, 위험점수·등급·근거", "API 요청 중 서버에서 처리\n상담 저장·가족 확인 선택 시 일부 기기 저장", "이용자가 요청한 서비스 제공\n법 제15조제1항제4호"],
          ["전화번호 검증", "입력 전화번호, 공개 웹 검색 결과, 공식·위험 정황", "서버와 NAVER 검색 API에서 요청 단위 처리", "이용자가 요청한 서비스 제공\n법 제15조제1항제4호"],
          ["URL·기관 검증", "입력 URL, 기관명, 위협·등록 확인 결과", "KISA 피싱사이트 목록(서버 내 CSV) 우선 확인 후\nGoogle Safe Browsing 및 공공데이터 API 요청", "이용자가 요청한 서비스 제공\n법 제15조제1항제4호"],
          ["AI 상담·검색", "상담 질문·답변, 규칙으로 마스킹된 문자열, 송금액·금액 구간, 신규 수취인·최근 통화 여부, 거래 비교값, 위험점수·코드, 검색자료 일부와 분석결과", "Gemini·Embedding API에서 요청 단위 처리\n저장 상담은 기기에 최근 5건", "이용자가 요청한 서비스 제공\n법 제15조제1항제4호"],
          ["거래패턴·관계 검색", "가상 사용자 ID, 조회시각, 수취인 파생 참조값, 범주형 위험·채널·행동 코드", "Supabase 거래패턴 조회와 Neo4j 관계 검색", "이용자가 요청한 서비스 제공\n법 제15조제1항제4호"],
          ["가족 보호 시연", "연결코드·상태·시각, 보호단계·임계값, 금액, 마스킹 계좌표시, 위험근거, 가족 확인 요청 당시의 상담내용과 가족 의견", "같은 브라우저의 localStorage에서 부모·자녀 화면 간 공유", "이용자가 요청한 서비스 제공\n법 제15조제1항제4호"],
          ["통화 연계 시연", "최근 통화시각, 통화 중 탐지된 범주형 위험 문구 표시값", "기기 localStorage에 저장\n실제 통화 음성·녹음·통화 원문은 수집하지 않음", "이용자가 요청한 서비스 제공\n법 제15조제1항제4호"],
          ["피해대응·문의·포트폴리오", "모의 피해정보·처리상태, 문의 내용·시각, 종목·수량·평균매입가", "기기 localStorage에 저장\n실제 기관·상담원·증권사로 전송하지 않음", "이용자가 요청한 서비스 제공\n법 제15조제1항제4호"],
          ["운영·보안", "IP, 브라우저·기기 정보, 접속시각, 요청 경로·상태, 오류기록", "호스팅·API 운영 과정에서 자동 생성될 수 있음", "서비스 제공 및 보안상 정당한 이익\n법 제15조제1항제4호·제6호"],
        ]} />
        <Note>주민등록번호, 비밀번호, 보안카드·OTP, 카드번호, 인증서, 생체정보를 요구하지 않습니다. 상담 대화에 이러한 민감정보나 타인의 고유식별정보를 직접 입력하지 마세요. 정규식 마스킹은 전화번호·이메일·URL·긴 숫자열 등을 줄이는 보조조치이며 이름·주소 등 모든 개인정보를 완전히 제거하지는 못합니다.</Note>
      </Section>

      <Section id="retention" title="제3조 보유기간과 파기">
        <PolicyTable headers={["구분", "현재 보유 기준", "삭제 방법"]} minWidth="min-w-[560px]" rows={[
          ["API 입력과 분석 결과", "운영팀 애플리케이션 DB에 별도 적재하지 않음", "요청 처리 후 별도 보관하지 않음\n단, 외부 사업자 보안·오류 로그는 별도 기준 적용"],
          ["AI 상담", "기기 최근 5건", "기록별 삭제 또는 전체 삭제"],
          ["가족 보호 로그", "기기 최근 20건", "기록별 삭제 또는 전체 삭제"],
          ["가족 위험 알림", "현재 별도 건수 제한 없이 기기에 저장", "기록별 삭제"],
          ["가족 연결·보호 설정", "연결 또는 설정 유지 중", "연결 해제 또는 전체 삭제"],
          ["연결·설정 알림", "기기 최근 50건", "전체 삭제"],
          ["문의·모의 피해대응", "각 기기 최근 20건", "전체 삭제"],
          ["최근 통화시각·통화 위험문구 표시값", "새 시연값으로 바뀌거나 이용자가 삭제할 때까지", "최근 통화시각은 전체 삭제\n위험문구 표시값은 현재 브라우저 저장정보 직접 삭제 필요"],
          ["포트폴리오·화면 설정", "이용자가 변경하거나 삭제할 때까지", "전체 삭제"],
          ["호스팅·외부 사업자 로그", "각 사업자의 계약·보안 설정과 관련 법령에 따른 기간", "각 사업자 정책과 운영팀 권리행사 절차"],
        ]} />
        <p>보유기간이 끝나거나 처리 목적을 달성한 정보는 지체 없이 삭제합니다. 현재 실제 금융거래 원장이나 지급정지 조치내역을 운영하지 않으므로 이를 이유로 이용자 입력을 5년간 보관하지 않습니다.</p>
      </Section>

      <Section id="family" title="제4조 가족 공유와 공동 허브 모델">
        <p>현재 가족 페어링은 동일 브라우저의 역할 전환 시연이므로 다른 사람의 기기로 네트워크 전송되는 제3자 제공이 아닙니다.</p>
        <div className="rounded-xl border border-gray-100 p-3.5">
          <p className="font-bold text-gray-800">현재 공유되는 최소 범위</p>
          <p className="mt-1">위험등급·위험근거, 송금액, 수취은행과 계좌 끝 4자리, 요청시각, 가족 확인 요청 당시 저장된 상담 메시지, 가족의 확인 의견</p>
          <p className="mt-2 font-bold text-gray-800">공유하지 않는 항목</p>
          <p className="mt-1">잔액, 전체 거래내역, 비밀번호·인증정보, 다른 금융상품 정보</p>
        </div>
        <p>실제 공동 허브 도입 시에는 부모·자녀 각각의 금융회사, 공동 허브, 연결 상대방의 역할을 확정하고 제공받는 자·목적·항목·보유기간·동의 거부권을 연결 화면에서 별도로 알린 뒤 양측 동의를 받습니다.</p>
      </Section>

      <Section id="external" title="제5조 국내 외부 서비스와 국외 이전" open>
        <p className="font-bold text-gray-800">국내 외부 서비스</p>
        <PolicyTable headers={["서비스", "목적", "전송 항목", "운영팀 보관"]} minWidth="min-w-[560px]" rows={[
          ["KISA 피싱사이트 목록\n(data.go.kr 스냅샷)", "URL 국내 피싱사이트 여부 확인", "입력 URL의 도메인·경로", "서버 내 CSV 조회로\n외부 전송 없음"],
          ["NAVER Cloud 검색 API", "전화번호 공개 웹문서 확인", "입력 전화번호", "응답 후 별도 저장하지 않음"],
          ["예금보험공사·금융위원회 공공데이터 API", "금융회사·기관 등록정보 확인", "기관명 등 공개 조회값", "응답 후 별도 저장하지 않음"],
        ]} />
        <p className="mt-2 font-bold text-gray-800">국외 처리·이전</p>
        <PolicyTable headers={["이전받는 자", "목적·항목", "시기·방법", "보유 기준"]} rows={[
          ["Google LLC", "Gemini·Embedding: 규칙 마스킹 대화, 송금액·구간, 수취인·통화 여부, 거래 비교값, 위험코드와 검색자료 일부\nSafe Browsing: 검사 URL\nYouTube: 재생 시 접속·기기 정보", "해당 기능 요청 또는 영상 재생 시 HTTPS", "Google 설정·적용 요금제·정책과 관련 법령에 따른 기간"],
          ["Vercel Inc.", "웹 호스팅·API 실행·보안\nIP, 접속·오류기록 및 요청 처리 입력", "페이지 접속·API 요청 시 HTTPS", "프로젝트·보안 설정과 관련 법령에 따른 기간"],
          ["Supabase Inc.", "가상 거래패턴 비교\n가상 사용자 ID, 조회시각, 수취인 파생 참조값", "송금 의도 분석 시 암호화된 DB 연결", "가상 데이터는 데모 운영기간\n요청값 별도 적재 없음"],
          ["Neo4j Inc.", "사기 진행 관계 검색\n범주형 위험·채널·사칭대상·행동 코드", "위험 대화 분석 시 HTTPS", "지식그래프는 데모 운영기간\n대화 원문 별도 적재 없음"],
        ]} />
        <p>국외 처리는 이용자가 요청한 기능 제공에 필요한 처리위탁·보관으로서 개인정보 보호법 제28조의8제1항제3호를 근거로 합니다. 현재 프로토타입에서는 외부 사업자의 프로젝트 설정에 따라 미국을 포함한 해외 인프라에서 처리될 수 있습니다. 국외 처리를 원하지 않으면 해당 AI 분석·URL 검사·영상 재생 기능을 사용하지 않을 수 있으나, 해당 기능의 결과는 제공되지 않습니다.</p>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
          <ExternalLink href="https://policies.google.com/privacy">Google 정책</ExternalLink>
          <ExternalLink href="https://vercel.com/legal/privacy-policy">Vercel 정책</ExternalLink>
          <ExternalLink href="https://supabase.com/privacy">Supabase 정책</ExternalLink>
          <ExternalLink href="https://neo4j.com/privacy-policy/">Neo4j 정책</ExternalLink>
        </div>
        <Note>외부 사업자의 정확한 데이터 리전·재수탁자·보안 로그 기간은 계약, 적용 요금제와 프로젝트 설정에 따라 달라질 수 있습니다. 현재 확정되지 않은 사항을 특정 국가나 기간으로 단정하지 않으며, 정식 운영 전 이전 국가·수령 법인과 연락처·보유기간·거부 절차를 실제 계약 내용에 맞춰 확정 고지합니다.</Note>
      </Section>

      <Section id="device" title="제6조 기기 저장정보·쿠키·외부 콘텐츠">
        <p>광고·행태추적용 쿠키는 사용하지 않습니다. 가족 연결, 보호 설정, 상담, 가족 기록·위험 알림, 피해대응, 문의, 포트폴리오, 큰글씨 설정, 최근 통화 시각과 통화 중 탐지된 범주형 위험 문구 표시값은 브라우저 localStorage에 저장됩니다. 실제 통화 음성·녹음·통화 원문은 수집하지 않습니다.</p>
        <p>페이지를 여는 것만으로 외부 글꼴 서버에 접속하지 않도록 기기 기본 글꼴을 사용합니다. 공식 예방 영상의 외부 썸네일도 미리 불러오지 않으며, 이용자가 재생을 선택한 뒤에만 YouTube의 개인정보 처리방침에 따라 연결됩니다.</p>
        <p>답변 듣기는 사용자가 누를 때 브라우저·운영체제의 음성합성 기능을 호출합니다. 운영팀은 음성 파일이나 마이크 입력을 수집하지 않습니다.</p>
        <Note>공용 기기에서는 다른 사용자가 저장 기록을 볼 수 있습니다. 이용 후 개별 기록 또는 아래의 전체 저장정보를 삭제해 주세요.</Note>
      </Section>

      <Section id="ai" title="제7조 AI 처리와 위험 결정" open>
        <p>AI는 상담에서 위험 신호를 구조화하고 이용자가 이해하기 쉬운 설명을 만드는 보조수단입니다. 최종 등급과 화면 조치는 사전에 정한 규칙, 공개 검증 결과와 이용자 답변을 함께 반영합니다.</p>
        <ul className="flex list-inside list-disc flex-col gap-1 pl-1">
          <li>입력: 규칙 마스킹 대화, 정확한 송금액과 금액 구간, 신규 수취인 여부, 통화 여부, 거래 비교값, 검증결과·위험신호 및 관련 검색자료 일부</li>
          <li>결과: 위험점수·등급, 의심 유형, 판단 근거와 권장 행동</li>
          <li>오류 시: 외부 AI 결과를 그대로 사용하지 않고 보수적인 서버 규칙으로 대체</li>
          <li>D등급 지연: 앱 화면의 모의 보호조치이며 실제 계좌나 송금을 정지하지 않음. 이용자는 추가 확인 과정을 거친 뒤 송금을 계속하거나 중단할 수 있음</li>
          <li>재검토: 상담 계속하기, 공식 채널 확인, 가족 의견 확인 후 이용자가 최종 판단</li>
          <li>설명·재검토: 현재 결과는 실제 금융상 권리·의무에 영향을 주는 완전히 자동화된 결정이 아닙니다. 이용자는 결과의 설명을 확인하고 상담·공식 채널·가족 확인을 통해 다시 검토할 수 있으며, 제12조의 문의 채널로 이의를 제기할 수 있습니다</li>
        </ul>
        <p>이용자 입력을 운영팀 자체 AI 모델의 학습·미세조정 자료로 사용하지 않습니다. Gemini API에서 입력·응답이 모델 개선에 사용되는지는 실제 적용 요금제와 Google의 이용조건에 따르며, 안전·부정 이용 탐지를 위한 로그가 별도로 처리될 수 있습니다. 학습 목적으로 변경할 경우 별도의 목적·항목·보유기간과 동의 절차를 먼저 마련하고, 이용자의 학습 거부 방법을 함께 안내합니다.</p>
      </Section>

      <Section id="security" title="제8조 안전성 확보조치">
        <ul className="flex list-inside list-disc flex-col gap-1 pl-1">
          <li>API 키와 DB 접속정보를 브라우저가 아닌 서버 환경변수로 관리</li>
          <li>서비스·외부 API·관리형 DB 사이 암호화 통신</li>
          <li>주민등록번호·전화번호·이메일·URL·긴 숫자열 규칙 마스킹</li>
          <li>Gemini에 원문 계좌번호를 전달하지 않고, 송금액·금액 구간·수취인 표시 유형과 위험 분석에 필요한 맥락만 전달</li>
          <li>Neo4j에 원문 대화 대신 범주형 위험 코드 전달</li>
          <li>프롬프트 인젝션 방어, 응답 구조 검증과 안전 문구 대체</li>
          <li>가족 공유 계좌 마스킹과 잔액·전체 거래내역 제외</li>
        </ul>
      </Section>

      <Section id="rights" title="제9조 이용자의 권리와 저장정보 삭제" open>
        <p>이용자는 개인정보의 열람·정정·삭제·처리정지 및 동의 철회를 요구할 수 있습니다. 현재 기기에 저장된 정보는 기록별 삭제, 가족 연결 해제 또는 아래 앱 내 저장정보 삭제 기능으로 제거할 수 있습니다. 다만 이 기능에는 가족 위험 알림과 통화 위험문구 표시값이 포함되지 않으므로, 완전한 삭제가 필요한 경우 브라우저의 사이트 저장정보를 직접 삭제해야 합니다.</p>
        <div className="rounded-xl border border-red-100 bg-red-50 p-4">
          <p className="text-[13px] font-bold text-red-700">이 기기의 앱 내 저장정보 삭제</p>
          <p className="mt-1 text-[11px] leading-relaxed text-red-500">가족 연결·보호 로그, 상담 기록, 문의, 피해대응, 포트폴리오와 화면 설정을 삭제하며 되돌릴 수 없습니다. 가족 위험 알림과 통화 위험문구 표시값은 브라우저의 사이트 저장정보에서 별도로 삭제해야 합니다. 실제 은행 데이터에는 영향이 없습니다.</p>
          {deleted ? (
            <p className="mt-3 rounded-lg bg-white px-3 py-2 text-[12px] font-bold text-green-600">전체 삭제 기능의 대상인 안심동행 데이터를 삭제했습니다.</p>
          ) : deleteConfirm ? (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setDeleteConfirm(false)} className="rounded-xl border border-gray-200 bg-white py-2.5 text-[12px] font-semibold text-gray-600">취소</button>
              <button type="button" onClick={deleteAllLocalData} className="rounded-xl bg-red-500 py-2.5 text-[12px] font-bold text-white">모두 삭제</button>
            </div>
          ) : (
            <button type="button" onClick={() => setDeleteConfirm(true)} className="mt-3 w-full rounded-xl border border-red-200 bg-white py-2.5 text-[12px] font-bold text-red-600">앱 내 저장정보 삭제</button>
          )}
        </div>
        <Note>앱의 1:1 문의는 현재 기기에만 저장되는 시연 기능으로 운영팀에 전송되지 않습니다. 브라우저 저장정보 삭제는 사용 중인 브라우저의 사이트 데이터 설정에서도 할 수 있습니다. 서버·외부 사업자 처리에 관한 권리행사는 제12조의 문의 채널을 이용합니다.</Note>
      </Section>

      <Section id="children" title="제10조 아동·고령 이용자 보호">
        <p>부모·자녀 역할은 성인 가족 구성원의 보호 흐름을 시연하기 위한 것입니다. 만 14세 미만 아동의 정보를 의도적으로 수집하지 않으며 확인될 경우 지체 없이 삭제합니다.</p>
        <p>고령 이용자가 처리 내용을 이해할 수 있도록 핵심 요약, 쉬운 표현, 큰글씨 화면과 단계별 재확인을 제공합니다. 가족 보호는 감시 기능이 아니라 부모가 범위를 정하고 언제든 회수할 수 있는 선택 기능으로 설계합니다.</p>
      </Section>

      <Section id="damage" title="제11조 피해대응 기능의 한계">
        <p>피해대응 화면은 지급정지 요청, 112 신고, 피해구제 신청과 증거 보관 순서를 안내하고 모의 신청서·체크리스트를 기기에 저장합니다.</p>
        <p>화면의 “접수 완료”, 접수번호와 전달 상태는 시연용이며 실제 금융회사·경찰에 신청하거나 계좌를 동결하지 않습니다. 실제 피해가 의심되면 해당 금융회사의 공식 대표번호와 112에 직접 연락해야 합니다.</p>
      </Section>

      <Section id="contact" title="제12조 개인정보 문의와 권익침해 구제">
        <p>개인정보 처리 관련 문의·권리행사·불만은 아래 담당자에게 요청할 수 있습니다.</p>
        <div className="rounded-xl bg-gray-50 p-3.5">
          <p>담당: 안심동행 AI 운영팀 개인정보 담당자</p>
          <p>이메일: seojun0007@naver.com</p>
          <p className="mt-1 text-[11px] text-gray-400">공모전 프로토타입 문의 채널이며, 정식 운영 전 사업자 정보와 공식 연락처를 확정해 다시 고지합니다.</p>
        </div>
        <p>이메일에 요청 내용과 회신받을 주소를 적어 접수하면 운영팀이 요청자를 확인한 뒤 처리 가능 여부와 결과를 회신합니다. AI 결과의 설명·재검토 요청이나 개인정보 노출 신고도 같은 채널로 접수할 수 있습니다. 법령상 제한 사유가 있거나 외부 사업자 확인이 필요한 경우 그 사유와 필요한 절차를 함께 안내합니다.</p>
        <ul className="flex list-inside list-disc flex-col gap-1 pl-1">
          <li>개인정보 침해신고센터: 118 · <ExternalLink href="https://privacy.kisa.or.kr">privacy.kisa.or.kr</ExternalLink></li>
          <li>개인정보 분쟁조정위원회: 1833-6972 · <ExternalLink href="https://www.kopico.go.kr">kopico.go.kr</ExternalLink></li>
          <li>대검찰청: 1301 · <ExternalLink href="https://www.spo.go.kr">spo.go.kr</ExternalLink></li>
          <li>경찰청: 182 · <ExternalLink href="https://ecrm.police.go.kr">ecrm.police.go.kr</ExternalLink></li>
        </ul>
      </Section>

      <Section id="revision" title="제13조 변경과 이전 버전">
        <p>기능, 외부 서비스, 공유 범위, 보유기간 또는 법령이 바뀌면 변경 내용과 시행일을 서비스 안에서 알립니다. 이용자 권리에 중요한 변경은 적용 전에 충분한 기간을 두고 안내합니다.</p>
        <p>현재 공개된 버전은 2026년 9월 4일 개정본입니다. 이번 개정에서는 실제 AI 전송항목, 가족·통화 관련 기기 저장정보, 삭제 범위, 국외 처리와 AI 결과 설명을 현재 프로토타입 동작에 맞게 구체화했습니다.</p>
        <p className="text-gray-400">최초 시행일자: 2026년 9월 3일 · 개정 공고·시행일자: 2026년 9월 4일</p>
      </Section>
    </div>
  );
}
