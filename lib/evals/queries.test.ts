import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { EvalSummaryRow } from './types'

const mockWithRLS = vi.hoisted(() => vi.fn())

vi.mock('@/lib/db/with-rls', () => ({
  withRLS: mockWithRLS
}))

import {
  buildCapabilityDashboardData,
  buildTrafficMonitorDashboardData,
  getEvalsDashboard
} from './queries'

const sampleRow = (
  overrides: Partial<EvalSummaryRow> = {}
): EvalSummaryRow => ({
  id: 'summary-1',
  experimentName: 'exp-1',
  datasetName: 'dataset-1',
  passRateBps: 9100,
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
        evaluatorScores: {},
        phoenixUrl: null
      })
    ])

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
      experimentName: 'tm-exp-1',
      passRateBps: 8800,
      createdAt: new Date('2026-04-13T12:00:00.000Z')
    })

    const rowsBySuite: Record<string, EvalSummaryRow[]> = {
      capability: [capabilityRow],
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
          const suite = callIndex++ === 0 ? 'capability' : 'traffic-monitor'
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
    expect(data.trafficMonitor.latest?.experimentName).toBe('tm-exp-1')
  })
})
