-- ============================================================================
-- BETTER ME - Savings goal controls
--
--   1. Archive a goal instead of deleting it.
--   2. Delete a goal without ever silently destroying the money inside it.
--
-- The delete is the important half. Today the app has no delete button at all,
-- and wiring one straight to a DELETE would cascade the goal's whole history
-- away and drop its balance with no record anywhere of where the money went.
-- A savings goal holding twenty thousand pesos would just stop existing.
--
-- So deleting a goal that still holds money is not allowed to be a single
-- destructive step. The caller has to say what happens to the balance first,
-- and whichever they choose is written to the ledger as a real movement.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Archive
--
-- Matches how wallets and categories already work, so there is one idea of
-- "put this away without losing it" across the app.
-- ----------------------------------------------------------------------------
alter table public.savings_categories
  add column if not exists archived boolean not null default false;

create index if not exists savings_categories_active_idx
  on public.savings_categories (user_id) where archived = false;

comment on column public.savings_categories.archived is
  'Archived goals keep their balance and their history, and leave the active '
  'list. Completed goals are the usual reason. Restoring is just the reverse.';

-- ----------------------------------------------------------------------------
-- Delete a savings goal, safely
--
-- p_disposition decides what happens to any remaining balance:
--
--   'empty'    - refuse unless the goal is already at zero. The safe default.
--   'move'     - move the balance into another goal of yours (p_target_goal_id).
--   'withdraw' - withdraw it back to one of your wallets (p_target_account_id).
--
-- Both 'move' and 'withdraw' go through the ledger rather than adjusting a
-- number quietly: a withdrawal is recorded against the goal being deleted, and
-- a matching deposit is recorded against the goal receiving it. The rows are
-- deleted along with the goal a moment later, but the receiving goal keeps its
-- deposit, so the money is always traceable to somewhere real.
--
-- Everything happens in one function, so a failure halfway cannot leave the
-- money in neither place.
-- ----------------------------------------------------------------------------
create or replace function public.delete_savings_goal(
  p_goal_id uuid,
  p_disposition text default 'empty',
  p_target_goal_id uuid default null,
  p_target_account_id uuid default null
)
returns json
language plpgsql
security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_goal public.savings_categories;
  v_target public.savings_categories;
  v_moved bigint := 0;
  v_action text := 'deleted';
begin
  if v_user is null then
    raise exception 'Not signed in.' using errcode = '42501';
  end if;

  if p_disposition not in ('empty', 'move', 'withdraw') then
    raise exception 'Choose what happens to the money first.' using errcode = '22023';
  end if;

  -- Locked, so a deposit landing at the same moment cannot be lost between
  -- reading the balance and deleting the goal.
  select * into v_goal
    from public.savings_categories
   where id = p_goal_id and user_id = v_user
     for update;

  if v_goal.id is null then
    raise exception 'Not authorized.' using errcode = '42501';
  end if;

  if v_goal.balance_centavos > 0 then
    if p_disposition = 'empty' then
      raise exception
        'This goal still holds %. Move it to another goal or withdraw it first.',
        v_goal.balance_centavos
        using errcode = '22023';
    end if;

    if p_disposition = 'move' then
      if p_target_goal_id is null or p_target_goal_id = p_goal_id then
        raise exception 'Pick a different goal to move the money into.' using errcode = '22023';
      end if;

      select * into v_target
        from public.savings_categories
       where id = p_target_goal_id and user_id = v_user
         for update;

      if v_target.id is null then
        raise exception 'That goal is not yours.' using errcode = '42501';
      end if;

      if v_target.archived then
        raise exception 'That goal is archived. Restore it first, or pick another.'
          using errcode = '22023';
      end if;

      -- Recorded on both sides. The receiving goal keeps its deposit row.
      insert into public.savings_transactions
        (user_id, category_id, type, amount_centavos, note, counter_account_id, entry_date)
      values
        (v_user, p_goal_id, 'withdrawal', v_goal.balance_centavos,
         'Moved to ' || v_target.name, null, (now() at time zone 'Asia/Manila')::date),
        (v_user, p_target_goal_id, 'deposit', v_goal.balance_centavos,
         'Moved from ' || v_goal.name, null, (now() at time zone 'Asia/Manila')::date);

      update public.savings_categories
         set balance_centavos = balance_centavos + v_goal.balance_centavos
       where id = p_target_goal_id;

      v_moved := v_goal.balance_centavos;
      v_action := 'moved';

    elsif p_disposition = 'withdraw' then
      if p_target_account_id is null then
        raise exception 'Pick the wallet the money goes back to.' using errcode = '22023';
      end if;

      if not exists (
        select 1 from public.finance_accounts
         where id = p_target_account_id and user_id = v_user
      ) then
        raise exception 'That bank is not yours.' using errcode = '42501';
      end if;

      -- A withdrawal against a wallet is a real movement, so it must survive
      -- the goal being deleted. It is written against the destination wallet
      -- as a transfer in, which is the only record that outlives the goal.
      insert into public.transfers
        (user_id, from_account_id, to_account_id, amount_centavos, entry_date, note)
      values
        (v_user, null, p_target_account_id, v_goal.balance_centavos,
         (now() at time zone 'Asia/Manila')::date,
         'Closed savings goal: ' || v_goal.name);

      v_moved := v_goal.balance_centavos;
      v_action := 'withdrawn';
    end if;

    update public.savings_categories set balance_centavos = 0 where id = p_goal_id;
  end if;

  -- The goal and its own history go. Anything the money moved into stays.
  delete from public.savings_categories where id = p_goal_id and user_id = v_user;

  return json_build_object('action', v_action, 'amount', v_moved);
end;
$$;

revoke all on function public.delete_savings_goal(uuid, text, uuid, uuid) from public, anon;
grant execute on function public.delete_savings_goal(uuid, text, uuid, uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- Archive and restore
--
-- Thin wrappers so the app never writes the flag directly, which keeps the
-- rule "a goal you cannot see still has your money in it" in one place.
-- ----------------------------------------------------------------------------
create or replace function public.set_savings_goal_archived(
  p_goal_id uuid,
  p_archived boolean
)
returns public.savings_categories
language plpgsql
security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_goal public.savings_categories;
begin
  if v_user is null then
    raise exception 'Not signed in.' using errcode = '42501';
  end if;

  update public.savings_categories
     set archived = p_archived
   where id = p_goal_id and user_id = v_user
  returning * into v_goal;

  if v_goal.id is null then
    raise exception 'Not authorized.' using errcode = '42501';
  end if;

  return v_goal;
end;
$$;

revoke all on function public.set_savings_goal_archived(uuid, boolean) from public, anon;
grant execute on function public.set_savings_goal_archived(uuid, boolean) to authenticated;
