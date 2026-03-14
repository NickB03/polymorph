/**
 * Structured observability logging for artifact lifecycle events.
 *
 * Every event is emitted as a single-line JSON object to stdout so it can be
 * captured by any log aggregator without additional dependencies.
 */
export function logArtifactEvent(event: string, data: Record<string, unknown>) {
  console.log(
    JSON.stringify({
      source: 'artifact',
      event,
      ...data,
      timestamp: Date.now()
    })
  )
}
