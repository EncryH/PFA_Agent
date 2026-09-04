import assert from "node:assert/strict";

import { closeText2SqlClient, getText2SqlClient } from "../text2sql/client.js";
import { retrieveTransactionPattern } from "../text2sql/transaction-pattern.js";

const { sql } = await getText2SqlClient();
if (!sql) throw new Error("SUPABASE_DATABASE_URL이 없거나 TEXT2SQL_ENABLED가 false입니다.");

try {
  const counts = await sql`
    select user_id, count(*)::int as transaction_count
    from public.transactions
    group by user_id
    order by user_id
  `;
  assert.deepEqual(counts.map((row) => row.user_id), [
    "demo-parent-01", "demo-parent-02", "demo-parent-03",
  ]);
  assert.ok(counts.every((row) => Number(row.transaction_count) >= 250));

  const suspicious = await retrieveTransactionPattern({
    transfer: {
      user_id: "demo-parent-01",
      occurred_at: "2026-08-31T18:00:00+09:00",
      amount: 12_000_000,
      recipient_account_hash: "acct_new_recipient",
    },
  }, { client: sql });
  assert.equal(suspicious.status, "ready");
  assert.equal(suspicious.recipient_known, false);
  assert.ok(suspicious.risk_score >= 30);

  const [knownRecipient] = await sql`
    select counterparty_account_hash, round(avg(amount))::bigint as average_amount
    from public.transactions
    where user_id = 'demo-parent-01'
      and direction = 'OUT'
      and (transaction_type = 'TRANSFER' or channel = 'MOBILE_TRANSFER')
    group by counterparty_account_hash
    order by count(*) desc
    limit 1
  `;
  const normal = await retrieveTransactionPattern({
    transfer: {
      user_id: "demo-parent-01",
      occurred_at: "2026-08-31T13:00:00+09:00",
      amount: Number(knownRecipient.average_amount),
      recipient_account_hash: knownRecipient.counterparty_account_hash,
    },
  }, { client: sql });
  assert.equal(normal.status, "ready");
  assert.equal(normal.recipient_known, true);
  assert.equal(normal.risk_score, 0);

  const security = await sql`
    select
      c.relname as table_name,
      c.relrowsecurity as rls_enabled,
      not exists (
        select 1
        from information_schema.role_table_grants g
        where g.table_schema = 'public'
          and g.table_name = c.relname
          and g.grantee in ('anon', 'authenticated')
      ) as browser_access_revoked
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in ('demo_users', 'transactions')
    order by c.relname
  `;
  assert.equal(security.length, 2);
  assert.ok(security.every((row) => row.rls_enabled && row.browser_access_revoked));

  console.log(JSON.stringify({
    status: "pass",
    counts,
    suspicious_pattern: suspicious,
    normal_pattern: {
      status: normal.status,
      recipient_known: normal.recipient_known,
      risk_score: normal.risk_score,
    },
    security,
  }, null, 2));
} finally {
  await closeText2SqlClient();
}
