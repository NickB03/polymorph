import { tool } from 'ai'
import { z } from 'zod'

export const competitorResearchToolName = 'competitorResearch' as const

export const competitorResearchInputSchema = z.object({
  market: z.string().min(1),
  competitors: z.array(z.string().min(1)).min(2).max(6),
  dimensions: z.array(z.string().min(1)).min(1).max(8)
})

export const competitorResearchOutputSchema = z.object({
  summary: z.string().min(1),
  cards: z.array(
    z.object({
      competitor: z.string().min(1),
      strengths: z.array(z.string().min(1)),
      weaknesses: z.array(z.string().min(1))
    })
  ),
  matrix: z.array(z.record(z.string(), z.string()))
})

export type CompetitorResearchInput = z.infer<
  typeof competitorResearchInputSchema
>
export type CompetitorResearchOutput = z.infer<
  typeof competitorResearchOutputSchema
>

type ToolExecuteContext = {
  abortSignal?: AbortSignal
}

type ExecutableTool = {
  execute?: (input: any, context: any) => unknown
}

type SearchResultLike = {
  title?: unknown
  url?: unknown
  content?: unknown
  description?: unknown
  snippet?: unknown
}

type CompetitorEvidence = {
  competitor: string
  snippets: string[]
  fetchedText?: string
}

type CreateCompetitorResearchToolArgs = {
  searchTool: ExecutableTool
  fetchTool: ExecutableTool
}

async function collectFinalToolResult(result: unknown): Promise<unknown> {
  const resolved = await result

  if (
    resolved &&
    typeof resolved === 'object' &&
    Symbol.asyncIterator in resolved
  ) {
    let finalChunk: unknown
    for await (const chunk of resolved as AsyncIterable<unknown>) {
      finalChunk = chunk
    }
    return finalChunk
  }

  return resolved
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function getSearchResults(value: unknown): SearchResultLike[] {
  if (
    !value ||
    typeof value !== 'object' ||
    !('results' in value) ||
    !Array.isArray((value as { results?: unknown }).results)
  ) {
    return []
  }

  return (value as { results: unknown[] }).results.filter(
    result => result && typeof result === 'object'
  ) as SearchResultLike[]
}

function getResultSnippet(result: SearchResultLike): string | undefined {
  return (
    getString(result.content) ??
    getString(result.description) ??
    getString(result.snippet) ??
    getString(result.title)
  )
}

function getFetchedText(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') return undefined

  const resultText = getSearchResults(value)
    .map(getResultSnippet)
    .filter(Boolean)
    .join(' ')

  return (
    getString(resultText) ??
    getString((value as { content?: unknown }).content) ??
    getString((value as { text?: unknown }).text) ??
    getString((value as { markdown?: unknown }).markdown)
  )
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value
  return `${value.slice(0, maxLength - 1).trim()}...`
}

function buildEvidenceStatement(
  evidence: CompetitorEvidence,
  dimension: string
): string {
  const haystack = `${evidence.snippets.join(' ')} ${evidence.fetchedText ?? ''}`
  if (!haystack.trim()) {
    return `Needs fresh validation for ${dimension}`
  }

  return truncateText(haystack.replace(/\s+/g, ' '), 140)
}

async function gatherCompetitorEvidence(
  input: CompetitorResearchInput,
  tools: CreateCompetitorResearchToolArgs,
  context: ToolExecuteContext
): Promise<CompetitorEvidence[]> {
  const evidence: CompetitorEvidence[] = []

  for (const competitor of input.competitors) {
    const query = [
      input.market,
      competitor,
      input.dimensions.join(' '),
      'competitor comparison'
    ].join(' ')

    const searchOutput = await collectFinalToolResult(
      tools.searchTool.execute?.(
        {
          query,
          type: 'optimized',
          max_results: 5
        },
        context
      )
    )
    const results = getSearchResults(searchOutput)
    const firstUrl = getString(results[0]?.url)
    let fetchedOutput: unknown
    if (firstUrl) {
      try {
        fetchedOutput = await collectFinalToolResult(
          tools.fetchTool.execute?.({ url: firstUrl, type: 'regular' }, context)
        )
      } catch {
        fetchedOutput = undefined
      }
    }

    evidence.push({
      competitor,
      snippets: results.map(getResultSnippet).filter(Boolean) as string[],
      fetchedText: getFetchedText(fetchedOutput)
    })
  }

  return evidence
}

function buildCompetitorResearchOutput(
  input: CompetitorResearchInput,
  evidence: CompetitorEvidence[]
): CompetitorResearchOutput {
  const cards = evidence.map(item => {
    const primaryDimension = input.dimensions[0] ?? 'positioning'
    const secondaryDimension = input.dimensions[1] ?? 'execution risk'
    const evidenceText = buildEvidenceStatement(item, primaryDimension)

    return {
      competitor: item.competitor,
      strengths: [
        `${primaryDimension}: ${evidenceText}`,
        `Coverage: reviewed ${item.snippets.length} live search result${
          item.snippets.length === 1 ? '' : 's'
        }`
      ],
      weaknesses: [`${secondaryDimension}: validate against primary sources`]
    }
  })

  const matrix = evidence.map(item => {
    const row: Record<string, string> = {
      competitor: item.competitor
    }

    for (const dimension of input.dimensions) {
      row[dimension] = buildEvidenceStatement(item, dimension)
    }

    return row
  })

  return {
    summary: `Compared ${input.competitors.length} competitors in ${input.market} across ${input.dimensions.join(', ')} using live search and fetch results.`,
    cards,
    matrix
  }
}

export function createCompetitorResearchTool(
  args: CreateCompetitorResearchToolArgs
) {
  return tool({
    description:
      'Run live competitor research for structured market, vendor, company, or product comparisons. Searches each competitor, fetches the top source when available, and returns summary cards plus a comparison matrix.',
    inputSchema: competitorResearchInputSchema,
    execute: async (input, context) => {
      const parsedInput = competitorResearchInputSchema.parse(input)
      const evidence = await gatherCompetitorEvidence(
        parsedInput,
        args,
        context ?? {}
      )
      return competitorResearchOutputSchema.parse(
        buildCompetitorResearchOutput(parsedInput, evidence)
      )
    }
  })
}
