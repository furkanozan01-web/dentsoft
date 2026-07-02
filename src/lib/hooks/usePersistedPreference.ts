'use client'

import { startTransition, useCallback, useEffect, useState } from 'react'

// Tarayıcıda (localStorage) hatırlanan basit bir tercih değeri.
// SSR ile uyumlu olması için ilk render'da her zaman defaultValue döner;
// mount sonrası localStorage'daki değer varsa ona geçer.
export function usePersistedPreference<T>(key: string, defaultValue: T) {
  const [value, setValue] = useState<T>(defaultValue)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key)
      if (raw !== null) {
        const parsed = JSON.parse(raw) as T
        startTransition(() => {
          setValue(parsed)
        })
      }
    } catch {
      // localStorage kullanılamıyorsa (gizli sekme vb.) sessizce varsayılanda kal.
    }
  }, [key])

  const update = useCallback(
    (next: T) => {
      setValue(next)
      try {
        window.localStorage.setItem(key, JSON.stringify(next))
      } catch {
        // yazılamazsa sorun değil, state yine de güncellendi.
      }
    },
    [key]
  )

  return [value, update] as const
}
