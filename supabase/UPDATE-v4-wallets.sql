-- ============================================================================
-- BETTER ME - Banks become wallets
--
-- Until now a bank was a label you could hang on an entry. From here it holds a
-- balance, and every entry moves money between banks:
--
--   income            chosen bank up
--   expense           chosen bank down
--   transfer          one bank down, another up
--   savings deposit   funding bank down, the goal's bank up
--   savings withdraw  the goal's bank down, the receiving bank up
--   debt payment      chosen bank down, and the debt shrinks
--
-- Total Balance becomes the sum of the bank balances rather than income minus
-- expenses. The two agree once everything is tagged, but only the wallet version
-- can disagree with your real banking app, which is the point: a mismatch tells
-- you something went unlogged.
--
-- A savings goal keeps its own name, target and balance, and gains the bank it
-- lives in. If that bank also holds money outside the goal the two numbers will
-- differ, which is correct rather than a bug, so the app shows both.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Opening balances
-- ----------------------------------------------------------------------------
alter table public.finance_accounts
  add column if not exists starting_balance_centavos bigint not null default 0;

comment on column public.finance_accounts.starting_balance_centavos is
  'What the account held before anything was logged. Zero for everyone today; '
  'kept so a real opening balance can be entered later without a migration.';

-- ----------------------------------------------------------------------------
-- Savings goals live in a bank
-- ----------------------------------------------------------------------------
alter table public.savings_categories
  add column if not exists account_id uuid references public.finance_accounts (id) on delete set null;

comment on column public.savings_categories.account_id is
  'The bank this goal is held in. Nullable so an existing goal is never lost, '
  'but the UI asks for it and treats a goal without one as needing attention.';

-- Which bank funded a deposit, or received a withdrawal. One column because a
-- savings movement always has exactly one bank on the far side of it, and which
-- direction it points is already recorded in `type`.
alter table public.savings_transactions
  add column if not exists counter_account_id uuid references public.finance_accounts (id) on delete set null;

-- ----------------------------------------------------------------------------
-- Debt payments come out of a bank
-- ----------------------------------------------------------------------------
alter table public.debt_payments
  add column if not exists account_id uuid references public.finance_accounts (id) on delete set null;

alter table public.debt_payments
  add column if not exists entry_date date not null default current_date;

create index if not exists debt_payments_user_date_idx
  on public.debt_payments (user_id, entry_date desc);

-- ----------------------------------------------------------------------------
-- Backfill: give every untagged entry a home
--
-- Without this the balances start out already wrong by whatever was logged
-- before banks existed. Everything untagged goes to Cash, creating Cash for the
-- user if they somehow do not have it.
-- ----------------------------------------------------------------------------
do $$
declare
  v_user uuid;
  v_cash uuid;
begin
  for v_user in
    select distinct user_id from (
      select user_id from public.income_entries where account_id is null
      union
      select user_id from public.expense_entries where account_id is null
    ) untagged
  loop
    select id into v_cash
    from public.finance_accounts
    where user_id = v_user and lower(trim(name)) = 'cash' and archived = false
    limit 1;

    if v_cash is null then
      insert into public.finance_accounts (user_id, name, flow, color, icon, is_builtin, sort_order)
      values (v_user, 'Cash', 'both', 'amber', 'wallet', true, 0)
      returning id into v_cash;
    end if;

    update public.income_entries  set account_id = v_cash where user_id = v_user and account_id is null;
    update public.expense_entries set account_id = v_cash where user_id = v_user and account_id is null;
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- One balance per account
--
-- A view rather than a stored column: a stored balance has to be kept in step by
-- every write path and drifts the first time one of them is missed. This is
-- derived from the entries themselves, so it cannot disagree with them.
--
-- security_invoker makes the view run as the caller, so the row level security
-- on the underlying tables still applies. Without it the view would happily hand
-- one user another user's balances.
-- ----------------------------------------------------------------------------
drop view if exists public.finance_account_balances;

create view public.finance_account_balances
with (security_invoker = on) as
with income_in as (
  select account_id as id, sum(amount_centavos) as amt
  from public.income_entries where account_id is not null group by account_id
),
expense_out as (
  select account_id as id, sum(amount_centavos) as amt
  from public.expense_entries where account_id is not null group by account_id
),
transfer_in as (
  select to_account_id as id, sum(amount_centavos) as amt
  from public.transfers where to_account_id is not null group by to_account_id
),
transfer_out as (
  select from_account_id as id, sum(amount_centavos) as amt
  from public.transfers where from_account_id is not null group by from_account_id
),
-- A deposit leaves the funding bank and lands in the goal's bank.
deposit_out as (
  select st.counter_account_id as id, sum(st.amount_centavos) as amt
  from public.savings_transactions st
  where st.type = 'deposit' and st.counter_account_id is not null
  group by st.counter_account_id
),
deposit_in as (
  select sc.account_id as id, sum(st.amount_centavos) as amt
  from public.savings_transactions st
  join public.savings_categories sc on sc.id = st.category_id
  where st.type = 'deposit' and sc.account_id is not null
  group by sc.account_id
),
-- A withdrawal is the same movement in reverse.
withdrawal_out as (
  select sc.account_id as id, sum(st.amount_centavos) as amt
  from public.savings_transactions st
  join public.savings_categories sc on sc.id = st.category_id
  where st.type = 'withdrawal' and sc.account_id is not null
  group by sc.account_id
),
withdrawal_in as (
  select st.counter_account_id as id, sum(st.amount_centavos) as amt
  from public.savings_transactions st
  where st.type = 'withdrawal' and st.counter_account_id is not null
  group by st.counter_account_id
),
debt_out as (
  select account_id as id, sum(amount_centavos) as amt
  from public.debt_payments where account_id is not null group by account_id
)
select
  a.id,
  a.user_id,
  a.starting_balance_centavos
    + coalesce(income_in.amt, 0)
    - coalesce(expense_out.amt, 0)
    + coalesce(transfer_in.amt, 0)
    - coalesce(transfer_out.amt, 0)
    + coalesce(deposit_in.amt, 0)
    - coalesce(deposit_out.amt, 0)
    + coalesce(withdrawal_in.amt, 0)
    - coalesce(withdrawal_out.amt, 0)
    - coalesce(debt_out.amt, 0)
    as balance_centavos
