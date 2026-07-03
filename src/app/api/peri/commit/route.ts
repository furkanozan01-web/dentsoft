/**
 * PERİ — Commit endpoint
 * POST /api/peri/commit
 *
 * Hekim onayından sonra yazma işlemini gerçekleştirir.
 * createAppointment, rescheduleAppointment, updateAppointmentStatus
 * gibi mevcut server action'ları çağırır — iş kuralları tek yerde yaşar.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAppointment, rescheduleAppointment, updateAppointmentStatus } from '@/app/appointments/actions'
import { createPatientFromPeri, updatePatientFromPeri, addNoteFromPeri, updateAnamnesisFromPeri, addPaymentWithCurrency, addPrescription, createPromissoryPlan, sendInvoiceToInstitution } from '@/app/patients/actions'
import { addExpense, addClinicDebt } from '@/app/finance/actions'
import { buildReceteContent } from '@/lib/peri/agents/pinar'
import type { PendingWrite } from '@/lib/peri/types'

interface CommitRequest {
  pendingWrite: PendingWrite
}

interface CommitResponse {
  success: boolean
  error?: string
}

export async function POST(req: NextRequest): Promise<NextResponse<CommitResponse>> {
  // ── Oturum doğrulama ────────────────────────────────────────────────────────
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ success: false, error: 'Oturum açmanız gerekiyor.' }, { status: 401 })
  }

  // ── İstek gövdesi ───────────────────────────────────────────────────────────
  let body: CommitRequest
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Geçersiz istek formatı.' }, { status: 400 })
  }

  const { pendingWrite } = body
  if (!pendingWrite?.action) {
    return NextResponse.json({ success: false, error: 'Bekleyen işlem bulunamadı.' }, { status: 400 })
  }

  // STUB yazma tool'ları gerçek veritabanı işlemi yapmaz
  if (pendingWrite.stub) {
    return NextResponse.json({ success: false, error: 'Bu işlem henüz aktif değil — yakında eklenecek.' })
  }

  const { action, params } = pendingWrite

  // ── İşlemi uygula ───────────────────────────────────────────────────────────
  try {
    if (action === 'randevu_olustur') {
      const result = await createAppointment({
        patientId: params.hasta_id as number,
        doctorId: params.hekim_id as number,
        scheduledAt: params.tarih_saat as string,
        durationMin: (params.sure_dakika as number) ?? 30,
        treatmentNote: (params.not as string) ?? null,
        status: 'scheduled',
      })
      if (result?.error) return NextResponse.json({ success: false, error: result.error })
      return NextResponse.json({ success: true })
    }

    if (action === 'randevu_tasi') {
      const result = await rescheduleAppointment(
        params.randevu_id as number,
        params.yeni_tarih_saat as string,
        (params.sure_dakika as number) ?? 30,
        params.hekim_id as number
      )
      if (result?.error) return NextResponse.json({ success: false, error: result.error })
      return NextResponse.json({ success: true })
    }

    if (action === 'randevu_iptal') {
      const result = await updateAppointmentStatus(params.randevu_id as number, 'cancelled')
      if (result?.error) return NextResponse.json({ success: false, error: result.error })
      return NextResponse.json({ success: true })
    }

    if (action === 'randevu_durumu_guncelle') {
      const result = await updateAppointmentStatus(
        params.randevu_id as number,
        params.durum as string
      )
      if (result?.error) return NextResponse.json({ success: false, error: result.error })
      return NextResponse.json({ success: true })
    }

    if (action === 'tahsilat_kaydet') {
      const result = await addPaymentWithCurrency(params.hasta_id as number, {
        amountKurus: params.tutar_kurus as number,
        originalCurrency: (params.para_birimi as string) ?? 'TRY',
        originalAmount: null,
        exchangeRate: null,
        paymentMethod: (params.method as string) ?? 'cash',
        partnerId: null,
        note: (params.notlar as string) ?? null,
        date: new Date().toISOString().slice(0, 10),
      })
      if (result.error) return NextResponse.json({ success: false, error: result.error })
      return NextResponse.json({ success: true })
    }

    if (action === 'sabit_gider_ekle') {
      const result = await addClinicDebt({
        title: params.aciklama as string,
        totalAmount: params.tutar_kurus as number,
        dueDate: (params.vade_tarihi as string) ?? null,
        recurrence: (params.tekrar as string) ?? 'tek_seferlik',
        notes: (params.notlar as string) ?? null,
      })
      if (result?.error) return NextResponse.json({ success: false, error: result.error })
      return NextResponse.json({ success: true })
    }

    if (action === 'odeme_kaydet') {
      const tutarKurus = params.tutar_kurus as number
      const amountStr = (tutarKurus / 100).toFixed(2).replace('.', ',')
      const result = await addExpense({
        amount: amountStr,
        date: (params.odeme_tarihi as string) ?? new Date().toISOString().slice(0, 10),
        description: params.aciklama as string,
        category: (params.kategori as string) ?? undefined,
        method: (params.method as string) ?? 'cash',
        partnerId: (params.firma_id as number) ?? null,
      })
      if (result?.error) return NextResponse.json({ success: false, error: result.error })
      return NextResponse.json({ success: true })
    }

    if (action === 'anamnez_guncelle') {
      const result = await updateAnamnesisFromPeri({
        patientId: params.hasta_id as number,
        kullandigi_ilaclar: (params.kullandigi_ilaclar as string) ?? undefined,
        kronik_hastaliklar: (params.kronik_hastaliklar as string) ?? undefined,
        alerjiler: (params.alerjiler as string) ?? undefined,
        kan_grubu: (params.kan_grubu as string) ?? undefined,
        notlar: (params.notlar as string) ?? undefined,
      })
      if (result.error) return NextResponse.json({ success: false, error: result.error })
      return NextResponse.json({ success: true })
    }

    if (action === 'hasta_not_ekle') {
      const result = await addNoteFromPeri(
        params.hasta_id as number,
        params.not_metni as string,
        Boolean(params.onemli)
      )
      if (result.error) return NextResponse.json({ success: false, error: result.error })
      return NextResponse.json({ success: true })
    }

    if (action === 'hasta_bilgi_guncelle') {
      // tc_enc bu path üzerinden asla set edilmez
      const result = await updatePatientFromPeri({
        patientId: params.hasta_id as number,
        name: (params.ad as string) ?? undefined,
        surname: (params.soyad as string) ?? undefined,
        phone1: (params.telefon1 as string) ?? undefined,
        phone2: (params.telefon2 as string) ?? undefined,
        birth_date: (params.dogum_tarihi as string) ?? undefined,
        address: (params.adres as string) ?? undefined,
        email: (params.eposta as string) ?? undefined,
      })
      if (result.error) return NextResponse.json({ success: false, error: result.error })
      return NextResponse.json({ success: true })
    }

    if (action === 'recete_olustur') {
      const ilaclar = params.ilac_listesi as { ilac_adi: string; doz: string; kullanim: string }[]
      if (!Array.isArray(ilaclar) || ilaclar.length === 0) {
        return NextResponse.json({ success: false, error: 'Reçete ilaç listesi boş.' })
      }
      const content = buildReceteContent(ilaclar, (params.notlar as string) ?? undefined)
      // PERİ oturumu hekim kimliği taşımaz; reçete hekim atanmadan kaydedilir.
      const result = await addPrescription(params.hasta_id as number, content, null)
      if (result.error) return NextResponse.json({ success: false, error: result.error })
      return NextResponse.json({ success: true })
    }

    if (action === 'senet_olustur') {
      const installments = params.installments as { due_date: string; amount: number }[]
      if (!Array.isArray(installments) || installments.length === 0) {
        return NextResponse.json({ success: false, error: 'Senet taksit listesi boş.' })
      }
      const rateBps = Math.round(((params.vade_farki_yuzde as number) ?? 0) * 100)
      const result = await createPromissoryPlan(
        params.hasta_id as number,
        'PERİ Senet Planı',
        rateBps,
        installments
      )
      if (result.error) return NextResponse.json({ success: false, error: result.error })
      return NextResponse.json({ success: true })
    }

    if (action === 'fatura_kes') {
      const transactionIds = params.transaction_ids as number[]
      if (!Array.isArray(transactionIds) || transactionIds.length === 0) {
        return NextResponse.json({ success: false, error: 'Faturalanacak ödeme kaydı bulunamadı.' })
      }
      const result = await sendInvoiceToInstitution({
        patientId: params.hasta_id as number,
        transactionIds,
        invoiceNo: '', // boş → sendInvoiceToInstitution otomatik sıradaki numarayı verir
        lineDescription: params.aciklama as string,
        amountKurus: params.tutar_kurus as number,
      })
      if (result.error) return NextResponse.json({ success: false, error: result.error })
      return NextResponse.json({ success: true })
    }

    if (action === 'hasta_olustur') {
      // tc_enc bu path üzerinden asla set edilmez
      const result = await createPatientFromPeri({
        name: params.ad as string,
        surname: params.soyad as string,
        phone1: (params.telefon as string) ?? undefined,
        gender: (params.cinsiyet as string) ?? null,
        birth_date: (params.dogum_tarihi as string) ?? null,
        email: (params.eposta as string) ?? null,
        address: (params.adres as string) ?? null,
      })
      if (result.error) return NextResponse.json({ success: false, error: result.error })
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ success: false, error: `Bilinmeyen işlem: ${action}` }, { status: 400 })
  } catch (e) {
    console.error('[PERİ commit] Hata:', e)
    return NextResponse.json({ success: false, error: 'İşlem gerçekleştirilemedi.' }, { status: 500 })
  }
}
