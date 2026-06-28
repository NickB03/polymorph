import { RunAgentInputSchema } from '@ag-ui/core'

import { createAguiRunResponse } from '@/lib/streaming/agui/response'
import { jsonError } from '@/lib/utils/json-error'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * AG-UI protocol endpoint (https://docs.ag-ui.com).
 *
 * Accepts a `RunAgentInput` and streams Polymorph's chat agent back as AG-UI
 * events over SSE, letting any AG-UI-compatible frontend (e.g. CopilotKit)
 * drive the agent.
 *
 * Disabled by default. Set `ENABLE_AGUI_ENDPOINT=true` to expose it. The
 * endpoint runs the agent unauthenticated and statelessly, so only enable it in
 * environments where that cost/abuse surface is acceptable (e.g. behind a
 * gateway or for a controlled demo).
 */
export async function POST(req: Request) {
  if (process.env.ENABLE_AGUI_ENDPOINT !== 'true') {
    return jsonError('NOT_FOUND', 'AG-UI endpoint is not enabled', 404)
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return jsonError('BAD_REQUEST', 'Invalid JSON body', 400)
  }

  const parsed = RunAgentInputSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError(
      'BAD_REQUEST',
      `Invalid RunAgentInput: ${parsed.error.issues.map(i => i.message).join('; ')}`,
      400
    )
  }

  try {
    return createAguiRunResponse(parsed.data, { abortSignal: req.signal })
  } catch (error) {
    console.error('[AG-UI] Failed to start run:', error)
    return jsonError('INTERNAL_ERROR', 'Failed to start AG-UI run', 500)
  }
}
