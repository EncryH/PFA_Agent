import { readFile } from "node:fs/promises";

import { closeText2SqlClient, getText2SqlClient } from "../text2sql/client.js";

const schemaUrl = new URL("../datasets/text2sql/schema.sql", import.meta.url);
const usersUrl = new URL("../datasets/text2sql/synthetic-users.csv", import.meta.url);
const transactionsUrl = new URL("../datasets/text2sql/synthetic-transactions.csv", import.meta.url);

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field.replace(/\r$/, ""));
      if (row.some(Boolean)) rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  const [headers, ...values] = rows;
  return values.map((columns) => Object.fromEntries(
    headers.map((header, index) => [header, columns[index] ?? ""]),
  ));
}

function normalizeUser(row) {
  return {
    ...row,
    analysis_window_months: Number(row.analysis_window_months),
    is_synthetic: row.is_synthetic === "true",
  };
}

function normalizeTransaction(row) {
  return {
    ...row,
    amount: Number(row.amount),
    balance_after: Number(row.balance_after),
    is_recurring: row.is_recurring === "true",
    is_synthetic: row.is_synthetic === "true",
  };
}

const { sql } = await getText2SqlClient();
if (!sql) {
  throw new Error("SUPABASE_DATABASE_URL이 없거나 TEXT2SQL_ENABLED가 false입니다.");
}

try {
  const [schema, usersText, transactionsText] = await Promise.all([
    readFile(schemaUrl, "utf8"),
    readFile(usersUrl, "utf8"),
    readFile(transactionsUrl, "utf8"),
  ]);
  const users = parseCsv(usersText).map(normalizeUser);
  const transactions = parseCsv(transactionsText).map(normalizeTransaction);
  const userColumns = [
    "user_id", "display_name", "profile_type", "age_band", "account_id",
    "account_name", "bank_name", "analysis_window_months", "is_synthetic",
  ];
  const transactionColumns = [
    "id", "user_id", "account_id", "occurred_at", "direction", "amount", "balance_after",
    "counterparty_name", "counterparty_bank", "counterparty_account_hash", "category",
    "transaction_type", "channel", "memo", "is_recurring", "is_synthetic",
  ];

  await sql.unsafe(schema);
  await sql.begin(async (tx) => {
    await tx`
      insert into public.demo_users ${tx(users, userColumns)}
      on conflict (user_id) do update set
        display_name = excluded.display_name,
        profile_type = excluded.profile_type,
        age_band = excluded.age_band,
        account_id = excluded.account_id,
        account_name = excluded.account_name,
        bank_name = excluded.bank_name,
        analysis_window_months = excluded.analysis_window_months,
        is_synthetic = excluded.is_synthetic
    `;

    for (let index = 0; index < transactions.length; index += 200) {
      const chunk = transactions.slice(index, index + 200);
      await tx`
        insert into public.transactions ${tx(chunk, transactionColumns)}
        on conflict (id) do update set
          user_id = excluded.user_id,
          account_id = excluded.account_id,
          occurred_at = excluded.occurred_at,
          direction = excluded.direction,
          amount = excluded.amount,
          balance_after = excluded.balance_after,
          counterparty_name = excluded.counterparty_name,
          counterparty_bank = excluded.counterparty_bank,
          counterparty_account_hash = excluded.counterparty_account_hash,
          category = excluded.category,
          transaction_type = excluded.transaction_type,
          channel = excluded.channel,
          memo = excluded.memo,
          is_recurring = excluded.is_recurring,
          is_synthetic = excluded.is_synthetic
      `;
    }
  });

  const counts = await sql`
    select user_id, count(*)::int as transaction_count,
           min(occurred_at) as first_transaction,
           max(occurred_at) as last_transaction
    from public.transactions
    group by user_id
    order by user_id
  `;
  console.log(JSON.stringify({ status: "seeded", users: users.length, transactions: transactions.length, counts }, null, 2));
} finally {
  await closeText2SqlClient();
}
