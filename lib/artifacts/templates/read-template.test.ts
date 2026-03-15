import { describe, expect, it } from 'vitest'

import { readTemplateFiles } from './read-template'

describe('readTemplateFiles', () => {
  it('reads the React SPA template into a path-to-content map', async () => {
    const files = await readTemplateFiles()

    expect(files['package.json']).toContain('"artifact-app"')
    expect(files['src/App.tsx']).toContain('export default function App')
    expect(files['src/components/ui/button.tsx']).toContain('Button')
  })

  it('returns the same cached object on repeated reads', async () => {
    const first = await readTemplateFiles()
    const second = await readTemplateFiles()

    expect(second).toBe(first)
  })
})
