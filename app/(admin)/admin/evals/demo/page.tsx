import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Filter,
  Layers,
  LineChart,
  Search,
  Sparkles,
  TrendingDown,
  TrendingUp
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'

export const dynamic = 'force-dynamic'

type Trend = 'up' | 'down' | 'flat'

interface KpiTile {
  label: string
  value: string
  delta: string
  trend: Trend
  helper: string
}

interface SuiteRow {
  evaluator: string
  capability: number
  traffic: number
  delta: number
}

interface ActivityEntry {
  id: string
  suite: 'Capability' | 'Traffic Monitor'
  title: string
  passRate: string
  delta: string
  trend: Trend
  timeAgo: string
}

const KPI_TILES: KpiTile[] = [
  {
    label: 'Pass Rate',
    value: '94.2%',
    delta: '+1.8%',
    trend: 'up',
    helper: 'vs. previous run'
  },
  {
    label: 'Overall Score',
    value: '0.873',
    delta: '+0.04',
    trend: 'up',
    helper: 'avg across evaluators'
  },
  {
    label: 'Sample Count',
    value: '1,284',
    delta: '+126',
    trend: 'up',
    helper: 'last 24h'
  },
  {
    label: 'Freshness',
    value: '12 min',
    delta: 'on schedule',
    trend: 'flat',
    helper: 'last successful run'
  }
]

const COMPARISON_ROWS: SuiteRow[] = [
  { evaluator: 'Faithfulness', capability: 0.92, traffic: 0.88, delta: -0.04 },
  { evaluator: 'Relevance', capability: 0.89, traffic: 0.91, delta: 0.02 },
  {
    evaluator: 'Response Quality',
    capability: 0.86,
    traffic: 0.83,
    delta: -0.03
  },
  { evaluator: 'Safety', capability: 0.99, traffic: 0.99, delta: 0.0 },
  {
    evaluator: 'Citation Accuracy',
    capability: 0.81,
    traffic: 0.74,
    delta: -0.07
  }
]

const ACTIVITY: ActivityEntry[] = [
  {
    id: 'a1',
    suite: 'Capability',
    title: 'Daily capability suite',
    passRate: '94.2%',
    delta: '+1.8%',
    trend: 'up',
    timeAgo: '12 min ago'
  },
  {
    id: 'a2',
    suite: 'Traffic Monitor',
    title: 'Hourly traffic sample',
    passRate: '91.6%',
    delta: '−0.4%',
    trend: 'down',
    timeAgo: '1 h ago'
  },
  {
    id: 'a3',
    suite: 'Capability',
    title: 'Daily capability suite',
    passRate: '92.4%',
    delta: '+0.6%',
    trend: 'up',
    timeAgo: '1 d ago'
  }
]

function deltaClass(trend: Trend) {
  if (trend === 'up') return 'text-emerald-600 dark:text-emerald-400'
  if (trend === 'down') return 'text-rose-600 dark:text-rose-400'
  return 'text-muted-foreground'
}

function DeltaIcon({ trend }: { trend: Trend }) {
  if (trend === 'up') return <TrendingUp className="size-3.5" />
  if (trend === 'down') return <TrendingDown className="size-3.5" />
  return <ArrowRight className="size-3.5" />
}

function Sparkline({ trend }: { trend: Trend }) {
  const path =
    trend === 'down'
      ? 'M0 8 L15 10 L30 14 L45 12 L60 18 L75 22 L90 24'
      : trend === 'flat'
        ? 'M0 16 L15 14 L30 17 L45 15 L60 16 L75 14 L90 16'
        : 'M0 22 L15 18 L30 20 L45 14 L60 12 L75 8 L90 6'
  const stroke =
    trend === 'down'
      ? 'stroke-rose-500'
      : trend === 'flat'
        ? 'stroke-muted-foreground/60'
        : 'stroke-emerald-500'
  return (
    <svg viewBox="0 0 90 28" className="h-7 w-full">
      <path
        d={path}
        fill="none"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={stroke}
      />
    </svg>
  )
}

