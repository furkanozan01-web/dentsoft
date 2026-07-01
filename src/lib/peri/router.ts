import type { AgentId } from './agents/base'

interface RouteResult {
  agentId: AgentId
  matchedKeyword: string | null
}

export function routeQuery(message: string): RouteResult {
  const lower = message.toLocaleLowerCase('tr-TR')

  const RANA_KEYWORDS = ['hakediş', 'finans', 'bakiye', 'ciro', 'tahsilat', 'fatura', 'gider', 'senet', 'taksit', 'ödeme planı', 'ödeme yap', 'firmaya öde']
  const IREM_KEYWORDS = ['anamnez', 'kvkk', 'onam', 'whatsapp', 'sms gönder', 'sms at', 'mesaj gönder', 'hasta ekle', 'hasta kaydet', 'hasta kayıt', 'hasta kayd', 'hasta notu', 'not ekle']
  const PINAR_KEYWORDS = [
    'tedavi plan', 'tedavi geçmiş', 'diş geçmiş', 'dişin geçmiş', 'numaralı diş', 'araştırma', 'literatür', 'faz 1', 'faz 2',
    'implant', 'protez', 'kanal', 'reçete', 'film', 'panoramik', 'röntgen',
  ]

  for (const kw of RANA_KEYWORDS) if (lower.includes(kw)) return { agentId: 'rana', matchedKeyword: kw }
  for (const kw of IREM_KEYWORDS) if (lower.includes(kw)) return { agentId: 'irem', matchedKeyword: kw }
  for (const kw of PINAR_KEYWORDS) if (lower.includes(kw)) return { agentId: 'pinar', matchedKeyword: kw }

  return { agentId: 'emre', matchedKeyword: null }
}
