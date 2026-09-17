import { ModelMessage } from 'ai'
import { getEncoding, type TiktokenEncoding } from 'js-tiktoken'

import { Model } from '../types/models'

interface ModelContextInfo {
  contextWindow: number
  outputTokens: number
}

// Model-specific context window configurations
const MODEL_CONTEXT_WINDOWS: Record<string, ModelContextInfo> = {
  // OpenAI Models
  'gpt-4.1': { contextWindow: 128000, outputTokens: 16384 },
  'gpt-4.1-mini': { contextWindow: 128000, outputTokens: 16384 },
  'gpt-4.1-nano': { contextWindow: 128000, outputTokens: 16384 },
  'gpt-4o-mini': { contextWindow: 128000, outputTokens: 16384 },

  // Anthropic Models
  'claude-opus-4': { contextWindow: 680000, outputTokens: 8192 },
  'claude-sonnet-4': { contextWindow: 680000, outputTokens: 8192 },
  'claude-3-7-sonnet': { contextWindow: 200000, outputTokens: 8192 },
  'claude-3-7-sonnet-20250219': { contextWindow: 200000, outputTokens: 8192 },
  'claude-3-5-haiku-20241022': { contextWindow: 200000, outputTokens: 8192 },

  // Google Models
  'gemini-3-flash': { contextWindow: 1048576, outputTokens: 65536 },
  'gemini-2.5-flash': { contextWindow: 1048576, outputTokens: 65536 },
  'gemini-2.5-pro': { contextWindow: 1048576, outputTokens: 65536 },
  'gemini-3.1-flash-lite': { contextWindow: 1048576, outputTokens: 65536 },

  // DeepSeek Models
  'deepseek-v4-flash': { contextWindow: 1048576, outputTokens: 65536 },
  'deepseek-v4-pro': { contextWindow: 1048576, outputTokens: 65536 },

  // xAI Models
  'grok-4.1-fast-non-reasoning': {
    contextWindow: 2097152,
    outputTokens: 65536
  },
  'grok-4.1-fast-reasoning': { contextWindow: 1048576, outputTokens: 65536 },
  'grok-4-0709': { contextWindow: 256000, outputTokens: 8192 },
  'grok-3': { contextWindow: 131072, outputTokens: 8192 },
  'grok-3-mini': { contextWindow: 131072, outputTokens: 8192 }
}

// Default values for unknown models
const DEFAULT_CONTEXT_WINDOW = 16384
const DEFAULT_OUTPUT_TOKENS = 4096

// Safety buffer percentage (reserved for system prompts and formatting)
const SAFETY_BUFFER_RATIO = 0.1

// Cache for tiktoken encoders
const encoderCache = new Map<string, any>()

// Mapping of our model IDs to tiktoken encoding names
// js-tiktoken supports 'cl100k_base' (for GPT-4), 'p50k_base', 'r50k_base'
const MODEL_TO_ENCODING: Record<string, TiktokenEncoding> = {
  'gpt-4.1': 'cl100k_base',
  'gpt-4.1-mini': 'cl100k_base',
  'gpt-4.1-nano': 'cl100k_base',
  'gpt-4o-mini': 'cl100k_base',
  'claude-opus-4': 'cl100k_base', // Use GPT-4 tokenizer as approximation for Claude
  'claude-sonnet-4': 'cl100k_base',
  'claude-3-7-sonnet': 'cl100k_base',
  'claude-3-7-sonnet-20250219': 'cl100k_base',
  'claude-3-5-haiku-20241022': 'cl100k_base',
  'gemini-3-flash': 'cl100k_base',
  'gemini-2.5-flash': 'cl100k_base', // Use GPT-4 tokenizer as approximation for Gemini
  'gemini-2.5-pro': 'cl100k_base',
  'gemini-3.1-flash-lite': 'cl100k_base',
  'deepseek-v4-flash': 'cl100k_base',
  'deepseek-v4-pro': 'cl100k_base',
  'grok-4.1-fast-non-reasoning': 'cl100k_base',
  'grok-4.1-fast-reasoning': 'cl100k_base',
  'grok-4-0709': 'cl100k_base', // Use GPT-4 tokenizer as approximation for Grok
  'grok-3': 'cl100k_base',
  'grok-3-mini': 'cl100k_base'
}

