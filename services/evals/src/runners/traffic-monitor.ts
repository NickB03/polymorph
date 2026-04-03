import { openai } from '@ai-sdk/openai'

import { config } from '../config'
import { createFaithfulnessExperimentEvaluator } from '../evaluators/faithfulness'
import { createRelevanceExperimentEvaluator } from '../evaluators/relevance'
import { createResponseQualityExperimentEvaluator } from '../evaluators/response-quality'
import { createDeterministicPrecheckEvaluator } from '../prechecks'
import { type ChatSample, sampleRecentChats } from '../sampler'

import {
  buildDatasetExamples,
  buildExperimentEvaluators,
  buildExperimentTask,
  createDatasetAndExperiment
} from './shared'

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

export async function runTrafficMonitorSuite() {
  console.log('[evals] Sampling recent chats...')
  const samples = await sampleRecentChats()

  if (samples.length === 0) {
    console.log('[evals] No chats found in lookback window. Exiting.')
    return
  }

  console.log(`[evals] Sampled ${samples.length} chats`)

  const cases = samples.map((sample, index) => ({
    id: `traffic-${index + 1}`,
    suite: 'traffic-monitor' as const,
    conversation: [
      {
        role: 'user' as const,
        parts: [{ type: 'text' as const, text: sample.userQuery }]
      }
    ],
    searchMode: 'chat' as const,
    modelType: 'speed' as const,
    tags: ['traffic-monitor'],
    requiresTextAnswer: true,
    requiresCitations: sample.citations.length > 0,
    allowsInteractiveOnly: false
  }))

  const results = samples.map(sample => ({
    answerText: sample.modelAnswer,
    citations: sample.citations,
    searchResults: sample.searchResults,
    toolNames: [],
    usedInteractiveOnlyOutput: false,
    modelId: '',
    durationMs: 0
  }))

  const examples = buildDatasetExamples(cases, results)
  const model = openai(config.judgeModel)
  const evaluators = buildExperimentEvaluators(
    createDeterministicPrecheckEvaluator,
    createFaithfulnessExperimentEvaluator,
    createRelevanceExperimentEvaluator,
    createResponseQualityExperimentEvaluator,
    model,
    {
      requiresTextAnswer: true,
      requiresCitations: samples.some(sample => sample.citations.length > 0),
      allowsInteractiveOnly: false
    }
  )

  const { datasetName, experimentName, experiment } =
    await createDatasetAndExperiment({
      suite: 'traffic-monitor',
      examples,
      evaluators,
      task: buildExperimentTask()
    })

  console.log(`[evals] Traffic monitor dataset: ${datasetName}`)
  console.log(`[evals] Traffic monitor experiment: ${experimentName}`)
  console.log(`[evals] Traffic monitor experiment ID: ${experiment.id}`)
}
