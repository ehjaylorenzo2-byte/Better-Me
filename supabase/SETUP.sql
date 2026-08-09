-- ============================================================================
-- BETTER ME - COMPLETE DATABASE SETUP
--
-- Paste this ENTIRE file into the Supabase SQL Editor and click Run, once,
-- on a brand new project. It creates every table, every Row Level Security
-- policy, and every function the app needs.
--
-- Safe to run: it will error loudly rather than half-apply.
-- ============================================================================

-- Better Me: initial schema
-- Run in order against a fresh Supabase project (SQL editor, or `supabase db push`).

-- ============================================================================
-- EXTENSIONS
-- ============================================================================
create extension if not exists "pgcrypto";

-- ============================================================================
-- PROFILES
-- ============================================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  username_normalized text not null unique,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- Deliberately no public/anon SELECT policy on profiles. Username
-- availability is checked pre-signup via the SECURITY DEFINER function
-- `public.is_username_available` (see 0002_functions_triggers.sql), which
-- returns only a boolean and never leaks row contents.

-- ============================================================================
-- USER PREFERENCES (appearance/timezone)
-- ============================================================================
create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  theme text not null default 'system' check (theme in ('light', 'dark', 'system')),
  timezone text not null default 'Asia/Manila',
  updated_at timestamptz not null default now()
);

alter table public.user_preferences enable row level security;

create policy "user_preferences_owner_all" on public.user_preferences
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================================
-- NOTIFICATION PREFERENCES
-- ============================================================================
create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  reminders_enabled boolean not null default true,
  one_hour_reminder_enabled boolean not null default true,
  noon_summary_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.notification_preferences enable row level security;

create policy "notification_preferences_owner_all" on public.notification_preferences
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================================
-- HABITS
-- ============================================================================
create table if not exists public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  description text,
  icon text,
  category text not null default 'general' check (category in ('general', 'gym')),
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists habits_user_id_idx on public.habits (user_id);

alter table public.habits enable row level security;

create policy "habits_owner_all" on public.habits
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================================
-- HABIT SCHEDULES
-- ============================================================================
create table if not exists public.habit_schedules (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null references public.habits (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  recurrence text not null check (recurrence in ('once', 'daily', 'weekly', 'monthly', 'custom')),
  weekdays int[],
  time time,
  start_date date not null,
  end_date date,
  reminder_enabled boolean not null default true,
  supersedes_schedule_id uuid references public.habit_schedules (id),
  created_at timestamptz not null default now(),
  constraint habit_schedules_date_order check (end_date is null or end_date >= start_date)
);

create index if not exists habit_schedules_habit_id_idx on public.habit_schedules (habit_id);

alter table public.habit_schedules enable row level security;

create policy "habit_schedules_owner_all" on public.habit_schedules
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================================
-- HABIT OCCURRENCES (materialized on demand -- see recurrence.ts; not pre-created into the future)
-- ============================================================================
create table if not exists public.habit_occurrences (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null references public.habits (id) on delete cascade,
  schedule_id uuid not null references public.habit_schedules (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  occurrence_date date not null,
  scheduled_time time,
  status text check (status in ('done', 'skipped', 'cancelled')),
  completed_at timestamptz,
  notes text,
  unique (habit_id, occurrence_date)
);

create index if not exists habit_occurrences_user_date_idx on public.habit_occurrences (user_id, occurrence_date);
create index if not exists habit_occurrences_habit_id_idx on public.habit_occurrences (habit_id);

alter table public.habit_occurrences enable row level security;

create policy "habit_occurrences_owner_all" on public.habit_occurrences
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================================
-- WORKOUTS / EXERCISES
-- ============================================================================
create table if not exists public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  occurrence_id uuid references public.habit_occurrences (id) on delete set null,
  workout_date date not null,
  duration_minutes int check (duration_minutes is null or duration_minutes >= 0),
  notes text,
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, workout_date)
);

create index if not exists workouts_user_date_idx on public.workouts (user_id, workout_date);

alter table public.workouts enable row level security;

create policy "workouts_owner_all" on public.workouts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.workout_exercises (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  sets int not null default 0 check (sets >= 0),
  reps int not null default 0 check (reps >= 0),
  weight_kg numeric(6, 2) not null default 0 check (weight_kg >= 0),
  notes text,
  order_index int not null default 0
);

create index if not exists workout_exercises_workout_id_idx on public.workout_exercises (workout_id);

alter table public.workout_exercises enable row level security;

create policy "workout_exercises_owner_all" on public.workout_exercises
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================================
-- FINANCE: INCOME / EXPENSES / BUDGETS
-- ============================================================================
create table if not exists public.income_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  amount_centavos bigint not null check (amount_centavos >= 0),
  source text not null,
  entry_date date not null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists income_entries_user_date_idx on public.income_entries (user_id, entry_date);

