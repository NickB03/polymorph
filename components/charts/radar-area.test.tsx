import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { RadarArea } from './radar-area'
import { RadarAxis } from './radar-axis'
import { RadarChart } from './radar-chart'
import { RadarGrid } from './radar-grid'
import { RadarLabels } from './radar-labels'

describe('RadarArea', () => {
  it('server-renders concrete SVG geometry attributes before motion hydrates', () => {
    const html = renderToString(
      <RadarChart
        data={[
          {
            label: 'This run',
            values: { faithfulness: 82, relevance: 91, safety: 88 }
          }
        ]}
        metrics={[
          { key: 'faithfulness', label: 'Faithfulness' },
          { key: 'relevance', label: 'Relevance' },
          { key: 'safety', label: 'Safety' }
        ]}
        size={240}
        levels={4}
        margin={48}
        animate
      >
        <RadarGrid showLabels={false} />
        <RadarAxis />
        <RadarLabels offset={20} fontSize={10} />
        <RadarArea index={0} showPoints showGlow />
      </RadarChart>
    )

    const pathTags = html.match(/<path\b[^>]*>/g) ?? []
    const areaPath = pathTags.at(-1)
    const pointTags = html.match(/<circle\b[^>]*>/g) ?? []

    expect(areaPath).toMatch(/\sd="/)
    expect(areaPath).toMatch(/\sfill-opacity="/)
    expect(areaPath).toMatch(/\sstroke-width="/)
    expect(pointTags.length).toBe(3)
    for (const pointTag of pointTags) {
      expect(pointTag).toMatch(/\scx="/)
      expect(pointTag).toMatch(/\scy="/)
      expect(pointTag).toMatch(/\sr="/)
    }
  })
})
