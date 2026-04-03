import { openai } from '@ai-sdk/openai'
import { createClient } from '@arizeai/phoenix-client'
import { createOrGetDataset } from '@arizeai/phoenix-client/datasets'
import { runExperiment } from '@arizeai/phoenix-client/experiments'

import { createFaithfulnessExperimentEvaluator } from './evaluators/faithfulness'
import { createRelevanceExperimentEvaluator } from './evaluators/relevance'
import { createResponseQualityExperimentEvaluator } from './evaluators/response-quality'
import { config } from './config'
import { closeDb } from './db'
import { withRetry } from './retry'
import { type ChatSample, sampleRecentChats } from './sampler'

export async function main() {
  const startTime = Date.now()
  console.log(`[evals] Starting evaluation run at ${new Date().toISOString()}`)
  console.log(
    `[evals] Config: sample=${config.sampleSize}, lookback=${config.lookbackHours}h, judge=${config.judgeModel}`
  )

  console.log('[evals] Sampling recent chats...')
  const samples = await sampleRecentChats()

  if (samples.length === 0) {
    console.log('[evals] No chats found in lookback window. Exiting.')
    await closeDb()
    return
  }

  console.log(`[evals] Sampled ${samples.length} chats`)

  const timestamp = new Date().toISOString().slice(0, 13).replace('T', '-')
  const datasetName = `polymorph-eval-${timestamp}h`
  const experimentName = `polymorph-eval-${timestamp}h`

  const examples = samples.map(sample => ({
    input: {
      query: sample.userQuery,
      context: formatContext(sample)
    },
    output: { answer: sample.modelAnswer },
    metadata: {
      chatId: sample.chatId,
      createdAt: sample.createdAt.toISOString(),
      citationCount: sample.citations.length,
      searchResultCount: sample.searchResults.length
    }
  }))

  // Pass host explicitly; auth (PHOENIX_API_KEY) flows via env var automatically
  const phoenix = createClient({
    options: { baseUrl: config.phoenixHost }
  })
  const model = openai(config.judgeModel)

  // Instantiate evaluators once, outside the retry loop
  const evaluators = [
    createFaithfulnessExperimentEvaluator(model),
    createRelevanceExperimentEvaluator(model),
    createResponseQualityExperimentEvaluator(model)
  ]

  // v6 behavior: createOrGetDataset is idempotent within the same name.
  // If this cron fires twice in the same hour, examples append to the
  // existing dataset. This is intentional — duplicate runs enrich rather
  // than overwrite the evaluation corpus.
  console.log(`[evals] Creating dataset: ${datasetName}`)
  const { datasetId } = await withRetry(
    () =>
      createOrGetDataset({
        client: phoenix,
        name: datasetName,
        description: `Automated eval of ${samples.length} chats from the last ${config.lookbackHours}h`,
        examples
      }),
    { maxAttempts: 3, baseDelayMs: 2000 }
  )

  console.log(`[evals] Running experiment: ${experimentName}`)
  const experiment = await withRetry(
    () =>
      runExperiment({
        client: phoenix,
        experimentName,
        experimentDescription: `Automated eval of ${samples.length} chats from the last ${config.lookbackHours}h`,
        dataset: { datasetId },
        task: async example => {
          // Extract answer string — evaluators receive this as `output`
          return (example.output as Record<string, unknown>)?.answer ?? ''
        },
        evaluators,
        concurrency: 3
      }),
    { maxAttempts: 3, baseDelayMs: 5000 }
  )

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`[evals] Experiment complete in ${elapsed}s`)
  console.log(`[evals] Experiment ID: ${experiment.id}`)
  console.log(`[evals] Results available in Phoenix UI`)

  await closeDb()
  console.log('[evals] Done.')
}

export function formatContext(sample: ChatSample): string {
  const parts: string[] = []

  for (const search of sample.searchResults) {
    if (search.query) parts.push(`[Search: "${search.query}"]`)
    for (const result of search.results) {
      parts.push(`- ${result.title}: ${result.snippet}`)
    }
  }

  if (sample.citations.length > 0) {
    parts.push('\n[Citations]')
    for (const citation of sample.citations) {
      parts.push(`- ${citation.title} (${citation.url})`)
    }
  }

  return parts.join('\n')
}

main().catch(async err => {
  console.error('[evals] Fatal error:', err)
  await closeDb().catch(() => {})
  process.exit(1)
})
