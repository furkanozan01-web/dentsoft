import 'server-only'

import Anthropic from '@anthropic-ai/sdk'
import type { ModelProvider } from './types'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

/**
 * Anthropic Claude API üzerinden çalışan ModelProvider uygulaması.
 *
 * Prompt caching: system prompt ve tool tanımları ajan başına neredeyse
 * hiç değişmediği için cache_control: { type: 'ephemeral' } ile işaretlenir.
 * Anthropic'in cache hiyerarşisi tools → system → messages sırasını izler;
 * bu yüzden cache_control işaretleri son tool bloğuna ve system bloğuna
 * konur (bkz. platform.claude.com/docs/en/build-with-claude/prompt-caching).
 */
export class ClaudeProvider implements ModelProvider {
  readonly id: string
  private readonly model: string

  constructor(model: string) {
    this.model = model
    this.id = `claude:${model}`
  }

  async complete(params: {
    systemPrompt: string
    tools: Anthropic.Tool[]
    messages: Anthropic.MessageParam[]
    maxTokens?: number
  }): Promise<Anthropic.Message> {
    const cachedTools: Anthropic.Tool[] = params.tools.map((tool, i) =>
      i === params.tools.length - 1
        ? { ...tool, cache_control: { type: 'ephemeral' } }
        : tool
    )

    return anthropic.messages.create({
      model: this.model,
      max_tokens: params.maxTokens ?? 1024,
      system: [
        {
          type: 'text',
          text: params.systemPrompt,
          cache_control: { type: 'ephemeral' },
        },
      ],
      tools: cachedTools,
      messages: params.messages,
    })
  }
}
