import { describe, expect, it } from 'vitest'

import {
  getInteractiveToolPartTypes,
  getInteractiveToolUiToolNames,
  getToolUiToolNamesForMode,
  TOOL_UI_TOOL_METADATA
} from '../metadata'

describe('Tool UI metadata', () => {
  it('keeps tool names unique', () => {
    const names = TOOL_UI_TOOL_METADATA.map(tool => tool.name)

    expect(new Set(names).size).toBe(names.length)
  })

  it('derives search display tools from metadata', () => {
    expect(getToolUiToolNamesForMode('search')).toEqual([
      'displayPlan',
      'displayTable',
      'displayChart',
      'displayGeoMap',
      'displayCitations',
      'displayLinkPreview',
      'displayAgentArtifact',
      'displayOptionList',
      'displayQuestionWizard',
      'displayCallout',
      'displayTimeline'
    ])
  })

  it('keeps displayPlan out of research mode', () => {
    expect(getToolUiToolNamesForMode('research')).toEqual([
      'displayTable',
      'displayChart',
      'displayGeoMap',
      'displayCitations',
      'displayLinkPreview',
      'displayAgentArtifact',
      'displayOptionList',
      'displayQuestionWizard',
      'displayCallout',
      'displayTimeline'
    ])
  })

  it('derives build display tools from build metadata', () => {
    expect(getToolUiToolNamesForMode('build')).toEqual([
      'displayPlan',
      'displayTable',
      'displayChart',
      'displayGeoMap',
      'displayCitations',
      'displayLinkPreview',
      'displayAgentArtifact',
      'displayOptionList',
      'displayQuestionWizard',
      'displayCallout',
      'displayTimeline'
    ])
  })

  it('derives interactive tool names from metadata', () => {
    expect(getInteractiveToolUiToolNames()).toEqual([
      'displayOptionList',
      'displayQuestionWizard'
    ])
  })

  it('derives interactive tool part types from metadata', () => {
    expect(getInteractiveToolPartTypes()).toEqual([
      'tool-displayOptionList',
      'tool-displayQuestionWizard'
    ])
  })

  it('links displayAgentArtifact to its community source record', () => {
    expect(
      TOOL_UI_TOOL_METADATA.find(tool => tool.name === 'displayAgentArtifact')
    ).toMatchObject({
      communitySourceId: 'agent-kit-agent-artifact'
    })
  })
})