// Model ids in config carry a provider prefix
// (e.g. "deepseek/deepseek-v4-flash") but the lookup tables here are
// keyed unprefixed. Strip the segment before "/".
function stripProviderPrefix(modelId: string): string {
  const slash = modelId.indexOf('/')
  return slash >= 0 ? modelId.slice(slash + 1) : modelId
}

/**
 * Get model-specific context window information
 */
function getModelContextInfo(modelId: string): ModelContextInfo {
  return (
    MODEL_CONTEXT_WINDOWS[stripProviderPrefix(modelId)] || {
      contextWindow: DEFAULT_CONTEXT_WINDOW,
      outputTokens: DEFAULT_OUTPUT_TOKENS
    }
  )
}

/**
 * Calculate the maximum allowed tokens for input
 */
export function getMaxAllowedTokens(model: Model): number {
  const { contextWindow, outputTokens } = getModelContextInfo(model.id)

  // Calculate available tokens for input
  let availableTokens = contextWindow - outputTokens

  // Apply safety buffer
  const safetyBuffer = Math.floor(contextWindow * SAFETY_BUFFER_RATIO)
  availableTokens -= safetyBuffer

  // Ensure minimum viable token count
  return Math.max(availableTokens, 1000)
}

// Binary payloads are not tokenized as text. Providers bill files at roughly
// this many bytes per token; it is an approximation, but far closer than the
// zero these parts used to contribute.
const BYTES_PER_BINARY_TOKEN = 750
// Providers downscale/tile images, so cost is bounded regardless of file size
// (a 5 MB photo is ~1-2k tokens, not bytes/750 ≈ 7k).
const MAX_IMAGE_TOKENS = 1600

function safeStringify(value: unknown): string {
  if (value === undefined || value === null) return ''
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value) ?? ''
  } catch {
    return ''
  }
}

type LoosePart = {
  type?: string
  text?: unknown
  data?: unknown
  image?: unknown
  mediaType?: unknown
}

const MEDIA_PART_TYPES = new Set([
  'image',
  'file',
  'media',
  'file-data',
  'image-data'
])

// Items of a tool-result `content` output (text + media); null otherwise.
function toolResultContentItems(part: unknown): LoosePart[] | null {
  const { type, output } = part as {
    type?: string
    output?: { type?: string; value?: unknown }
  }
  return type === 'tool-result' &&
    output?.type === 'content' &&
    Array.isArray(output.value)
    ? (output.value as LoosePart[])
    : null
}

/**
 * Extract text content from various message content types.
 *
 * Tool calls and tool results are serialized rather than skipped: they are
 * often the largest thing in a research turn, and counting them as zero
 * tokens made the budget meaningless. Base64 media inside tool results is
 * excluded here and billed by estimateBinaryTokens instead.
 */
function extractTextContent(content: ModelMessage['content']): string {
  if (!content) return ''

  // Handle string content
  if (typeof content === 'string') {
    return content
  }

  // Handle array of parts
  if (Array.isArray(content)) {
    return content
      .map(part => {
        if ('text' in part && typeof part.text === 'string') {
          return part.text
        }
        if (part.type === 'tool-call') {
          return safeStringify(part.input)
        }
        if (part.type === 'tool-result') {
          const items = toolResultContentItems(part)
          if (!items) return safeStringify(part.output)
          return items
            .map(item =>
              MEDIA_PART_TYPES.has(item.type ?? '')
                ? ''
                : typeof item.text === 'string'
                  ? item.text
                  : safeStringify(item)
            )
            .join(' ')
        }
        return ''
      })
      .join(' ')
  }

  // Handle other content types
  return ''
}

function byteLengthOf(data: unknown): number {
  if (data instanceof Uint8Array) return data.byteLength
  if (data instanceof ArrayBuffer) return data.byteLength
  // Strings are base64: 4 chars per 3 bytes
  if (typeof data === 'string') return Math.ceil((data.length * 3) / 4)
  // Tagged file data: { type: 'data', data }
  if (data && typeof data === 'object' && 'data' in data) {
    return byteLengthOf((data as { data: unknown }).data)
  }
  return 0
}

