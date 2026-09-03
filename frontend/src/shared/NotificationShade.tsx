// 알림함 — 은행 앱 안의 페이지다. (폰 알림창이 아니다)
// 오른쪽에서 밀려 들어오고, 뒤로가기로 나간다.

import { useCallback, useEffect, useRef, useState } from "react";
import { readNotices, TRANSACTIONS, MY_ACCOUNTS, CHILD_ACCOUNT, type TxnRow } from "./data";
import { PROTECTION_LEVELS, getProtectionDisplayLevel } from "./protection";

type NotificationShadeProps = {
  role: "parent" | "child";
  hasRiskAlert?: boolean;
  onClose: () => void;
  onOpenRiskAlert?: () => void;
  /** 지금 세션에서 새로 생긴 거래 (송금·중도해지 등) — 저장된 내역보다 먼저 보여준다 */
  extraTxns?: TxnRow[];
};

type Notice = {
  icon: "shield" | "mail" | "family" | "money" | "gift" | "unlink";
  title: string;
  body: string;
  date: string;
  accent?: boolean;          // 위험 알림은 제목을 강조한다
  onClick?: () => void;
};

const ICONS: Record<Notice["icon"], React.ReactNode> = {
  shield: <path d="M12 2l8 3.5v6c0 4.6-3.4 8.9-8 10.5-4.6-1.6-8-5.9-8-10.5v-6L12 2z" />,
  mail:   <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></>,
  family: <><circle cx="8" cy="9" r="3" /><circle cx="16" cy="9" r="3" /><path d="M3 19c0-2.5 2.2-4.5 5-4.5S13 16.5 13 19M13 19c0-2.5 2.2-4.5 5-4.5s3 1.4 3 4.5" /></>,
  money:  <><circle cx="12" cy="12" r="9" /><path d="M9 9h6M9 12h6M12 12v5" /></>,
  gift:   <><rect x="3" y="8" width="18" height="13" rx="2" /><path d="M3 12h18M12 8v13M12 8c-1.5-3-6-3-6 0h6zm0 0c1.5-3 6-3 6 0h-6z" /></>,
  unlink: <><path d="M9.5 14.5l-2 2a3.5 3.5 0 01-5-5l2-2M14.5 9.5l2-2a3.5 3.5 0 015 5l-2 2" /><path d="M3 3l18 18" /></>,
};

