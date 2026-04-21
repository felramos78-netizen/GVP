/**
 * app/(app)/aseo/page.tsx
 * Redirige a /actividades (URL canónica del módulo).
 */
import { redirect } from 'next/navigation'

export default function AseoPage() {
  redirect('/actividades')
}
