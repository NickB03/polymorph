import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { EvalSummaryRow } from '@/lib/evals/types'

const mockWithRLS = vi.hoisted(() => vi.fn())

vi.mock('@/lib/db/with-rls', () => ({
  withRLS: mockWithRLS
}))

import {
  buildCapabilityDashboardData,
  buildTrafficMonitorDashboardData,
  getEvalsDashboard,
  toSnapshot
} from '@/lib/evals/queries'

const sampleRow = (
  overrides: Partial<EvalSummaryRow> = {}
): EvalSummaryRow => ({
  id: 'summary-1',
  suite: 'capability',
  experimentName: 'exp-1',
  datasetName: 'dataset-1',
  passRateBps: 9100,
  thresholdBps: 8000,
  thresholdBreached: false,
  failedEvaluators: [],
  evaluatorScores: { faithfulness: 0.9, relevance: 0.8 },
  totalCases: 20,
  attemptedCases: 20,
  failedCases: 0,
  phoenixUrl: 'https://phoenix.example.com/1',
  createdAt: new Date('2026-04-09T12:00:00.000Z'),
  ...overrides
})

describe('buildCapabilityDashboardData', () => {
  it('converts basis points to passRate and orders latest/previous/trend correctly', () => {
    const data = buildCapabilityDashboardData([
      sampleRow(),
      sampleRow({
        id: 'summary-2',
        experimentName: 'exp-2',
        datasetName: 'dataset-2',
        passRateBps: 8700,
        evaluatorScores: { faithfulness: 0.8, relevance: 0.6 },
        totalCases: 18,
        phoenixUrl: 'https://phoenix.example.com/2',
        createdAt: new Date('2026-04-09T13:00:00.000Z')
      })
    ])

    expect(data.latest?.experimentName).toBe('exp-2')
    expect(data.latest?.passRate).toBe(0.87)
    expect(data.latest?.threshold).toBe(0.8)
    expect(data.previous?.experimentName).toBe('exp-1')
    expect(data.trend.map(point => point.createdAt)).toEqual([
      '2026-04-09T12:00:00.000Z',
      '2026-04-09T13:00:00.000Z'
    ])
    expect(data.lastUpdated).toBe('2026-04-09T13:00:00.000Z')
  })

  it('computes overallScore from evaluator scores and falls back to zero', () => {
    const data = buildCapabilityDashboardData([
      sampleRow({
        passRateBps: 5000,
        thresholdBps: null,
        evaluatorScores: {},
        phoenixUrl: null
      })
    ])

    expect(data.latest?.overallScore).toBe(0)
  })

  it('excludes null evaluator scores from the mean instead of coercing to zero', () => {
    const row: EvalSummaryRow = {
      id: 'row-null',
      suite: 'capability',
      experimentName: 'exp-null',
      datasetName: 'ds-null',
      passRateBps: 9000,
      thresholdBps: 8000,
      thresholdBreached: false,
      failedEvaluators: [],
      // faithfulness legitimately returned null (e.g. expectsRefusal case).
      // Historical bug: null was averaged as 0, dragging the mean from 0.9 to 0.6.
      evaluatorScores: {
        prechecks: 0.9,
        relevance: 0.9,
        response_quality: 0.9,
        safety: 0.9,
        faithfulness: null as unknown as number
      },
      totalCases: 1,
      attemptedCases: 1,
      failedCases: 0,
      phoenixUrl: null,
      createdAt: new Date('2026-04-22T00:00:00Z')
    }

    const data = buildCapabilityDashboardData([row])

    // 4 real scores, all 0.9 → mean is 0.9, not (0.9*4 + 0)/5 = 0.72.
    expect(data.latest?.overallScore).toBeCloseTo(0.9, 5)
  })

  it('returns 0 when every evaluator score is null', () => {
    const row: EvalSummaryRow = {
      id: 'row-all-null',
      suite: 'capability',
      experimentName: 'exp-all-null',
      datasetName: 'ds-all-null',
      passRateBps: 0,
      thresholdBps: 8000,
      thresholdBreached: true,
      failedEvaluators: ['faithfulness'],
      evaluatorScores: {
        faithfulness: null as unknown as number
      },
      totalCases: 1,
      attemptedCases: 1,
      failedCases: 1,
      phoenixUrl: null,
      createdAt: new Date('2026-04-22T00:00:00Z')
    }

    const data = buildCapabilityDashboardData([row])

    expect(data.latest?.overallScore).toBe(0)
  })

  it('surfaces attempted/failed/dropRate on the snapshot', () => {
    const row: EvalSummaryRow = {
      id: 'r-1',
      suite: 'traffic-monitor',
      experimentName: 'exp',
      datasetName: 'ds',
      passRateBps: 9000,
      thresholdBps: 8000,
      thresholdBreached: false,
      failedEvaluators: [],
      evaluatorScores: { faithfulness: 0.9 },
      totalCases: 7,
      attemptedCases: 10,
      failedCases: 3,
      phoenixUrl: null,
      createdAt: new Date('2026-04-28T00:00:00Z')
    }
    const snapshot = toSnapshot(row)
    expect(snapshot.attemptedCases).toBe(10)
    expect(snapshot.failedCases).toBe(3)
    expect(snapshot.dropRate).toBeCloseTo(0.3, 5)
  })
})

