'use client'
/**
 * hooks/useProducts.ts
 * Hooks de React para gestionar productos desde el cliente.
 * Usa TanStack Query para cache, loading states y refetch automático.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface ProductFilters {
  category?: string
  type?: string
  search?: string
}

// ─── Fetchers ─────────────────────────────────────────────────────────────────

async function fetchProducts(filters: ProductFilters = {}) {
  const params = new URLSearchParams()
  if (filters.category) params.set('category', filters.category)
  if (filters.type)     params.set('type', filters.type)
  if (filters.search)   params.set('search', filters.search)

  const res = await fetch(`/api/products?${params.toString()}`)
  if (!res.ok) {
    const { error } = await res.json()
    throw new Error(error ?? 'Error al cargar productos')
  }
  return res.json()
}

async function fetchProduct(id: string) {
  const res = await fetch(`/api/products/${id}`)
  if (!res.ok) throw new Error('Producto no encontrado')
  return res.json()
}

async function createProductFn(data: any) {
  const res = await fetch('/api/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const { error } = await res.json()
    throw new Error(error ?? 'Error al crear producto')
  }
  return res.json()
}

async function updateProductFn({ id, ...data }: any) {
  const res = await fetch(`/api/products/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const { error } = await res.json()
    throw new Error(error ?? 'Error al actualizar producto')
  }
  return res.json()
}

async function archiveProductFn(id: string) {
  const res = await fetch(`/api/products/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Error al archivar producto')
  return res.json()
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

/**
 * Lista de productos con filtros opcionales.
 */
export function useProducts(filters: ProductFilters = {}) {
  return useQuery({
    queryKey: ['products', filters],
    queryFn: () => fetchProducts(filters),
  })
}

/**
 * Producto individual con todos sus detalles.
 */
export function useProduct(id: string | null) {
  return useQuery({
    queryKey: ['product', id],
    queryFn: () => fetchProduct(id!),
    enabled: !!id,
  })
}

/**
 * Mutación para crear un nuevo producto.
 * Invalida la lista de productos al completarse.
 */
export function useCreateProduct() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createProductFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
    },
  })
}

/**
 * Mutación para actualizar un producto existente.
 */
export function useUpdateProduct() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateProductFn,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['product', variables.id] })
    },
  })
}

/**
 * Mutación para archivar (soft-delete) un producto.
 */
export function useArchiveProduct() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: archiveProductFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
    },
  })
}

/**
 * Hook para buscar precios con IA.
 * Llama a /api/ai/search-prices e invalida price_history al completarse.
 */
export function useSearchPrices() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (productIds: string[]) => {
      const res = await fetch('/api/ai/search-prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productIds }),
      })
      if (!res.ok) {
        const { error } = await res.json()
        throw new Error(error ?? 'Error en búsqueda IA')
      }
      return res.json()
    },
    onSuccess: () => {
      // Refrescar precios en todas las fichas de productos
      queryClient.invalidateQueries({ queryKey: ['product'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
    },
  })
}
