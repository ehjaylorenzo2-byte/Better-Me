-- ============================================================================
-- BETTER ME - Gym tracker: programs, routines, and per-set logging
--
-- The thing that makes everything else possible is workout_sets. Today an
-- exercise stores ONE sets count, ONE rep count and ONE weight, so "what did I
-- lift last time", personal records, per-set volume and exercise history are
-- all unanswerable: the individual sets were never recorded.
--
-- Nothing is dropped. workout_exercises keeps its columns and every existing
-- row is migrated into the new shape, so old workouts stay visible and the Gym
-- and Habit integration keeps working exactly as it does now.
--
-- Structure:
--   programs          Push Pull Legs
--     routines        Push Day, Pull Day, Leg Day
--       routine_exercises   Bench Press, Incline Press, ...
--   workouts          one day's training, optionally from a routine
--     workout_exercises     what you actually did
--       workout_sets        each set: weight, reps, or time, or distance
-- ============================================================================

-- ----------------------------------------------------------------------------
-- How an exercise is measured
--
-- Weight times reps is meaningless for a plank or a run, and inventing a
-- kilogram figure for them would put fiction into the volume total. Each
-- exercise says how it is measured and the maths follows from that.
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'exercise_measure') then
    create type public.exercise_measure as enum ('weight_reps', 'reps', 'duration', 'distance');
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- Programs
-- ----------------------------------------------------------------------------
create table if not exists public.programs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 60),
  notes text,
  archived boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists programs_user_idx on public.programs (user_id) where archived = false;

alter table public.programs enable row level security;
drop policy if exists "programs_owner_all" on public.programs;
create policy "programs_owner_all" on public.programs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- Routines
--
-- A routine belongs to a program. routine_note is the reusable one that shows
-- up every time you train it, as distinct from a note about one day's session.
-- ----------------------------------------------------------------------------
create table if not exists public.routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  program_id uuid references public.programs (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 60),
  /** Sticks to the routine and reappears every time it is used. */
  routine_note text,
  archived boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists routines_program_idx on public.routines (program_id, sort_order);
create index if not exists routines_user_idx on public.routines (user_id) where archived = false;

alter table public.routines enable row level security;
drop policy if exists "routines_owner_all" on public.routines;
create policy "routines_owner_all" on public.routines
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- The exercises a routine contains
--
-- target_sets is a hint for the day, not a limit: you can always do more or
-- fewer, and what you actually did lives in workout_sets.
-- ----------------------------------------------------------------------------
create table if not exists public.routine_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  routine_id uuid not null references public.routines (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 60),
  measure public.exercise_measure not null default 'weight_reps',
  target_sets int check (target_sets is null or target_sets between 1 and 20),
  notes text,
  sort_order int not null default 0
);

create index if not exists routine_exercises_routine_idx
  on public.routine_exercises (routine_id, sort_order);

alter table public.routine_exercises enable row level security;
drop policy if exists "routine_exercises_owner_all" on public.routine_exercises;
create policy "routine_exercises_owner_all" on public.routine_exercises
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- Workouts gain a routine, a clock, and today's own note
-- ----------------------------------------------------------------------------
alter table public.workouts
  add column if not exists routine_id uuid references public.routines (id) on delete set null,
  add column if not exists started_at timestamptz,
  add column if not exists ended_at timestamptz;

comment on column public.workouts.notes is
  'The note for this one session. The reusable note lives on routines.routine_note.';

-- ----------------------------------------------------------------------------
-- Exercises inside a workout gain a measure and a link back to the routine
-- ----------------------------------------------------------------------------
alter table public.workout_exercises
  add column if not exists measure public.exercise_measure not null default 'weight_reps',
  add column if not exists routine_exercise_id uuid references public.routine_exercises (id) on delete set null;

-- The old flat columns stay, so nothing that reads them breaks. They are no
-- longer the source of truth: workout_sets is.
comment on column public.workout_exercises.sets is
  'Superseded by workout_sets, kept so older code and history still read. '
  'Maintained automatically by the set triggers below.';

-- ----------------------------------------------------------------------------
-- Every set, recorded individually
--
-- This is the table the whole upgrade rests on.
-- ----------------------------------------------------------------------------
create table if not exists public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  workout_exercise_id uuid not null references public.workout_exercises (id) on delete cascade,
  set_number int not null check (set_number between 1 and 50),
  -- Weight in grams, integer, for the same reason money is in centavos: 62.5kg
  -- is exact as 62500 and approximate as a float.
  weight_grams int check (weight_grams is null or weight_grams >= 0),
  reps int check (reps is null or reps between 0 and 1000),
  duration_seconds int check (duration_seconds is null or duration_seconds >= 0),
  distance_metres int check (distance_metres is null or distance_metres >= 0),
  completed boolean not null default true,
  created_at timestamptz not null default now(),
  unique (workout_exercise_id, set_number)
);

