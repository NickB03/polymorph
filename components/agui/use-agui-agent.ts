'use client'

import { useCallback, useState } from 'react'

import {
  type AguiConsumeResult,
  consumeAguiStream
} from '@/lib/streaming/agui/client'

export type UseAguiAgentStatus = 'idle' | 'running' | 'finished' | 'error'

export interface UseAguiAgentOptions {
  /** AG-UI agent endpoint that accepts a `RunAgentInput` POST and streams SSE. */
  endpoint: string
}

export interface UseAguiAgentResult {
  /** POST `input` as JSON to the endpoint and consume the AG-UI SSE response. */
  run: (input: unknown) => Promise<AguiConsumeResult | null>
  /** The reduced result of the most recent run, or `null` before the first run. */
  result: AguiConsumeResult | null
  status: UseAguiAgentStatus
  error: string | null
}

/**
 * Drive an external AG-UI agent from a Polymorph client component.
 *
 * `run(input)` POSTs the AG-UI `RunAgentInput` as JSON to `endpoint` and pipes
 * the streaming {@link Response} straight into `consumeAguiStream` — the same
 * reducer the loopback tests use — then exposes the normalized result for
 * rendering (e.g. via `AguiGenerativeUI`). Decoding is delegated entirely to
 * `lib/streaming/agui/client.ts`; this hook only owns the fetch + React state.
 */
export function useAguiAgent({
  endpoint
}: UseAguiAgentOptions): UseAguiAgentResult {
  const [result, setResult] = useState<AguiConsumeResult | null>(null)
  const [status, setStatus] = useState<UseAguiAgentStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  const run = useCallback(
    async (input: unknown): Promise<AguiConsumeResult | null> => {
      setStatus('running')
      setError(null)

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input)
        })

        if (!response.ok || !response.body) {
          throw new Error(`AG-UI request failed (${response.status})`)
        }

        const consumed = await consumeAguiStream(response)
        setResult(consumed)
        setStatus(consumed.status === 'error' ? 'error' : 'finished')
        if (consumed.status === 'error') {
          setError(consumed.error ?? 'AG-UI run failed')
        }
        return consumed
      } catch (caught) {
        const message =
          caught instanceof Error ? caught.message : 'AG-UI run failed'
        setError(message)
        setStatus('error')
        return null
      }
    },
    [endpoint]
  )

  return { run, result, status, error }
}
