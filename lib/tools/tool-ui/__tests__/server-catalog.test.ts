import { describe, expect, it } from 'vitest'

import { TOOL_UI_TOOL_METADATA } from '../metadata'
import {
  createToolUiServerTools,
  getToolUiServerToolNames
} from '../server-catalog'

describe('Tool UI server catalog', () => {
  it('registers one server tool per metadata row', () => {
    expect(getToolUiServerToolNames()).toEqual(
      TOOL_UI_TOOL_METADATA.map(tool => tool.name)
    )
  })

  it('exposes AI SDK server tools with input schemas', () => {
    const tools = createToolUiServerTools()

    for (const metadata of TOOL_UI_TOOL_METADATA) {
      expect(tools[metadata.name]).toEqual(
        expect.objectContaining({
          inputSchema: expect.any(Object)
        })
      )
    }
  })

  it('keeps client-resolved tools registered with output schemas', () => {
    const tools = createToolUiServerTools()

    expect(tools.displayOptionList.inputSchema).toEqual(expect.any(Object))
    expect(tools.displayOptionList.outputSchema).toEqual(expect.any(Object))
    expect(tools.displayOptionList.execute).toBeUndefined()

    expect(tools.displayQuestionWizard.inputSchema).toEqual(expect.any(Object))
    expect(tools.displayQuestionWizard.outputSchema).toEqual(expect.any(Object))
    expect(tools.displayQuestionWizard.execute).toBeUndefined()
  })
})
