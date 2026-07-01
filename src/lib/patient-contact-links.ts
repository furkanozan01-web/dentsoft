/** Hasta iletişim bağlantılarını tek yerde ve loglama yapmadan üretir. */
export function normalizeTurkishMobilePhone(phone: string | null | undefined): string | null {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '')
  if (/^90\d{10}$/.test(digits)) return `+${digits}`
  if (/^0\d{10}$/.test(digits)) return `+90${digits.slice(1)}`
  if (/^5\d{9}$/.test(digits)) return `+90${digits}`
  return null
}

export function buildWhatsAppLink(phone: string | null | undefined): string | null {
  const normalized = normalizeTurkishMobilePhone(phone)
  return normalized ? `https://wa.me/${normalized.slice(1)}` : null
}

export function buildSmsLink(phone: string | null | undefined): string | null {
  const normalized = normalizeTurkishMobilePhone(phone)
  return normalized ? `sms:${normalized}` : null
}
