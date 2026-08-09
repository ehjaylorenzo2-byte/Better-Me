import { supabase } from '@/lib/supabase'

export type CategoryKind = 'expense' | 'income'

export interface FinanceCategory {
  id: string
  userId: string
  name: string
  kind: CategoryKind
  color: string
  icon: string
  isBuiltin: boolean
  archived: boolean
  sortOrder: number
}

interface Row {
  id: string
  user_id: string
  name: string
  kind: CategoryKind
  color: string
  icon: string
  is_builtin: boolean
  archived: boolean
  sort_order: number
}

function map(row: Row): FinanceCategory {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    kind: row.kind,
    color: row.color,
    icon: row.icon,
    isBuiltin: row.is_builtin,
    archived: row.archived,
    sortOrder: row.sort_order,
  }
}

/**
 * Seeds the starter categories the first time a user opens Finance. Safe to
 * call on every load: the server only seeds when the user has none at all, so
 * it never resurrects categories that were deliberately archived.
 */
export async function ensureDefaultCategories(): Promise<void> {
  const { error } = await supabase.rpc('ensure_default_finance_categories')
  if (error) throw error
}

export async function listCategories(
  userId: string,
  options: { includeArchived?: boolean } = {},
): Promise<FinanceCategory[]> {
  let query = supabase
    .from('finance_categories')
    .select('*')
    .eq('user_id', userId)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  if (!options.includeArchived) query = query.eq('archived', false)

  const { data, error } = await query
  if (error) throw error
  return ((data ?? []) as Row[]).map(map)
}

export interface CategoryInput {
  name: string
  kind: CategoryKind
  color: string
  icon: string
}

export async function createCategory(userId: string, input: CategoryInput): Promise<FinanceCategory> {
  const name = input.name.trim()
  if (!name) throw new Error('Give the category a name.')
  if (name.length > 30) throw new Error('Keep the name under 30 characters.')

  const { data, error } = await supabase
    .from('finance_categories')
    .insert({
      user_id: userId,
      name,
      kind: input.kind,
      color: input.color,
      icon: input.icon,
      sort_order: 500,
    })
    .select('*')
    .single()

  if (error) {
    if (error.code === '23505') throw new Error(`You already have a ${input.kind} category called "${name}".`)
    throw error
  }
  return map(data as Row)
}

export async function updateCategory(
  categoryId: string,
  updates: Partial<Pick<CategoryInput, 'name' | 'color' | 'icon'>>,
): Promise<void> {
  const payload: { name?: string; color?: string; icon?: string } = {}
  if (updates.name !== undefined) {
    const name = updates.name.trim()
    if (!name) throw new Error('Give the category a name.')
    payload.name = name
  }
  if (updates.color !== undefined) payload.color = updates.color
  if (updates.icon !== undefined) payload.icon = updates.icon

  const { error } = await supabase.from('finance_categories').update(payload).eq('id', categoryId)
  if (error) {
    if (error.code === '23505') throw new Error('You already have a category with that name.')
    throw error
  }
}

/** Archive rather than delete, so past transactions keep their labels intact. */
export async function setCategoryArchived(categoryId: string, archived: boolean): Promise<void> {
  const { error } = await supabase.from('finance_categories').update({ archived }).eq('id', categoryId)
  if (error) throw error
}

export async function reorderCategories(ordered: Array<{ id: string; sortOrder: number }>): Promise<void> {
  await Promise.all(
    ordered.map(({ id, sortOrder }) =>
      supabase.from('finance_categories').update({ sort_order: sortOrder }).eq('id', id),
    ),
  )
}

/** Lookup map from category name to its colour/icon, for decorating transaction rows. */
export function buildCategoryLookup(categories: FinanceCategory[]): Map<string, FinanceCategory> {
  return new Map(categories.map((c) => [c.name.toLowerCase(), c]))
}

// ---------------------------------------------------------------------------
// Per-category monthly budgets
// ---------------------------------------------------------------------------

export interface CategoryBudget {
  id: string
  categoryId: string
  month: string
  amount: number
}

export async function listCategoryBudgets(userId: string, month: string): Promise<CategoryBudget[]> {
  const { data, error } = await supabase
    .from('category_budgets')
    .select('*')
    .eq('user_id', userId)
    .eq('month', month)
  if (error) throw error
  return (data ?? []).map((r: { id: string; category_id: string; month: string; amount_centavos: number }) => ({
    id: r.id,
    categoryId: r.category_id,
    month: r.month,
    amount: r.amount_centavos,
  }))
}

export async function setCategoryBudget(
  userId: string,
  categoryId: string,
  month: string,
  amount: number,
): Promise<void> {
  if (amount < 0) throw new Error('Budget cannot be negative.')

  if (amount === 0) {
    const { error } = await supabase
      .from('category_budgets')
      .delete()
      .eq('user_id', userId)
      .eq('category_id', categoryId)
      .eq('month', month)
    if (error) throw error
    return
  }

  const { error } = await supabase
    .from('category_budgets')
    .upsert(
      { user_id: userId, category_id: categoryId, month, amount_centavos: amount },
      { onConflict: 'user_id,category_id,month' },
    )
  if (error) throw error
}
