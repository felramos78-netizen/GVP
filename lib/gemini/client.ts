/**
 * lib/gemini/client.ts
 * Instancia singleton del cliente Gemini.
 * Solo se usa en server-side (API Routes).
 * La API key nunca llega al cliente.
 */
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai'

function getGenAI() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY no está definida en las variables de entorno.')
  }
  return new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
}

export const genAI = { getGenerativeModel: (...args: Parameters<GoogleGenerativeAI['getGenerativeModel']>) => getGenAI().getGenerativeModel(...args) }

/**
 * Modelo de búsqueda de precios con Google Search integrado.
 * Gemini 2.0 Flash — gratuito hasta 1.500 req/día.
 */
export function getPriceSearchModel() {
  return genAI.getGenerativeModel({
    model: 'gemini-2.5-flash-lite',
    tools: [{ googleSearch: {} }],
    safetySettings: [
      {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
    ],
    generationConfig: {
      temperature: 0.1,     // baja temperatura para respuestas factuales
      maxOutputTokens: 2048,
    },
  })
}

/**
 * Modelo de sugerencias y asistente general.
 * Sin Google Search — más rápido y económico en tokens.
 */
export function getSuggestModel() {
  return genAI.getGenerativeModel({
    model: 'gemini-2.5-flash-lite',
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 1024,
    },
  })
}
