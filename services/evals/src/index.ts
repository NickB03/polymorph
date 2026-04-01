import { runExperiment } from '@arizeai/phoenix-client/experiments'

import { faithfulnessEvaluator } from './evaluators/faithfulness'
import { relevanceEvaluator } from './evaluators/relevance'
import { responseQualityEvaluator } from './evaluators/response-quality'
import { config } from './config'
import { closeDb } from './db'
import { withRetry } from './retry'
import { type ChatSample, sampleRecentChats } from './sampler'

/**
 * Polymorph Evals — scheduled evaluation pipeline
 *
 * Flow:
 * 1. Sample recent chats from Supabase Postgres
 * 2. Run evaluators (faithfulness, search relevance, response quality)
 * 3. Push results to Phoenix as an experiment
 * 4. Exit cleanly (Railway cron requirement)
 *
 * Phoenix client reads PHOENIX_HOST and PHOENIX_API_KEY from env automatically.
 */
async function main() {
  const startTime = Date.now()
  console.log(`[evals] Starting evaluation run at ${new Date().toISOString()}`)
  console.log(
    `[evals] Config: sample=${config.sampleSize}, lookback=${config.lookbackHours}h, judge=${config.judgeModel}`
  )

  // Step 1: Sample recent chats
  console.log('[evals] Sampling recent chats...')
  const samples = await sampleRecentChats()

  if (samples.length === 0) {
    console.log('[evals] No chats found in lookback window. Exiting.')
    await closeDb()
    return
  }

  console.log(`[evals] Sampled ${samples.length} chats`)

  // Step 2: Transform into Phoenix dataset examples
  const examples = samples.map((sample, i) => ({
    id: `${sample.chatId}-${i}`,
    updatedAt: sample.createdAt,
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

  // Step 3: Run experiment with evaluators
  // The task returns the model's actual answer — we're evaluating
  // existing answers, not generating new ones.
  const experimentName = `polymorph-eval-${new Date().toISOString().slice(0, 13).replace('T', '-')}h`
  console.log(`[evals] Running experiment: ${experimentName}`)

  const experiment = await withRetry(
    () =>
      runExperiment({
        experimentName,
        experimentDescription: `Automated eval of ${samples.length} chats from the last ${config.lookbackHours}h`,
        dataset: examples,
        task: async example => {
          return (example.output as Record<string, unknown>)?.answer ?? ''
        },
        evaluators: [
          faithfulnessEvaluator,
          relevanceEvaluator,
          responseQualityEvaluator
        ],
        concurrency: 3
      }),
    { maxAttempts: 3, baseDelayMs: 5000 }
  )

  // Step 4: Report results
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`[evals] Experiment complete in ${elapsed}s`)
  console.log(`[evals] Experiment ID: ${experiment.id}`)
  console.log(`[evals] Results available in Phoenix UI`)

  // Step 5: Clean exit
  await closeDb()
  console.log('[evals] Done.')
}

/**
 * Format search results + citations into a text context block
 * for evaluators to judge against.
 */
function formatContext(sample: ChatSample): string {
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
