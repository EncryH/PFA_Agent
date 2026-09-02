-- 안심동행 AI MVP: 가상 사용자와 최근 거래내역
-- Supabase SQL Editor에서 실행한 뒤 users CSV, transactions CSV 순서로 가져온다.

create table if not exists public.demo_users (
  user_id text primary key,
  display_name text not null,
  profile_type text not null,
  age_band text not null,
  account_id text not null unique,
  account_name text not null,
  bank_name text not null,
  analysis_window_months integer not null default 12 check (analysis_window_months between 3 and 12),
  is_synthetic boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id text primary key,
  user_id text not null references public.demo_users(user_id) on delete cascade,
  account_id text not null,
  occurred_at timestamptz not null,
  direction text not null check (direction in ('IN', 'OUT')),
  amount bigint not null check (amount > 0),
  balance_after bigint not null,
  counterparty_name text not null,
  counterparty_bank text not null,
  counterparty_account_hash text not null,
  category text not null,
  transaction_type text not null,
  channel text not null,
  memo text not null default '',
  is_recurring boolean not null default false,
  is_synthetic boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists transactions_user_time_idx
  on public.transactions (user_id, occurred_at desc);
create index if not exists transactions_user_counterparty_idx
  on public.transactions (user_id, counterparty_account_hash);
create index if not exists transactions_user_type_time_idx
  on public.transactions (user_id, transaction_type, occurred_at desc);

alter table public.demo_users enable row level security;
alter table public.transactions enable row level security;

-- MVP에서는 신뢰된 백엔드 DB 연결만 조회한다. 브라우저 Data API 접근은 열지 않는다.
revoke all on table public.demo_users from anon, authenticated;
revoke all on table public.transactions from anon, authenticated;
