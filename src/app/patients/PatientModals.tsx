'use client'

import { useActionState, useEffect, useState, useTransition } from 'react'
import { addPaymentWithCurrency, createPatient, updatePatient } from './actions'
import { getBusinessPartners } from '@/app/finance/actions'
import { localDateValue, toTitleCase } from '@/lib/format'
import { toast } from 'sonner'
import type { ActionResult, BusinessPartner, Patient } from './types'
// ---- New Patient Modal ----
export function NewPatientModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void
  onSuccess: () => void
}) {
  const [state, action, pending] = useActionState(createPatient, null as ActionResult)

  useEffect(() => {
    if ((state as ActionResult)?.success) onSuccess()
  }, [state, onSuccess])

  return (
    <Modal title="Yeni Hasta Ekle" onClose={onClose}>
      <form action={action} className="p-6 space-y-4">
        {(state as ActionResult)?.error && (
          <div className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">
            {(state as ActionResult)!.error}
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Ad *" name="name" required placeholder="Furkan" />
          <Field label="Soyad *" name="surname" required placeholder="OZANCI" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Cinsiyet</label>
            <select
              name="gender"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/30"
            >
              <option value="">Seçiniz</option>
              <option value="male">Erkek</option>
              <option value="female">Kadın</option>
              <option value="other">Diğer</option>
            </select>
          </div>
          <Field label="Doğum Tarihi" name="birth_date" type="date" />
        </div>
        <Field label="T.C. Kimlik No" name="tc" placeholder="12345678901" maxLength={11} />
        <div className="grid grid-cols-2 gap-4">
          <Field label="Telefon 1" name="phone1" type="tel" placeholder="0532 123 45 67" />
          <Field label="Telefon 2" name="phone2" type="tel" placeholder="0212 123 45 67" />
        </div>
        <Field label="E-posta" name="email" type="email" placeholder="ornek@email.com" />
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Adres</label>
          <textarea
            name="address"
            rows={2}
            placeholder="Adres..."
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/30 resize-none"
          />
        </div>
        <ModalActions onCancel={onClose} pending={pending} submitLabel="Hasta Ekle" />
      </form>
    </Modal>
  )
}

// ---- Edit Patient Modal ----
export function EditPatientModal({
  patient,
  onClose,
  onSuccess,
}: {
  patient: Patient
  onClose: () => void
  onSuccess: (updated: Patient) => void
}) {
  const [name, setName] = useState(patient.name)
  const [surname, setSurname] = useState(patient.surname)
  const [gender, setGender] = useState(patient.gender ?? '')
  const [birthDate, setBirthDate] = useState(patient.birth_date ?? '')
  const [phone1, setPhone1] = useState(patient.phone1 ?? '')
  const [phone2, setPhone2] = useState(patient.phone2 ?? '')
  const [email, setEmail] = useState(patient.email ?? '')
  const [address, setAddress] = useState(patient.address ?? '')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !surname.trim()) {
      setError('Ad ve soyad zorunludur')
      return
    }
    const fd = new FormData()
    fd.set('id', String(patient.id))
    fd.set('name', name.trim())
    fd.set('surname', surname.trim())
    fd.set('gender', gender)
    fd.set('birth_date', birthDate)
    fd.set('phone1', phone1)
    fd.set('phone2', phone2)
    fd.set('email', email)
    fd.set('address', address)
    startTransition(async () => {
      const res = await updatePatient(null, fd)
      if (res?.error) {
        setError(res.error)
        return
      }
      onSuccess({
        ...patient,
        name: name.trim(),
        surname: surname.trim().toUpperCase(),
        gender: gender || null,
        birth_date: birthDate || null,
        phone1: phone1 || null,
        phone2: phone2 || null,
        email: email || null,
        address: address || null,
      })
    })
  }

  const inputCls =
    'w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/30'

  return (
    <Modal
      title="Hasta Bilgilerini Düzenle"
      subtitle={`${toTitleCase(patient.name)} ${toTitleCase(patient.surname)}`}
      onClose={onClose}
    >
      <form onSubmit={submit} className="p-6 space-y-4">
        {error && (
          <div className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Ad *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Soyad *</label>
            <input value={surname} onChange={(e) => setSurname(e.target.value)} required className={inputCls} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Cinsiyet</label>
            <select value={gender} onChange={(e) => setGender(e.target.value)} className={inputCls}>
              <option value="">Seçiniz</option>
              <option value="male">Erkek</option>
              <option value="female">Kadın</option>
              <option value="other">Diğer</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Doğum Tarihi</label>
            <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className={inputCls} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Telefon 1</label>
            <input type="tel" value={phone1} onChange={(e) => setPhone1(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Telefon 2</label>
            <input type="tel" value={phone2} onChange={(e) => setPhone2(e.target.value)} className={inputCls} />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">E-posta</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Adres</label>
          <textarea
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            rows={2}
            className={`${inputCls} resize-none`}
          />
        </div>
        <p className="text-[11px] text-gray-400">
          🔒 T.C. Kimlik No şifreli saklandığı için bu ekrandan değiştirilemez.
        </p>
        <ModalActions onCancel={onClose} pending={pending} submitLabel="Değişiklikleri Kaydet" />
      </form>
    </Modal>
  )
}

// ---- Add Payment Modal ----
const CURRENCIES = [
  { value: 'TRY', label: '₺ TL' },
  { value: 'USD', label: '$ USD' },
  { value: 'EUR', label: '€ EUR' },
  { value: 'GBP', label: '£ GBP' },
]

export function AddPaymentModal({
  patientId,
  patientName,
  onClose,
  onSuccess,
}: {
  patientId: number
  patientName: string
  onClose: () => void
  onSuccess: () => void
}) {
  const today = localDateValue()
  const [currency, setCurrency] = useState('TRY')
  const [forexAmount, setForexAmount] = useState('')
  const [exchangeRate, setExchangeRate] = useState('')
  const [tryAmount, setTryAmount] = useState('')
  const [method, setMethod] = useState('cash')
  const [partnerId, setPartnerId] = useState<number | null>(null)
  const [partners, setPartners] = useState<BusinessPartner[]>([])
  const [date, setDate] = useState(today)
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  // Döviz seçilince ortakları zaten yüklüyoruz; firma_odemesi seçilince de lazım
  useEffect(() => {
    getBusinessPartners().then((res) => {
      if (res.data) setPartners(res.data)
    })
  }, [])

  // TL karşılığı canlı hesaplama
  const computedTry = (() => {
    if (currency === 'TRY') return null
    const amt = parseFloat(forexAmount.replace(',', '.'))
    const rate = parseFloat(exchangeRate.replace(',', '.'))
    if (!isNaN(amt) && !isNaN(rate) && amt > 0 && rate > 0)
      return Math.round(amt * rate * 100)
    return null
  })()

  const displayTry = computedTry !== null
    ? (computedTry / 100).toLocaleString('tr-TR', { minimumFractionDigits: 2 })
    : null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    let amountKurus: number
    if (currency === 'TRY') {
      const raw = tryAmount.replace(/\./g, '').replace(',', '.').replace(/[^0-9.]/g, '')
      amountKurus = Math.round(parseFloat(raw) * 100)
    } else {
      if (computedTry === null) {
        setError('Döviz tutarı ve kur bilgisini girin')
        return
      }
      amountKurus = computedTry
    }

    if (!Number.isFinite(amountKurus) || amountKurus <= 0) {
      setError('Geçerli bir tutar girin')
      return
    }
    if (method === 'firma_odemesi' && !partnerId) {
      setError('Firma ödemesi için iş ortağı seçin')
      return
    }

    startTransition(async () => {
      const res = await addPaymentWithCurrency(patientId, {
        amountKurus,
        originalCurrency: currency,
        originalAmount: currency !== 'TRY' ? Math.round(parseFloat(forexAmount.replace(',', '.')) * 100) : null,
        exchangeRate: currency !== 'TRY' ? parseFloat(exchangeRate.replace(',', '.')) : null,
        paymentMethod: method,
        partnerId: method === 'firma_odemesi' ? partnerId : null,
        note: note.trim() || null,
        date,
      })
      if (res.error) {
        setError(res.error)
      } else {
        toast.success('Ödeme kaydedildi')
        onSuccess()
      }
    })
  }

  const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/30'
  const firmaPartners = partners.filter((p) => p.partner_type === 'firma_odeme' || p.partner_type === 'diger')

  return (
    <Modal title="Ödeme Ekle" subtitle={patientName} onClose={onClose}>
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        {error && (
          <div className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</div>
        )}

        {/* Para birimi + Tarih */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Para Birimi</label>
            <select
              value={currency}
              onChange={(e) => { setCurrency(e.target.value); setForexAmount(''); setExchangeRate('') }}
              className={inputCls}
            >
              {CURRENCIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Tarih</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
          </div>
        </div>

        {/* TL tutarı (TRY seçiliyse) */}
        {currency === 'TRY' && (
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Tutar (₺) *</label>
            <input
              type="text"
              inputMode="decimal"
              value={tryAmount}
              onChange={(e) => setTryAmount(e.target.value)}
              required
              placeholder="1500"
              className={inputCls}
            />
          </div>
        )}

        {/* Döviz alanları */}
        {currency !== 'TRY' && (
          <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4 space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">
                  Döviz Tutarı ({currency}) *
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={forexAmount}
                  onChange={(e) => setForexAmount(e.target.value)}
                  required
                  placeholder="100"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">
                  Kur (1 {currency} = ? ₺) *
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={exchangeRate}
                  onChange={(e) => setExchangeRate(e.target.value)}
                  required
                  placeholder="34.50"
                  className={inputCls}
                />
              </div>
            </div>
            <div className="rounded-lg bg-white border border-blue-200 px-3 py-2 text-sm font-semibold text-[#0F2B3D]">
              {displayTry
                ? <>TL Karşılığı: <span className="font-black text-[#0F766E]">₺{displayTry}</span></>
                : <span className="text-slate-400 font-medium">Tutar ve kur girilince TL karşılığı hesaplanır</span>
              }
            </div>
          </div>
        )}

        {/* Ödeme yöntemi */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Ödeme Yöntemi</label>
          <select value={method} onChange={(e) => { setMethod(e.target.value); setPartnerId(null) }} className={inputCls}>
            <option value="cash">Nakit</option>
            <option value="card">Kredi Kartı</option>
            <option value="transfer">Havale / EFT</option>
            <option value="firma_odemesi">Firma Ödemesi</option>
          </select>
        </div>

        {/* Firma seçimi */}
        {method === 'firma_odemesi' && (
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">İş Ortağı *</label>
            {firmaPartners.length === 0 ? (
              <div className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                Henüz iş ortağı eklenmedi.{' '}
                <a href="/finance?tab=ortaklar" className="font-black underline" target="_blank" rel="noopener noreferrer">
                  Finans → İş Ortaklarımız
                </a>{' '}
                sayfasından ekleyin.
              </div>
            ) : (
              <select
                value={partnerId ?? ''}
                onChange={(e) => setPartnerId(e.target.value ? Number(e.target.value) : null)}
                required
                className={inputCls}
              >
                <option value="">İş ortağı seçin…</option>
                {firmaPartners.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* Açıklama */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Açıklama</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="İsteğe bağlı not..."
            className={inputCls}
          />
        </div>

        <ModalActions onCancel={onClose} pending={pending} submitLabel="Ödeme Kaydet" />
      </form>
    </Modal>
  )
}

// ---- Shared UI ----
function Modal({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string
  subtitle?: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-y-auto max-h-[90vh]">
        <div className="flex items-center justify-between px-6 pt-6 pb-5 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-[#0F2B3D]">{title}</h2>
            {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Field({
  label,
  name,
  type = 'text',
  required,
  placeholder,
  maxLength,
  defaultValue,
}: {
  label: string
  name: string
  type?: string
  required?: boolean
  placeholder?: string
  maxLength?: number
  defaultValue?: string
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1.5">{label}</label>
      <input
        type={type}
        name={name}
        required={required}
        placeholder={placeholder}
        maxLength={maxLength}
        defaultValue={defaultValue}
        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/30"
      />
    </div>
  )
}

function ModalActions({
  onCancel,
  pending,
  submitLabel,
}: {
  onCancel: () => void
  pending: boolean
  submitLabel: string
}) {
  return (
    <div className="flex gap-3 pt-2">
      <button
        type="button"
        onClick={onCancel}
        className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors"
      >
        İptal
      </button>
      <button
        type="submit"
        disabled={pending}
        className="flex-1 px-4 py-2.5 bg-[#2DD4BF] text-[#0F2B3D] text-sm font-semibold rounded-xl hover:bg-[#26b8a5] transition-colors disabled:opacity-60"
      >
        {pending ? 'Kaydediliyor…' : submitLabel}
      </button>
    </div>
  )
}
