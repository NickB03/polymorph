import { z } from 'zod'

import { runEvalChat } from '@/lib/streaming/eval-chat-runner'
import { jsonError } from '@/lib/utils/json-error'
import { selectModelForModeAndType } from '@/lib/utils/model-selection'

const evalRequestSchema = z.object({
  caseId: z.string().min(1),
  suite: z.enum(['capability', 'regression', 'smoke', 'traffic-monitor']),
  conversation: z.array(
    z.object({
      role: z.enum(['user', 'assistant']),
      parts: z.array(
        z.object({
          type: z.literal('text'),
          text: z.string()
        })
      )
    })
  ),
  searchMode: z.enum(['chat', 'research']),
  userMode: z.enum(['search', 'research', 'build']).optional(),
  intent: z.string().optional(),
  modelType: z.enum(['speed', 'quality'])
})

export async function POST(req: Request) {
  const configuredSecret = process.env.EVAL_RUNNER_SECRET?.trim()
  const providedSecret = req.headers.get('x-eval-runner-secret')?.trim()

  if (!providedSecret) {
    return jsonError('AUTH_REQUIRED', 'Missing eval runner secret', 401)
  }

  if (!configuredSecret || providedSecret !== configuredSecret) {
    return jsonError('FORBIDDEN', 'Invalid eval runner secret', 403)
  }

  try {
    const body = await req.json()
    const parsed = evalRequestSchema.safeParse(body)

    if (!parsed.success) {
      return jsonError('BAD_REQUEST', 'Invalid eval run payload', 400)
    }

    const model = selectModelForModeAndType({
      searchMode: parsed.data.searchMode,
      modelType: parsed.data.modelType
    })

    const result = await runEvalChat({
      caseId: parsed.data.caseId,
      suite: parsed.data.suite,
      conversation: parsed.data.conversation,
      searchMode: parsed.data.searchMode,
      userMode: parsed.data.userMode,
      intent: parsed.data.intent,
      modelType: parsed.data.modelType,
      model,
      abortSignal: req.signal
    })

    return Response.json(result, {
      headers: {
        'Cache-Control': 'no-store'
      }
    })
  } catch (error) {
    console.error('[eval-run] Route error:', error)
    return jsonError('INTERNAL_ERROR', 'Error running eval chat', 500)
  }
}
