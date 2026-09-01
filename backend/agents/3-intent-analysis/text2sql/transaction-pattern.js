import { getText2SqlClient } from "./client.js";

const DEFAULT_USER_ID = "demo-parent-01";
const USER_ID_PATTERN = /^demo-parent-0[1-3]$/;

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function currentHour(value) {
  const date = new Date(value);
  const validDate = Number.isNaN(date.getTime()) ? new Date() : date;
  const hour = Number(new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    hour12: false,
  }).format(validDate));
  return hour % 24;
}

function errorKind(error) {
  const message = String(error?.message || error || "");
  if (/timeout|timed out/i.test(message)) return "timeout";
  if (/password|authentication|28P01/i.test(message)) return "authentication";
  if (/relation .* does not exist|42P01/i.test(message)) return "schema_missing";
  if (/ENOTFOUND|ECONNREFUSED|network|connect/i.test(message)) return "connection";
  return "query_failed";
}

export function calculatePatternRisk(stats = {}, current = {}) {
  const reasons = [];
  let score = 0;
  const amount = number(current.amount);
  const average = number(stats.average_transfer_amount);
  const maximum = number(stats.maximum_transfer_amount);
  const recipientCount = number(stats.recipient_transfer_count);
  const transferCount = number(stats.transfer_count);
  const hour = number(current.hour);
  const typicalHour = number(stats.typical_transfer_hour);

  if (transferCount >= 3 && recipientCount === 0) {
    score += 10;
    reasons.push("최근 12개월에 보내지 않은 수취인");
  }
  if (maximum > 0 && amount >= maximum * 2) {
    score += 15;
    reasons.push("과거 최대 송금액의 2배 이상");
  } else if (average > 0 && amount >= average * 4) {
    score += 10;
    reasons.push("평균 송금액의 4배 이상");
  }
  if (amount >= 10_000_000 && maximum < 3_000_000) {
    score += 10;
    reasons.push("과거에 없던 1천만원 이상 고액 송금");
  }
  const hourDifference = Math.min(Math.abs(hour - typicalHour), 24 - Math.abs(hour - typicalHour));
  if ((hour < 6 || hour >= 22) && hourDifference >= 5) {
    score += 5;
    reasons.push("평소와 다른 심야 송금 시간");
  }

  return { score: Math.min(score, 40), reasons };
}

export async function retrieveTransactionPattern(input = {}, {
  config = {},
  client,
} = {}) {
  const transfer = input.transfer || {};
  const userId = USER_ID_PATTERN.test(String(transfer.user_id || ""))
    ? transfer.user_id
    : DEFAULT_USER_ID;
  const occurredAt = transfer.occurred_at || new Date().toISOString();
  const recipientHash = String(transfer.recipient_account_hash || "acct_unknown");
  const hour = currentHour(occurredAt);
  const resolved = client ? { sql: client, config: { enabled: true, timeoutMs: 5_000 } }
    : getText2SqlClient(config);

  if (!resolved.config.enabled || !resolved.sql) {
    return {
      status: "disabled",
      method: "supabase_parameterized_sql",
      user_id: userId,
      risk_score: 0,
      risk_reasons: [],
    };
  }

  try {
    const query = resolved.sql`
      with outgoing as (
        select occurred_at, amount, counterparty_account_hash, category,
               transaction_type, channel
        from public.transactions
        where user_id = ${userId}
          and direction = 'OUT'
          and occurred_at >= ${occurredAt}::timestamptz - interval '12 months'
          and occurred_at < ${occurredAt}::timestamptz
      ), transfers as (
        select * from outgoing
        where transaction_type = 'TRANSFER' or channel = 'MOBILE_TRANSFER'
      )
      select
        (select count(*) from outgoing)::int as outgoing_count,
        count(*)::int as transfer_count,
        coalesce(round(avg(amount))::bigint, 0) as average_transfer_amount,
        coalesce(round(percentile_cont(0.5) within group (order by amount))::bigint, 0) as median_transfer_amount,
        coalesce(max(amount), 0)::bigint as maximum_transfer_amount,
        count(*) filter (where counterparty_account_hash = ${recipientHash})::int as recipient_transfer_count,
        coalesce(round(mode() within group (order by extract(hour from occurred_at at time zone 'Asia/Seoul')))::int, 12) as typical_transfer_hour,
        (select count(*) from outgoing where category = 'FAMILY')::int as family_count,
        (select count(*) from outgoing where category = 'HOUSING')::int as housing_count,
        (select count(*) from outgoing where category in ('GROCERIES', 'HEALTHCARE', 'TRANSPORT', 'DINING', 'CONSUMPTION', 'HOUSEHOLD'))::int as consumption_count
      from transfers
    `;
    const rows = await Promise.race([
      query,
      new Promise((_, reject) => setTimeout(
        () => reject(new Error("Text2SQL timeout")),
        resolved.config.timeoutMs,
      )),
    ]);
    const row = rows[0] || {};
    const stats = {
      outgoing_count: number(row.outgoing_count),
      transfer_count: number(row.transfer_count),
      average_transfer_amount: number(row.average_transfer_amount),
      median_transfer_amount: number(row.median_transfer_amount),
      maximum_transfer_amount: number(row.maximum_transfer_amount),
      recipient_transfer_count: number(row.recipient_transfer_count),
      typical_transfer_hour: number(row.typical_transfer_hour),
      family_count: number(row.family_count),
      housing_count: number(row.housing_count),
      consumption_count: number(row.consumption_count),
    };
    const risk = calculatePatternRisk(stats, { amount: transfer.amount, hour });
    return {
      status: "ready",
      method: "supabase_parameterized_sql",
      query_intent: "최근 12개월 송금액·수취인·시간대·생활 패턴 비교",
      user_id: userId,
      lookback_months: 12,
      ...stats,
      recipient_known: stats.recipient_transfer_count > 0,
      current_amount: number(transfer.amount),
      current_hour: hour,
      risk_score: risk.score,
      risk_reasons: risk.reasons,
    };
  } catch (error) {
    console.warn(`[Text2SQL] 거래 패턴 조회 실패 → 기존 판정 유지: ${errorKind(error)}`);
    return {
      status: "unavailable",
      method: "supabase_parameterized_sql",
      user_id: userId,
      reason: errorKind(error),
      risk_score: 0,
      risk_reasons: [],
    };
  }
}

export function formatTransactionPatternContext(pattern = {}) {
  if (pattern.status !== "ready") return "[개인 거래 패턴 근거]\n조회되지 않음";
  const known = pattern.recipient_known
    ? `최근 12개월 ${pattern.recipient_transfer_count}회 송금한 수취인`
    : "최근 12개월 송금 이력이 없는 수취인";
  return [
    "[개인 거래 패턴 근거]",
    `비교 기간: 최근 ${pattern.lookback_months}개월`,
    `현재 송금액: ${number(pattern.current_amount).toLocaleString("ko-KR")}원`,
    `평균 송금액: ${number(pattern.average_transfer_amount).toLocaleString("ko-KR")}원`,
    `최대 송금액: ${number(pattern.maximum_transfer_amount).toLocaleString("ko-KR")}원`,
    `수취인 이력: ${known}`,
    `주요 송금 시간: ${pattern.typical_transfer_hour}시 전후`,
    `개인 패턴 위험 점수: ${number(pattern.risk_score)}점`,
    `현재 거래와 다른 점: ${(pattern.risk_reasons || []).join(", ") || "뚜렷한 차이 없음"}`,
  ].join("\n");
}
