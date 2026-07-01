'use client'

import type { ReactNode } from 'react'
import { toast } from 'sonner'
import { EXTERNAL_HEALTH_SYSTEMS } from '@/lib/external-health-systems'
import { buildSmsLink, buildWhatsAppLink } from '@/lib/patient-contact-links'

export default function PatientQuickActions({ phone, onPay, onAppointment, onPrescription, onKvkk, onDigitalConsent }: {
  phone: string | null
  onPay: () => void
  onAppointment: () => void
  onPrescription: () => void
  onKvkk: () => void
  onDigitalConsent: () => void
}) {
  const smsLink = buildSmsLink(phone)
  const whatsappLink = buildWhatsAppLink(phone)
  const requirePhone = (action: () => void) => () => {
    if (!smsLink) { toast.error('Bu işlem için hastanın geçerli bir cep telefonu bulunmalıdır.'); return }
    action()
  }

  return <section className="rounded-[24px] border border-slate-200/90 bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
    <div className="mb-4"><h3 className="text-sm font-black text-[#0F2B3D]">Hızlı İşlemler</h3><p className="mt-1 text-xs font-semibold text-slate-400">Hasta işlemlerine güvenli ve hızlı erişim</p></div>
    <ActionGroup title="Hasta İşlemleri">
      <Action label="Ödeme Al" onClick={onPay} icon={<IconCard/>}/>
      <Action label="Randevu Ekle" onClick={onAppointment} icon={<IconCalendar/>}/>
      <Action label="Reçete Yaz" onClick={onPrescription} icon={<IconFile/>}/>
    </ActionGroup>
    <ActionGroup title="Sistem">
      {EXTERNAL_HEALTH_SYSTEMS.map((system) => <Action key={system.id} label={system.label} href={system.url} icon={<IconExternal/>}/>) }
    </ActionGroup>
    <ActionGroup title="İletişim">
      <Action label="SMS Gönder" href={smsLink ?? undefined} disabled={!smsLink} disabledHint="Geçerli cep telefonu yok" icon={<IconSms/>}/>
      <Action label="WhatsApp Mesajı Gönder" href={whatsappLink ?? undefined} disabled={!whatsappLink} disabledHint="Geçerli cep telefonu yok" icon={<IconWhatsapp/>}/>
    </ActionGroup>
    <ActionGroup title="Onam" last>
      <Action label="KVKK Onayı" onClick={requirePhone(onKvkk)} disabled={!smsLink} disabledHint="Geçerli cep telefonu yok" icon={<IconShield/>}/>
      <Action label="Dijital Onam" onClick={requirePhone(onDigitalConsent)} disabled={!smsLink} disabledHint="Geçerli cep telefonu yok" icon={<IconCheck/>}/>
    </ActionGroup>
  </section>
}

function ActionGroup({ title, children, last = false }: { title: string; children: ReactNode; last?: boolean }) {
  return <div className={last ? 'pt-3' : 'border-b border-slate-100 py-3 first:pt-0'}><p className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-400">{title}</p><div className="grid gap-1 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">{children}</div></div>
}

function Action({ label, icon, onClick, href, disabled, disabledHint }: { label:string; icon:ReactNode; onClick?:()=>void; href?:string; disabled?:boolean; disabledHint?:string }) {
  const cls=`flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-xs font-bold transition ${disabled?'cursor-not-allowed text-slate-300 opacity-60':'text-slate-600 hover:bg-[#E9FBF8] hover:text-[#0F766E]'}`
  const content=<><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">{icon}</span><span className="min-w-0 flex-1"><span className="block">{label}</span>{disabled&&disabledHint&&<span className="block truncate text-[9px] font-semibold text-slate-300">{disabledHint}</span>}</span>{!disabled&&<span aria-hidden="true">{href?'↗':'›'}</span>}</>
  if(href&&!disabled)return <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>{content}</a>
  return <button type="button" onClick={onClick} disabled={disabled} className={cls}>{content}</button>
}

const Svg=({children}: {children:ReactNode})=><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
function IconCard(){return <Svg><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18"/></Svg>}
function IconCalendar(){return <Svg><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M8 2v4M16 2v4M3 10h18M12 14v4M10 16h4"/></Svg>}
function IconFile(){return <Svg><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h6"/></Svg>}
function IconExternal(){return <Svg><path d="M14 3h7v7M10 14 21 3M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/></Svg>}
function IconSms(){return <Svg><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/><path d="M8 10h.01M12 10h.01M16 10h.01"/></Svg>}
function IconWhatsapp(){return <Svg><path d="M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 21l2.1-5.2A8.5 8.5 0 1 1 21 11.5z"/><path d="M9 8c.5 3 2 4.5 5 5"/></Svg>}
function IconShield(){return <Svg><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></Svg>}
function IconCheck(){return <Svg><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></Svg>}
