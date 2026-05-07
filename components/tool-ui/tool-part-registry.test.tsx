import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { getInteractiveToolPartTypes } from '@/lib/tools/tool-ui/metadata'

import { interactiveToolRendererEntries } from './interactive-renderer-catalog'
import { renderToolPart } from './tool-part-registry'

const optionListInput = {
  id: 'research-depth',
  options: [
    { id: 'quick', label: 'Quick scan' },
    { id: 'deep', label: 'Deep research' }
  ],
  selectionMode: 'single' as const
}

const optionListReceiptInput = {
  ...optionListInput,
  id: 'build-target'
}

const questionWizardInput = {
  id: 'project-intake',
  steps: [
    {
      id: 'style',
      title: 'Choose a style',
      options: [
        { id: 'minimal', label: 'Minimal' },
        { id: 'editorial', label: 'Editorial' }
      ],
      selectionMode: 'single' as const
    },
    {
      id: 'tone',
      title: 'Choose a tone',
      options: [
        { id: 'formal', label: 'Formal' },
        { id: 'friendly', label: 'Friendly' }
      ],
      selectionMode: 'single' as const
    }
  ],
  submitLabel: 'Finish'
}

async function click(element: Element) {
  await act(async () => {
    fireEvent.click(element)
    await Promise.resolve()
  })
}

describe('tool part registry interactive display tools', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('keeps interactive renderer names aligned with metadata', () => {
    expect(
      interactiveToolRendererEntries.map(entry => `tool-${entry.name}`)
    ).toEqual(getInteractiveToolPartTypes())
  })

  it('renders displayOptionList input and submits the selected result', async () => {
    const submitInteractiveToolOutput = vi.fn()
    const node = renderToolPart({
      toolName: 'displayOptionList',
      toolPart: {
        state: 'input-available',
        input: optionListInput,
        toolCallId: 'option-call'
      },
      messageId: 'message-1',
      partIndex: 0,
      isResearchMode: false,
      submitInteractiveToolOutput
    })

    render(<>{node}</>)

    await click(screen.getByRole('option', { name: /deep research/i }))
    await click(screen.getByRole('button', { name: /confirm/i }))

    expect(submitInteractiveToolOutput).toHaveBeenCalledWith({
      toolCallId: 'option-call',
      output: 'deep'
    })
  })

  it('keeps displayOptionList Clear local instead of submitting an empty tool result', async () => {
    const submitInteractiveToolOutput = vi.fn()
    const node = renderToolPart({
      toolName: 'displayOptionList',
      toolPart: {
        state: 'input-available',
        input: optionListInput,
        toolCallId: 'option-call'
      },
      messageId: 'message-1',
      partIndex: 0,
      isResearchMode: false,
      submitInteractiveToolOutput
    })

    render(<>{node}</>)

    await click(screen.getByRole('option', { name: /deep research/i }))
    await click(screen.getByRole('button', { name: /clear/i }))

    expect(submitInteractiveToolOutput).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /confirm/i })).toBeDisabled()
  })

  it('renders displayOptionList output as the selected choice', () => {
    const node = renderToolPart({
      toolName: 'displayOptionList',
      toolPart: {
        state: 'output-available',
        input: optionListReceiptInput,
        output: 'quick'
      },
      messageId: 'message-1',
      partIndex: 0,
      isResearchMode: false
    })

    render(<>{node}</>)

    expect(screen.getByRole('status')).toHaveTextContent('Quick scan')
    expect(screen.queryByText('Deep research')).not.toBeInTheDocument()
  })

  it('renders displayQuestionWizard input and submits the wizard result', async () => {
    vi.useFakeTimers()
    const submitInteractiveToolOutput = vi.fn()
    const node = renderToolPart({
      toolName: 'displayQuestionWizard',
      toolPart: {
        state: 'input-available',
        input: questionWizardInput,
        toolCallId: 'wizard-call'
      },
      messageId: 'message-1',
      partIndex: 0,
      isResearchMode: false,
      submitInteractiveToolOutput
    })

    render(<>{node}</>)

    await click(screen.getByRole('option', { name: /minimal/i }))
    await click(screen.getByRole('button', { name: /next/i }))
    act(() => {
      vi.advanceTimersByTime(200)
    })
    await click(screen.getByRole('option', { name: /friendly/i }))
    await click(screen.getByRole('button', { name: /finish/i }))

    expect(submitInteractiveToolOutput).toHaveBeenCalledWith({
      toolCallId: 'wizard-call',
      output: {
        style: 'minimal',
        tone: 'friendly'
      }
    })
  })

  it('renders displayQuestionWizard loading skeleton when input-streaming', () => {
    const node = renderToolPart({
      toolName: 'displayQuestionWizard',
      toolPart: {
        state: 'input-streaming',
        toolCallId: 'wiz-1'
      },
      messageId: 'message-1',
      partIndex: 0,
      isResearchMode: false
    })

    const { container } = render(<>{node}</>)

    const placeholder = container.querySelector('.h-24.animate-pulse')
    expect(placeholder).toBeInTheDocument()
  })

  it('renders displayQuestionWizard output as submitted selections', () => {
    const node = renderToolPart({
      toolName: 'displayQuestionWizard',
      toolPart: {
        state: 'output-available',
        input: questionWizardInput,
        output: {
          style: 'editorial',
          tone: 'formal'
        }
      },
      messageId: 'message-1',
      partIndex: 0,
      isResearchMode: false
    })

    render(<>{node}</>)

    expect(screen.getByRole('status')).toHaveTextContent('Editorial')
    expect(screen.getByRole('status')).toHaveTextContent('Formal')
  })
})