alter table public.income_entries enable row level security;

create policy "income_entries_owner_all" on public.income_entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.expense_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  amount_centavos bigint not null check (amount_centavos >= 0),
  category text not null,
  entry_date date not null,
  description text,
  created_at timestamptz not null default now()
);

create index if not exists expense_entries_user_date_idx on public.expense_entries (user_id, entry_date);

alter table public.expense_entries enable row level security;

create policy "expense_entries_owner_all" on public.expense_entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  month text not null check (month ~ '^\d{4}-\d{2}$'),
  amount_centavos bigint not null check (amount_centavos >= 0),
  unique (user_id, month)
);

alter table public.budgets enable row level security;

create policy "budgets_owner_all" on public.budgets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================================
-- SAVINGS
-- ============================================================================
create table if not exists public.savings_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  goal_amount_centavos bigint check (goal_amount_centavos is null or goal_amount_centavos > 0),
  balance_centavos bigint not null default 0 check (balance_centavos >= 0),
  created_at timestamptz not null default now()
);

create index if not exists savings_categories_user_id_idx on public.savings_categories (user_id);

alter table public.savings_categories enable row level security;

create policy "savings_categories_owner_all" on public.savings_categories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.savings_transactions (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.savings_categories (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (type in ('deposit', 'withdrawal')),
  amount_centavos bigint not null check (amount_centavos > 0),
  note text,
  created_at timestamptz not null default now()
);

create index if not exists savings_transactions_category_id_idx on public.savings_transactions (category_id);

alter table public.savings_transactions enable row level security;

create policy "savings_transactions_owner_all" on public.savings_transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================================
-- DEBT
-- ============================================================================
create table if not exists public.debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  original_amount_centavos bigint not null check (original_amount_centavos >= 0),
  balance_centavos bigint not null check (balance_centavos >= 0),
  paid_off boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists debts_user_id_idx on public.debts (user_id);

alter table public.debts enable row level security;

create policy "debts_owner_all" on public.debts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.debt_payments (
  id uuid primary key default gen_random_uuid(),
  debt_id uuid not null references public.debts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  amount_centavos bigint not null check (amount_centavos > 0),
  note text,
  created_at timestamptz not null default now()
);

create index if not exists debt_payments_debt_id_idx on public.debt_payments (debt_id);

alter table public.debt_payments enable row level security;

create policy "debt_payments_owner_all" on public.debt_payments
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================================
-- PUSH SUBSCRIPTIONS
-- ============================================================================
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

alter table public.push_subscriptions enable row level security;

create policy "push_subscriptions_owner_all" on public.push_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================================
-- PRIVILEGES
-- Supabase normally grants public-schema tables to anon + authenticated and
-- relies purely on RLS. Better Me is stricter: the anonymous role gets NO
-- table access at all (it only needs the is_username_available function, which
-- is SECURITY DEFINER). Logged-in users get table access, still fully gated by
-- the RLS policies above.
-- ============================================================================
grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

revoke all on all tables in schema public from anon;


-- ============================================================================
-- Username availability check, safe for anon callers (pre-signup). Returns
-- only a boolean -- never exposes profile row contents.
-- ============================================================================
create or replace function public.is_username_available(p_username text)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select not exists (
    select 1 from public.profiles where username_normalized = lower(trim(p_username))
  );
$$;

grant execute on function public.is_username_available(text) to anon, authenticated;

-- ============================================================================
-- Auto-create profile + default preference rows on signup.
-- The client passes the chosen username via auth.users raw_user_meta_data.
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  chosen_username text;
begin
  chosen_username := coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1));

  insert into public.profiles (id, username, username_normalized)
  values (new.id, chosen_username, lower(trim(chosen_username)))
  on conflict (id) do nothing;

  insert into public.user_preferences (user_id) values (new.id)
  on conflict (user_id) do nothing;

  insert into public.notification_preferences (user_id) values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- Atomic debt payment: validate, insert payment, update balance, mark paid off.
