/**
 * Guards the contract telemetryRecordingOptions() depends on but does not own:
 * that the AI SDK actually HONOURS recordInputs/recordOutputs, so prompt and
 * completion content really leaves the exported span.
 *
 * Unit-testing the helper only proves it returns the right booleans. This runs
 * those booleans through a real generateText call with a mock model and a real
 * in-memory OTel exporter, then asserts on the exported span attributes — the
 * same place production content ends up. Verified against live Phoenix on
 * 2026-09-16: production LLM spans carry `input.value` / `output.value`, which
 * is precisely what the masked case must remove.
 *
 * If an AI SDK upgrade ever stops honouring these flags, masking would silently
 * become decorative again — the exact failure this feature exists to prevent.
 * That regression fails here. No network, no cost, no production writes.
 */
import { OpenTelemetry } from '@ai-sdk/otel'
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor
} from '@opentelemetry/sdk-trace-base'
import { generateText } from 'ai'
import { MockLanguageModelV3 } from 'ai/test'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { telemetryRecordingOptions } from './telemetry'

const SECRET_PROMPT = 'PROMPT-CANARY-do-not-leak'
const SECRET_ANSWER = 'ANSWER-CANARY-do-not-leak'

function makeModel() {
  return new MockLanguageModelV3({
    doGenerate: async () => ({
      finishReason: { unified: 'stop' as const, raw: 'stop' },
      usage: {
        inputTokens: {
          total: 1,
          noCache: 1,
          cacheRead: undefined,
          cacheWrite: undefined
        },
        outputTokens: { total: 1, text: 1, reasoning: undefined }
      },
      content: [{ type: 'text' as const, text: SECRET_ANSWER }],
      warnings: []
    })
  })
}

async function runAndCollect() {
  const exporter = new InMemorySpanExporter()
  const provider = new BasicTracerProvider({
    spanProcessors: [new SimpleSpanProcessor(exporter)]
  })
  const tracer = provider.getTracer('masking-verify')

  // Mirrors lib/agents/chat/factory.ts — the production call shape. In AI SDK 7
  // the tracer moved off the telemetry options onto the OpenTelemetry
  // integration, passed here per call via `integrations`.
  await generateText({
    model: makeModel(),
    prompt: SECRET_PROMPT,
    telemetry: {
      isEnabled: true,
      functionId: 'masking-verify',
      integrations: [new OpenTelemetry({ tracer })],
      ...telemetryRecordingOptions()
    }
  })

  await provider.forceFlush()
  const spans = exporter.getFinishedSpans()
  const blob = JSON.stringify(spans.map(s => s.attributes))
  return { spans, blob }
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('AI SDK honours telemetryRecordingOptions end to end', () => {
  it('records prompt and completion when masking is off (control)', async () => {
    const { spans, blob } = await runAndCollect()

    expect(spans.length).toBeGreaterThan(0)
    // Control: without this, an "absent" result below would prove nothing —
    // the canaries might simply never reach a span at all.
    expect(blob).toContain(SECRET_PROMPT)
    expect(blob).toContain(SECRET_ANSWER)
  })

  it('strips prompt and completion from spans when masking is on', async () => {
    vi.stubEnv('OPENINFERENCE_HIDE_INPUTS', 'true')
    vi.stubEnv('OPENINFERENCE_HIDE_OUTPUTS', 'true')

    const { spans, blob } = await runAndCollect()

    expect(spans.length).toBeGreaterThan(0)
    expect(blob).not.toContain(SECRET_PROMPT)
    expect(blob).not.toContain(SECRET_ANSWER)
  })

  it('does NOT strip when the value is TRUE, only lowercase true', async () => {
    vi.stubEnv('OPENINFERENCE_HIDE_INPUTS', 'TRUE')
    vi.stubEnv('OPENINFERENCE_HIDE_OUTPUTS', '1')

    const { blob } = await runAndCollect()

    expect(blob).toContain(SECRET_PROMPT)
    expect(blob).toContain(SECRET_ANSWER)
  })

  it('masks each direction independently', async () => {
    vi.stubEnv('OPENINFERENCE_HIDE_INPUTS', 'true')

    const { blob } = await runAndCollect()

    expect(blob).not.toContain(SECRET_PROMPT)
    expect(blob).toContain(SECRET_ANSWER)
  })
})
