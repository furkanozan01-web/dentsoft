'use client'

import { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { formatAmount } from '@/lib/format'
import { getOffboardSummary, offboardDoctor, offboardUser, type OffboardSummary } from './actions'
import { ErrBox, SModal } from './SettingsSharedUI'

/**
 * Hekim veya kullanıcıyı pasife alma / silme penceresi.
 * Devam eden hastası varsa hangi hekime aktarılacağı sorulur; yalnızca ödenmemiş kısım yeni hekime geçer.
 */
export function OffboardModal({
  kind,
  name,
  doctorId,
  userId,
  action,
  onClose,
  onDone,
}: {
  kind: 'doctor' | 'user'
  name: string
  doctorId: number | null
  userId?: string
  action: 'passive' | 'delete'
  onClose: () => void
  onDone: () => void
}) {
  const [pending, startTransition] = useTransition()
  const [summary, setSummary] = useState<OffboardSummary | null>(null)
  const [loading, setLoading] = useState(doctorId !== null)
  const [error, setError] = useState<string | null>(null)
  const [target, setTarget] = useState('')
  const [moveAppts, setMoveAppts] = useState(true)

  useEffect(() => {
    if (doctorId === null) return
    let active = true
    getOffboardSummary(doctorId).then((res) => {
      if (!active) return
      if (res.error) setError(res.error)
      else if (res.data) setSummary(res.data)
      setLoading(false)
    })
    return () => { active = false }
  }, [doctorId])

  const needsTarget = !!summary && summary.treatments > 0
  const verb = action === 'delete' ? 'Sil' : 'Pasife Al'

  const submit = () => {
    if (needsTarget && !target) { setError('Devam eden hastaların aktarılacağı hekimi seçin'); return }
    setError(null)
    startTransition(async () => {
      const common = { action, transferToDoctorId: target ? Number(target) : null, moveAppointments: moveAppts }
      const res = kind === 'user' && userId
        ? await offboardUser({ userId, ...common })
        : await offboardDoctor({ doctorId: doctorId!, ...common })
      if (res.error) { setError(res.error); return }
      toast.success(action === 'delete' ? 'Silindi' : 'Pasife alındı')
      if (res.message) toast.message(res.message, { duration: 9000 })
      onDone()
    })
  }

  const targets = summary?.targets ?? []
  const selectCls = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/30'

  return (
    <SModal
      title={`${name} — ${verb}`}
      subtitle={action === 'delete'
        ? 'Silinen kişi listelerden kalkar ve girişi kapanır; geçmiş kayıtlar (hasta, ödeme, hakediş) korunur.'
        : 'Pasif kişi giriş yapamaz ve yeni işlem alamaz; geçmiş kayıtlar korunur.'}
      onClose={onClose}
    >
      <div className="p-6 space-y-4">
        {error && <ErrBox msg={error} />}
        {loading && <p className="text-sm text-gray-500">Devam eden hastalar kontrol ediliyor…</p>}

        {!loading && summary && summary.treatments === 0 && (
          <p className="text-sm text-gray-600">Devam eden hastası yok, aktarım gerekmiyor.</p>
        )}

        {!loading && needsTarget && summary && (
          <>
            <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <p className="font-bold">Devam eden: {summary.patients} hasta, {summary.treatments} açık tedavi</p>
              <p className="mt-1">Yeni hekime geçecek ödenmemiş tutar: <b>₺{formatAmount(summary.unpaidKurus)}</b></p>
              <p>Eski hekimde kalacak (ödenmiş) tutar: <b>₺{formatAmount(summary.paidKurus)}</b></p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Devam eden hastalar hangi hekime aktarılsın? *</label>
              <select value={target} onChange={(e) => setTarget(e.target.value)} className={selectCls}>
                <option value="">Hekim seçin…</option>
                {targets.map((d) => <option key={d.id} value={d.id}>Dt. {d.name}</option>)}
              </select>
              {targets.length === 0 && <p className="mt-1 text-xs text-red-600">Aktarılabilecek aktif başka hekim yok.</p>}
            </div>
            {summary.futureAppointments > 0 && (
              <label className="flex items-start gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={moveAppts} onChange={(e) => setMoveAppts(e.target.checked)} className="mt-0.5" />
                <span>Gelecekteki {summary.futureAppointments} randevuyu da aktar (yeni hekimde çakışanlar eski hekimde kalır)</span>
              </label>
            )}
            <p className="text-xs text-gray-400">
              Kısmen ödenmiş tedavide ödenen kısım eski hekimde kalır, kalan bedel yeni hekime ayrı bir kayıt olarak geçer. Hastanın toplam borcu değişmez.
            </p>
          </>
        )}

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50">İptal</button>
          <button
            type="button"
            onClick={submit}
            disabled={pending || loading || (needsTarget && targets.length === 0)}
            className={`flex-1 px-4 py-2.5 text-white text-sm font-bold rounded-xl disabled:opacity-50 ${action === 'delete' ? 'bg-red-600 hover:bg-red-700' : 'bg-[#0F2B3D] hover:bg-[#14364A]'}`}
          >
            {pending ? 'İşleniyor…' : needsTarget ? `Aktar ve ${verb}` : verb}
          </button>
        </div>
      </div>
    </SModal>
  )
}
