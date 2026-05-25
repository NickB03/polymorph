import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { Gauge } from './gauge'

describe('Gauge', () => {
  it('rounds generated path coordinates for stable server/client hydration', () => {
    const html = renderToString(
      <Gauge
        value={92}
        centerValue={92}
        height={176}
        width={176}
        inactiveFillOpacity={0.3}
      />
    )
    const paths = [...html.matchAll(/\sd="([^"]+)"/g)].map(match => match[1])

    expect(paths.length).toBeGreaterThan(0)
    for (const path of paths) {
      expect(path).not.toMatch(/\d+\.\d{7,}/)
    }
  })
})
