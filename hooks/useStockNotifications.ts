'use client'
import { useEffect, useRef } from 'react'

type StockAlert = {
  id: string
  current_qty: number
  min_qty: number
  products?: { name: string } | null
}

export function useStockNotifications(alerts: StockAlert[]) {
  const notifiedRef = useRef(false)

  useEffect(() => {
    if (!alerts.length || notifiedRef.current) return
    if (!('Notification' in window)) return

    const notify = () => {
      notifiedRef.current = true
      const critical = alerts.filter(a => a.current_qty === 0)
      const low = alerts.filter(a => a.current_qty > 0)

      if (critical.length > 0) {
        new Notification('Sistema Vida — Stock agotado', {
          body: critical.map(a => a.products?.name ?? '').filter(Boolean).join(', '),
          icon: '/icons/icon-192x192.png',
          tag: 'stock-critical',
        })
      }
      if (low.length > 0) {
        new Notification('Sistema Vida — Stock bajo', {
          body: `${low.length} producto${low.length > 1 ? 's' : ''} por debajo del mínimo`,
          icon: '/icons/icon-192x192.png',
          tag: 'stock-low',
        })
      }
    }

    if (Notification.permission === 'granted') {
      notify()
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then(perm => {
        if (perm === 'granted') notify()
      })
    }
  }, [alerts.length])
}
