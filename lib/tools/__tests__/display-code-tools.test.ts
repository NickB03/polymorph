import { describe, expect, it } from 'vitest'

import { displayCodeBlockTool } from '../display-code-block'
import { displayCodeDiffTool } from '../display-code-diff'

describe('display code tools', () => {
  it('accepts a valid displayCodeBlock payload', async () => {
    const payload = {
      id: 'code-block-1',
      code: 'export default function App() {\n  return <main>Hello</main>\n}',
      language: 'tsx',
      filename: 'App.tsx',
      lineNumbers: true,
      highlightLines: [2],
      maxCollapsedLines: 24
    }

    expect(displayCodeBlockTool.inputSchema).toBeDefined()
    await expect(
      displayCodeBlockTool.execute!(payload, {
        toolCallId: 'tool-code-block-1',
        messages: []
      } as any)
    ).resolves.toEqual(payload)
  })

  it('accepts a valid displayCodeDiff payload', async () => {
    const payload = {
      id: 'code-diff-1',
      oldCode: 'export const answer = 1\n',
      newCode: 'export const answer = 2\n',
      language: 'ts',
      filename: 'answer.ts',
      lineNumbers: true,
      diffStyle: 'side-by-side' as const,
      maxCollapsedLines: 20
    }

    expect(displayCodeDiffTool.inputSchema).toBeDefined()
    await expect(
      displayCodeDiffTool.execute!(payload, {
        toolCallId: 'tool-code-diff-1',
        messages: []
      } as any)
    ).resolves.toEqual(payload)
  })
})
