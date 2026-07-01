/**
 * PERİ — Server-side API route
 * POST /api/peri
 *
 * Router, gelen mesajı analiz ederek Emre / Pınar / Rana / İrem'e yönlendirir.
 * Seçilen ajanın tool seti + sistem prompt'u kullanılır.
 * API anahtarı server'da kalır, client'a asla sızmaz.
 */

import { NextRequest, NextResponse } from 'next/server'
import type Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { routeQuery } from '@/lib/peri/router'
import { emreAgent } from '@/lib/peri/agents/emre'
import { pinarAgent } from '@/lib/peri/agents/pinar'
import { ranaAgent } from '@/lib/peri/agents/rana'
import { iremAgent } from '@/lib/peri/agents/irem'
import { getProvider } from '@/lib/peri/providers/registry'
import type { PeriRequest, PeriResponse, PendingWrite } from '@/lib/peri/types'

const AGENTS = {
  emre: emreAgent,
  pinar: pinarAgent,
  rana: ranaAgent,
  irem: iremAgent,
}

export async function POST(req: NextRequest): Promise<NextResponse<PeriResponse>> {
  // ── 1. Oturum doğrulama ─────────────────────────────────────────────────────
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ type: 'error', text: 'Oturum açmanız gerekiyor.' }, { status: 401 })
  }

  // ── 2. İstek gövdesini al ───────────────────────────────────────────────────
  let body: PeriRequest
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ type: 'error', text: 'Geçersiz istek formatı.' }, { status: 400 })
  }

  if (!body.messages || body.messages.length === 0) {
    return NextResponse.json({ type: 'error', text: 'Mesaj listesi boş.' }, { status: 400 })
  }

  // ── 3. Router: son kullanıcı mesajına göre ajan seç ─────────────────────────
  const lastUserMessage = [...body.messages].reverse().find((m) => m.role === 'user')?.content ?? ''
  const { agentId } = routeQuery(lastUserMessage)
  const agent = AGENTS[agentId]
  const provider = getProvider(agent.tier)

  // ── 4. Model sağlayıcısına ilk istek ────────────────────────────────────────
  try {
    const anthropicMessages: Anthropic.MessageParam[] = body.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }))

    let response = await provider.complete({
      systemPrompt: agent.systemPrompt,
      tools: agent.tools,
      messages: anthropicMessages,
      maxTokens: 1024,
    })

    // ── 5. Tool kullanım döngüsü ─────────────────────────────────────────────
    while (response.stop_reason === 'tool_use') {
      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
      )

      // Yazma tool'u var mı? Varsa önizleme döndür, döngüyü kes.
      const writeBlock = toolUseBlocks.find((b) => agent.writeTools.has(b.name))

      if (writeBlock) {
        const previewResult = await agent.executeTool(
          writeBlock.name,
          writeBlock.input as Record<string, unknown>
        )

        if (!previewResult.success) {
          return NextResponse.json({
            type: 'error',
            text: `Bir sorun oluştu: ${previewResult.error}`,
            agent: { id: agent.id, displayName: agent.displayName },
          })
        }

        const pending = previewResult.data as PendingWrite & { __type?: string; stub?: boolean }
        return NextResponse.json({
          type: 'preview',
          text: pending.preview,
          pendingWrite: {
            action: pending.action,
            params: pending.params,
            preview: pending.preview,
            ...(pending.stub ? { stub: true } : {}),
          },
          agent: { id: agent.id, displayName: agent.displayName },
        })
      }

      // Okuma tool'ları → çalıştır, sonuçları modele gönder
      const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
        toolUseBlocks.map(async (block) => {
          const result = await agent.executeTool(block.name, block.input as Record<string, unknown>)
          return {
            type: 'tool_result' as const,
            tool_use_id: block.id,
            content: result.success ? JSON.stringify(result.data) : `Hata: ${result.error}`,
          }
        })
      )

      anthropicMessages.push({ role: 'assistant', content: response.content })
      anthropicMessages.push({ role: 'user', content: toolResults })

      response = await provider.complete({
        systemPrompt: agent.systemPrompt,
        tools: agent.tools,
        messages: anthropicMessages,
        maxTokens: 1024,
      })
    }

    // ── 6. Son metin yanıtını döndür ─────────────────────────────────────────
    const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text')

    return NextResponse.json({
      type: 'text',
      text: textBlock?.text ?? 'Yanıt alınamadı.',
      agent: { id: agent.id, displayName: agent.displayName },
    })
  } catch (e) {
    console.error('[PERİ] API hatası:', e)
    return NextResponse.json(
      { type: 'error', text: 'PERİ şu an yanıt veremiyor. Lütfen tekrar deneyin.' },
      { status: 500 }
    )
  }
}
