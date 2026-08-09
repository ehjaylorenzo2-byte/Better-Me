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
