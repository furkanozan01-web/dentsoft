import 'server-only'
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

function getKey(): Buffer | null {
  const hex = process.env.ENCRYPTION_KEY
  if (!hex || !/^[0-9a-fA-F]{64}$/.test(hex.slice(0, 64))) return null
  return Buffer.from(hex.slice(0, 64), 'hex')
}

export function tryEncrypt(text: string): string | null {
  const key = getKey()
  if (!key) {
    console.warn('[CRYPTO] ENCRYPTION_KEY ayarlanmamış — alan kaydedilmedi')
    return null
  }
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`
}

export function tryDecrypt(ciphertext: string): string | null {
  try {
    const key = getKey()
    if (!key) return null
    const [ivHex, tagHex, dataHex] = ciphertext.split(':')
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'))
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'))
    return (
      decipher.update(Buffer.from(dataHex, 'hex')).toString('utf8') +
      decipher.final('utf8')
    )
  } catch {
    return null
  }
}
