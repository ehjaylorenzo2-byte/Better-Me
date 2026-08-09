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
