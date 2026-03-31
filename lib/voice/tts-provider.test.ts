import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  resolveProvider,
  synthesizeElevenLabs,
  synthesizeOpenAI
} from './tts-provider'

describe('resolveProvider', () => {
  const originalElevenLabs = process.env.ELEVENLABS_API_KEY
  const originalOpenAI = process.env.OPENAI_API_KEY

  afterEach(() => {
    if (originalElevenLabs === undefined) {
      delete process.env.ELEVENLABS_API_KEY
    } else {
      process.env.ELEVENLABS_API_KEY = originalElevenLabs
    }
    if (originalOpenAI === undefined) {
      delete process.env.OPENAI_API_KEY
    } else {
      process.env.OPENAI_API_KEY = originalOpenAI
    }
  })

  it('returns null when preferred is browser', () => {
    expect(resolveProvider('browser')).toBeNull()
  })

  it('returns null when no API keys are set', () => {
    delete process.env.ELEVENLABS_API_KEY
    delete process.env.OPENAI_API_KEY
    expect(resolveProvider()).toBeNull()
  })

  it('ignores whitespace-only API keys', () => {
    process.env.ELEVENLABS_API_KEY = '   '
    process.env.OPENAI_API_KEY = '  '
    expect(resolveProvider()).toBeNull()
    expect(resolveProvider('elevenlabs')).toBeNull()
    expect(resolveProvider('openai')).toBeNull()
  })

  it('ignores empty string API keys', () => {
    process.env.ELEVENLABS_API_KEY = ''
    process.env.OPENAI_API_KEY = ''
    expect(resolveProvider()).toBeNull()
  })

  it('resolves elevenlabs when key is valid', () => {
    process.env.ELEVENLABS_API_KEY = 'sk_valid_key'
    delete process.env.OPENAI_API_KEY
    expect(resolveProvider()).toBe('elevenlabs')
    expect(resolveProvider('elevenlabs')).toBe('elevenlabs')
  })

  it('resolves openai when key is valid', () => {
    delete process.env.ELEVENLABS_API_KEY
    process.env.OPENAI_API_KEY = 'sk-valid-key'
    expect(resolveProvider()).toBe('openai')
    expect(resolveProvider('openai')).toBe('openai')
  })

  it('prefers elevenlabs over openai in auto-resolve', () => {
    process.env.ELEVENLABS_API_KEY = 'sk_el'
    process.env.OPENAI_API_KEY = 'sk-oa'
    expect(resolveProvider()).toBe('elevenlabs')
  })
})

describe('synthesizeElevenLabs', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('throws when API key is not configured', async () => {
    const original = process.env.ELEVENLABS_API_KEY
    delete process.env.ELEVENLABS_API_KEY
    await expect(synthesizeElevenLabs('hello', 'voice-1')).rejects.toThrow(
      'ELEVENLABS_API_KEY not configured'
    )
    process.env.ELEVENLABS_API_KEY = original
  })

  it('throws when API key is whitespace-only', async () => {
    const original = process.env.ELEVENLABS_API_KEY
    process.env.ELEVENLABS_API_KEY = '   '
    await expect(synthesizeElevenLabs('hello', 'voice-1')).rejects.toThrow(
      'ELEVENLABS_API_KEY not configured'
    )
    process.env.ELEVENLABS_API_KEY = original
  })

  it('rejects non-audio Content-Type responses', async () => {
    const original = process.env.ELEVENLABS_API_KEY
    process.env.ELEVENLABS_API_KEY = 'sk_test'

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('<html>error</html>', {
        status: 200,
        headers: { 'Content-Type': 'text/html' }
      })
    )

    await expect(synthesizeElevenLabs('hello', 'voice-1')).rejects.toThrow(
      'unexpected Content-Type: text/html'
    )
    process.env.ELEVENLABS_API_KEY = original
  })

  it('accepts audio/mpeg Content-Type', async () => {
    const original = process.env.ELEVENLABS_API_KEY
    process.env.ELEVENLABS_API_KEY = 'sk_test'

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1]))
        controller.close()
      }
    })

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(stream, {
        status: 200,
        headers: { 'Content-Type': 'audio/mpeg' }
      })
    )

    const result = await synthesizeElevenLabs('hello', 'voice-1')
    expect(result).toBeInstanceOf(ReadableStream)
    process.env.ELEVENLABS_API_KEY = original
  })
})

describe('synthesizeOpenAI', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('throws when API key is not configured', async () => {
    const original = process.env.OPENAI_API_KEY
    delete process.env.OPENAI_API_KEY
    await expect(synthesizeOpenAI('hello')).rejects.toThrow(
      'OPENAI_API_KEY not configured'
    )
    process.env.OPENAI_API_KEY = original
  })

  it('throws when API key is whitespace-only', async () => {
    const original = process.env.OPENAI_API_KEY
    process.env.OPENAI_API_KEY = '   '
    await expect(synthesizeOpenAI('hello')).rejects.toThrow(
      'OPENAI_API_KEY not configured'
    )
    process.env.OPENAI_API_KEY = original
  })

  it('rejects non-audio Content-Type responses', async () => {
    const original = process.env.OPENAI_API_KEY
    process.env.OPENAI_API_KEY = 'sk-test'

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('{"error":"bad"}', {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    )

    await expect(synthesizeOpenAI('hello')).rejects.toThrow(
      'unexpected Content-Type: application/json'
    )
    process.env.OPENAI_API_KEY = original
  })

  it('accepts application/octet-stream Content-Type', async () => {
    const original = process.env.OPENAI_API_KEY
    process.env.OPENAI_API_KEY = 'sk-test'

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1]))
        controller.close()
      }
    })

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(stream, {
        status: 200,
        headers: { 'Content-Type': 'application/octet-stream' }
      })
    )

    const result = await synthesizeOpenAI('hello')
    expect(result).toBeInstanceOf(ReadableStream)
    process.env.OPENAI_API_KEY = original
  })
})
