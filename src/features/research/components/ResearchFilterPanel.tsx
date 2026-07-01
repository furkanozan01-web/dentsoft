'use client'

import type { ResearchDoctor, ResearchFilters } from '../types'
import { ANAMNESIS_FILTERS } from '../filters/defaults'

interface Props {
  filters: ResearchFilters
  doctors: ResearchDoctor[]
  loading: boolean
  onChange: (filters: ResearchFilters) => void
  onRun: () => void
  onReset: () => void
}

export default function ResearchFilterPanel({
  filters,
  doctors,
  loading,
  onChange,
  onRun,
  onReset,
}: Props) {
  const update = <K extends keyof ResearchFilters>(
    section: K,
    field: keyof ResearchFilters[K],
    value: string | string[]
  ) => {
    onChange({
      ...filters,
      [section]: { ...filters[section], [field]: value },
    })
  }

  const toggleCondition = (condition: string) => {
    const current = filters.anamnesis.conditions
    update(
      'anamnesis',
      'conditions',
      current.includes(condition)
        ? current.filter((item) => item !== condition)
        : [...current, condition]
    )
  }

  return (
    <aside className="w-full shrink-0 border-b border-slate-200 bg-white lg:w-[330px] lg:border-r lg:border-b-0">
      <div className="sticky top-0 max-h-none overflow-visible p-5 lg:max-h-screen lg:overflow-y-auto">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-black text-[#142536]">Filtreler</h2>
            <p className="mt-1 text-xs font-semibold text-slate-400">Klinik kayıtlarını daraltın</p>
          </div>
          <button
            type="button"
            onClick={onReset}
            className="text-xs font-black text-[#0F766E] transition hover:text-[#115E59]"
          >
            Temizle
          </button>
        </div>

        <div className="space-y-2">
          <FilterGroup title="Hasta Bilgileri" open>
            <Field label="Ad soyad">
              <Input value={filters.patient.search} onChange={(value) => update('patient', 'search', value)} placeholder="Hasta ara" />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="En az yaş"><Input type="number" value={filters.patient.minAge} onChange={(value) => update('patient', 'minAge', value)} /></Field>
              <Field label="En çok yaş"><Input type="number" value={filters.patient.maxAge} onChange={(value) => update('patient', 'maxAge', value)} /></Field>
            </div>
            <Field label="Cinsiyet">
              <Select value={filters.patient.gender} onChange={(value) => update('patient', 'gender', value)}>
                <option value="">Tümü</option><option value="female">Kadın</option><option value="male">Erkek</option><option value="other">Diğer</option>
              </Select>
            </Field>
            <Field label="Telefon">
              <PresenceSelect value={filters.patient.hasPhone} onChange={(value) => update('patient', 'hasPhone', value)} />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Kayıt başlangıç"><Input type="date" value={filters.patient.registeredFrom} onChange={(value) => update('patient', 'registeredFrom', value)} /></Field>
              <Field label="Kayıt bitiş"><Input type="date" value={filters.patient.registeredTo} onChange={(value) => update('patient', 'registeredTo', value)} /></Field>
            </div>
            <Field label="Hasta durumu">
              <Select value={filters.patient.status} onChange={(value) => update('patient', 'status', value)}>
                <option value="">Tümü</option><option value="active">Aktif</option><option value="passive">Pasif</option>
              </Select>
            </Field>
          </FilterGroup>

          <FilterGroup title="Anamnez">
            <div className="flex flex-wrap gap-1.5">
              {ANAMNESIS_FILTERS.map((condition) => (
                <label key={condition} className={`cursor-pointer rounded-md border px-2 py-1.5 text-[11px] font-bold transition ${filters.anamnesis.conditions.includes(condition) ? 'border-[#2DD4BF] bg-[#E9FBF8] text-[#0F766E]' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'}`}>
                  <input type="checkbox" className="sr-only" checked={filters.anamnesis.conditions.includes(condition)} onChange={() => toggleCondition(condition)} />
                  {condition}
                </label>
              ))}
            </div>
            <Field label="Kullanılan ilaç"><Input value={filters.anamnesis.medication} onChange={(value) => update('anamnesis', 'medication', value)} /></Field>
            <Field label="Sistemik hastalık notu"><Input value={filters.anamnesis.systemicNote} onChange={(value) => update('anamnesis', 'systemicNote', value)} /></Field>
          </FilterGroup>

          <FilterGroup title="Tedavi">
            <Field label="Tedavi tipi"><Input value={filters.treatment.name} onChange={(value) => update('treatment', 'name', value)} placeholder="İmplant, kanal..." /></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="FDI diş no"><Input type="number" value={filters.treatment.tooth} onChange={(value) => update('treatment', 'tooth', value)} /></Field>
              <Field label="Durum">
                <Select value={filters.treatment.status} onChange={(value) => update('treatment', 'status', value)}>
                  <option value="">Tümü</option><option value="planned">Planlandı</option><option value="in_progress">Devam ediyor</option><option value="completed">Tamamlandı</option><option value="cancelled">İptal</option>
                </Select>
              </Field>
            </div>
            <Field label="Hekim">
              <Select value={filters.treatment.doctorId} onChange={(value) => update('treatment', 'doctorId', value)}>
                <option value="">Tüm hekimler</option>
                {doctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.name}</option>)}
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="İşlem başlangıç"><Input type="date" value={filters.treatment.from} onChange={(value) => update('treatment', 'from', value)} /></Field>
              <Field label="İşlem bitiş"><Input type="date" value={filters.treatment.to} onChange={(value) => update('treatment', 'to', value)} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Min. ücret (TL)"><Input type="number" value={filters.treatment.minFee} onChange={(value) => update('treatment', 'minFee', value)} /></Field>
              <Field label="Maks. ücret (TL)"><Input type="number" value={filters.treatment.maxFee} onChange={(value) => update('treatment', 'maxFee', value)} /></Field>
            </div>
          </FilterGroup>

          <FilterGroup title="Randevu">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Başlangıç"><Input type="date" value={filters.appointment.from} onChange={(value) => update('appointment', 'from', value)} /></Field>
              <Field label="Bitiş"><Input type="date" value={filters.appointment.to} onChange={(value) => update('appointment', 'to', value)} /></Field>
            </div>
            <Field label="Randevu durumu">
              <Select value={filters.appointment.status} onChange={(value) => update('appointment', 'status', value)}>
                <option value="">Tümü</option><option value="completed">Geldi</option><option value="no_show">Gelmedi</option><option value="cancelled">İptal</option><option value="confirmed">Onaylandı</option>
              </Select>
            </Field>
            <Field label="Gelecek randevu"><PresenceSelect value={filters.appointment.hasFuture} onChange={(value) => update('appointment', 'hasFuture', value)} /></Field>
            <Field label="Kaç aydır gelmeyen"><Input type="number" value={filters.appointment.inactiveMonths} onChange={(value) => update('appointment', 'inactiveMonths', value)} placeholder="Örn. 6" /></Field>
          </FilterGroup>

          <FilterGroup title="Finans">
            <Field label="Ödeme durumu">
              <Select value={filters.finance.state} onChange={(value) => update('finance', 'state', value)}>
                <option value="">Tümü</option><option value="debt">Borcu var</option><option value="no_debt">Borcu yok</option><option value="partial">Kısmi ödeme</option>
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Taksit planı"><PresenceSelect value={filters.finance.hasPlan} onChange={(value) => update('finance', 'hasPlan', value)} /></Field>
              <Field label="Geciken taksit"><PresenceSelect value={filters.finance.overdueInstallment} onChange={(value) => update('finance', 'overdueInstallment', value)} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Min. ödeme (TL)"><Input type="number" value={filters.finance.minPaid} onChange={(value) => update('finance', 'minPaid', value)} /></Field>
              <Field label="Maks. ödeme (TL)"><Input type="number" value={filters.finance.maxPaid} onChange={(value) => update('finance', 'maxPaid', value)} /></Field>
              <Field label="Min. borç (TL)"><Input type="number" value={filters.finance.minDebt} onChange={(value) => update('finance', 'minDebt', value)} /></Field>
              <Field label="Maks. borç (TL)"><Input type="number" value={filters.finance.maxDebt} onChange={(value) => update('finance', 'maxDebt', value)} /></Field>
            </div>
            <Field label="Kapalı hesabı"><PresenceSelect value={filters.finance.hasClosedAccount} onChange={(value) => update('finance', 'hasClosedAccount', value)} /></Field>
          </FilterGroup>

          <FilterGroup title="Görüntü / Dosya">
            <Field label="Dosya türü">
              <Select value={filters.file.type} onChange={(value) => update('file', 'type', value)}>
                <option value="">Tümü</option><option value="any">Dosyası olan</option><option value="panoramic">Panoramik</option><option value="xray">Röntgen</option><option value="photo">Fotoğraf</option>
              </Select>
            </Field>
          </FilterGroup>
        </div>

        <button type="button" onClick={onRun} disabled={loading} className="mt-5 h-11 w-full rounded-md bg-[#142536] px-4 text-sm font-black text-white shadow-sm transition hover:bg-[#0F2B3D] disabled:cursor-wait disabled:opacity-60">
          {loading ? 'Araştırılıyor...' : 'Araştırmayı Çalıştır'}
        </button>
      </div>
    </aside>
  )
}