function estimateMediaPartTokens(part: LoosePart): number {
  if (!MEDIA_PART_TYPES.has(part.type ?? '')) return 0
  const tokens = Math.ceil(
    byteLengthOf(part.data ?? part.image) / BYTES_PER_BINARY_TOKEN
  )
  const isImage =
    part.type === 'image' ||
    part.type === 'image-data' ||
    (typeof part.mediaType === 'string' && part.mediaType.startsWith('image'))
  return isImage ? Math.min(tokens, MAX_IMAGE_TOKENS) : tokens
}

/**
 * Approximate token cost of image/file parts, which carry no text.
 */
function estimateBinaryTokens(content: ModelMessage['content']): number {
  if (!Array.isArray(content)) return 0

  let tokens = 0
  for (const part of content) {
    for (const item of toolResultContentItems(part) ?? [part as LoosePart]) {
      tokens += estimateMediaPartTokens(item)
    }
  }
  return tokens
}

/**
 * Drop `tool` messages whose tool calls are no longer present in the kept
 * window. Truncation can strip the assistant turn that issued a tool call
 * while its result survives, which providers reject with a 400.
 */
function dropOrphanToolMessages(messages: ModelMessage[]): ModelMessage[] {
  const availableCallIds = new Set<string>()
  const kept: ModelMessage[] = []

  for (const message of messages) {
    if (message.role === 'assistant' && Array.isArray(message.content)) {
      for (const part of message.content) {
        if (part.type === 'tool-call') {
          availableCallIds.add(part.toolCallId)
        }
      }
    }

    if (message.role === 'tool' && Array.isArray(message.content)) {
      const orphaned = message.content.some(
        part => 'toolCallId' in part && !availableCallIds.has(part.toolCallId)
      )
      if (orphaned) continue
    }

    kept.push(message)
  }

  return kept
}

/**
 * Get or create encoder for a model
 */
function getEncoder(modelId: string) {
  try {
    const encodingName: TiktokenEncoding =
      MODEL_TO_ENCODING[stripProviderPrefix(modelId)] || 'cl100k_base'

    if (!encoderCache.has(encodingName)) {
      const encoder = getEncoding(encodingName)
      encoderCache.set(encodingName, encoder)
    }

    return encoderCache.get(encodingName)
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(
        `Failed to load tokenizer for model ${modelId}, falling back to estimation`,
        error
      )
    }
    return null
  }
}

/**
 * Estimate token count for a message
 * Uses tiktoken for accurate counting when available
 */
// Tool payloads are stringified and BPE-encoded, so each message is measured
// once and reused across the budget check, truncation, and eviction passes.
const tokenCountCache = new WeakMap<
  ModelMessage,
  { modelId?: string; tokens: number }
>()

function estimateMessageTokens(
  message: ModelMessage,
  modelId?: string
): number {
  const cached = tokenCountCache.get(message)
  if (cached && cached.modelId === modelId) return cached.tokens
  const tokens = estimateTokenCount(message.content, modelId)
  tokenCountCache.set(message, { modelId, tokens })
  return tokens
}

function estimateTokenCount(
  content: ModelMessage['content'],
  modelId?: string
): number {
  const text = extractTextContent(content)
  const binaryTokens = estimateBinaryTokens(content)
  if (!text) return binaryTokens > 0 ? binaryTokens + 4 : 0

  // Try to use tiktoken for accurate counting
  if (modelId) {
    const encoder = getEncoder(modelId)
    if (encoder) {
      try {
        const tokens = encoder.encode(text)
        const tokenCount = tokens.length
        const overhead = 4 // Message formatting tokens
        return tokenCount + overhead + binaryTokens
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.warn(
            'Failed to encode text with tiktoken, falling back to estimation',
            error
          )
        }
      }
    }
  }

  // Fallback: Rough approximation
  // ~4 characters per token for English, adjust for other languages
  const baseCount = Math.ceil(text.length / 4)
  const overhead = 4 // Message formatting tokens

  return baseCount + overhead + binaryTokens
}

