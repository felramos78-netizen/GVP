/**
 * lib/gemini/price-search.ts
 * Lógica de búsqueda de precios usando Gemini + Google Search.
 * Solo se ejecuta en server-side (API Routes).
 */
import { getPriceSearchModel } from './client'
import { buildMultiSupplierPricePrompt } from './prompts'

export type PriceSearchResult = {
  supplierId: string
  supplierName: string
  available: boolean
  priceCLP: number | null
  isOnSale: boolean
  confidence: 'high' | 'medium' | 'low'
  error?: string
}

export type ProductPriceSearch = {
  productId: string
  productName: string
  results: PriceSearchResult[]
  searchedAt: string
}

/**
 * Busca el precio de un producto en múltiples proveedores.
 * Usa una sola llamada a Gemini para todos los proveedores (más eficiente).
 */
export async function searchProductPrices(
  productName: string,
  suppliers: Array<{ id: string; name: string; searchUrl: string | null }>
): Promise<PriceSearchResult[]> {
  const model = getPriceSearchModel()
  const prompt = buildMultiSupplierPricePrompt(productName, suppliers)

  try {
    const result = await model.generateContent(prompt)
    const text = result.response.text().trim()

    // Limpiar posibles backticks de markdown
    const clean = text.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean)

    if (!parsed.results || !Array.isArray(parsed.results)) {
      throw new Error('Respuesta inesperada de Gemini: sin campo results')
    }

    // Mapear resultados al formato interno
    return parsed.results.map((r: any) => {
      const supplier = suppliers.find(
        s => s.name.toLowerCase() === r.supplier?.toLowerCase()
      )
      return {
        supplierId: supplier?.id ?? '',
        supplierName: r.supplier ?? '',
        available: r.available ?? false,
        priceCLP: r.price_clp ?? null,
        isOnSale: r.is_on_sale ?? false,
        confidence: r.confidence ?? 'low',
      }
    }).filter((r: PriceSearchResult) => r.supplierId !== '')

  } catch (err) {
    // Si falla el parsing, retornar error por cada proveedor
    return suppliers.map(s => ({
      supplierId: s.id,
      supplierName: s.name,
      available: false,
      priceCLP: null,
      isOnSale: false,
      confidence: 'low' as const,
      error: err instanceof Error ? err.message : 'Error desconocido',
    }))
  }
}

/**
 * Busca precios de múltiples productos en lote.
 * Respeta el rate limit haciendo las llamadas secuencialmente
 * con un pequeño delay entre cada una.
 */
export async function searchPricesBatch(
  products: Array<{
    productId: string
    productName: string
    suppliers: Array<{ id: string; name: string; searchUrl: string | null }>
  }>
): Promise<ProductPriceSearch[]> {
  const results: ProductPriceSearch[] = []

  for (const product of products) {
    const priceResults = await searchProductPrices(
      product.productName,
      product.suppliers
    )
    results.push({
      productId: product.productId,
      productName: product.productName,
      results: priceResults,
      searchedAt: new Date().toISOString(),
    })

    // Delay de 500ms entre productos para evitar rate limiting de Gemini
    if (products.indexOf(product) < products.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500))
    }
  }

  return results
}
