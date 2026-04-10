import { describe, expect, it } from 'vitest'

import { buildCapabilityDashboardData } from './queries'

describe('buildCapabilityDashboardData', () => {
  it('converts basis points to passRate and orders latest/previous/trend correctly', () => {
    const data = buildCapabilityDashboardData([
      {
        id: 'summary-1',
        experimentName: 'exp-1',
        datasetName: 'dataset-1',
        passRateBps: 9100,
        evaluatorScores: {
          faithfulness: 0.9,
          relevance: 0.8
        },
        totalCases: 20,
        phoenixUrl: 'https://phoenix.example.com/1',
        createdAt: new Date('2026-04-09T12:00:00.000Z')
      },
      {
        id: 'summary-2',
        experimentName: 'exp-2',
        datasetName: 'dataset-2',
        passRateBps: 8700,
        evaluatorScores: {
          faithfulness: 0.8,
          relevance: 0.6
        },
        totalCases: 18,
        phoenixUrl: 'https://phoenix.example.com/2',
        createdAt: new Date('2026-04-09T13:00:00.000Z')
      }
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
      {
        id: 'summary-1',
        experimentName: 'exp-1',
        datasetName: 'dataset-1',
        passRateBps: 5000,
        evaluatorScores: {},
        totalCases: 10,
        phoenixUrl: null,
        createdAt: new Date('2026-04-09T12:00:00.000Z')
      }
    ])

    expect(data.latest?.overallScore).toBe(0)
  })
})
