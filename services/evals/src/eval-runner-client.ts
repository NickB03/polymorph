import { getCorpusVersion } from './corpus'
import { withRetry } from './retry'
import type { EvalCase, EvalRunResult } from './types'

export interface EvalRunnerClientConfig {
  evalRunnerUrl: string
  evalRunnerSecret: string
  timeoutMs?: number
}

export interface EvalRunnerRequest {
  caseId: string
  suite: EvalCase['suite']
  conversation: EvalCase['conversation']
  searchMode: EvalCase['searchMode']
  userMode?: EvalCase['userMode']
  intent?: EvalCase['intent']
  modelType: EvalCase['modelType']
  corpusVersion?: string
}

export class EvalRunnerHttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly statusText: string,
    public readonly body: string
  ) {
    super(`Eval endpoint returned ${status} ${statusText}: ${body}`)
    this.name = 'EvalRunnerHttpError'
  }

  get retryable(): boolean {
    return this.status >= 500 || this.status === 429
  }
}

export async function runEvalCase(
  caseSpec: EvalCase,
  config: EvalRunnerClientConfig
): Promise<EvalRunResult> {
  const timeoutMs = config.timeoutMs ?? 120_000

  return await withRetry(
    async () => {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), timeoutMs)

      try {
        const response = await fetch(`${config.evalRunnerUrl}/api/evals/run`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-eval-runner-secret': config.evalRunnerSecret
          },
          body: JSON.stringify({
            caseId: caseSpec.id,
            suite: caseSpec.suite,
            conversation: caseSpec.conversation,
            searchMode: caseSpec.searchMode,
            ...(caseSpec.userMode !== undefined
              ? { userMode: caseSpec.userMode }
              : {}),
            ...(caseSpec.intent !== undefined
              ? { intent: caseSpec.intent }
              : {}),
            modelType: caseSpec.modelType,
            corpusVersion: getCorpusVersion()
          } satisfies EvalRunnerRequest),
          signal: controller.signal
        })

        if (!response.ok) {
          const body = await response
            .text()
            .catch(() => '(unable to read body)')
          throw new EvalRunnerHttpError(
            response.status,
            response.statusText,
            body
          )
        }

        return (await response.json()) as EvalRunResult
      } finally {
        clearTimeout(timeout)
      }
    },
    {
      maxAttempts: 3,
      baseDelayMs: 5_000,
      shouldRetry: err => err instanceof EvalRunnerHttpError && err.retryable
    }
  )
}
