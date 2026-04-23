import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { EvalSummaryRow } from './types'

const mockWithRLS = vi.hoisted(() => vi.fn())

vi.mock('@/lib/db/with-rls', () => ({
  withRLS: mockWithRLS
}))

import { DEFAULT_TEMPLATE_ID } from './layout/templates'
import {
  buildCapabilityDashboardData,
  buildTrafficMonitorDashboardData,
  getEvalsDashboard,
  getEvalsDashboardWithLayout,
  getPreferredEvalsLayout
} from './queries'

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
      phoenixUrl: null,
      createdAt: new Date('2026-04-22T00:00:00Z')
    }

    const data = buildCapabilityDashboardData([row])

    expect(data.latest?.overallScore).toBe(0)
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

    const buildChain = (suite: string) => ({
      orderBy: vi.fn(() => ({
        limit: vi.fn(() => rowsBySuite[suite] ?? [])
      }))
    })

    let callIndex = 0
    const select = vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => {
          const suite = ['capability', 'regression', 'traffic-monitor'][
            callIndex++
          ]
          return buildChain(suite)
        })
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
  })
})

describe('getPreferredEvalsLayout', () => {
  beforeEach(() => {
    mockWithRLS.mockReset()
  })

  const stubTxReturning = (rows: Array<{ preferredLayout: string }>) =>
    ({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => rows
          })
        })
      })
    }) as never

  it('returns the stored preference when a row exists', async () => {
    mockWithRLS.mockImplementation(async (_userId, cb) =>
      cb(stubTxReturning([{ preferredLayout: 'a' }]))
    )

    const result = await getPreferredEvalsLayout('user-1')
    expect(result).toBe('a')
    expect(mockWithRLS).toHaveBeenCalledWith('user-1', expect.any(Function))
  })

  it('returns DEFAULT_TEMPLATE_ID when no row exists', async () => {
    mockWithRLS.mockImplementation(async (_userId, cb) =>
      cb(stubTxReturning([]))
    )

    const result = await getPreferredEvalsLayout('user-1')
    expect(result).toBe(DEFAULT_TEMPLATE_ID)
  })

  it('falls back to default on malformed values', async () => {
    mockWithRLS.mockImplementation(async (_userId, cb) =>
      cb(stubTxReturning([{ preferredLayout: 'zzz' }]))
    )

    const result = await getPreferredEvalsLayout('user-1')
    expect(result).toBe(DEFAULT_TEMPLATE_ID)
  })
})

describe('getEvalsDashboardWithLayout', () => {
  beforeEach(() => {
    mockWithRLS.mockReset()
  })

  it('returns data and layout from a single RLS transaction', async () => {
    const capRow = sampleRow({
      id: 'cap-1',
      experimentName: 'cap-exp',
      createdAt: new Date('2026-04-14T12:00:00.000Z')
    })
    const trafRow = sampleRow({
      id: 'traf-1',
      suite: 'traffic-monitor',
      experimentName: 'traf-exp',
      createdAt: new Date('2026-04-14T13:00:00.000Z')
    })
    const regRow = sampleRow({
      id: 'reg-1',
      suite: 'regression',
      experimentName: 'reg-exp',
      createdAt: new Date('2026-04-14T12:30:00.000Z')
    })

    let selectCall = 0
    const tx = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => {
            selectCall++
            if (selectCall <= 3) {
              // Suite queries (capability, regression, traffic-monitor)
              return {
                orderBy: vi.fn(() => ({
                  limit: vi.fn(() =>
                    selectCall === 1
                      ? [capRow]
                      : selectCall === 2
                        ? [regRow]
                        : [trafRow]
                  )
                }))
              }
            }
            // Preference query
            return {
              limit: vi.fn(() => [{ preferredLayout: 'a' }])
            }
          })
        }))
      }))
    } as never

    mockWithRLS.mockImplementation(
      async (_userId: string, cb: (tx: never) => Promise<unknown>) => cb(tx)
    )

    const result = await getEvalsDashboardWithLayout('user-1')

    expect(mockWithRLS).toHaveBeenCalledTimes(1)
    expect(result.data.capability.latest?.experimentName).toBe('cap-exp')
    expect(result.data.regression.latest?.experimentName).toBe('reg-exp')
    expect(result.data.trafficMonitor.latest?.experimentName).toBe('traf-exp')
    expect(result.layout).toBe('a')
  })

  it('falls back to default layout when no preference exists', async () => {
    const row = sampleRow({
      createdAt: new Date('2026-04-14T12:00:00.000Z')
    })

    let selectCall = 0
    const tx = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => {
            selectCall++
            if (selectCall <= 3) {
              return {
                orderBy: vi.fn(() => ({
                  limit: vi.fn(() => (selectCall === 1 ? [row] : []))
                }))
              }
            }
            return { limit: vi.fn(() => []) }
          })
        }))
      }))
    } as never

    mockWithRLS.mockImplementation(
      async (_userId: string, cb: (tx: never) => Promise<unknown>) => cb(tx)
    )

    const result = await getEvalsDashboardWithLayout('user-1')

    expect(result.layout).toBe(DEFAULT_TEMPLATE_ID)
  })
})