create index if not exists workout_sets_exercise_idx
  on public.workout_sets (workout_exercise_id, set_number);
create index if not exists workout_sets_user_idx on public.workout_sets (user_id);

alter table public.workout_sets enable row level security;
drop policy if exists "workout_sets_owner_all" on public.workout_sets;
create policy "workout_sets_owner_all" on public.workout_sets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update, delete on public.programs, public.routines,
  public.routine_exercises, public.workout_sets to authenticated;
revoke all on public.programs, public.routines, public.routine_exercises,
  public.workout_sets from anon;

-- ----------------------------------------------------------------------------
-- Migrate what already exists
--
-- An old row saying "3 sets of 10 at 60kg" becomes three set rows. It is the
-- honest reading: that is all the old shape ever recorded. Only rows with no
-- sets yet are touched, so this cannot double up if re-run.
-- ----------------------------------------------------------------------------
insert into public.workout_sets
  (user_id, workout_exercise_id, set_number, weight_grams, reps, completed)
select we.user_id,
       we.id,
       gs.n,
       case when we.weight_kg > 0 then (we.weight_kg * 1000)::int else null end,
       nullif(we.reps, 0),
       true
  from public.workout_exercises we
 cross join generate_series(1, greatest(we.sets, 1)) as gs(n)
 where we.sets > 0
   and not exists (select 1 from public.workout_sets s where s.workout_exercise_id = we.id);

-- ----------------------------------------------------------------------------
-- Past days stay locked, for sets too
--
-- The workout_exercises guard from 0009 is also relaxed here for one specific
-- case: Better Me keeping the old flat totals in step with the new set rows.
-- That is the app maintaining its own derived data, not a person rewriting an
-- old session, and without the exemption every set you log would fail.
-- ----------------------------------------------------------------------------
create or replace function public.guard_workout_exercise_is_editable()
returns trigger
language plpgsql
as $$
declare
  v_today date := (now() at time zone 'Asia/Manila')::date;
  v_date date;
begin
  -- Set only by sync_exercise_totals, and only for the length of one statement.
  if coalesce(current_setting('betterme.internal_sync', true), 'off') = 'on' then
    return coalesce(new, old);
  end if;

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

create or replace function public.guard_workout_set_is_editable()
returns trigger
language plpgsql
as $$
declare
  v_today date := (now() at time zone 'Asia/Manila')::date;
  v_date date;
begin
  select w.workout_date into v_date
    from public.workout_exercises we
    join public.workouts w on w.id = we.workout_id
   where we.id = coalesce(new.workout_exercise_id, old.workout_exercise_id);

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

drop trigger if exists workout_sets_editable on public.workout_sets;
create trigger workout_sets_editable
  before insert or update or delete on public.workout_sets
  for each row execute function public.guard_workout_set_is_editable();

-- ----------------------------------------------------------------------------
-- Keep the old flat columns in step
--
-- So the existing screens, the history list and anything else still reading
-- sets/reps/weight_kg keep showing something sensible while the new UI is
-- built on top of workout_sets.
-- ----------------------------------------------------------------------------
create or replace function public.sync_exercise_totals()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_exercise uuid := coalesce(new.workout_exercise_id, old.workout_exercise_id);
begin
  -- The past-day guard on workout_exercises would otherwise block this, since
  -- keeping the old totals in step is an update to that table. The flag says
  -- "this write is Better Me itself, not a person editing an old day", and the
  -- guard checks for it. Scoped to the transaction, so it cannot leak.
  perform set_config('betterme.internal_sync', 'on', true);

  update public.workout_exercises we
     set sets = coalesce(agg.set_count, 0),
         reps = coalesce(agg.top_reps, 0),
         weight_kg = coalesce(agg.top_weight, 0)
    from (
      select count(*) as set_count,
             max(reps) as top_reps,
             round(max(weight_grams) / 1000.0, 2) as top_weight
        from public.workout_sets
       where workout_exercise_id = v_exercise and completed
    ) agg
   where we.id = v_exercise;

  perform set_config('betterme.internal_sync', 'off', true);

  return coalesce(new, old);
end;
$$;

drop trigger if exists workout_sets_sync_totals on public.workout_sets;
create trigger workout_sets_sync_totals
  after insert or update or delete on public.workout_sets
  for each row execute function public.sync_exercise_totals();

