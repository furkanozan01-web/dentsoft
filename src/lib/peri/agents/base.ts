import type Anthropic from '@anthropic-ai/sdk'
import type { ToolResult } from '../types'

export type AgentId = 'emre' | 'pinar' | 'rana' | 'irem'

export interface PeriAgent {
  id: AgentId
  displayName: string
  role: string
  /** Bu ajanın hangi model kademesini kullanacağı — bkz. lib/peri/providers/registry.ts */
  tier: 'haiku' | 'sonnet'
  systemPrompt: string
  tools: Anthropic.Tool[]
  writeTools: Set<string>
  executeTool: (toolName: string, input: Record<string, unknown>) => Promise<ToolResult>
}

export function stubRead(): ToolResult {
  return {
    success: true,
    data: { not_implemented: true, mesaj: 'Bu özellik henüz aktif değil, yakında eklenecek.' },
  }
}

export function stubWrite(toolName: string, input: Record<string, unknown>): ToolResult {
  return {
    success: true,
    data: {
      __type: 'pending_write',
      action: toolName,
      params: input,
      preview: 'Bu işlem henüz aktif değil — yakında eklenecek.',
      stub: true,
    },
  }
}
