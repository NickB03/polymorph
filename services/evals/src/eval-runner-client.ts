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
  modelType: EvalCase['modelType']
}

export async function runEvalCase(
  caseSpec: EvalCase,
  config: EvalRunnerClientConfig
): Promise<EvalRunResult> {
  const controller = new AbortController()
  const timeoutMs = config.timeoutMs ?? 120_000
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
        modelType: caseSpec.modelType
      } satisfies EvalRunnerRequest),
      signal: controller.signal
    })

    if (!response.ok) {
      throw new Error(
        `Eval endpoint returned ${response.status} ${response.statusText}`
      )
    }

    const json = (await response.json()) as EvalRunResult
    return json
  } finally {
    clearTimeout(timeout)
  }
}
