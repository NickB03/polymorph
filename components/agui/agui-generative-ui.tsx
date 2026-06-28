'use client'

import type { ReactNode } from 'react'

import type { AguiConsumeResult } from '@/lib/streaming/agui/client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

import {
  isRegisteredToolUI,
  tryRenderToolUIByName
} from '@/components/tool-ui/registry'

interface AguiGenerativeUIProps {
  result: AguiConsumeResult
}

/**
 * Render a consumed AG-UI run with Polymorph's native tool-UI renderers.
 *
 * Given an {@link AguiConsumeResult} (produced by `consumeAguiStream`), this
 * renders the assistant message text, a compact list of the reconstructed tool
 * calls, and each `generativeUI` entry by mapping its `component` name to the
 * tool-UI registry. A registered component renders its real Polymorph card; an
 * unregistered or invalid one degrades to a labeled fallback card rather than
 * crashing.
 */
export function AguiGenerativeUI({ result }: AguiGenerativeUIProps) {
  return (
    <div className="flex flex-col gap-4" data-slot="agui-generative-ui">
      {result.status === 'error' && result.error && (
        <Card data-slot="agui-error">
          <CardHeader>
            <CardTitle className="text-destructive text-sm">
              Run error
            </CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">
            {result.error}
          </CardContent>
        </Card>
      )}

      {result.messages.map(message => (
        <div
          key={message.id}
          className="flex flex-col gap-2"
          data-slot="agui-message"
        >
          {message.text && (
            <p className="text-sm leading-6 whitespace-pre-wrap">
              {message.text}
            </p>
          )}

          {message.toolCalls.length > 0 && (
            <ul
              className="text-muted-foreground flex flex-col gap-1 text-xs"
              data-slot="agui-tool-calls"
            >
              {message.toolCalls.map(call => (
                <li key={call.toolCallId} data-slot="agui-tool-call">
                  <span className="font-medium">{call.name}</span>
                  {call.args && <span className="ml-1">{call.args}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}

      {result.generativeUI.map(item => (
        <AguiGenerativeUIItem
          key={item.toolCallId}
          component={item.component}
          toolCallId={item.toolCallId}
          props={item.props}
        />
      ))}
    </div>
  )
}

function AguiGenerativeUIItem({
  component,
  toolCallId,
  props
}: {
  component: string
  toolCallId: string
  props: unknown
}) {
  const partId = `agui-${toolCallId}`

  let rendered: ReactNode = null
  if (isRegisteredToolUI(component)) {
    rendered = tryRenderToolUIByName(component, props, partId)
  }

  if (rendered) return <>{rendered}</>

  return (
    <Card data-slot="agui-generative-ui-fallback">
      <CardHeader>
        <CardTitle className="text-sm">{component}</CardTitle>
      </CardHeader>
      <CardContent className="text-muted-foreground text-xs">
        No renderer available for this component.
      </CardContent>
    </Card>
  )
}
