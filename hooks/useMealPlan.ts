'use client'
/**
 * hooks/useMealPlan.ts
 * Hooks para gestionar el planner de comidas y recetas.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, startOfWeek } from 'date-fns'

// ─── Fetchers ─────────────────────────────────────────────────────────────────

async function fetchWeekPlan(weekDate: Date) {
  const weekStr = format(
    startOfWeek(weekDate, { weekStartsOn: 1 }), 'yyyy-MM-dd'
  )
  const res = await fetch(`/api/meal-plan?week=${weekStr}`)
  if (!res.ok) throw new Error('Error al cargar planner')
  return res.json()
}

async function fetchMonthPlan(year: number, month: number) {
  const res = await fetch(`/api/meal-plan?year=${year}&month=${month}`)
  if (!res.ok) throw new Error('Error al cargar mes')
  return res.json()
}

async function fetchShoppingList(weekDate: Date) {
  const weekStr = format(
    startOfWeek(weekDate, { weekStartsOn: 1 }), 'yyyy-MM-dd'
  )
  const res = await fetch(`/api/meal-plan?week=${weekStr}&shoppingList=true`)
  if (!res.ok) throw new Error('Error al cargar lista')
  return res.json()
}

async function upsertMealPlanEntry(entry: any) {
  const res = await fetch('/api/meal-plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entry),
  })
  if (!res.ok) {
    const { error } = await res.json()
    throw new Error(error ?? 'Error al guardar entrada')
  }
  return res.json()
}

async function fetchRecipes(mealType?: string) {
  const url = mealType ? `/api/recipes?meal_type=${mealType}` : '/api/recipes'
  const res = await fetch(url)
  if (!res.ok) throw new Error('Error al cargar recetas')
  return res.json()
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useWeekPlan(weekDate: Date = new Date()) {
  return useQuery({
    queryKey: ['meal-plan', 'week', format(weekDate, 'yyyy-MM-dd')],
    queryFn: () => fetchWeekPlan(weekDate),
  })
}

export function useMonthPlan(year: number, month: number) {
  return useQuery({
    queryKey: ['meal-plan', 'month', year, month],
    queryFn: () => fetchMonthPlan(year, month),
  })
}

export function useShoppingList(weekDate: Date = new Date()) {
  return useQuery({
    queryKey: ['shopping-list', format(weekDate, 'yyyy-MM-dd')],
    queryFn: () => fetchShoppingList(weekDate),
  })
}

export function useUpsertMealPlan() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: upsertMealPlanEntry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meal-plan'] })
      queryClient.invalidateQueries({ queryKey: ['shopping-list'] })
    },
  })
}

export function useRecipes(mealType?: string) {
  return useQuery({
    queryKey: ['recipes', mealType ?? 'all'],
    queryFn: () => fetchRecipes(mealType),
  })
}