-- ----------------------------------------------------------------------------
-- Volume, and only where it means something
--
-- weight_reps: weight times reps, summed.
-- Everything else: no weight volume at all, because there isn't one. Duration
-- and distance are reported in their own units by the app.
-- ----------------------------------------------------------------------------
create or replace view public.workout_exercise_totals
with (security_invoker = on) as
select we.id as workout_exercise_id,
       we.workout_id,
       we.user_id,
       we.name,
       we.measure,
       count(s.id) filter (where s.completed) as set_count,
       coalesce(sum(s.reps) filter (where s.completed), 0) as total_reps,
       case
         when we.measure = 'weight_reps'
           then coalesce(sum(s.weight_grams::bigint * s.reps) filter (where s.completed), 0)
         else 0
       end as volume_grams,
       coalesce(sum(s.duration_seconds) filter (where s.completed), 0) as total_seconds,
       coalesce(sum(s.distance_metres) filter (where s.completed), 0) as total_metres,
       max(s.weight_grams) filter (where s.completed) as best_weight_grams,
       max(s.reps) filter (where s.completed) as best_reps
  from public.workout_exercises we
  left join public.workout_sets s on s.workout_exercise_id = we.id
 group by we.id, we.workout_id, we.user_id, we.name, we.measure;

grant select on public.workout_exercise_totals to authenticated;
revoke all on public.workout_exercise_totals from anon;

create or replace view public.workout_totals
with (security_invoker = on) as
select w.id as workout_id,
       w.user_id,
       w.workout_date,
       w.completed,
       count(distinct t.workout_exercise_id) as exercise_count,
       coalesce(sum(t.set_count), 0) as set_count,
       coalesce(sum(t.total_reps), 0) as total_reps,
       coalesce(sum(t.volume_grams), 0) as volume_grams,
       coalesce(sum(t.total_seconds), 0) as total_seconds,
       coalesce(sum(t.total_metres), 0) as total_metres,
       -- Prefers the real clock, falls back to the number the person typed.
       coalesce(
         case when w.ended_at is not null and w.started_at is not null
              then greatest(0, (extract(epoch from (w.ended_at - w.started_at)) / 60)::int)
         end,
         w.duration_minutes
       ) as duration_minutes
  from public.workouts w
  left join public.workout_exercise_totals t on t.workout_id = w.id
 group by w.id, w.user_id, w.workout_date, w.completed, w.started_at, w.ended_at, w.duration_minutes;

grant select on public.workout_totals to authenticated;
revoke all on public.workout_totals from anon;

-- ----------------------------------------------------------------------------
-- Personal records
--
-- Deliberately simple and explainable: your best single set by weight, your
-- best rep count, and your best volume in one session, per exercise name.
-- Matching on name is what lets a record survive being moved between routines.
-- ----------------------------------------------------------------------------
create or replace view public.exercise_records
with (security_invoker = on) as
with per_session as (
  select t.user_id,
         lower(trim(t.name)) as key,
         t.name,
         w.workout_date,
         t.best_weight_grams,
         t.best_reps,
         t.volume_grams
    from public.workout_exercise_totals t
    join public.workouts w on w.id = t.workout_id
   where t.set_count > 0
)
select user_id,
       key,
       max(name) as name,
       max(best_weight_grams) as best_weight_grams,
       max(best_reps) as best_reps,
       max(volume_grams) as best_volume_grams,
       max(workout_date) as last_done
  from per_session
 group by user_id, key;

grant select on public.exercise_records to authenticated;
revoke all on public.exercise_records from anon;

/**
 * What did I do last time?
 *
 * Returns the most recent completed sets for an exercise name, before the date
 * given, so the logging screen can show last session's numbers inline instead
 * of making the person go digging.
 */
create or replace function public.previous_exercise_sets(
  p_name text,
  p_before date
)
returns table (
  workout_date date,
  set_number int,
  weight_grams int,
  reps int,
  duration_seconds int,
  distance_metres int
)
language sql
stable
security definer set search_path = public
as $$
  with last_session as (
    select w.id, w.workout_date
      from public.workout_exercises we
      join public.workouts w on w.id = we.workout_id
     where we.user_id = auth.uid()
       and lower(trim(we.name)) = lower(trim(p_name))
       and w.workout_date < p_before
       and exists (select 1 from public.workout_sets s where s.workout_exercise_id = we.id and s.completed)
     order by w.workout_date desc
     limit 1
  )
  select ls.workout_date, s.set_number, s.weight_grams, s.reps, s.duration_seconds, s.distance_metres
    from last_session ls
    join public.workout_exercises we on we.workout_id = ls.id
    join public.workout_sets s on s.workout_exercise_id = we.id
   where we.user_id = auth.uid()
     and lower(trim(we.name)) = lower(trim(p_name))
     and s.completed
   order by s.set_number;
$$;

grant execute on function public.previous_exercise_sets(text, date) to authenticated;

-- ----------------------------------------------------------------------------
-- Rest timer preference
-- ----------------------------------------------------------------------------
alter table public.user_preferences
  add column if not exists rest_seconds int not null default 90
    check (rest_seconds between 0 and 600),
  add column if not exists rest_timer_enabled boolean not null default true;
