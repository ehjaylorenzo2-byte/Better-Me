-- Better Me — 0011: make the finance reminder switch mean something.
--
-- notification_preferences.finance_reminders_enabled has existed since 0006 and
-- has been written by the settings screen ever since, but nothing has ever read
-- it. The switch was decoration. The sender is being built now, so the delivery
-- ledger has to be able to record what it sends: reminder_deliveries.kind only
-- allowed 'one_hour' and 'noon_summary', and an insert of anything else was
-- rejected by the check constraint, which would have silently stopped every
-- finance nudge at the claim step.
--
-- Safe to run more than once.

begin;

-- The constraint is dropped by its generated name and by any earlier hand-named
-- variant, because a database restored from SETUP.sql may carry either.
alter table public.reminder_deliveries
  drop constraint if exists reminder_deliveries_kind_check;

alter table public.reminder_deliveries
  drop constraint if exists reminder_deliveries_kind_allowed;

alter table public.reminder_deliveries
  add constraint reminder_deliveries_kind_allowed
  check (kind in ('one_hour', 'noon_summary', 'finance_nudge'));

comment on column public.reminder_deliveries.kind is
  'one_hour: an hour before a scheduled habit. noon_summary: the midday list of '
  'what is still outstanding. finance_nudge: the evening reminder to record the '
  'day''s money, sent only when nothing was recorded.';

-- The one hour reminder now claims per SCHEDULE rather than per habit.
--
-- A habit with two schedules — say a 7am run and a 6pm run — shares one habit
-- id, so the old key (user, kind, habit_id, date) let the first send block the
-- second for the rest of the day. subject_id now carries the schedule id, which
-- is unique per reminder, and the existing unique index needs no change because
-- it is already keyed on subject_id.
comment on column public.reminder_deliveries.subject_id is
  'The habit_schedules row for a one_hour reminder. Null for noon_summary and '
  'finance_nudge, which are one per user per day.';

commit;
