export type ToolUiCommunitySourceType = 'npm' | 'ported' | 'local'

type BaseCommunitySource = {
  id: string
  sourceType: ToolUiCommunitySourceType
  upstreamProject: string
  license: string
  adapterFiles: readonly string[]
  runtimeNotes: string
}

export type ToolUiNpmCommunitySource = BaseCommunitySource & {
  sourceType: 'npm'
  packageName: string
  packageVersion: string
  publicImports: readonly string[]
  docsUrl: string
}

export type ToolUiUpstreamFileReference = {
  path: string
  blobSha: string
  url: string
}

export type ToolUiPortedCommunitySource = BaseCommunitySource & {
  sourceType: 'ported'
  upstreamUrl: string
  upstreamCommit: string
  upstreamFiles: readonly ToolUiUpstreamFileReference[]
  copiedFiles: readonly string[]
  adaptedFiles: readonly string[]
  attributionNotice: string
  localNoticeFile?: string
}

export type ToolUiLocalCommunitySource = BaseCommunitySource & {
  sourceType: 'local'
}

export type ToolUiCommunitySource =
  | ToolUiNpmCommunitySource
  | ToolUiPortedCommunitySource
  | ToolUiLocalCommunitySource

export const TOOL_UI_COMMUNITY_SOURCES = [
  {
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
    attributionNotice:
      'Copyright (c) 2025 Abhishek Gahlot. Permission notice retained for the adapted non-commercial Agent Artifact port.',
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
    ],
    runtimeNotes:
      'Polymorph keeps its local AI SDK v6 chat runtime and renders through the manifest renderer catalog instead of adopting the upstream runtime.'
  }
] as const satisfies readonly ToolUiCommunitySource[]

export type ToolUiCommunitySourceId = ToolUiCommunitySource['id']

const forbiddenImportSegments = new Set(['dist', 'internal', 'src', 'build'])

export function isPublicPackageImport(importPath: string): boolean {
  if (importPath.startsWith('.') || importPath.startsWith('@/')) return false

  const segments = importPath.split('/').filter(Boolean)
  if (segments.length === 0) return false
  if (importPath.startsWith('@') && segments.length < 2) return false

  const packageSegments = importPath.startsWith('@') ? 2 : 1
  const subpathSegments = segments.slice(packageSegments)

  return !subpathSegments.some(segment => forbiddenImportSegments.has(segment))
}

export function getToolUiCommunitySourceById(
  id: string
): ToolUiCommunitySource | undefined {
  return TOOL_UI_COMMUNITY_SOURCES.find(source => source.id === id)
}
