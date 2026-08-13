-- ============================================================================
-- BETTER ME - Habit rules and an exact gym link
--
-- Four things, all of them enforced in the database rather than only in the
-- screen, because the screen is not the guarantee:
--
--   1. A habit cannot be marked on a future day.
--   2. A habit cannot be marked on a day it was never scheduled.
--   3. No Status means no row, not a row with an empty status.
--   4. Completing a workout marks the EXACT gym habit it belongs to, chosen
--      once and stored, rather than whichever one the database happened to
--      return first.
--
-- Plus the thing that blocks all of the gym work: until now no screen could
-- create a gym habit at all, because the category column only allowed two
-- values and the habit form never sent one.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Habit categories you can actually choose
--
-- 'gym' keeps its special meaning, because the workout link depends on it.
-- Everything else is now a label the person picks, so Health, Study, Money or
-- anything else works without a migration each time.
-- ----------------------------------------------------------------------------
alter table public.habits drop constraint if exists habits_category_check;

alter table public.habits
  add constraint habits_category_check
  check (char_length(trim(category)) between 1 and 24);

comment on column public.habits.category is
  'Free text, chosen by the person. Only ''gym'' is special: it is what links a '
  'habit to the workout tracker. Everything else is just a label.';

-- ----------------------------------------------------------------------------
-- 2. Does a schedule apply on a date?
--
-- A direct port of scheduleAppliesOnDate in src/utils/recurrence.ts. It has to
-- exist here because the app materialises occurrences on demand: the write
-- arrives as a bare (habit, schedule, date) and the database previously had no
-- way to know whether that date was ever scheduled.
--
-- Kept deliberately close to the TypeScript, case for case, so the two cannot
-- drift apart without it being obvious.
-- ----------------------------------------------------------------------------
create or replace function public.schedule_applies_on(
  p_schedule_id uuid,
  p_date date
)
returns boolean
language plpgsql
stable
security definer set search_path = public
as $$
declare
  s public.habit_schedules;
  v_weekday int;
begin
  select * into s from public.habit_schedules where id = p_schedule_id;
  if s.id is null then return false; end if;

  if p_date < s.start_date then return false; end if;
  if s.end_date is not null and p_date > s.end_date then return false; end if;

  -- Postgres dow is 0=Sunday, matching the JavaScript convention used by the app.
  v_weekday := extract(dow from p_date)::int;

  return case s.recurrence
    when 'once'  then p_date = s.start_date
    when 'daily' then true
    when 'weekly' then
      case
        when s.weekdays is not null and array_length(s.weekdays, 1) > 0
          then v_weekday = any(s.weekdays)
        else extract(dow from s.start_date)::int = v_weekday
      end
    when 'monthly' then
      extract(day from p_date) = extract(day from s.start_date)
    when 'custom' then
      s.weekdays is not null and v_weekday = any(s.weekdays)
    else false
  end;
end;
$$;

-- ----------------------------------------------------------------------------
-- 3. Setting a habit status, with the rules applied
--
-- Replaces the old function, which validated only the status value and who was
-- asking. It never looked at the date, so tomorrow could be marked Done, and a
-- Monday-Wednesday-Friday habit could be marked Done on a Sunday.
--
-- Passing null now DELETES the row. That is what "No Status" means: nothing
-- recorded. Storing a row with an empty status was the same thing wearing a
-- disguise, and it made "how many are still undecided" impossible to answer.
-- ----------------------------------------------------------------------------
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
  v_user uuid := auth.uid();
  v_habit public.habits;
  v_today date := (now() at time zone 'Asia/Manila')::date;
  v_row public.habit_occurrences;
