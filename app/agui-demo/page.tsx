'use client'

import { Button } from '@/components/ui/button'

import { AguiGenerativeUI } from '@/components/agui/agui-generative-ui'
import { useAguiAgent } from '@/components/agui/use-agui-agent'

/**
 * Dev demo page for the AG-UI consume → render path. Drives the local
 * `/api/agui` endpoint (enable with `ENABLE_AGUI_ENDPOINT=true AGUI_DEMO=true`)
 * via {@link useAguiAgent} and renders the live result with
 * {@link AguiGenerativeUI}. Intentionally auth/DB-free.
 */
export default function AguiDemoPage() {
  const { run, result, status, error } = useAguiAgent({ endpoint: '/api/agui' })

  const handleRun = () =>
    run({
      threadId: 't1',
      runId: 'r1',
      messages: [{ id: '1', role: 'user', content: 'What is AG-UI?' }],
      tools: [],
      context: [],
      forwardedProps: { userMode: 'search' }
    })

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 p-6">
      <div className="flex items-center gap-3">
        <Button onClick={handleRun} disabled={status === 'running'}>
          {status === 'running' ? 'Running…' : 'Run AG-UI demo'}
        </Button>
        <span className="text-muted-foreground text-sm">status: {status}</span>
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}

      {result && <AguiGenerativeUI result={result} />}
    </main>
  )
}
