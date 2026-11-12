import { useCallback, useRef } from 'react'

/**
 * React 19, `<form action>` sunucu işlemi bitince formu sıfırlar; hata dönse bile yazılanlar silinir.
 * Bu kanca gönderim anındaki değerleri saklar ve hata sonrası alanlara geri yazar.
 * Kullanım: `<form ref={formRef} onSubmit={onSubmit} action={...}>`; hata gelince `restore()` çağırın.
 */
export function useKeepFormValues() {
  const formRef = useRef<HTMLFormElement>(null)
  const saved = useRef<FormData | null>(null)

  const onSubmit = useCallback((event: React.FormEvent<HTMLFormElement>) => {
    saved.current = new FormData(event.currentTarget)
  }, [])

  const restore = useCallback(() => {
    const form = formRef.current
    const data = saved.current
    if (!form || !data) return
    // Sıfırlama bu render'dan sonra uygulanır; değerleri bir sonraki karede geri yaz
    requestAnimationFrame(() => {
      for (const [key, value] of data.entries()) {
        const el = form.elements.namedItem(key)
        if (el && typeof value === 'string' && 'value' in el) (el as unknown as HTMLInputElement).value = value
      }
    })
  }, [])

  return { formRef, onSubmit, restore }
}
