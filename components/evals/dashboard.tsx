import { formatDistanceToNow } from 'date-fns'

import type {
  CapabilityDashboardData,
  EvalsDashboardData
} from '@/lib/evals/types'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

import { EvaluatorBars } from './evaluator-bars'
import { ScoreRing } from './score-ring'
import { TrendChart } from './trend-chart'

function computeDelta(
  latest: number | null | undefined,
  previous: number | null | undefined
) {
  if (latest == null || previous == null) {
    return null
  }

  return latest - previous
}

function EmptySuiteCard({
  title,
  description
}: {
  title: string
  description: string
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-muted-foreground">
        <p>{description}</p>
        <p>
          This section stays empty until the evals service records at least one
          persisted summary row for this suite.
        </p>
      </CardContent>
    </Card>
  )
}

function SuiteSection({
  heading,
  data
}: {
  heading: string
  data: CapabilityDashboardData
}) {
  if (!data.latest) {
    return (
      <EmptySuiteCard
        title={`${heading} — no summaries yet`}
        description={`Run the ${heading.toLowerCase()} eval suite to populate this section.`}
      />
    )
  }

  const overallDelta = computeDelta(
    data.latest.overallScore,
    data.previous?.overallScore
  )

  return (
    <section className="space-y-6">
      <h2 className="text-xl font-semibold">{heading}</h2>
      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <ScoreRing
          label="Overall"
          score={data.latest.overallScore}
          passRate={data.latest.passRate}
          delta={overallDelta}
        />
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Latest Run</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Experiment</p>
              <p className="font-medium">{data.latest.experimentName}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Dataset</p>
              <p className="font-medium">{data.latest.datasetName}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Cases</p>
              <p className="font-medium tabular-nums">
                {data.latest.totalCases}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Updated</p>
              <p className="font-medium">
                {data.lastUpdated
                  ? formatDistanceToNow(new Date(data.lastUpdated), {
                      addSuffix: true
                    })
                  : 'Unknown'}
              </p>
            </div>
            {data.latest.phoenixUrl ? (
              <div className="space-y-1 sm:col-span-2">
                <p className="text-sm text-muted-foreground">Phoenix</p>
                <a
                  className="text-sm font-medium text-primary underline underline-offset-4"
                  href={data.latest.phoenixUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  Open experiment details
                </a>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <TrendChart title={`${heading} Trend`} trend={data.trend} />
      <EvaluatorBars evaluatorScores={data.latest.evaluatorScores} />
    </section>
  )
}

export default function EvalsDashboard({ data }: { data: EvalsDashboardData }) {
  if (!data.capability.latest && !data.trafficMonitor.latest) {
    return (
      <EmptySuiteCard
        title="No eval summaries yet"
        description="Run the capability or traffic-monitor eval suite to populate the admin dashboard."
      />
    )
  }

  return (
    <div className="space-y-10">
      <SuiteSection heading="Capability" data={data.capability} />
      <SuiteSection heading="Traffic Monitor" data={data.trafficMonitor} />
    </div>
  )
}
