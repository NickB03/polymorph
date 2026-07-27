import { context, trace, type Tracer } from '@opentelemetry/api'
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks'
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor
} from '@opentelemetry/sdk-trace-base'
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest'

import { OpenInferenceContextPropagator } from './otel-context-processor'
import {
  flushTraces,
  isEvalReplayTracingEnabled,
  isTracingEnabled,
  telemetryRecordingOptions,
  withOtelRootSpan,
  withOtelSession
} from './telemetry'

let exporter: InMemorySpanExporter
let provider: BasicTracerProvider
let contextManager: AsyncLocalStorageContextManager
let tracer: Tracer

beforeAll(async () => {
  exporter = new InMemorySpanExporter()
  const openInferenceProcessor = new OpenInferenceContextPropagator()
  await openInferenceProcessor.init()
  provider = new BasicTracerProvider({
    spanProcessors: [openInferenceProcessor, new SimpleSpanProcessor(exporter)]
  })
  contextManager = new AsyncLocalStorageContextManager()
  contextManager.enable()
  context.setGlobalContextManager(contextManager)
  trace.setGlobalTracerProvider(provider)
  tracer = provider.getTracer('telemetry-test')
})

afterAll(() => {
  trace.disable()
  context.disable()
})

beforeEach(() => {
  exporter.reset()
})

describe('isTracingEnabled', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns false when ENABLE_TRACING is not set', () => {
    vi.stubEnv('ENABLE_TRACING', '')
    expect(isTracingEnabled()).toBe(false)
  })

  it('returns false when ENABLE_TRACING is "false"', () => {
    vi.stubEnv('ENABLE_TRACING', 'false')
    expect(isTracingEnabled()).toBe(false)
  })

  it('returns true when ENABLE_TRACING is "true"', () => {
    vi.stubEnv('ENABLE_TRACING', 'true')
    expect(isTracingEnabled()).toBe(true)
  })
})

describe('isEvalReplayTracingEnabled', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('defaults to false', () => {
    vi.stubEnv('EVAL_REPLAY_TRACING_ENABLED', '')
    expect(isEvalReplayTracingEnabled()).toBe(false)
  })

  it('returns true when explicitly enabled', () => {
    vi.stubEnv('EVAL_REPLAY_TRACING_ENABLED', 'true')
    expect(isEvalReplayTracingEnabled()).toBe(true)
  })
})

describe('withOtelRootSpan', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('creates a root span and returns the actual otel trace id', async () => {
    vi.stubEnv('ENABLE_TRACING', 'true')

    const result = await withOtelRootSpan(
      {
        name: 'chat-response',
        sessionId: 'chat-1',
        userId: 'user-1',
        metadata: {
          correlationId: 'corr-1',
          executionMode: 'chat'
        }
      },
      async traceContext => traceContext
    )

    const span = exporter
      .getFinishedSpans()
      .find(finishedSpan => finishedSpan.name === 'chat-response')
    expect(span).toBeDefined()
    expect(result.otelTraceId).toBe(span?.spanContext().traceId)
    expect(span?.attributes['session.id']).toBe('chat-1')
    expect(span?.attributes['user.id']).toBe('user-1')
    expect(JSON.parse(String(span?.attributes.metadata))).toMatchObject({
      correlationId: 'corr-1',
      executionMode: 'chat'
    })
  })
})

describe('withOtelSession', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('propagates OpenInference session and user attributes to child spans', async () => {
    vi.stubEnv('ENABLE_TRACING', 'true')

    await withOtelSession(
      { sessionId: 'chat-1', userId: 'user-1' },
      async () => {
        await tracer.startActiveSpan('child-operation', async span => {
          span.end()
        })
      }
    )

    const childSpan = exporter
      .getFinishedSpans()
      .find(span => span.name === 'child-operation')
    expect(childSpan?.attributes['session.id']).toBe('chat-1')
    expect(childSpan?.attributes['user.id']).toBe('user-1')
  })
})

describe('telemetryRecordingOptions', () => {
  it('telemetryRecordingOptions honors OPENINFERENCE_HIDE_INPUTS/OUTPUTS', () => {
    vi.stubEnv('OPENINFERENCE_HIDE_INPUTS', 'true')
    vi.stubEnv('OPENINFERENCE_HIDE_OUTPUTS', 'false')
    expect(telemetryRecordingOptions()).toEqual({
      recordInputs: false,
      recordOutputs: true
    })
    vi.unstubAllEnvs()
    expect(telemetryRecordingOptions()).toEqual({
      recordInputs: true,
      recordOutputs: true
    })
  })
})

describe('flushTraces', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('resolves without error when tracing is disabled', async () => {
    vi.stubEnv('ENABLE_TRACING', 'false')
    await expect(flushTraces()).resolves.toBeUndefined()
  })

  it('resolves without error when tracing is enabled but no provider registered', async () => {
    vi.stubEnv('ENABLE_TRACING', 'true')
    await expect(flushTraces()).resolves.toBeUndefined()
  })
})