function FilterGroup({ title, open = false, children }: { title: string; open?: boolean; children: React.ReactNode }) {
  return (
    <details open={open} className="group rounded-md border border-slate-200 bg-white">
      <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-3 text-xs font-black text-[#142536]">
        {title}<span className="text-slate-400 transition group-open:rotate-45">+</span>
      </summary>
      <div className="space-y-3 border-t border-slate-100 px-3 py-3">{children}</div>
    </details>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-[10px] font-black uppercase text-slate-400">{label}</span>{children}</label>
}

function Input({ value, onChange, type = 'text', placeholder }: { value: string; onChange: (value: string) => void; type?: string; placeholder?: string }) {
  return <input type={type} value={value} min={type === 'number' ? 0 : undefined} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className="h-9 w-full rounded-md border border-slate-200 bg-white px-2.5 text-xs font-semibold text-[#142536] outline-none transition placeholder:text-slate-300 focus:border-[#2DD4BF] focus:ring-2 focus:ring-[#2DD4BF]/15" />
}

function Select({ value, onChange, children }: { value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return <select value={value} onChange={(event) => onChange(event.target.value)} className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold text-[#142536] outline-none transition focus:border-[#2DD4BF] focus:ring-2 focus:ring-[#2DD4BF]/15">{children}</select>
}

function PresenceSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <Select value={value} onChange={onChange}><option value="all">Tümü</option><option value="yes">Var</option><option value="no">Yok</option></Select>
}