/**
 * Smart message truncation with priority for context preservation
 */
export function truncateMessages(
  messages: ModelMessage[],
  maxTokens: number,
  modelId?: string
): ModelMessage[] {
  // Input validation
  if (!messages || messages.length === 0) return []
  if (maxTokens <= 0) {
    console.error('Invalid maxTokens value:', maxTokens)
    return []
  }

  // Always try to keep the first user message (initial context)
  const firstUserIndex = messages.findIndex(m => m.role === 'user')
  const firstUserMessage = firstUserIndex >= 0 ? messages[firstUserIndex] : null

  // Calculate token counts for all messages
  const messageTokenCounts = messages.map(msg => ({
    message: msg,
    tokens: estimateMessageTokens(msg, modelId)
  }))

  // Calculate total tokens
  const totalTokens = messageTokenCounts.reduce(
    (sum, item) => sum + item.tokens,
    0
  )

  // If under limit, return all messages
  if (totalTokens <= maxTokens) {
    return messages
  }

  // Strategy: Keep first user message + as many recent messages as possible
  const result: ModelMessage[] = []
  let usedTokens = 0

  // Reserve space for first user message if it exists
  let reservedFirstUser = false
  if (firstUserMessage) {
    const firstUserTokens = messageTokenCounts[firstUserIndex].tokens
    if (firstUserTokens < maxTokens * 0.3) {
      // Don't let first message take more than 30%
      result.push(firstUserMessage)
      usedTokens += firstUserTokens
      reservedFirstUser = true
    }
  }

  // Add recent messages from the end
  const recentMessages: ModelMessage[] = []

  for (let i = messages.length - 1; i >= 0; i--) {
    const { message, tokens } = messageTokenCounts[i]

    // Skip the first user message only if we already reserved it above.
    // If it was too large to reserve, let it compete here instead of being
    // dropped entirely (otherwise a single oversized question vanishes).
    if (reservedFirstUser && i === firstUserIndex) continue

    if (usedTokens + tokens <= maxTokens) {
      recentMessages.unshift(message)
      usedTokens += tokens
    } else {
      // Try to at least include the last user message if we haven't
      if (message.role === 'user' && recentMessages.length > 0) {
        // Remove oldest assistant messages to make room
        while (recentMessages.length > 0 && usedTokens + tokens > maxTokens) {
          const removed = recentMessages.shift()
          if (removed) {
            usedTokens -= estimateMessageTokens(removed, modelId)
          }
        }
        if (usedTokens + tokens <= maxTokens) {
          recentMessages.unshift(message)
          usedTokens += tokens
        }
      }
      break
    }
  }

  // Combine results, ensuring conversation flow
  if (firstUserMessage && result.length > 0) {
    // If we kept the first message, add recent ones
    result.push(...recentMessages)
  } else {
    // Otherwise, just use recent messages
    result.push(...recentMessages)
  }

  // Drop tool results whose originating tool call fell outside the window
  const pruned = dropOrphanToolMessages(result)
  result.length = 0
  result.push(...pruned)

  // Ensure the result starts with a user message
  while (result.length > 0 && result[0].role !== 'user') {
    result.shift()
  }

  // Safety net: never send an empty turn. If truncation stripped everything
  // (e.g. the only/first user message alone exceeds the budget, or the result
  // was reduced to leading assistant messages), fall back to the most recent
  // user message so the model always receives the actual question.
  if (result.length === 0) {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        return [messages[i]]
      }
    }
  }

  return result
}

/**
 * Check and truncate messages in a single call.
 * Returns the original messages if no truncation is needed.
 */
export function maybeTruncateMessages(
  messages: ModelMessage[],
  model: Model
): ModelMessage[] {
  if (!messages || messages.length === 0) return messages

  const maxTokens = getMaxAllowedTokens(model)
  const totalTokens = messages.reduce(
    (sum, msg) => sum + estimateMessageTokens(msg, model.id),
    0
  )

  if (totalTokens <= maxTokens) return messages
  return truncateMessages(messages, maxTokens, model.id)
}
