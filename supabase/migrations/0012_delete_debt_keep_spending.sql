-- ----------------------------------------------------------------------------
-- 0012 — Deleting a debt must not refund you.
--
-- The problem this fixes:
--
-- finance_account_balances subtracts debt_payments from the wallet they were
-- paid from (the `debt_out` branch, migration 0007). Deleting a debt cascades
-- its payments away, so those rows stop being subtracted and the money
-- reappears in the wallet. Money out for the month drops by the same amount.
--
-- That is wrong. The money genuinely left. Removing a debt should remove the
-- debt, not rewrite history so you look richer than you are — and a total that
-- silently climbs after a delete is exactly the kind of quiet inaccuracy that
-- makes a money app untrustworthy.
--
-- So: before the debt goes, every payment made against it is converted into a
-- plain expense with the same amount, date and wallet, filed under the debt's
-- name. The outflow is preserved, the balances do not move, and the debt is
-- gone. "Where it went" already lists debt payments under the debt's name, so
-- the breakdown looks identical before and after.
--
-- It has to be one function rather than two calls from the browser: inserting
-- the expenses and deleting the debt must both happen or neither, otherwise a
-- dropped connection between them either double-counts the spending or
-- refunds it.
-- ----------------------------------------------------------------------------

create or replace function public.delete_debt_keep_spending(p_debt_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_name text;
begin
  -- security definer bypasses RLS, so ownership is checked by hand. Selecting
  -- the row and comparing against auth.uid() is the whole guard: a debt id
  -- belonging to someone else finds nothing and raises.
  select user_id, name into v_user_id, v_name
  from public.debts
  where id = p_debt_id;

  if v_user_id is null then
    raise exception 'Debt not found.';
  end if;

  if v_user_id is distinct from auth.uid() then
    raise exception 'Not your debt.';
  end if;

  -- Preserve the outflow. account_id is carried across so the wallet that paid
  -- is still the wallet that is down; a payment logged without a wallet stays
  -- without one.
  insert into public.expense_entries (user_id, amount_centavos, category, entry_date, description, account_id)
  select
    dp.user_id,
    dp.amount_centavos,
    v_name,
    dp.entry_date,
    coalesce(nullif(dp.note, ''), 'Debt payment'),
    dp.account_id
  from public.debt_payments dp
  where dp.debt_id = p_debt_id;

  -- Cascade takes the payments with it.
  delete from public.debts where id = p_debt_id;
end;
$$;

revoke all on function public.delete_debt_keep_spending(uuid) from public;
grant execute on function public.delete_debt_keep_spending(uuid) to authenticated;
