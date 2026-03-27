import { serveCanvasHtml } from '@/lib/canvas/serve-canvas-html'

export const dynamic = 'force-dynamic'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ artifactId: string }> }
) {
  try {
    const { artifactId } = await params
    return await serveCanvasHtml(req, artifactId, 'inline')
  } catch (error) {
    console.error('Canvas view error:', error)
    const { jsonError } = await import('@/lib/utils/json-error')
    return jsonError('INTERNAL_ERROR', 'Error viewing canvas artifact', 500)
  }
}
