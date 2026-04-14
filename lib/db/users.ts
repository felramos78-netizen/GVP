/**
 * lib/db/users.ts
 * Queries para gestionar el perfil del usuario y centros de costo.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, InsertDto, UpdateDto } from '@/types/database'

type Supabase = SupabaseClient<Database>

// ─── Perfil ───────────────────────────────────────────────────────────────────

export async function getUserProfile(supabase: Supabase, userId: string) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single()

  if (error) throw new Error(`getUserProfile: ${error.message}`)
  return data
}

export async function upsertUserProfile(
  supabase: Supabase,
  profile: InsertDto<'users'>
) {
  const { data, error } = await supabase
    .from('users')
    .upsert(profile)
    .select()
    .single()

  if (error) throw new Error(`upsertUserProfile: ${error.message}`)
  return data
}

// ─── Centros de costo ─────────────────────────────────────────────────────────

export async function getCostCenters(supabase: Supabase, userId: string) {
  const { data, error } = await supabase
    .from('cost_centers')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('sort_order')

  if (error) throw new Error(`getCostCenters: ${error.message}`)
  return data
}

export async function createCostCenter(
  supabase: Supabase,
  center: InsertDto<'cost_centers'>
) {
  const { data, error } = await supabase
    .from('cost_centers')
    .insert(center)
    .select()
    .single()

  if (error) throw new Error(`createCostCenter: ${error.message}`)
  return data
}

export async function updateCostCenter(
  supabase: Supabase,
  id: string,
  userId: string,
  updates: UpdateDto<'cost_centers'>
) {
  const { data, error } = await supabase
    .from('cost_centers')
    .update(updates)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) throw new Error(`updateCostCenter: ${error.message}`)
  return data
}

export async function deleteCostCenter(
  supabase: Supabase,
  id: string,
  userId: string
) {
  // Soft delete
  const { error } = await supabase
    .from('cost_centers')
    .update({ is_active: false })
    .eq('id', id)
    .eq('user_id', userId)

  if (error) throw new Error(`deleteCostCenter: ${error.message}`)
}

// ─── Presupuesto mensual ──────────────────────────────────────────────────────

export async function getMonthlyBudget(
  supabase: Supabase,
  userId: string,
  yearMonth: string // 'yyyy-MM-01'
) {
  const { data, error } = await supabase
    .from('monthly_budget')
    .select('*, cost_centers(name, icon, color)')
    .eq('user_id', userId)
    .eq('year_month', yearMonth)

  if (error) throw new Error(`getMonthlyBudget: ${error.message}`)
  return data
}

/**
 * Registra un gasto en el presupuesto mensual.
 * Suma el monto al campo 'spent' del centro de costo correspondiente.
 */
export async function recordExpense(
  supabase: Supabase,
  userId: string,
  costCenterId: string,
  yearMonth: string,
  amount: number
) {
  // Obtener valor actual
  const { data: current } = await supabase
    .from('monthly_budget')
    .select('id, spent')
    .eq('user_id', userId)
    .eq('cost_center_id', costCenterId)
    .eq('year_month', yearMonth)
    .maybeSingle()

  const newSpent = (current?.spent ?? 0) + amount

  const { error } = await supabase
    .from('monthly_budget')
    .upsert({
      user_id: userId,
      cost_center_id: costCenterId,
      year_month: yearMonth,
      spent: newSpent,
    }, { onConflict: 'user_id,cost_center_id,year_month' })

  if (error) throw new Error(`recordExpense: ${error.message}`)
}