function SectionHeader({
  icon: Icon,
  title,
  description
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Icon className="size-4 text-muted-foreground" />
          <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        </div>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}

function Toolbar() {
  return (
    <Card className="shadow-sm">
      <CardContent className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search evaluators, runs..."
            className="pl-9"
            disabled
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2">
            <Filter className="size-4" />
            All suites
            <ChevronDown className="size-3.5 opacity-60" />
          </Button>
          <Button variant="outline" size="sm" className="gap-2">
            <CalendarDays className="size-4" />
            Last 7 days
            <ChevronDown className="size-3.5 opacity-60" />
          </Button>
          <Button variant="outline" size="sm" className="gap-2">
            <Layers className="size-4" />
            Health Monitor
            <ChevronDown className="size-3.5 opacity-60" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function KpiCard({ tile }: { tile: KpiTile }) {
  return (
    <Card className="shadow-sm transition-shadow hover:shadow-md">
      <CardHeader className="space-y-1 p-4 pb-2 sm:p-5 sm:pb-2">
        <CardDescription className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {tile.label}
        </CardDescription>
        <CardTitle className="text-3xl font-semibold tracking-tight">
          {tile.value}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0 sm:p-5 sm:pt-0">
        <div
          className={`inline-flex items-center gap-1 text-xs font-medium ${deltaClass(tile.trend)}`}
        >
          <DeltaIcon trend={tile.trend} />
          {tile.delta}
          <span className="ml-1 text-muted-foreground font-normal">
            {tile.helper}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

function TrendCard({
  title,
  helper,
  trend
}: {
  title: string
  helper: string
  trend: Trend
}) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="p-4 pb-2 sm:p-5 sm:pb-2">
        <CardDescription className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {title}
        </CardDescription>
        <CardTitle className="text-sm font-medium text-foreground">
          {helper}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0 sm:p-5 sm:pt-0">
        <Sparkline trend={trend} />
      </CardContent>
    </Card>
  )
}

function SuiteSummaryCard({
  suite,
  passRate,
  score,
  delta,
  trend
}: {
  suite: string
  passRate: string
  score: string
  delta: string
  trend: Trend
}) {
  return (
    <Card className="shadow-sm transition-shadow hover:shadow-md">
      <CardHeader className="p-5 pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="space-y-1">
            <CardDescription className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {suite}
            </CardDescription>
            <CardTitle className="text-2xl font-semibold tracking-tight">
              {passRate}
            </CardTitle>
          </div>
          <Badge
            variant="outline"
            className={`${deltaClass(trend)} gap-1 border-current/20 bg-current/5`}
          >
            <DeltaIcon trend={trend} />
            {delta}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-5 pt-0">
        <div className="text-sm text-muted-foreground">
          Overall score{' '}
          <span className="font-medium text-foreground">{score}</span>
        </div>
        <Sparkline trend={trend} />
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-between gap-2"
        >
          View details
          <ArrowUpRight className="size-3.5" />
        </Button>
      </CardContent>
    </Card>
  )
}

function ComparisonTable() {
  return (
    <Card className="shadow-sm">
      <CardHeader className="p-5 pb-3">
        <CardTitle className="text-base font-semibold">
          Evaluator comparison
        </CardTitle>
        <CardDescription className="text-sm">
          Capability vs Traffic Monitor scores across the 5 LLM-judge
          evaluators.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="grid grid-cols-[1.4fr_repeat(3,_minmax(0,_1fr))_auto] items-center gap-x-4 border-y bg-muted/30 px-5 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <span>Evaluator</span>
          <span className="text-right">Capability</span>
          <span className="text-right">Traffic</span>
          <span className="text-right">Δ</span>
          <span className="w-24 text-right">Action</span>
        </div>
        <ul>
          {COMPARISON_ROWS.map((row, idx) => {
            const trend: Trend =
              row.delta > 0 ? 'up' : row.delta < 0 ? 'down' : 'flat'
            const formatted =
              row.delta === 0
                ? '0.00'
                : `${row.delta > 0 ? '+' : '−'}${Math.abs(row.delta).toFixed(2)}`
            return (
              <li
                key={row.evaluator}
                className={`grid grid-cols-[1.4fr_repeat(3,_minmax(0,_1fr))_auto] items-center gap-x-4 px-5 py-3 text-sm ${idx !== COMPARISON_ROWS.length - 1 ? 'border-b' : ''}`}
              >
                <span className="font-medium">{row.evaluator}</span>
                <span className="text-right tabular-nums">
                  {row.capability.toFixed(2)}
                </span>
                <span className="text-right tabular-nums">
                  {row.traffic.toFixed(2)}
                </span>
                <span
                  className={`text-right text-xs font-medium tabular-nums ${deltaClass(trend)}`}
                >
                  {formatted}
                </span>
                <div className="flex w-24 justify-end">
                  <Button variant="ghost" size="sm" className="gap-1 text-xs">
                    View
                    <ArrowUpRight className="size-3" />
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}

function ActivityCard({ entry }: { entry: ActivityEntry }) {
  return (
    <Card className="shadow-sm transition-shadow hover:shadow-md">
      <CardContent className="flex items-center justify-between gap-4 p-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex size-9 items-center justify-center rounded-full bg-muted">
            <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="min-w-0 space-y-0.5">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-[10px] uppercase">
                {entry.suite}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {entry.timeAgo}
              </span>
            </div>
            <p className="truncate text-sm font-medium">{entry.title}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-lg font-semibold tabular-nums">
              {entry.passRate}
            </div>
            <div
              className={`flex items-center justify-end gap-1 text-xs font-medium ${deltaClass(entry.trend)}`}
            >
              <DeltaIcon trend={entry.trend} />
              {entry.delta}
            </div>
          </div>
          <Button variant="ghost" size="sm" className="gap-1">
            View
            <ArrowUpRight className="size-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default function EvalsDemoPage() {
  return (
    <div className="flex flex-1 min-h-0 min-w-0 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 pb-12 pt-8 sm:px-6 lg:px-8">
        <header className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1">
              <Sparkles className="size-3" />
              Demo
            </Badge>
            <span className="text-xs text-muted-foreground">
              Mock data — design preview
            </span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Evaluations</h1>
          <p className="text-sm text-muted-foreground">
            Capability suite and Traffic Monitor at a glance. Switch views,
            filter by suite, and drill into any run.
          </p>
        </header>

        <Toolbar />

        <section className="space-y-4">
          <SectionHeader
            icon={Activity}
            title="System health"
            description="Latest run vitals across all suites."
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {KPI_TILES.map(tile => (
              <KpiCard key={tile.label} tile={tile} />
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <SectionHeader
            icon={LineChart}
            title="Trends over time"
            description="Last 7 days of pass rate and overall score."
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <TrendCard title="Pass rate" helper="Capability suite" trend="up" />
            <TrendCard
              title="Pass rate"
              helper="Traffic Monitor"
              trend="down"
            />
            <TrendCard title="Overall score" helper="Combined" trend="flat" />
          </div>
        </section>

        <section className="space-y-4">
          <SectionHeader
            icon={Layers}
            title="Suite comparison"
            description="Side-by-side health for Capability and Traffic Monitor."
          />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <SuiteSummaryCard
              suite="Capability"
              passRate="94.2%"
              score="0.873"
              delta="+1.8%"
              trend="up"
            />
            <SuiteSummaryCard
              suite="Traffic Monitor"
              passRate="91.6%"
              score="0.842"
              delta="−0.4%"
              trend="down"
            />
          </div>
          <ComparisonTable />
        </section>

        <section className="space-y-4">
          <SectionHeader
            icon={Activity}
            title="Recent activity"
            description="Latest eval runs in reverse chronological order."
          />
          <div className="grid grid-cols-1 gap-3">
            {ACTIVITY.map(entry => (
              <ActivityCard key={entry.id} entry={entry} />
            ))}
          </div>
        </section>

        <Separator />
        <footer className="text-xs text-muted-foreground">
          Demo only · No live data · /admin/evals/demo
        </footer>
      </div>
    </div>
  )
}
