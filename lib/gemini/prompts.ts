/**
 * lib/gemini/prompts.ts
 * Prompts centralizados para todas las interacciones con Gemini.
 * Mantener aquí facilita ajustar instrucciones sin tocar la lógica.
 */

/**
 * Prompt para buscar el precio actual de un producto en un supermercado chileno.
 * Usa Google Search para obtener datos reales y actuales.
 */
export function buildPriceSearchPrompt(
  productName: string,
  supplierName: string,
  supplierSearchUrl: string | null
): string {
  return `Busca el precio actual de "${productName}" en ${supplierName} Chile.

${supplierSearchUrl ? `URL de búsqueda de referencia: ${supplierSearchUrl.replace('{query}', encodeURIComponent(productName))}` : ''}

Instrucciones:
- Busca el precio de venta al público en pesos chilenos (CLP).
- Prioriza el precio regular, no el de oferta (a menos que sea el único disponible).
- Si encuentras múltiples presentaciones, reporta la más similar a: "${productName}".
- Si el producto no está disponible en ${supplierName}, responde exactamente: NO_DISPONIBLE

Responde ÚNICAMENTE con el siguiente JSON (sin markdown, sin texto adicional):
{
  "available": true,
  "price_clp": 4990,
  "product_name_found": "Pechuga de Pollo sin hueso 1kg",
  "is_on_sale": false,
  "sale_price_clp": null,
  "source_url": "https://...",
  "confidence": "high"
}

O si no está disponible:
{
  "available": false,
  "price_clp": null,
  "product_name_found": null,
  "is_on_sale": false,
  "sale_price_clp": null,
  "source_url": null,
  "confidence": "high"
}

Valores válidos para confidence: "high" (precio encontrado directamente), "medium" (precio inferido de resultado similar), "low" (estimación).`
}

/**
 * Prompt para buscar precios en múltiples supermercados a la vez.
 * Más eficiente en tokens que hacer una búsqueda por proveedor.
 */
export function buildMultiSupplierPricePrompt(
  productName: string,
  suppliers: Array<{ name: string; searchUrl: string | null }>
): string {
  const supplierList = suppliers.map(s => s.name).join(', ')

  return `Busca el precio actual de "${productName}" en los siguientes supermercados de Chile: ${supplierList}.

Instrucciones:
- Busca el precio de venta al público en pesos chilenos (CLP) para cada supermercado.
- Si el producto tiene diferentes presentaciones, usa la más estándar.
- Si no encuentras precio en algún supermercado, marca como null.

Responde ÚNICAMENTE con este JSON (sin markdown):
{
  "product": "${productName}",
  "results": [
    {
      "supplier": "Líder",
      "available": true,
      "price_clp": 4990,
      "is_on_sale": false,
      "confidence": "high"
    },
    {
      "supplier": "Tottus",
      "available": true,
      "price_clp": 4790,
      "is_on_sale": false,
      "confidence": "high"
    },
    {
      "supplier": "Jumbo",
      "available": false,
      "price_clp": null,
      "is_on_sale": false,
      "confidence": "high"
    }
  ]
}`
}

/**
 * Prompt para el asistente de sugerencias de comidas basado en stock.
 */
export function buildMealSuggestionPrompt(
  stockItems: Array<{ name: string; qty: number; unit: string }>,
  mealType: 'desayuno' | 'almuerzo' | 'cena' | 'snack',
  userGoal: string
): string {
  const stockList = stockItems
    .map(item => `- ${item.name}: ${item.qty} ${item.unit}`)
    .join('\n')

  return `Eres un nutricionista que ayuda a planificar comidas saludables.

Stock disponible:
${stockList}

Objetivo del usuario: ${userGoal}
Comida a planificar: ${mealType}

Sugiere 3 opciones de ${mealType} usando los ingredientes disponibles.
Prioriza recetas que usen ingredientes próximos a vencer.

Responde ÚNICAMENTE con este JSON (sin markdown):
{
  "suggestions": [
    {
      "name": "Nombre del plato",
      "ingredients_used": ["ingrediente1", "ingrediente2"],
      "kcal_approx": 350,
      "protein_g_approx": 28,
      "prep_time_min": 15,
      "difficulty": "facil",
      "notes": "Nota breve opcional"
    }
  ]
}`
}