begin
  if v_user is null then
    raise exception 'Not signed in.' using errcode = '42501';
  end if;

  if p_status is not null and p_status not in ('done', 'skipped', 'cancelled') then
    raise exception 'Invalid status.' using errcode = '22023';
  end if;

  select * into v_habit from public.habits where id = p_habit_id;
  if v_habit.id is null or v_habit.user_id <> v_user then
    raise exception 'Not authorized.' using errcode = '42501';
  end if;

  -- You cannot have done tomorrow yet.
  if p_occurrence_date > v_today then
    raise exception 'That day has not happened yet.' using errcode = '22023';
  end if;

  -- Nor can you decide a day the habit was never scheduled for.
  if not public.schedule_applies_on(p_schedule_id, p_occurrence_date) then
    raise exception 'This habit was not scheduled on that day.' using errcode = '22023';
  end if;

  -- The schedule has to belong to the habit, or the two checks above could be
  -- passed using somebody else's schedule.
  if not exists (
    select 1 from public.habit_schedules
     where id = p_schedule_id and habit_id = p_habit_id and user_id = v_user
  ) then
    raise exception 'That schedule does not belong to this habit.' using errcode = '42501';
  end if;

  if p_status is null then
    delete from public.habit_occurrences
     where habit_id = p_habit_id and occurrence_date = p_occurrence_date and user_id = v_user;

    -- Clearing a gym habit also un-completes that day's workout.
    if v_habit.category = 'gym' then
      update public.workouts w
         set completed = false
       where w.user_id = v_user
         and w.workout_date = p_occurrence_date
         and w.habit_id = p_habit_id;
    end if;

    return null;
  end if;

  insert into public.habit_occurrences
    (habit_id, schedule_id, user_id, occurrence_date, scheduled_time, status, completed_at)
  values
    (p_habit_id, p_schedule_id, v_user, p_occurrence_date, p_scheduled_time, p_status,
     case when p_status = 'done' then now() else null end)
  on conflict (habit_id, occurrence_date) do update
    set status = excluded.status,
        schedule_id = excluded.schedule_id,
        scheduled_time = excluded.scheduled_time,
        completed_at = excluded.completed_at
  returning * into v_row;

  -- Gym habits keep that day's workout in step, but only the workout actually
  -- tied to this habit. Matching on date alone used to let one gym habit
  -- un-complete a workout belonging to another.
  if v_habit.category = 'gym' then
    update public.workouts w
       set completed = (p_status = 'done')
     where w.user_id = v_user
       and w.workout_date = p_occurrence_date
       and w.habit_id = p_habit_id;
  end if;

  return v_row;
end;
$$;

grant execute on function public.set_habit_occurrence_status(uuid, uuid, date, time, text) to authenticated;

-- ----------------------------------------------------------------------------
-- 4. Workouts know which habit they belong to
--
-- The old link searched at completion time: "any gym habit, limit 1, no order
-- by". With two gym habits it picked one at random and could pick a different
-- one next time, marking a habit Done on a day it was never scheduled while
-- the real one stayed untouched.
--
-- The workout now stores its habit, decided once when the workout is created
-- and never guessed again.
-- ----------------------------------------------------------------------------
alter table public.workouts
  add column if not exists habit_id uuid references public.habits (id) on delete set null;

create index if not exists workouts_habit_idx on public.workouts (habit_id, workout_date);

-- Backfill: existing workouts adopt the user's earliest live gym habit, which
-- is the only defensible guess and is at least deterministic.
update public.workouts w
   set habit_id = h.id
  from (
    select distinct on (user_id) user_id, id
      from public.habits
     where category = 'gym' and archived = false
     order by user_id, created_at
  ) h
 where w.habit_id is null and h.user_id = w.user_id;

/**
 * Which gym habit does a date belong to?
 *
 * Deterministic on purpose: live habits only, ones actually scheduled that day
 * first, then oldest. Same answer every time it is asked.
 */
create or replace function public.resolve_gym_habit(p_date date)
returns uuid
language plpgsql
stable
security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_habit uuid;
begin
  if v_user is null then return null; end if;

  select h.id into v_habit
    from public.habits h
   where h.user_id = v_user
     and h.category = 'gym'
     and h.archived = false
   order by
     (exists (
        select 1 from public.habit_schedules s
         where s.habit_id = h.id and public.schedule_applies_on(s.id, p_date)
      )) desc,
     h.created_at asc
   limit 1;

  return v_habit;