-- Runs as SECURITY DEFINER but re-checks auth.uid() = user_id internally so
-- it can't be used to touch another user's debt even though it bypasses RLS.
-- ============================================================================
create or replace function public.record_debt_payment(
  p_debt_id uuid,
  p_amount_centavos bigint,
  p_note text default null
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

  if p_amount_centavos > v_debt.balance_centavos then
    raise exception 'Payment of % exceeds remaining balance of %.', p_amount_centavos, v_debt.balance_centavos
      using errcode = '22023';
  end if;

  v_new_balance := v_debt.balance_centavos - p_amount_centavos;

  insert into public.debt_payments (debt_id, user_id, amount_centavos, note)
  values (p_debt_id, auth.uid(), p_amount_centavos, p_note);

  update public.debts
  set balance_centavos = v_new_balance,
      paid_off = (v_new_balance = 0)
  where id = p_debt_id
  returning * into v_debt;

  return v_debt;
end;
$$;

-- ============================================================================
-- Atomic savings transaction: validate, insert transaction, update balance.
-- ============================================================================
create or replace function public.record_savings_transaction(
  p_category_id uuid,
  p_type text,
  p_amount_centavos bigint,
  p_note text default null
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

  if p_type = 'withdrawal' and p_amount_centavos > v_category.balance_centavos then
    raise exception 'Withdrawal of % exceeds category balance of %.', p_amount_centavos, v_category.balance_centavos
      using errcode = '22023';
  end if;

  v_new_balance := case
    when p_type = 'deposit' then v_category.balance_centavos + p_amount_centavos
    else v_category.balance_centavos - p_amount_centavos
  end;

  insert into public.savings_transactions (category_id, user_id, type, amount_centavos, note)
  values (p_category_id, auth.uid(), p_type, p_amount_centavos, p_note);

  update public.savings_categories
  set balance_centavos = v_new_balance
  where id = p_category_id
  returning * into v_category;

  return v_category;
end;
$$;

-- ============================================================================
-- Mark a habit occurrence's status, creating the occurrence row on first
-- write (lazy materialization) if it doesn't exist yet. If the habit's
-- category is 'gym', also syncs the linked workout's `completed` flag so
-- Gym Tracker and Habit Tracker share one source of truth.
-- ============================================================================
create or replace function public.set_habit_occurrence_status(
  p_habit_id uuid,
  p_schedule_id uuid,
  p_occurrence_date date,
  p_scheduled_time time,
  p_status text
)
returns public.habit_occurrences
language plpgsql
security definer set search_path = public
as $$
declare
  v_habit public.habits;
  v_occurrence public.habit_occurrences;
begin
  if p_status is not null and p_status not in ('done', 'skipped', 'cancelled') then
    raise exception 'Invalid status.' using errcode = '22023';
  end if;

  select * into v_habit from public.habits where id = p_habit_id;
  if v_habit.id is null or v_habit.user_id <> auth.uid() then
    raise exception 'Not authorized.' using errcode = '42501';
  end if;

  insert into public.habit_occurrences (habit_id, schedule_id, user_id, occurrence_date, scheduled_time, status, completed_at)
  values (
    p_habit_id, p_schedule_id, auth.uid(), p_occurrence_date, p_scheduled_time, p_status,
    case when p_status = 'done' then now() else null end
  )
  on conflict (habit_id, occurrence_date) do update
    set status = excluded.status,
        completed_at = case when excluded.status = 'done' then now() else null end
  returning * into v_occurrence;

  if v_habit.category = 'gym' then
    update public.workouts
    set completed = (p_status = 'done')
    where user_id = auth.uid() and workout_date = p_occurrence_date;
  end if;

  return v_occurrence;
end;
$$;

-- ============================================================================
-- Mark a workout completed, which is the single source of truth that also
-- marks the linked Gym habit occurrence DONE (see spec: one source of truth).
-- ============================================================================
create or replace function public.complete_workout(p_workout_id uuid)
returns public.workouts
language plpgsql
security definer set search_path = public
as $$
declare
  v_workout public.workouts;
  v_gym_habit_id uuid;
  v_schedule_id uuid;
begin
  select * into v_workout from public.workouts where id = p_workout_id for update;
  if v_workout.id is null or v_workout.user_id <> auth.uid() then
    raise exception 'Not authorized.' using errcode = '42501';
  end if;

  if v_workout.workout_date <> (now() at time zone 'Asia/Manila')::date then
    raise exception 'Only today''s workout can be completed.' using errcode = '22023';
  end if;

  update public.workouts set completed = true where id = p_workout_id returning * into v_workout;

  select h.id into v_gym_habit_id
  from public.habits h
  where h.user_id = auth.uid() and h.category = 'gym'
  limit 1;

  if v_gym_habit_id is not null then
    select id into v_schedule_id from public.habit_schedules
    where habit_id = v_gym_habit_id
    order by created_at desc limit 1;

    if v_schedule_id is not null then
      perform public.set_habit_occurrence_status(
        v_gym_habit_id, v_schedule_id, v_workout.workout_date, null, 'done'
      );
    end if;
  end if;

  return v_workout;
end;
$$;

-- ============================================================================
-- Grants: allow the authenticated role to call these RPCs (RLS/ownership
-- checks happen inside each function body).
-- ============================================================================
grant execute on function public.record_debt_payment(uuid, bigint, text) to authenticated;
grant execute on function public.record_savings_transaction(uuid, text, bigint, text) to authenticated;
grant execute on function public.set_habit_occurrence_status(uuid, uuid, date, time, text) to authenticated;
grant execute on function public.complete_workout(uuid) to authenticated;
