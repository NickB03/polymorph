import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { consumeAguiStream } from '@/lib/streaming/agui/client'
import { demoFullStream } from '@/lib/streaming/agui/demo'
import { aguiSseResponse } from '@/lib/streaming/agui/sse'

import { AguiGenerativeUI } from './agui-generative-ui'

const IDS = { threadId: 't1', runId: 'r1' }

describe('AguiGenerativeUI', () => {
  it('renders the real Plan component from a consumed demo stream', async () => {
    const response = aguiSseResponse(async () => demoFullStream(), IDS)
    const result = await consumeAguiStream(response)

    expect(result.status).toBe('finished')

    render(<AguiGenerativeUI result={result} />)

    // Assistant text appears.
    expect(
      screen.getByText(/AG-UI is an open, event-based protocol/)
    ).toBeInTheDocument()

    // The real Plan component renders (consume → registry → Plan), not a
    // fallback: its title plus at least one todo label from the demo payload.
    expect(screen.getByText('Learn AG-UI')).toBeInTheDocument()
    expect(screen.getByText('Read the protocol spec')).toBeInTheDocument()

    // The fallback card must not be present for this registered component.
    expect(
      screen.queryByText('No renderer available for this component.')
    ).not.toBeInTheDocument()
  })

  it('renders a labeled fallback card for an unregistered component', () => {
    const result = {
      status: 'finished' as const,
      messages: [],
      generativeUI: [
        {
          component: 'displayUnknown',
          toolCallId: 'call-x',
          props: { anything: true }
        }
      ]
    }

    render(<AguiGenerativeUI result={result} />)

    expect(screen.getByText('displayUnknown')).toBeInTheDocument()
    expect(
      screen.getByText('No renderer available for this component.')
    ).toBeInTheDocument()
  })
})
