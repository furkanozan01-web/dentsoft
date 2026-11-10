'use client'


export function SectionHeader({
  icon,
  title,
  description,
  iconClassName,
}: {
  icon: React.ReactNode
  title: string
  description: string
  iconClassName: string
}) {
  return (
    <div className="flex items-start gap-3">
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${iconClassName}`}>
        {icon}
      </span>
      <div>
        <h2 className="text-base font-black text-[#0F2B3D]">{title}</h2>
        <p className="mt-0.5 text-xs font-medium text-slate-400">{description}</p>
      </div>
    </div>
  )
}
export function FinanceLine({
  label,
  value,
  valueClassName = 'text-[#0F2B3D]',
  strong = false,
}: {
  label: string
  value: string
  valueClassName?: string
  strong?: boolean
}) {
  return (
    <div className={`flex items-center justify-between gap-4 border-b border-[#EEF2F6] px-4 py-3 last:border-0 ${strong ? 'bg-[#FAFBFC]' : 'bg-white'}`}>
      <span className={`text-sm ${strong ? 'font-black text-[#142536]' : 'font-semibold text-slate-500'}`}>{label}</span>
      <span className={`text-sm font-black ${valueClassName}`}>{value}</span>
    </div>
  )
}
export function EmptyState({
  icon,
  title,
  description,
  action,
  compact = false,
}: {
  icon: React.ReactNode
  title: string
  description: string
  action?: React.ReactNode
  compact?: boolean
}) {
  return (
    <div className={`flex flex-col items-center justify-center rounded-[20px] border border-dashed border-slate-300 bg-[#FAFBFC] px-6 text-center ${compact ? 'min-h-[160px] py-6' : 'min-h-[210px] py-8'}`}>
      <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-[22px] bg-white text-[#0F766E] shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
        {icon}
      </span>
      <h3 className="text-sm font-black text-[#142536]">{title}</h3>
      <p className="mt-2 max-w-md text-xs font-medium leading-5 text-slate-400">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
export function IconPlus() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14" /><path d="M5 12h14" /></svg>
}
export function IconTrash() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v5" /><path d="M14 11v5" /></svg>
}
export function IconPrint() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9V2h12v7" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></svg>
}
