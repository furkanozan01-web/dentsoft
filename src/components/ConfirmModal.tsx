'use client'

import { createContext, useContext, useState, useCallback, useRef } from 'react'

export interface ConfirmOptions {
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
  danger?: boolean // varsayılan true → kırmızı onay butonu
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn | null>(null)

// Onay diyaloğunu çağırmak için: const confirm = useConfirm();
// if (!(await confirm({ message: '...' }))) return
export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm, ConfirmProvider içinde kullanılmalı')
  return ctx
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null)
  const resolver = useRef<((v: boolean) => void) | null>(null)

  const confirm = useCallback<ConfirmFn>((options) => {
    setOpts(options)
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve
    })
  }, [])

  const close = (value: boolean) => {
    resolver.current?.(value)
    resolver.current = null
    setOpts(null)
  }

  const danger = opts?.danger !== false

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {opts && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => close(false)}
            aria-hidden="true"
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
            <div className="flex items-start gap-3 mb-4">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                  danger ? 'bg-red-50 text-red-500' : 'bg-[#2DD4BF]/15 text-[#0F2B3D]'
                }`}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <div className="flex-1 pt-0.5">
                <h2 className="text-base font-semibold text-[#0F2B3D]">{opts.title ?? 'Onay'}</h2>
                <p className="text-sm text-gray-500 mt-1">{opts.message}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => close(false)}
                className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors"
              >
                {opts.cancelText ?? 'İptal'}
              </button>
              <button
                type="button"
                onClick={() => close(true)}
                className={`flex-1 px-4 py-2.5 text-sm font-semibold rounded-xl transition-colors ${
                  danger
                    ? 'bg-red-500 text-white hover:bg-red-600'
                    : 'bg-[#2DD4BF] text-[#0F2B3D] hover:bg-[#26b8a5]'
                }`}
              >
                {opts.confirmText ?? (danger ? 'Evet, Sil' : 'Onayla')}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}
