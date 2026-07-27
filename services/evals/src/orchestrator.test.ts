import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockConfig = vi.hoisted(() => ({
  evalRunMode: 'all',
  exitOnThresholdBreach: false
}))

const mockRunCapabilitySuite = vi.hoisted(() => vi.fn())
const mockRunRegressionSuite = vi.hoisted(() => vi.fn())
const mockRunTrafficMonitorSuite = vi.hoisted(() => vi.fn())
const mockRunSmokeSuite = vi.hoisted(() => vi.fn())
const mockAssertSmokeHealthy = vi.hoisted(() => vi.fn())

vi.mock('./config', () => ({
  config: mockConfig
}))

vi.mock('./runners/capability', () => ({
  runCapabilitySuite: mockRunCapabilitySuite
}))

vi.mock('./runners/regression', () => ({
  runRegressionSuite: mockRunRegressionSuite
}))

vi.mock('./runners/traffic-monitor', () => ({
  runTrafficMonitorSuite: mockRunTrafficMonitorSuite
}))

vi.mock('./runners/smoke', () => ({
  runSmokeSuite: mockRunSmokeSuite,
  assertSmokeHealthy: mockAssertSmokeHealthy
}))

describe('runConfiguredModes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockConfig.evalRunMode = 'all'
    mockConfig.exitOnThresholdBreach = false
    mockRunCapabilitySuite.mockResolvedValue({
      suite: 'capability',
      status: 'passed',
      passRate: 0.91,
      threshold: 0.8,
      failedEvaluators: [],
      experimentName: 'cap-exp',
      datasetName: 'cap-ds',
      phoenixUrl: null,
      totalCases: 12
    })
    mockRunRegressionSuite.mockResolvedValue({
      suite: 'regression',
      status: 'passed',
      passRate: 0.89,
      threshold: 0.8,
      failedEvaluators: [],
      experimentName: 'reg-exp',
      datasetName: 'reg-ds',
      phoenixUrl: null,
      totalCases: 8
    })
    mockRunTrafficMonitorSuite.mockResolvedValue({
      suite: 'traffic-monitor',
      status: 'passed',
      passRate: 0.87,
      threshold: 0.8,
      failedEvaluators: [],
      experimentName: 'traf-exp',
      datasetName: 'traf-ds',
      phoenixUrl: null,
      totalCases: 20
    })
    mockRunSmokeSuite.mockResolvedValue({
      attempted: 1,
      succeeded: 1,
      authFailed: false
    })
  })

  it('returns suite results for persisted eval modes and still runs smoke', async () => {
    const { runConfiguredModes } = await import('./orchestrator')

    const results = await runConfiguredModes()

    expect(results).toHaveLength(3)
    expect(results.map(result => result.suite)).toEqual([
      'capability',
      'regression',
      'traffic-monitor'
    ])
    expect(mockRunTrafficMonitorSuite).toHaveBeenCalledWith()
    expect(mockRunSmokeSuite).toHaveBeenCalledTimes(1)
    expect(mockAssertSmokeHealthy).toHaveBeenCalledWith({
      attempted: 1,
      succeeded: 1,
      authFailed: false
    })
  })

  it('propagates smoke failure in smoke mode instead of exiting 0', async () => {
    mockConfig.evalRunMode = 'smoke'
    mockRunSmokeSuite.mockResolvedValueOnce({
      attempted: 1,
      succeeded: 0,
      authFailed: false
    })
    mockAssertSmokeHealthy.mockImplementationOnce(() => {
      throw new Error(
        '[evals] SMOKE FAILED - 0/1 smoke chats succeeded; the app chat path is down'
      )
    })

    const { runConfiguredModes } = await import('./orchestrator')

    await expect(runConfiguredModes()).rejects.toThrow(/SMOKE FAILED/)
    expect(mockAssertSmokeHealthy).toHaveBeenCalledWith({
      attempted: 1,
      succeeded: 0,
      authFailed: false
    })
  })

  it('all mode runs remaining suites when one suite throws', async () => {
    mockConfig.evalRunMode = 'all'
    mockRunCapabilitySuite.mockRejectedValueOnce(new Error('phoenix down'))

    const { runConfiguredModes } = await import('./orchestrator')

    await expect(runConfiguredModes()).rejects.toThrow(/1 suite failure/)
    expect(mockRunRegressionSuite).toHaveBeenCalled()
    expect(mockRunTrafficMonitorSuite).toHaveBeenCalled()
    expect(mockRunSmokeSuite).toHaveBeenCalledTimes(1)
  })

  it('throws after aggregation when exitOnThresholdBreach is enabled', async () => {
    mockConfig.exitOnThresholdBreach = true
    mockRunTrafficMonitorSuite.mockResolvedValueOnce({
      suite: 'traffic-monitor',
      status: 'threshold_breached',
      passRate: 0.71,
      threshold: 0.8,
      failedEvaluators: ['faithfulness'],
      experimentName: 'traf-exp',
      datasetName: 'traf-ds',
      phoenixUrl: null,
      totalCases: 20
    })

    const { runConfiguredModes } = await import('./orchestrator')

    await expect(runConfiguredModes()).rejects.toThrow(
      'Threshold breach exit requested'
    )
    expect(mockRunSmokeSuite).toHaveBeenCalledTimes(1)
  })

  it('returns no results without throwing when traffic-monitor skips on empty traffic', async () => {
    mockConfig.evalRunMode = 'traffic-monitor'
    mockRunTrafficMonitorSuite.mockResolvedValueOnce(null)

    const { runConfiguredModes } = await import('./orchestrator')

    const results = await runConfiguredModes()

    expect(results).toEqual([])
    expect(mockRunTrafficMonitorSuite).toHaveBeenCalledWith()
  })

  it('exits via threshold-breach message even when DB write fails during the same suite', async () => {
    const { EvalSummaryPersistError } = await import('./error')
    mockConfig.evalRunMode = 'all'
    mockConfig.exitOnThresholdBreach = true
    mockRunTrafficMonitorSuite.mockRejectedValueOnce(
      new EvalSummaryPersistError(
        '[evals] traffic-monitor eval summary could not be persisted',
        {
          suite: 'traffic-monitor',
          status: 'threshold_breached',
          passRate: 0.7,
          threshold: 0.85,
          failedEvaluators: ['faithfulness'],
          experimentName: 'traf-exp-x',
          datasetName: 'traf-ds-x',
          phoenixUrl: null,
          totalCases: 10,
          attemptedCases: 10,
          failedCases: 0
        }
      )
    )

    const { runConfiguredModes } = await import('./orchestrator')

    await expect(runConfiguredModes()).rejects.toThrow(
      /Threshold breach exit requested.*traffic-monitor/
    )
  })

  it('rethrows DB-write failure as EvalSummaryPersistError when no breach occurs', async () => {
    const { EvalSummaryPersistError } = await import('./error')
    mockConfig.evalRunMode = 'traffic-monitor'
    const persistedResult = {
      suite: 'traffic-monitor' as const,
      status: 'passed' as const,
      passRate: 0.91,
      threshold: 0.8,
      failedEvaluators: [],
      experimentName: 'traf-exp-y',
      datasetName: 'traf-ds-y',
      phoenixUrl: null,
      totalCases: 10,
      attemptedCases: 10,
      failedCases: 0
    }
    mockRunTrafficMonitorSuite.mockRejectedValueOnce(
      new EvalSummaryPersistError(
        '[evals] traffic-monitor eval summary could not be persisted',
        persistedResult
      )
    )

    const { runConfiguredModes } = await import('./orchestrator')

    let caught: unknown
    await runConfiguredModes().catch(error => {
      caught = error
    })
    expect(caught).toBeInstanceOf(EvalSummaryPersistError)
    expect(
      (caught as InstanceType<typeof EvalSummaryPersistError>).result
    ).toEqual(persistedResult)
  })

  it('throws AggregateError preserving every persist failure when more than one suite fails', async () => {
    const { EvalSummaryPersistError } = await import('./error')
    mockConfig.evalRunMode = 'all'
    mockConfig.exitOnThresholdBreach = false

    const persistErrA = new EvalSummaryPersistError(
      '[evals] capability eval summary could not be persisted',
      {
        suite: 'capability',
        status: 'passed',
        passRate: 0.91,
        threshold: 0.8,
        failedEvaluators: [],
        experimentName: 'cap-x',
        datasetName: 'cap-y',
        phoenixUrl: null,
        totalCases: 5,
        attemptedCases: 5,
        failedCases: 0
      }
    )
    const persistErrB = new EvalSummaryPersistError(
      '[evals] regression eval summary could not be persisted',
      {
        suite: 'regression',
        status: 'passed',
        passRate: 0.88,
        threshold: 0.8,
        failedEvaluators: [],
        experimentName: 'reg-x',
        datasetName: 'reg-y',
        phoenixUrl: null,
        totalCases: 4,
        attemptedCases: 4,
        failedCases: 0
      }
    )
    mockRunCapabilitySuite.mockRejectedValueOnce(persistErrA)
    mockRunRegressionSuite.mockRejectedValueOnce(persistErrB)

    const { runConfiguredModes } = await import('./orchestrator')

    let caught: unknown
    await runConfiguredModes().catch(error => {
      caught = error
    })

    expect(caught).toBeInstanceOf(AggregateError)
    expect((caught as AggregateError).errors).toEqual([
      persistErrA,
      persistErrB
    ])
    expect((caught as Error).message).toMatch(
      /2 eval summary persistence failures/
    )
  })

  it('attaches persistErrors as cause on the threshold-breach throw when both occur', async () => {
    const { EvalSummaryPersistError } = await import('./error')
    mockConfig.evalRunMode = 'all'
    mockConfig.exitOnThresholdBreach = true

    const persistErr = new EvalSummaryPersistError(
      '[evals] traffic-monitor eval summary could not be persisted',
      {
        suite: 'traffic-monitor',
        status: 'threshold_breached',
        passRate: 0.7,
        threshold: 0.85,
        failedEvaluators: ['faithfulness'],
        experimentName: 'traf-x',
        datasetName: 'traf-y',
        phoenixUrl: null,
        totalCases: 10,
        attemptedCases: 10,
        failedCases: 0
      }
    )
    mockRunTrafficMonitorSuite.mockRejectedValueOnce(persistErr)

    const { runConfiguredModes } = await import('./orchestrator')

    let caught: unknown
    await runConfiguredModes().catch(error => {
      caught = error
    })

    expect(caught).toBeInstanceOf(Error)
    expect((caught as Error).message).toMatch(
      /Threshold breach exit requested.*traffic-monitor/
    )
    // The DB error is preserved on `cause` so it's not silently dropped.
    expect((caught as { cause?: unknown }).cause).toBe(persistErr)
  })

  it('attaches an AggregateError as cause when threshold breach collides with multiple persist failures', async () => {
    const { EvalSummaryPersistError } = await import('./error')
    mockConfig.evalRunMode = 'all'
    mockConfig.exitOnThresholdBreach = true

    const persistErrA = new EvalSummaryPersistError(
      '[evals] capability eval summary could not be persisted',
      {
        suite: 'capability',
        status: 'passed',
        passRate: 0.91,
        threshold: 0.8,
        failedEvaluators: [],
        experimentName: 'cap-x',
        datasetName: 'cap-y',
        phoenixUrl: null,
        totalCases: 5,
        attemptedCases: 5,
        failedCases: 0
      }
    )
    const persistErrB = new EvalSummaryPersistError(
      '[evals] traffic-monitor eval summary could not be persisted',
      {
        suite: 'traffic-monitor',
        status: 'threshold_breached',
        passRate: 0.7,
        threshold: 0.85,
        failedEvaluators: ['faithfulness'],
        experimentName: 'traf-x',
        datasetName: 'traf-y',
        phoenixUrl: null,
        totalCases: 10,
        attemptedCases: 10,
        failedCases: 0
      }
    )
    mockRunCapabilitySuite.mockRejectedValueOnce(persistErrA)
    mockRunTrafficMonitorSuite.mockRejectedValueOnce(persistErrB)

    const { runConfiguredModes } = await import('./orchestrator')

    let caught: unknown
    await runConfiguredModes().catch(error => {
      caught = error
    })

    // The breach message wins as the primary throw (operator-actionable signal).
    expect((caught as Error).message).toMatch(
      /Threshold breach exit requested.*traffic-monitor/
    )
    // Both persist errors are preserved together via AggregateError on cause —
    // not just the first. This is the cause-chain promise the log message makes.
    const cause = (caught as { cause?: unknown }).cause
    expect(cause).toBeInstanceOf(AggregateError)
    expect((cause as AggregateError).errors).toEqual([persistErrA, persistErrB])
  })
})
