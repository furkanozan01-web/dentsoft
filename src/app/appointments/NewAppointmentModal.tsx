'use client'

import { useState, useMemo, useTransition } from 'react'
import { toast } from 'sonner'
import { createAppointment, createPatientForAppointment } from './actions'
import { ApptDoctor, ApptPatient, ApptTariff, AppointmentTypeOption, NightShiftConfig, ShiftMode, isoDate } from './appointmentsShared'
import { ApptModal } from './ApptModal'

export function NewAppointmentModal({
  doctors,
  patients,
  tariffs,
  defaultDuration,
  prefill,
  prefillPatientId,
  shiftMode,
  appointmentTypes,
  nightShift,
  canOverrideNight,
  onClose,
  onSuccess,
}: {
  doctors: ApptDoctor[]
  patients: ApptPatient[]
  tariffs: ApptTariff[]
  defaultDuration: number
  prefill: { date: string; time: string } | null
  prefillPatientId?: number | null
  shiftMode: ShiftMode
  appointmentTypes: AppointmentTypeOption[]
  nightShift: NightShiftConfig
  canOverrideNight: boolean
  onClose: () => void
  onSuccess: () => void
}) {
  const [patientId, setPatientId] = useState<number | ''>(prefillPatientId ?? '')
  const [doctorId, setDoctorId] = useState<number | ''>(doctors[0]?.id ?? '')
  const [date, setDate] = useState(prefill?.date ?? isoDate(new Date()))
  const [time, setTime] = useState(prefill?.time ?? (shiftMode === 'work' ? '09:00' : '18:00'))
  const [duration, setDuration] = useState(defaultDuration)
  const [note, setNote] = useState('')
  const [pending, startTransition] = useTransition()
  const [search, setSearch] = useState('')
  const [tariffSearch, setTariffSearch] = useState('')
  const [selectedTariff, setSelectedTariff] = useState<ApptTariff | null>(null)
  const [selectedType, setSelectedType] = useState<AppointmentTypeOption | null>(null)
  const [customColor, setCustomColor] = useState('#3B82F6')
  const [overrideNight, setOverrideNight] = useState(false)
  const [saveNewPatient, setSaveNewPatient] = useState(false)
  const [newName, setNewName] = useState('')
  const [newSurname, setNewSurname] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newBirthDate, setNewBirthDate] = useState('')
  const [newGender, setNewGender] = useState('')

  const filteredPatients = patients
    .filter((p) => `${p.name} ${p.surname} ${p.phone1 ?? ''}`.toLowerCase().includes(search.toLowerCase()))
    .slice(0, 8)

  const filteredTariffs = useMemo(() => {
    if (!tariffSearch.trim()) return tariffs.slice(0, 12)
    const q = tariffSearch.toLowerCase()
    return tariffs.filter((t) => t.treatment_name.toLowerCase().includes(q)).slice(0, 12)
  }, [tariffs, tariffSearch])

  const pickTariff = (t: ApptTariff) => {
    setSelectedTariff(t)
    setNote(t.treatment_name)
    setTariffSearch('')
    if (t.duration_minutes) setDuration(t.duration_minutes)
  }

  const startNewPatient = () => {
    const parts = search.trim().split(/\s+/).filter(Boolean)
    setNewName((cur) => cur || parts.slice(0, -1).join(' ') || parts[0] || '')
    setNewSurname((cur) => cur || (parts.length > 1 ? parts[parts.length - 1] : ''))
    setSaveNewPatient(true)
    setPatientId('')
  }

  const selectedPatient = patientId ? patients.find((p) => p.id === patientId) : null
  const unsavedName = search.trim() || [newName, newSurname].filter(Boolean).join(' ').trim()

  const save = () => {
    if (!doctorId) {
      toast.error('Hekim seçin')
      return
    }
    if (!patientId && !saveNewPatient && !unsavedName) {
      toast.error('Hasta seçin veya hasta adını yazın')
      return
    }
    if (saveNewPatient && (!newName.trim() || !newSurname.trim())) {
      toast.error('Yeni hasta için ad ve soyad zorunludur')
      return
    }

    startTransition(async () => {
      let finalPatientId: number | null = patientId ? Number(patientId) : null
      if (saveNewPatient) {
        const patientRes = await createPatientForAppointment({
          name: newName,
          surname: newSurname,
          phone1: newPhone || null,
          birthDate: newBirthDate || null,
          gender: newGender || null,
        })
        if (patientRes.error || !patientRes.id) {
          toast.error(patientRes.error ?? 'Hasta kaydedilemedi')
          return
        }
        finalPatientId = patientRes.id
      }

      const scheduledAt = new Date(`${date}T${time}:00`).toISOString()
      const guestPrefix = !finalPatientId && unsavedName ? `Kayıtsız: ${unsavedName}` : null
      const treatmentNote = [guestPrefix, note.trim() || null].filter(Boolean).join(' · ') || null
      const res = await createAppointment({
        patientId: finalPatientId,
        doctorId: Number(doctorId),
        scheduledAt,
        durationMin: duration,
        treatmentNote,
        appointmentTypeId: selectedType?.id ?? null,
        color: customColor,
        overrideNight,
      })
      if (res?.error) toast.error(res.error)
      else onSuccess()
    })
  }

  return (
    <ApptModal title="Yeni Randevu" onClose={onClose}>
      <div className="p-6 space-y-4">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-medium text-gray-500">Hasta Ara</label>
            <button type="button" onClick={startNewPatient} className="text-xs font-semibold text-[#0F2B3D] hover:text-[#2DD4BF]">
              Yeni hasta ekle
            </button>
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPatientId('') }}
            placeholder="Ad soyad veya telefon yazın"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/30"
          />
          {selectedPatient && (
            <p className="mt-2 text-xs text-[#0F2B3D]">Seçili hasta: {selectedPatient.name} {selectedPatient.surname}</p>
          )}
          {search.trim() && filteredPatients.length > 0 && !patientId && (
            <div className="mt-2 max-h-36 overflow-y-auto rounded-xl border border-gray-100 bg-white shadow-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {filteredPatients.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => { setPatientId(p.id); setSearch(`${p.name} ${p.surname}`); setSaveNewPatient(false) }}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-[#2DD4BF]/10"
                >
                  <span className="font-medium text-[#0F2B3D]">{p.name} {p.surname}</span>
                  <span className="text-xs text-gray-400">{p.phone1 ?? ''}</span>
                </button>
              ))}
            </div>
          )}
          {search.trim() && filteredPatients.length === 0 && !saveNewPatient && (
            <p className="mt-2 text-xs text-gray-400">Eşleşen kayıt yok. Yeni hasta ekleyebilir veya kaydetmeden randevu oluşturabilirsiniz.</p>
          )}
        </div>

        {saveNewPatient && (
          <div className="rounded-2xl border border-[#2DD4BF]/30 bg-[#2DD4BF]/5 p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ad *" className="px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none" />
              <input value={newSurname} onChange={(e) => setNewSurname(e.target.value)} placeholder="Soyad *" className="px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="Telefon" className="px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none" />
              <input type="date" value={newBirthDate} onChange={(e) => setNewBirthDate(e.target.value)} className="px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none" />
            </div>
            <select value={newGender} onChange={(e) => setNewGender(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none">
              <option value="">Cinsiyet seçiniz</option>
              <option value="male">Erkek</option>
              <option value="female">Kadın</option>
              <option value="other">Diğer</option>
            </select>
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Hekim</label>
          <select value={doctorId} onChange={(e) => setDoctorId(Number(e.target.value))} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/30">
            {doctors.map((d) => <option key={d.id} value={d.id}>Dt. {d.name}</option>)}
          </select>
        </div>

        <div><label className="mb-2 block text-xs font-medium text-gray-500">Hızlı Randevu Türü</label><div className="flex max-h-32 flex-wrap gap-2 overflow-auto">{appointmentTypes.filter((type)=>!type.doctor_ids.length||type.doctor_ids.includes(Number(doctorId))).map((type)=><button key={type.id} type="button" onClick={()=>{setSelectedType(type);setCustomColor(type.color);setDuration(type.default_duration);setNote(type.name)}} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition ${selectedType?.id===type.id?'border-[#142536] bg-slate-50 text-[#142536]':'border-slate-200 text-slate-500'}`}><span className="h-3 w-3 rounded-full" style={{backgroundColor:type.color}}/>{type.name}</button>)}</div></div>

        <div className="grid grid-cols-2 gap-3"><label className="text-xs font-medium text-gray-500">Randevu Rengi<div className="mt-1.5 flex gap-2"><input type="color" value={customColor} onChange={e=>setCustomColor(e.target.value)} className="h-10 w-14 rounded-xl border border-gray-200"/><input value={customColor} onChange={e=>setCustomColor(e.target.value)} className="min-w-0 flex-1 rounded-xl border border-gray-200 px-2 font-mono text-xs"/></div></label><div><p className="text-xs font-medium text-gray-500">Ön izleme</p><div className="mt-1.5 h-10 rounded-xl px-3 py-2 text-xs font-black text-white" style={{backgroundColor:customColor}}>{selectedType?.name||'Randevu'}</div></div></div>

        {tariffs.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">İşlem / Tedavi</label>
            {selectedTariff ? (
              <div className="flex items-center justify-between px-3 py-2 bg-[#2DD4BF]/10 border border-[#2DD4BF]/30 rounded-xl text-sm">
                <span className="font-medium text-[#0F2B3D]">{selectedTariff.treatment_name}</span>
                <button type="button" onClick={() => { setSelectedTariff(null); setNote('') }} className="text-gray-400 hover:text-red-500">Kaldır</button>
              </div>
            ) : (
              <div className="relative">
                <input value={tariffSearch} onChange={(e) => setTariffSearch(e.target.value)} placeholder="İşlem ara" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/30" />
                {tariffSearch.length > 0 && filteredTariffs.length > 0 && (
                  <div className="absolute z-10 mt-1 max-h-44 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {filteredTariffs.map((t) => (
                      <button key={t.id} type="button" onClick={() => pickTariff(t)} className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-[#2DD4BF]/10">
                        <span className="text-[#0F2B3D]">{t.treatment_name}</span>
                        <span className="ml-2 text-xs text-gray-400">{t.duration_minutes ?? defaultDuration} dk</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Tarih</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/30" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Saat</label>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/30" />
            <p className="mt-1 text-[11px] text-gray-400">{shiftMode === 'work' ? '09:00-18:00' : '18:00-09:00'}</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Süre (dk)</label>
            <input type="number" value={duration} min={5} step={5} onChange={(e) => setDuration(Number(e.target.value))} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/30" />
          </div>
        </div>

        {shiftMode === 'duty' && <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-3 text-xs font-bold text-indigo-700">Gece mesaisi: {nightShift.active ? `${nightShift.start}–${nightShift.end}` : 'Kapalı'}{canOverrideNight && <label className="mt-2 flex items-center gap-2 text-indigo-600"><input type="checkbox" checked={overrideNight} onChange={e=>setOverrideNight(e.target.checked)}/>Yetkili olarak özel izinle oluştur</label>}</div>}

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Not (opsiyonel)</label>
          <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ek notlar" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/30" />
        </div>

        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50">İptal</button>
          <button onClick={save} disabled={pending} className="flex-1 px-4 py-2.5 bg-[#2DD4BF] text-[#0F2B3D] text-sm font-semibold rounded-xl hover:bg-[#26b8a5] disabled:opacity-60">
            {pending ? 'Kaydediliyor…' : 'Randevu Oluştur'}
          </button>
        </div>
      </div>
    </ApptModal>
  )
}