describe('buildTrafficMonitorDashboardData', () => {
  it('behaves identically to buildCapabilityDashboardData for traffic-monitor rows', () => {
    const rows = [
      sampleRow({
        id: 'tm-1',
        experimentName: 'tm-exp-1',
        passRateBps: 9000,
        createdAt: new Date('2026-04-13T00:00:00.000Z')
      }),
      sampleRow({
        id: 'tm-2',
        experimentName: 'tm-exp-2',
        passRateBps: 9500,
        createdAt: new Date('2026-04-13T06:00:00.000Z')
      })
    ]

    const trafficData = buildTrafficMonitorDashboardData(rows)
    const capabilityData = buildCapabilityDashboardData(rows)

    expect(trafficData).toEqual(capabilityData)
    expect(trafficData.latest?.experimentName).toBe('tm-exp-2')
    expect(trafficData.previous?.experimentName).toBe('tm-exp-1')
  })
})

describe('getEvalsDashboard', () => {
  beforeEach(() => {
    mockWithRLS.mockReset()
  })

  it('returns capability and trafficMonitor sections under one RLS transaction', async () => {
    const capabilityRow = sampleRow({
      id: 'cap-1',
      experimentName: 'cap-exp-1',
      passRateBps: 9100,
      createdAt: new Date('2026-04-12T12:00:00.000Z')
    })
    const trafficRow = sampleRow({
      id: 'tm-1',
      suite: 'traffic-monitor',
      experimentName: 'tm-exp-1',
      passRateBps: 8800,
      createdAt: new Date('2026-04-13T12:00:00.000Z')
    })
    const regressionRow = sampleRow({
      id: 'reg-1',
      suite: 'regression',
      experimentName: 'reg-exp-1',
      passRateBps: 8600,
      createdAt: new Date('2026-04-13T06:00:00.000Z')
    })

    const rowsBySuite: Record<string, EvalSummaryRow[]> = {
      capability: [capabilityRow],
      regression: [regressionRow],
      'traffic-monitor': [trafficRow]
    }

    const allRecent = [trafficRow, regressionRow, capabilityRow]
    const limitCalls: number[] = []

    const buildLimitChain = (rows: EvalSummaryRow[]) => ({
      orderBy: vi.fn(() => ({
        limit: vi.fn((limit: number) => {
          limitCalls.push(limit)
          return rows
        })
      }))
    })

    let suiteCallIndex = 0
    const select = vi.fn(() => ({
      from: vi.fn(() => ({
        // selectSuiteRows: select(...).from(...).where(...).orderBy(...).limit(...)
        where: vi.fn(() => {
          const suite = ['capability', 'regression', 'traffic-monitor'][
            suiteCallIndex++
          ]
          return buildLimitChain(rowsBySuite[suite] ?? [])
        }),
        // selectRecentRuns: select(...).from(...).orderBy(...).limit(...)
        orderBy: vi.fn(() => ({
          limit: vi.fn((limit: number) => {
            limitCalls.push(limit)
            return allRecent
          })
        }))
      }))
    }))

    const tx = { select } as never

    mockWithRLS.mockImplementation(
      async (_userId: string, callback: (tx: never) => Promise<unknown>) =>
        callback(tx)
    )

    const data = await getEvalsDashboard('user-1')

    expect(mockWithRLS).toHaveBeenCalledTimes(1)
    expect(mockWithRLS).toHaveBeenCalledWith('user-1', expect.any(Function))
    expect(data.capability.latest?.experimentName).toBe('cap-exp-1')
    expect(data.regression.latest?.experimentName).toBe('reg-exp-1')
    expect(data.trafficMonitor.latest?.experimentName).toBe('tm-exp-1')
    expect(data.recentRuns.map(r => r.experimentName)).toEqual([
      'tm-exp-1',
      'reg-exp-1',
      'cap-exp-1'
    ])
    expect(limitCalls).toEqual([12, 12, 12, 10])
  })
})
