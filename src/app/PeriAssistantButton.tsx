'use client'

import { useState, useRef, useEffect, useTransition, Fragment } from 'react'
import type { PeriMessage, PeriResponse, PendingWrite } from '@/lib/peri/types'

interface ChatMessage {
  role: 'user' | 'assistant'
  text: string
  type?: 'text' | 'preview' | 'error' | 'success'
  pendingWrite?: PendingWrite
  agent?: { id: string; displayName: string }
}

export default function PeriAssistantButton() {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [history, setHistory] = useState<PeriMessage[]>([])
  const [pending, startTransition] = useTransition()
  const [committing, startCommit] = useTransition()
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      inputRef.current?.focus()
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [open, messages])

  const send = (text?: string) => {
    const userText = (text ?? input).trim()
    if (!userText || pending) return

    const userMsg: ChatMessage = { role: 'user', text: userText }
    const newHistory: PeriMessage[] = [...history, { role: 'user', content: userText }]

    setMessages((prev) => [...prev, userMsg])
    setHistory(newHistory)
    setInput('')

    startTransition(async () => {
      try {
        const res = await fetch('/api/peri', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: newHistory }),
        })
        const data: PeriResponse = await res.json()

        if (data.type === 'preview') {
          setMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              text: data.text,
              type: 'preview',
              pendingWrite: data.pendingWrite,
              agent: data.agent,
            },
          ])
          // Onay beklediği için history'e eklemiyoruz; kullanıcı onaylarsa devam eder
        } else {
          setMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              text: data.text,
              type: data.type,
              agent: data.agent,
            },
          ])
          if (data.type === 'text') {
            setHistory((prev) => [...prev, { role: 'assistant', content: data.text }])
          }
        }
      } catch {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', text: 'Bağlantı hatası oluştu. Tekrar deneyin.', type: 'error' },
        ])
      }
    })
  }

  const confirm = (pendingWrite: PendingWrite) => {
    startCommit(async () => {
      try {
        const res = await fetch('/api/peri/commit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pendingWrite }),
        })
        const data: { success: boolean; error?: string } = await res.json()
        if (data.success) {
          setMessages((prev) =>
            prev.map((m) =>
              m.pendingWrite === pendingWrite
                ? { ...m, type: 'success', text: '✓ ' + m.text.replace('Onaylıyor musunuz?', '').trim() + ' — Kaydedildi.' }
                : m
            )
          )
          setHistory((prev) => [
            ...prev,
            { role: 'assistant', content: '✓ İşlem başarıyla tamamlandı.' },
          ])
        } else {
          setMessages((prev) =>
            prev.map((m) =>
              m.pendingWrite === pendingWrite
                ? { ...m, type: 'error', text: `Hata: ${data.error ?? 'İşlem gerçekleştirilemedi.'}` }
                : m
            )
          )
        }
      } catch {
        setMessages((prev) =>
          prev.map((m) =>
            m.pendingWrite === pendingWrite
              ? { ...m, type: 'error', text: 'Commit sırasında bağlantı hatası oluştu.' }
              : m
          )
        )
      }
    })
  }

  const dismiss = (pendingWrite: PendingWrite) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.pendingWrite === pendingWrite
          ? { ...m, type: 'text', text: m.text + '\n\n— İptal edildi.' }
          : m
      )
    )
    setHistory((prev) => [...prev, { role: 'assistant', content: 'İşlem iptal edildi.' }])
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
      {open && (
        <div className="flex w-[340px] flex-col rounded-2xl border border-[#2DD4BF]/30 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.18)] sm:w-[380px]">
          {/* Header */}
          <div className="flex items-center gap-3 rounded-t-2xl border-b border-[#E7ECF2] bg-[#0F2B3D] px-4 py-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#2DD4BF] text-sm font-black text-[#0F2B3D]">P</span>
            <div className="flex-1">
              <p className="text-sm font-bold text-white">PERİ</p>
              <p className="text-[10px] text-[#2DD4BF]">Klinik Asistanı</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white"
              aria-label="Kapat"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Mesaj listesi */}
          <div className="flex max-h-[420px] min-h-[180px] flex-col gap-3 overflow-y-auto p-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#E6FFFA] text-[#0F766E] text-xl">🦷</span>
                <p className="text-sm font-semibold text-[#0F2B3D]">PERİ&apos;ye hoş geldiniz!</p>
                <p className="mt-1 text-xs text-slate-400">Randevu, hasta ve program sorularınızı yazın.</p>
                <div className="mt-4 flex flex-wrap justify-center gap-1.5">
                  {['Bugünkü programım', 'Yarın boş slot var mı?', 'Açık bakiyeler'].map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => send(q)}
                      className="rounded-full border border-[#E7ECF2] bg-[#F8FAFC] px-3 py-1.5 text-[11px] font-semibold text-slate-600 hover:border-[#2DD4BF]/50 hover:bg-[#E6FFFA] transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => {
              const prev = i > 0 ? messages[i - 1] : null
              const agentChanged =
                msg.role === 'assistant' &&
                msg.agent != null &&
                prev?.role === 'assistant' &&
                prev.agent != null &&
                prev.agent.id !== msg.agent.id
              return (
              <Fragment key={i}>
                {agentChanged && (
                  <div className="flex items-center gap-2 px-1 py-0.5">
                    <div className="h-px flex-1 bg-[#E7ECF2]" />
                    <span className="text-[10px] text-slate-400">→ {msg.agent!.displayName}</span>
                    <div className="h-px flex-1 bg-[#E7ECF2]" />
                  </div>
                )}
              <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="mr-2 mt-0.5 flex shrink-0 flex-col items-center gap-0.5">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0F2B3D] text-[10px] font-black text-[#2DD4BF]">P</span>
                    {msg.agent && (
                      <span className="text-[9px] font-medium leading-none text-slate-400">{msg.agent.displayName}</span>
                    )}
                  </div>
                )}
                <div
                  className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'rounded-tr-sm bg-[#0F2B3D] text-white'
                      : msg.type === 'error'
                      ? 'rounded-tl-sm border border-red-200 bg-red-50 text-red-700'
                      : msg.type === 'success'
                      ? 'rounded-tl-sm border border-green-200 bg-green-50 text-green-700'
                      : msg.type === 'preview'
                      ? 'rounded-tl-sm border border-amber-200 bg-amber-50 text-amber-800'
                      : 'rounded-tl-sm border border-[#E7ECF2] bg-[#F8FAFC] text-[#0F2B3D]'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.text}</p>

                  {msg.type === 'preview' && msg.pendingWrite && (
                    <div className="mt-2.5 flex gap-2">
                      <button
                        type="button"
                        onClick={() => confirm(msg.pendingWrite!)}
                        disabled={committing}
                        className="flex-1 rounded-lg bg-[#0F2B3D] px-3 py-1.5 text-xs font-black text-white hover:bg-[#14384f] disabled:opacity-60 transition-colors"
                      >
                        {committing ? 'Kaydediliyor…' : 'Onayla'}
                      </button>
                      <button
                        type="button"
                        onClick={() => dismiss(msg.pendingWrite!)}
                        disabled={committing}
                        className="flex-1 rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-100 disabled:opacity-60 transition-colors"
                      >
                        Vazgeç
                      </button>
                    </div>
                  )}
                </div>
              </div>
              </Fragment>
              )
            })}

            {pending && (
              <div className="flex justify-start">
                <span className="mr-2 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0F2B3D] text-[10px] font-black text-[#2DD4BF]">P</span>
                <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm border border-[#E7ECF2] bg-[#F8FAFC] px-4 py-3">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#2DD4BF]" style={{ animationDelay: '0ms' }} />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#2DD4BF]" style={{ animationDelay: '150ms' }} />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#2DD4BF]" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="flex items-center gap-2 border-t border-[#E7ECF2] p-3">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
              placeholder="Randevu, hasta, program…"
              disabled={pending}
              className="flex-1 rounded-xl border border-[#E7ECF2] bg-[#F8FAFC] px-3 py-2 text-sm text-[#0F2B3D] placeholder-slate-400 outline-none transition focus:border-[#2DD4BF] focus:ring-2 focus:ring-[#2DD4BF]/20 disabled:opacity-60"
            />
            <button
              type="button"
              onClick={() => send()}
              disabled={pending || !input.trim()}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#2DD4BF] text-[#0F2B3D] hover:bg-[#26b8a5] disabled:opacity-40 transition-colors"
              aria-label="Gönder"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M22 2L11 13" />
                <path d="M22 2L15 22l-4-9-9-4 20-7z" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Floating button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="group flex h-14 items-center gap-3 rounded-2xl bg-[#0F2B3D] px-4 text-white shadow-lg shadow-[#0F2B3D]/25 transition-colors hover:bg-[#14384f]"
        aria-expanded={open}
        aria-label="PERİ asistanını aç"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#2DD4BF] text-sm font-black text-[#0F2B3D]">
          P
        </span>
        <span className="hidden pr-1 text-sm font-semibold sm:inline">PERİ</span>
      </button>
    </div>
  )
}
