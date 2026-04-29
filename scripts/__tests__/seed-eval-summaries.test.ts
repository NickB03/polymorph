import { describe, expect, it } from 'vitest'

import {
  assertLocalDatabaseUrl,
  buildSeedEvalSummaryRows,
  getSeedResetPattern,
  seedEvalSummaries
} from '../seed-eval-summaries'

const NOW = new Date('2026-04-29T16:00:00.000Z')

describe('buildSeedEvalSummaryRows', () => {
  it('creates 12 rows across the three persisted eval suites', () => {
    const rows = buildSeedEvalSummaryRows(NOW)

    expect(rows).toHaveLength(12)
    expect(new Set(rows.map(row => row.suite))).toEqual(
      new Set(['capability', 'regression', 'traffic-monitor'])
    )
    expect(rows.filter(row => row.suite === 'capability')).toHaveLength(4)
    expect(rows.filter(row => row.suite === 'regression')).toHaveLength(4)
    expect(rows.filter(row => row.suite === 'traffic-monitor')).toHaveLength(4)
  })

  it('keeps all suites represented in the newest 10 rows', () => {
    const newestTen = buildSeedEvalSummaryRows(NOW)
      .sort(
        (left, right) => right.createdAt.getTime() - left.createdAt.getTime()
      )
      .slice(0, 10)

    expect(new Set(newestTen.map(row => row.suite))).toEqual(
      new Set(['capability', 'regression', 'traffic-monitor'])
    )
  })

  it('generates dashboard-safe values and stable local seed names', () => {
    const rows = buildSeedEvalSummaryRows(NOW)

    for (const row of rows) {
      expect(row.experimentName).toMatch(/^local-seed-/)
      expect(row.datasetName).toMatch(/^local-seed-/)
      expect(row.passRateBps).toBeGreaterThanOrEqual(0)
      expect(row.passRateBps).toBeLessThanOrEqual(10000)
      expect(row.thresholdBps).toBeGreaterThanOrEqual(0)
      expect(row.thresholdBps).toBeLessThanOrEqual(10000)
      expect(row.totalCases).toBeGreaterThan(0)
      expect(row.attemptedCases).toBe(row.totalCases)
      expect(row.failedCases).toBeGreaterThanOrEqual(0)
      expect(row.failedCases).toBeLessThanOrEqual(row.attemptedCases)
      expect(typeof row.thresholdBreached).toBe('boolean')
      expect(Array.isArray(row.failedEvaluators)).toBe(true)
      expect(Object.keys(row.evaluatorScores).length).toBeGreaterThan(0)
    }
  })
})

describe('local database guard', () => {
  it('accepts local database URLs', () => {
    expect(() =>
      assertLocalDatabaseUrl(
        'postgresql://postgres:postgres@localhost:44322/postgres'
      )
    ).not.toThrow()
    expect(() =>
      assertLocalDatabaseUrl(
        'postgres://postgres:postgres@127.0.0.1:5432/postgres'
      )
    ).not.toThrow()
    expect(() =>
      assertLocalDatabaseUrl('postgres://postgres:postgres@[::1]:5432/postgres')
    ).not.toThrow()
  })

  it('rejects remote database URLs', () => {
    expect(() =>
      assertLocalDatabaseUrl(
        'postgres://user:pass@db.example.com:5432/postgres'
      )
    ).toThrow(/non-local database host/)
    expect(() =>
      assertLocalDatabaseUrl(
        'postgres://user:pass@aws-0-us-east.pooler.supabase.com:5432/postgres'
      )
    ).toThrow(/non-local database host/)
  })
})

describe('reset target', () => {
  it('only targets local seed experiment names', () => {
    expect(getSeedResetPattern()).toBe('local-seed-%')
  })
})

describe('dry run', () => {
  it('does not require a database URL', async () => {
    const databaseUrl = process.env.DATABASE_URL
    const postgresUrl = process.env.POSTGRES_URL

    delete process.env.DATABASE_URL
    delete process.env.POSTGRES_URL

    try {
      await expect(
        seedEvalSummaries({ dryRun: true, now: NOW })
      ).resolves.toMatchObject({
        dryRun: true,
        inserted: 0,
        planned: 12
      })
    } finally {
      if (databaseUrl === undefined) {
        delete process.env.DATABASE_URL
      } else {
        process.env.DATABASE_URL = databaseUrl
      }

      if (postgresUrl === undefined) {
        delete process.env.POSTGRES_URL
      } else {
        process.env.POSTGRES_URL = postgresUrl
      }
    }
  })
})
