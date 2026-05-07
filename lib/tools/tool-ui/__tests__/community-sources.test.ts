import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import type { ToolUiCommunitySource } from '../community-sources'
import {
  getToolUiCommunitySourceById,
  isPublicPackageImport,
  TOOL_UI_COMMUNITY_SOURCES
} from '../community-sources'

describe('Tool UI community sources', () => {
  it('records the proof community port with copied/adapted file ownership', () => {
    expect(
      getToolUiCommunitySourceById('agent-kit-agent-artifact')
    ).toMatchObject({
      id: 'agent-kit-agent-artifact',
      sourceType: 'ported',
      upstreamProject: 'Agent Kit / agents-ui artifact UI',
      upstreamUrl: 'https://github.com/agents-ui/agents-kit',
      upstreamCommit: '03c55476a3e03a4f7ac90211f00a6a6d19706dac',
      upstreamFiles: [
        {
          path: 'components/agents-ui/agent-artifact.tsx',
          blobSha: 'c2e6265ed9ed2c219499c6a70ffa9e886e57e58d',
          url: 'https://github.com/agents-ui/agents-kit/blob/03c55476a3e03a4f7ac90211f00a6a6d19706dac/components/agents-ui/agent-artifact.tsx'
        },
        {
          path: 'app/docs/agent-artifact/page.mdx',
          blobSha: 'e44d7184fa1e69e655fe32e659e46fe1776804bf',
          url: 'https://github.com/agents-ui/agents-kit/blob/03c55476a3e03a4f7ac90211f00a6a6d19706dac/app/docs/agent-artifact/page.mdx'
        },
        {
          path: 'LICENSE.md',
          blobSha: '3c9d400a8904c040338ec6bbc982fd21b759765b',
          url: 'https://github.com/agents-ui/agents-kit/blob/03c55476a3e03a4f7ac90211f00a6a6d19706dac/LICENSE.md'
        }
      ],
      license:
        'non-commercial; personal and internal evaluation allowed, commercial use requires permission',
      attributionNotice: expect.stringContaining(
        'Copyright (c) 2025 Abhishek Gahlot'
      ),
      localNoticeFile: 'components/tool-ui/agent-artifact/UPSTREAM-LICENSE.md',
      copiedFiles: [],
      adaptedFiles: [
        'components/tool-ui/agent-artifact/agent-artifact.tsx',
        'components/tool-ui/agent-artifact/schema.ts',
        'lib/tools/display-agent-artifact/result.tsx'
      ],
      adapterFiles: [
        'components/tool-ui/agent-artifact/_adapter.tsx',
        'components/tool-ui/agent-artifact/agent-artifact.tsx',
        'lib/tools/display-agent-artifact/result.tsx'
      ]
    })
  })

  it('retains the upstream notice in the local notice file', () => {
    const source = getToolUiCommunitySourceById('agent-kit-agent-artifact')

    expect(source?.sourceType).toBe('ported')
    if (source?.sourceType !== 'ported') return

    const noticeFile = source.localNoticeFile

    expect(noticeFile).toBe(
      'components/tool-ui/agent-artifact/UPSTREAM-LICENSE.md'
    )
    if (!noticeFile) throw new Error('missing Agent Artifact notice file')

    const notice = readFileSync(noticeFile, 'utf8')

    expect(notice).toContain('Copyright (c) 2025 Abhishek Gahlot')
    expect(notice).not.toContain('Retain the exact copyright')
  })

  it('accepts public package imports and rejects deep or internal imports', () => {
    const assistantReact = '@assistant-ui/react'
    const toolUiGeoMap = '@tool-ui/geo-map'

    expect(isPublicPackageImport('@assistant-ui/react')).toBe(true)
    expect(isPublicPackageImport('@assistant-ui/react-ai-sdk')).toBe(true)
    expect(isPublicPackageImport('@tool-ui/geo-map')).toBe(true)

    expect(isPublicPackageImport(`${assistantReact}/dist/thread`)).toBe(false)
    expect(isPublicPackageImport(`${assistantReact}/internal/thread`)).toBe(
      false
    )
    expect(isPublicPackageImport(`${toolUiGeoMap}/src/geo-map`)).toBe(false)
    expect(
      isPublicPackageImport(
        ['@/components', 'community', 'assistant-ui', 'thread'].join('/')
      )
    ).toBe(false)
    expect(
      isPublicPackageImport(
        ['..', 'vendor', 'assistant-ui', 'thread'].join('/')
      )
    ).toBe(false)
  })

  it('keeps npm source records on public import boundaries', () => {
    for (const source of TOOL_UI_COMMUNITY_SOURCES as readonly ToolUiCommunitySource[]) {
      if (source.sourceType !== 'npm') continue

      for (const publicImport of source.publicImports) {
        expect(isPublicPackageImport(publicImport)).toBe(true)
      }
    }
  })
})