from public.finance_accounts a
left join income_in      on income_in.id = a.id
left join expense_out    on expense_out.id = a.id
left join transfer_in    on transfer_in.id = a.id
left join transfer_out   on transfer_out.id = a.id
left join deposit_in     on deposit_in.id = a.id
left join deposit_out    on deposit_out.id = a.id
left join withdrawal_in  on withdrawal_in.id = a.id
left join withdrawal_out on withdrawal_out.id = a.id
left join debt_out       on debt_out.id = a.id;

grant select on public.finance_account_balances to authenticated;
revoke all on public.finance_account_balances from anon;

-- ----------------------------------------------------------------------------
-- RPCs gain the bank on the other side.
--
-- Dropped and recreated rather than given a defaulted extra parameter: adding a
-- default would leave the old signature in place too, and a four argument call
-- would then be ambiguous.
-- ----------------------------------------------------------------------------
drop function if exists public.record_savings_transaction(uuid, text, bigint, text);

create or replace function public.record_savings_transaction(
  p_category_id uuid,
  p_type text,
  p_amount_centavos bigint,
  p_note text default null,
  p_counter_account_id uuid default null
)
returns public.savings_categories
language plpgsql
security definer set search_path = public
as $$
declare
  v_category public.savings_categories;
  v_new_balance bigint;
begin
  if p_type not in ('deposit', 'withdrawal') then
    raise exception 'Invalid transaction type.' using errcode = '22023';
  end if;

  if p_amount_centavos is null or p_amount_centavos <= 0 then
    raise exception 'Amount must be greater than zero.' using errcode = '22023';
  end if;

  select * into v_category from public.savings_categories where id = p_category_id for update;

  if v_category.id is null then
    raise exception 'Savings category not found.' using errcode = 'P0002';
  end if;

  if v_category.user_id <> auth.uid() then
    raise exception 'Not authorized.' using errcode = '42501';
  end if;

  -- The far side has to belong to the same person, or one user could push money
  -- through another user's wallet.
  if p_counter_account_id is not null then
    if not exists (
      select 1 from public.finance_accounts
      where id = p_counter_account_id and user_id = auth.uid()
    ) then
      raise exception 'Not authorized.' using errcode = '42501';
    end if;
  end if;

  if p_type = 'withdrawal' and p_amount_centavos > v_category.balance_centavos then
    raise exception 'Withdrawal of % exceeds category balance of %.', p_amount_centavos, v_category.balance_centavos
      using errcode = '22023';
  end if;

  v_new_balance := case
    when p_type = 'deposit' then v_category.balance_centavos + p_amount_centavos
    else v_category.balance_centavos - p_amount_centavos
  end;

  insert into public.savings_transactions (category_id, user_id, type, amount_centavos, note, counter_account_id)
  values (p_category_id, auth.uid(), p_type, p_amount_centavos, p_note, p_counter_account_id);

  update public.savings_categories
  set balance_centavos = v_new_balance
  where id = p_category_id
  returning * into v_category;

  return v_category;
end;
$$;

grant execute on function public.record_savings_transaction(uuid, text, bigint, text, uuid) to authenticated;

drop function if exists public.record_debt_payment(uuid, bigint, text);

create or replace function public.record_debt_payment(
  p_debt_id uuid,
  p_amount_centavos bigint,
  p_note text default null,
  p_account_id uuid default null,
  p_entry_date date default null
)
returns public.debts
language plpgsql
security definer set search_path = public
as $$
declare
  v_debt public.debts;
  v_new_balance bigint;
begin
  if p_amount_centavos is null or p_amount_centavos <= 0 then
    raise exception 'Payment must be greater than zero.' using errcode = '22023';
  end if;

  select * into v_debt from public.debts where id = p_debt_id for update;

  if v_debt.id is null then
    raise exception 'Debt not found.' using errcode = 'P0002';
  end if;

  if v_debt.user_id <> auth.uid() then
    raise exception 'Not authorized.' using errcode = '42501';
  end if;

  if p_account_id is not null then
    if not exists (
      select 1 from public.finance_accounts
      where id = p_account_id and user_id = auth.uid()
    ) then
      raise exception 'Not authorized.' using errcode = '42501';
    end if;
  end if;

  if p_amount_centavos > v_debt.balance_centavos then
    raise exception 'Payment of % exceeds remaining balance of %.', p_amount_centavos, v_debt.balance_centavos
      using errcode = '22023';
  end if;

  v_new_balance := v_debt.balance_centavos - p_amount_centavos;

  insert into public.debt_payments (debt_id, user_id, amount_centavos, note, account_id, entry_date)
  values (p_debt_id, auth.uid(), p_amount_centavos, p_note, p_account_id, coalesce(p_entry_date, current_date));

  update public.debts
  set balance_centavos = v_new_balance,
      paid_off = (v_new_balance = 0)
  where id = p_debt_id
  returning * into v_debt;

  return v_debt;
end;
$$;

grant execute on function public.record_debt_payment(uuid, bigint, text, uuid, date) to authenticated;
