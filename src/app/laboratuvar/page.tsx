import { redirect } from 'next/navigation'
import { getLabCtx } from './labCtx'
import LabPortal, { type LabEntry, type LabQuickItem, LabSignOut } from './LabPortal'

export const metadata = { title: 'Laboratuvar — DentSoft' }

export default async function LaboratuvarPage() {
  const ctx = await getLabCtx()
  if (ctx.status === 'anonymous') redirect('/login')
  if (ctx.status === 'not-lab') redirect('/')
  if (ctx.status === 'invalid') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F0F4F9] p-6">
        <div className="max-w-md rounded-[24px] border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="font-black text-[#142536]">Laboratuvar portalı kullanılamıyor</p>
          <p className="mt-2 text-sm font-semibold text-slate-500">{ctx.reason}</p>
          <div className="mt-5"><LabSignOut /></div>
        </div>
      </div>
    )
  }

  const { admin, partner } = ctx
  const [{ data: services }, { data: debts }, { data: quick }] = await Promise.all([
    admin
      .from('partner_services')
      .select('id, service_name, service_date, amount, quantity, unit_price, payment_status, description, reported_by_partner')
      .eq('partner_id', partner.id)
      .eq('clinic_id', ctx.clinicId)
      .order('service_date', { ascending: false })
      .order('id', { ascending: false })
      .limit(300),
    admin
      .from('clinic_debts')
      .select('id, partner_service_id, total_amount, paid_amount, status')
      .eq('partner_id', partner.id)
      .eq('clinic_id', ctx.clinicId)
      .neq('status', 'cancelled'),
    admin
      .from('partner_quick_items')
      .select('id, name, unit_price')
      .eq('partner_id', partner.id)
      .eq('clinic_id', ctx.clinicId)
      .eq('is_active', true)
      .order('name'),
  ])

  const paidByService = new Map<number, { total: number; paid: number }>()
  let totalDebt = 0
  let totalPaid = 0
  for (const d of debts ?? []) {
    totalDebt += d.total_amount
    totalPaid += d.paid_amount
    if (d.partner_service_id != null) {
      const cur = paidByService.get(d.partner_service_id) ?? { total: 0, paid: 0 }
      cur.total += d.total_amount
      cur.paid += d.paid_amount
      paidByService.set(d.partner_service_id, cur)
    }
  }

  const entries: LabEntry[] = (services ?? []).map((s) => {
    const p = paidByService.get(s.id)
    const paid = p?.paid ?? (s.payment_status === 'odendi' ? s.amount : 0)
    return {
      id: s.id,
      name: s.service_name,
      date: s.service_date,
      amount: s.amount,
      quantity: s.quantity ?? 1,
      unitPrice: s.unit_price ?? null,
      paid,
      note: s.description,
      mine: s.reported_by_partner === true,
    }
  })

  return (
    <LabPortal
      labName={partner.name}
      userName={ctx.userName}
      entries={entries}
      quickItems={(quick ?? []) as LabQuickItem[]}
      totalDebt={totalDebt}
      totalPaid={totalPaid}
    />
  )
}
