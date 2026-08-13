-- ============================================================================
-- BETTER ME - Money correctness, and one security hole
--
--   1. Close a cross-user write hole in seed_default_finance_categories.
--   2. Stop savings goals with no bank from destroying money in Total Balance.
--   3. Give savings movements a real entry_date instead of guessing from a
--      UTC timestamp, so a Manila morning deposit stops landing in two
--      different months depending on which screen you look at.
--   4. Add a default monthly budget, so a month with no override still has one.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. seed_default_finance_categories was a cross-user write
--
-- It is security definer, it takes the user id as an argument, it never checked
-- who was calling, and it was never revoked from PUBLIC. Postgres grants
-- execute to PUBLIC by default and anon has usage on this schema, so anyone
-- who knew a user id could write categories into that person's account,
-- straight past row level security.
--
-- Two fixes, because either alone would do and both together cost nothing: the
-- grant goes away, and a signed-in caller may only target themselves.
--
-- The guard deliberately permits a NULL auth.uid(). This function is also
-- called by the handle_new_user trigger during sign-up, where there is no JWT
-- yet because the account is still being created. A blanket "must be signed
-- in" check here breaks registration entirely, which is exactly what the test
-- suite caught. The revoke below is what stops untrusted callers; the guard
-- only stops a signed-in user from targeting somebody else.
--
-- Clients never need this function anyway: they call
-- ensure_default_finance_categories, which derives the user from auth.uid().
-- ----------------------------------------------------------------------------
create or replace function public.seed_default_finance_categories(p_user_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if p_user_id is null then
    raise exception 'A user is required.' using errcode = '22023';
  end if;

  if auth.uid() is not null and p_user_id <> auth.uid() then
    raise exception 'You can only seed your own categories.' using errcode = '42501';
  end if;

  insert into public.finance_categories (user_id, name, kind, color, icon, is_builtin, sort_order)
  values
    (p_user_id, 'Food',          'expense', 'orange', 'utensils',     true, 0),
    (p_user_id, 'Transport',     'expense', 'sky',    'car',          true, 1),
    (p_user_id, 'Bills',         'expense', 'violet', 'zap',          true, 2),
    (p_user_id, 'Shopping',      'expense', 'pink',   'shopping-bag', true, 3),
    (p_user_id, 'Health',        'expense', 'rose',   'heart',        true, 4),
    (p_user_id, 'Entertainment', 'expense', 'amber',  'sparkles',     true, 5),
    (p_user_id, 'Subscriptions', 'expense', 'indigo', 'repeat',       true, 6),
    (p_user_id, 'Other',         'expense', 'slate',  'circle',       true, 7),
    (p_user_id, 'Salary',        'income',  'lime',   'banknote',     true, 0),
    (p_user_id, 'Freelance',     'income',  'teal',   'briefcase',    true, 1),
    (p_user_id, 'Bonus',         'income',  'amber',  'gift',         true, 2),
    (p_user_id, 'Other Income',  'income',  'slate',  'circle',       true, 3)
  on conflict do nothing;
end;
$$;

-- Nobody may call this directly. The trigger runs as the function owner, so it
-- is unaffected; every client path goes through ensure_default_finance_categories.
revoke all on function public.seed_default_finance_categories(uuid) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2. Savings movements are earmarks, not spending
--
-- A savings goal lives inside one of your banks. Putting money into it moves
-- that money from the funding bank to the goal's bank, which nets to zero
-- across your wallets: the app says so on screen, "your Total Balance does not
-- change".
--
-- The old view broke that promise for a goal with no bank attached. The debit
-- keyed on the funding account and the credit keyed on the goal's account, so
-- with no goal account the money left one wallet and arrived nowhere. Paying
-- into your emergency fund made your Total Balance fall.
--
-- Both legs now require the goal to have a bank. A goal with none is simply
-- invisible to wallet balances, in both directions, which is the only answer
-- that keeps the promise true. Attaching a bank to every goal is handled in
-- the app, not here, because it is a decision about the person's money.
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
-- Note the join on both sides now. A movement only touches wallet balances
-- when BOTH ends are known, so it can never be half-applied.
deposit_out as (
  select st.counter_account_id as id, sum(st.amount_centavos) as amt
  from public.savings_transactions st
  join public.savings_categories sc on sc.id = st.category_id
  where st.type = 'deposit'
    and st.counter_account_id is not null
    and sc.account_id is not null
  group by st.counter_account_id
),
deposit_in as (
  select sc.account_id as id, sum(st.amount_centavos) as amt
  from public.savings_transactions st
  join public.savings_categories sc on sc.id = st.category_id
  where st.type = 'deposit'
    and st.counter_account_id is not null
    and sc.account_id is not null
  group by sc.account_id
),
withdrawal_out as (
  select sc.account_id as id, sum(st.amount_centavos) as amt
  from public.savings_transactions st
  join public.savings_categories sc on sc.id = st.category_id
  where st.type = 'withdrawal'
    and st.counter_account_id is not null
    and sc.account_id is not null
  group by sc.account_id
),
withdrawal_in as (
  select st.counter_account_id as id, sum(st.amount_centavos) as amt
  from public.savings_transactions st
  join public.savings_categories sc on sc.id = st.category_id
  where st.type = 'withdrawal'
    and st.counter_account_id is not null
    and sc.account_id is not null
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
-- 3. Savings movements get a real date
--
-- Everything else in Finance is dated with a plain date the person chose.
-- Savings alone was dated by its UTC created_at, and three places converted
-- that differently: the reset function read it as UTC, the Recent list sliced
-- the ISO string, and the goal page formatted it in Manila time. A deposit at
-- 07:00 Manila on the 1st is 23:00 UTC on the previous day, so the same row
-- could sit in two different months depending on which screen you opened.
--
-- Backfill converts the existing timestamps to Manila dates, which is what the
-- goal page was already showing, so nothing appears to move.
-- ----------------------------------------------------------------------------
alter table public.savings_transactions
  add column if not exists entry_date date;

update public.savings_transactions
   set entry_date = (created_at at time zone 'Asia/Manila')::date
 where entry_date is null;

alter table public.savings_transactions
  alter column entry_date set default (now() at time zone 'Asia/Manila')::date;

alter table public.savings_transactions
  alter column entry_date set not null;

create index if not exists savings_transactions_entry_date_idx
  on public.savings_transactions (user_id, entry_date);

-- The recording RPC takes the date now, defaulting to today in Manila.
drop function if exists public.record_savings_transaction(uuid, text, bigint, text, uuid);

create or replace function public.record_savings_transaction(
  p_category_id uuid,
  p_type text,
  p_amount_centavos bigint,
  p_note text default null,
  p_counter_account_id uuid default null,
  p_entry_date date default null
)
returns public.savings_categories
language plpgsql
security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_category public.savings_categories;
  v_date date := coalesce(p_entry_date, (now() at time zone 'Asia/Manila')::date);
begin
  if v_user is null then
    raise exception 'Not signed in.' using errcode = '42501';
  end if;

  if p_type not in ('deposit', 'withdrawal') then
    raise exception 'Type must be deposit or withdrawal.' using errcode = '22023';
  end if;

  if p_amount_centavos is null or p_amount_centavos <= 0 then
    raise exception 'Enter an amount greater than zero.' using errcode = '22023';
  end if;

  -- Locked so two withdrawals cannot both pass the balance check.
  select * into v_category
    from public.savings_categories
   where id = p_category_id and user_id = v_user
     for update;

  if v_category.id is null then
    raise exception 'Not authorized.' using errcode = '42501';
  end if;

  if p_counter_account_id is not null then
    if not exists (
      select 1 from public.finance_accounts
       where id = p_counter_account_id and user_id = v_user
    ) then
      raise exception 'That bank is not yours.' using errcode = '42501';
    end if;
  end if;

  if p_type = 'withdrawal' and p_amount_centavos > v_category.balance_centavos then
    raise exception 'Withdrawal of % exceeds category balance of %.',
      p_amount_centavos, v_category.balance_centavos using errcode = '22023';
  end if;

  insert into public.savings_transactions
    (user_id, category_id, type, amount_centavos, note, counter_account_id, entry_date)
  values
    (v_user, p_category_id, p_type, p_amount_centavos, p_note, p_counter_account_id, v_date);

  update public.savings_categories
     set balance_centavos = balance_centavos
         + case when p_type = 'deposit' then p_amount_centavos else -p_amount_centavos end
   where id = p_category_id
  returning * into v_category;

  return v_category;
end;
$$;

grant execute on function public.record_savings_transaction(uuid, text, bigint, text, uuid, date) to authenticated;

-- Reset This Month must use the same date as everything else, or a deposit can
-- survive a reset that removed the balance change it caused.
create or replace function public.reset_this_month(
  p_month text,
  p_include_budget boolean default false
)
returns json
language plpgsql
security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_start date;
  v_end date;
  v_habits int;
  v_workouts int;
  v_income int;
  v_expenses int;
  v_transfers int;
  v_savings int;
  v_payments int;
begin
  if v_user is null then
    raise exception 'Not signed in.' using errcode = '42501';
  end if;

  if p_month !~ '^\d{4}-\d{2}$' then
    raise exception 'Month must look like 2026-08.' using errcode = '22023';
  end if;

  v_start := to_date(p_month || '-01', 'YYYY-MM-DD');
  v_end := (v_start + interval '1 month - 1 day')::date;

  delete from public.habit_occurrences
   where user_id = v_user and occurrence_date between v_start and v_end;
  get diagnostics v_habits = row_count;

  delete from public.workouts
   where user_id = v_user and workout_date between v_start and v_end;
  get diagnostics v_workouts = row_count;

  delete from public.income_entries
   where user_id = v_user and entry_date between v_start and v_end;
  get diagnostics v_income = row_count;

  delete from public.expense_entries
   where user_id = v_user and entry_date between v_start and v_end;
  get diagnostics v_expenses = row_count;

  delete from public.transfers
   where user_id = v_user and entry_date between v_start and v_end;
  get diagnostics v_transfers = row_count;

  -- Put the money back before the history goes.
  update public.savings_categories sc
     set balance_centavos = sc.balance_centavos - coalesce(delta.amount, 0)
    from (
      select st.category_id,
             sum(case when st.type = 'deposit' then st.amount_centavos else -st.amount_centavos end) as amount
        from public.savings_transactions st
       where st.user_id = v_user
         and st.entry_date between v_start and v_end
       group by st.category_id
    ) delta
   where sc.id = delta.category_id and sc.user_id = v_user;

  delete from public.savings_transactions
   where user_id = v_user and entry_date between v_start and v_end;
  get diagnostics v_savings = row_count;

  update public.debts d
     set balance_centavos = d.balance_centavos + coalesce(paid.amount, 0),
         paid_off = (d.balance_centavos + coalesce(paid.amount, 0)) = 0
    from (
      select dp.debt_id, sum(dp.amount_centavos) as amount
        from public.debt_payments dp
       where dp.user_id = v_user
         and dp.entry_date between v_start and v_end
       group by dp.debt_id
    ) paid
   where d.id = paid.debt_id and d.user_id = v_user;

  delete from public.debt_payments
   where user_id = v_user and entry_date between v_start and v_end;
  get diagnostics v_payments = row_count;

  if p_include_budget then
    delete from public.budgets where user_id = v_user and month = p_month;
    delete from public.category_budgets where user_id = v_user and month = p_month;
  end if;

  delete from public.reminder_deliveries
   where user_id = v_user and occurrence_date between v_start and v_end;

  return json_build_object(
    'habits', v_habits,
    'workouts', v_workouts,
    'income', v_income,
    'expenses', v_expenses,
    'transfers', v_transfers,
    'savings', v_savings,
    'debtPayments', v_payments
  );
end;
$$;

grant execute on function public.reset_this_month(text, boolean) to authenticated;

-- ----------------------------------------------------------------------------
-- 4. A default monthly budget
--
-- Until now a month with no budget row had no budget at all, so every month
-- started blank. The default applies to any month you have not overridden, and
-- setting December's budget still cannot touch November's, because the
-- override rows are unchanged and remain the source of truth per month.
-- ----------------------------------------------------------------------------
alter table public.user_preferences
  add column if not exists default_budget_centavos bigint
    check (default_budget_centavos is null or default_budget_centavos >= 0);

comment on column public.user_preferences.default_budget_centavos is
  'Applies to any month with no row in budgets. Null means no default, which '
  'is the old behaviour of having no budget until one is set.';
