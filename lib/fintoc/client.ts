/**
 * lib/fintoc/client.ts
 * Cliente Fintoc para operaciones server-side.
 * Documentación: https://docs.fintoc.com
 */

const FINTOC_BASE = 'https://api.fintoc.com/v1'
const SECRET_KEY = process.env.FINTOC_SECRET_KEY!

async function fintocFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${FINTOC_BASE}${path}`, {
    ...options,
    headers: {
      'Authorization': SECRET_KEY,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  if (!res.ok) {
    const error = await res.text()
    throw new Error(`Fintoc API error ${res.status}: ${error}`)
  }
  return res.json()
}

// Obtener los links (conexiones bancarias) del usuario
export async function getLinks() {
  return fintocFetch('/links')
}

// Obtener un link específico
export async function getLink(linkToken: string) {
  return fintocFetch(`/links/${linkToken}`)
}

// Obtener cuentas de un link
export async function getAccounts(linkToken: string) {
  return fintocFetch(`/links/${linkToken}/accounts`)
}

// Obtener movimientos de una cuenta
export async function getMovements(
  linkToken: string,
  accountId: string,
  options: { since?: string; until?: string; perPage?: number } = {}
) {
  const params = new URLSearchParams()
  if (options.since) params.set('since', options.since)
  if (options.until) params.set('until', options.until)
  if (options.perPage) params.set('per_page', options.perPage.toString())

  return fintocFetch(`/links/${linkToken}/accounts/${accountId}/movements?${params}`)
}

// Obtener saldo de una cuenta
export async function getBalance(linkToken: string, accountId: string) {
  return fintocFetch(`/links/${linkToken}/accounts/${accountId}`)
}