end;
$$;

grant execute on function public.resolve_gym_habit(date) to authenticated;

-- ----------------------------------------------------------------------------
-- 5. Completing a workout
--
-- Past days stay locked and future days are refused, as before. What changes is
-- that the habit is read off the workout instead of being searched for, and the
-- schedule chosen is one that actually covers the date.
-- ----------------------------------------------------------------------------
create or replace function public.complete_workout(p_workout_id uuid)
returns public.workouts
language plpgsql
security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_workout public.workouts;
  v_schedule_id uuid;
begin
  if v_user is null then
    raise exception 'Not signed in.' using errcode = '42501';
  end if;

  select * into v_workout from public.workouts where id = p_workout_id;
  if v_workout.id is null or v_workout.user_id <> v_user then
    raise exception 'Not authorized.' using errcode = '42501';
  end if;

  if v_workout.workout_date <> (now() at time zone 'Asia/Manila')::date then
    raise exception 'Only today''s workout can be completed.' using errcode = '22023';
  end if;

  update public.workouts set completed = true where id = p_workout_id returning * into v_workout;

  -- No gym habit, or none scheduled today, means nothing to mark. The caller
  -- is told which, so the screen can stop claiming a habit was marked Done
  -- when nothing happened.
  if v_workout.habit_id is not null then
    select s.id into v_schedule_id
      from public.habit_schedules s
     where s.habit_id = v_workout.habit_id
       and public.schedule_applies_on(s.id, v_workout.workout_date)
     order by s.created_at desc
     limit 1;

    if v_schedule_id is not null then
      perform public.set_habit_occurrence_status(
        v_workout.habit_id, v_schedule_id, v_workout.workout_date, null, 'done'
      );
    end if;
  end if;

  return v_workout;
end;
$$;

grant execute on function public.complete_workout(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 6. Past workouts are locked in the database too
--
-- The screen already refused to edit a past day. Nothing else did, so a stale
-- tab or a replayed request could still rewrite last year's session.
-- ----------------------------------------------------------------------------
-- The exercise rows have no date of their own, so the guard reads the parent
-- workout's date.
create or replace function public.guard_workout_exercise_is_editable()
returns trigger
language plpgsql
as $$
declare
  v_today date := (now() at time zone 'Asia/Manila')::date;
  v_date date;
begin
  select workout_date into v_date
    from public.workouts
   where id = coalesce(new.workout_id, old.workout_id);

  if v_date is null then return coalesce(new, old); end if;

  if v_date < v_today then
    raise exception 'That day is finished and cannot be changed.' using errcode = '22023';
  end if;
  if v_date > v_today then
    raise exception 'That day has not happened yet.' using errcode = '22023';
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists workout_exercises_editable on public.workout_exercises;
create trigger workout_exercises_editable
  before insert or update or delete on public.workout_exercises
  for each row execute function public.guard_workout_exercise_is_editable();

-- ----------------------------------------------------------------------------
-- 7. Close the direct-insert back door
--
-- The occurrences table had a blanket owner policy, so a client could insert a
-- row for any date at all and skip every rule above. Writes now go through the
-- function, which is the only place the rules live.
-- ----------------------------------------------------------------------------
drop policy if exists "habit_occurrences_owner_all" on public.habit_occurrences;
-- Dropped first so the whole file can be re-run without erroring. Without
-- these two lines a second run fails on "policy already exists", which looks
-- alarming and changes nothing.
drop policy if exists "habit_occurrences_owner_read" on public.habit_occurrences;
drop policy if exists "habit_occurrences_owner_delete" on public.habit_occurrences;

create policy "habit_occurrences_owner_read" on public.habit_occurrences
  for select using (auth.uid() = user_id);

create policy "habit_occurrences_owner_delete" on public.habit_occurrences
  for delete using (auth.uid() = user_id);

revoke insert, update on public.habit_occurrences from authenticated;