export default function NotificationShade({ role, hasRiskAlert = false, onClose, onOpenRiskAlert, extraTxns = [] }: NotificationShadeProps) {
  const [closing, setClosing] = useState(false);
  const closingRef = useRef(false);
  const closeTimer = useRef<number | null>(null);

  const requestClose = useCallback((afterClose = onClose) => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    closeTimer.current = window.setTimeout(afterClose, 260);
  }, [onClose]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => event.key === "Escape" && requestClose();
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      if (closeTimer.current) window.clearTimeout(closeTimer.current);
    };
  }, [requestClose]);

  const bankName = role === "parent" ? "한결은행" : "나눔은행";

  // 연결·해제 기록 — 지나간 사건이므로 지금 연결 상태와 무관하게 남는다. 최신순.
  const stamp = (iso: string) =>
    new Intl.DateTimeFormat("ko-KR", {
      month: "long", day: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true,
    }).format(new Date(iso));

  // 받침에 따라 조사가 달라진다 — "따님과" / "어머니와"
  const familyWith = role === "parent" ? "따님과" : "어머니와";

  // 가족 보호 범위는 부모가 정하지만, 바뀐 사실은 양쪽 앱에 똑같이 남는다.
  const levelName = (level?: number) => PROTECTION_LEVELS[level ?? 2]?.name ?? "";

  const pairingNotices: Notice[] = readNotices()
    .slice()
    .reverse()
    .map((e) => {
      if (e.type === "level-changed") {
        return {
          icon: "shield" as const,
          title: "안심동행 가족 보호 범위가 바뀌었어요",
          body: role === "parent"
            ? `Lv.${getProtectionDisplayLevel(e.from)} ${levelName(e.from)} → Lv.${getProtectionDisplayLevel(e.to)} ${levelName(e.to)} 로 변경했어요.`
            : `어머니가 Lv.${getProtectionDisplayLevel(e.from)} ${levelName(e.from)} → Lv.${getProtectionDisplayLevel(e.to)} ${levelName(e.to)} 로 바꾸셨어요.`,
          date: stamp(e.at),
        };
      }
      return e.type === "paired"
        ? {
            icon: "family" as const,
            title: `${familyWith} 안심동행이 연결됐어요`,
            body: role === "parent"
              ? "이제 위험한 송금이 있으면 따님이 함께 확인해드려요."
              : "어머니 계좌에 위험한 거래가 생기면 알려드려요.",
            date: stamp(e.at),
          }
        : {
            icon: "unlink" as const,
            title: `${familyWith} 안심동행 연결이 해제됐어요`,
            body: "이제 위험 거래 알림이 전달되지 않아요. 계좌와 거래내역은 그대로예요.",
            date: stamp(e.at),
          };
    });

  const fresh: Notice[] =
    role === "child" && hasRiskAlert
      ? [{
          icon: "shield",
          title: "어머니의 위험 송금을 확인해주세요",
          body: "평소와 다른 300만원 송금이 잠시 보류됐어요.",
          date: "방금",
          accent: true,
          onClick: () => requestClose(onOpenRiskAlert ?? onClose),
        }]
      : [];

  // 계좌의 입출금 내역도 알림처럼 보여준다 — 실제 은행 앱처럼 거래가 생길 때마다 알림이 쌓이는 걸 재현.
  const txnDate = (mmdd: string) => {
    const [m, d] = mmdd.split(".").map(Number);
    return `${m}월 ${d}일`;
  };

  const account = role === "parent" ? MY_ACCOUNTS[0] : CHILD_ACCOUNT;
  const accountLabel = `${account.name}(${account.account.slice(-4)})`;

  const txnNotices: Notice[] = [...extraTxns, ...(TRANSACTIONS[account.account] ?? [])].map((t) => ({
    icon: "money" as const,
    title: accountLabel,
    body: `${t.amount > 0 ? "입금" : "출금"} ${Math.abs(t.amount).toLocaleString()}원 | ${t.name}`,
    date: txnDate(t.date),
  }));

  const marketingNotices: Notice[] = role === "parent"
    ? [{ icon: "gift" as const, title: "안심 정기예금 금리가 올랐어요",  body: "연 3.5%로 12개월 예치하실 수 있어요.", date: "7월 28일" }]
    : [{ icon: "gift" as const, title: "나눔 적금 이벤트가 시작됐어요",   body: "매주 저축할 때마다 추가 금리를 드려요.", date: "7월 25일" }];

  const earlier: Notice[] = [...pairingNotices, ...txnNotices, ...marketingNotices];

  const row = (n: Notice, i: number) => {
    const Tag = n.onClick ? "button" : "div";
    return (
      <Tag
        key={i}
        {...(n.onClick ? { onClick: n.onClick } : {})}
        className={`flex w-full items-start gap-3.5 px-5 py-5 text-left ${n.onClick ? "active:bg-black/5 transition-colors" : ""}`}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke={n.accent ? "#dc2626" : "currentColor"} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
          className={`mt-0.5 h-6 w-6 shrink-0 ${n.accent ? "" : "text-gray-800"}`}>
          {ICONS[n.icon]}
        </svg>
        <span className="min-w-0 flex-1">
          <span className={`block text-[16px] font-bold leading-snug ${n.accent ? "text-red-600" : "text-gray-900"}`}>{n.title}</span>
          <span className="mt-1 block text-[14px] leading-snug text-gray-600">{n.body}</span>
          <span className="mt-1.5 block text-[13px] text-gray-400">{n.date}</span>
        </span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
          className="mt-1 h-4 w-4 shrink-0 text-gray-300"><path d="M9 6l6 6-6 6" /></svg>
      </Tag>
    );
  };

  return (
    <div className="fixed inset-0 z-[100] flex justify-center" role="dialog" aria-label="알림" aria-modal="true">
      <button
        aria-label="알림 닫기"
        onClick={() => requestClose()}
        className={`absolute inset-0 bg-black/25 ${closing ? "notification-backdrop-out" : "notification-backdrop"}`}
      />

      <div className="absolute inset-y-0 left-1/2 w-full max-w-[430px] -translate-x-1/2 overflow-hidden">
      <section className={`${closing ? "notification-shade-out" : "notification-shade"} relative flex h-dvh max-h-dvh w-full flex-col overflow-hidden bg-white shadow-2xl`}>
        {/* 헤더 */}
        <div className="relative flex shrink-0 items-center justify-center border-b border-gray-100 px-4 py-4">
          <button aria-label="뒤로" onClick={() => requestClose()} className="absolute left-3 rounded-full p-1.5 text-gray-700 active:scale-90 transition-transform">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <p className="text-[17px] font-bold text-gray-900">알림</p>
        </div>

        <div className={`min-h-0 flex-1 overflow-y-auto overscroll-contain ${role === "parent" ? "bg-[#e2edfe]" : "bg-[#fbfcf9]"}`}>
          {fresh.length > 0 && (
            <>
              <p className="px-5 pt-6 pb-1 text-[17px] font-bold text-gray-900">새 알림</p>
              <div className="divide-y divide-gray-100 bg-white">{fresh.map(row)}</div>
            </>
          )}

          <p className="px-5 pt-6 pb-1 text-[17px] font-bold text-gray-900">이전 알림</p>
          <div className="divide-y divide-gray-100 bg-white">{earlier.map(row)}</div>

          <p className="px-5 py-8 text-center text-[13px] text-gray-400">
            최근 3개월 알림만 보여드려요 · {bankName}
          </p>
        </div>
      </section>
      </div>
    </div>
  );
}
