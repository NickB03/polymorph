'use client'

import { z } from 'zod'

const competitorResearchResultSchema = z.object({
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

export type CompetitorResearchResultProps = z.infer<
  typeof competitorResearchResultSchema
>

export function safeParseCompetitorResearchResult(
  output: unknown
): CompetitorResearchResultProps | null {
  const parsed = competitorResearchResultSchema.safeParse(output)
  return parsed.success ? parsed.data : null
}

function getMatrixColumns(
  matrix: CompetitorResearchResultProps['matrix']
): string[] {
  const columns = new Set<string>()

  for (const row of matrix) {
    for (const key of Object.keys(row)) {
      columns.add(key)
    }
  }

  return [
    'competitor',
    ...Array.from(columns).filter(column => column !== 'competitor')
  ]
}

export function CompetitorResearchResult({
  summary,
  cards,
  matrix
}: CompetitorResearchResultProps) {
  const columns = getMatrixColumns(matrix)

  return (
    <section
      aria-label="Competitor research result"
      className="flex w-full max-w-3xl flex-col gap-4 rounded-md border bg-background p-4"
    >
      <div className="space-y-1">
        <p className="text-xs font-medium tracking-normal text-muted-foreground uppercase">
          Competitor Research
        </p>
        <p className="text-sm leading-relaxed text-foreground">{summary}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {cards.map(card => (
          <article
            key={card.competitor}
            className="rounded-md border bg-muted/30 p-3"
          >
            <h3 className="text-sm font-semibold">{card.competitor}</h3>
            <div className="mt-3 grid gap-3 text-xs leading-relaxed">
              <div>
                <p className="font-medium text-muted-foreground">Strengths</p>
                <ul className="mt-1 list-disc space-y-1 pl-4">
                  {card.strengths.map(strength => (
                    <li key={strength}>{strength}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="font-medium text-muted-foreground">Risks</p>
                <ul className="mt-1 list-disc space-y-1 pl-4">
                  {card.weaknesses.map(weakness => (
                    <li key={weakness}>{weakness}</li>
                  ))}
                </ul>
              </div>
            </div>
          </article>
        ))}
      </div>

      {columns.length > 0 && (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full min-w-[520px] border-collapse text-left text-xs">
            <thead className="bg-muted/60 text-muted-foreground">
              <tr>
                {columns.map(column => (
                  <th key={column} className="px-3 py-2 font-medium">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.map((row, index) => (
                <tr
                  key={`${row.competitor ?? 'competitor'}-${index}`}
                  className="border-t"
                >
                  {columns.map(column => (
                    <td key={column} className="px-3 py-2 align-top">
                      {row[column] ?? ''}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
