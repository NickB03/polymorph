// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockCompile, mockReadFileSync } = vi.hoisted(() => ({
  mockCompile: vi.fn(),
  mockReadFileSync: vi.fn()
}))

vi.mock('fs', () => ({
  default: {
    readFileSync: mockReadFileSync
  },
  readFileSync: mockReadFileSync
}))

vi.mock('tailwindcss', () => ({
  compile: mockCompile
}))

async function loadBuildTailwindCss() {
  vi.resetModules()
  return import('./build-tailwind-css')
}

describe('buildTailwindCss', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockReadFileSync.mockReturnValue('@import "tailwindcss";')
    mockCompile.mockImplementation(async (_entry, options) => {
      await options.loadStylesheet()

      return {
        build(candidates: string[]) {
          return `candidates:${[...candidates].sort().join('|')}`
        }
      }
    })
  })

  it('extracts supported class candidates from ts and tsx sources', async () => {
    const { buildTailwindCss } = await loadBuildTailwindCss()
    const css = await buildTailwindCss({
      'App.tsx': `
export default function App() {
  return (
    <div
      className="flex bg-blue-200"
      data-extra="ignored"
    >
      <div className={'items-center justify-between'} />
      <div className={\`grid \${dynamicClass} gap-2\`} />
      <div className={cn('text-red-500 font-bold', isActive && 'underline')} />
    </div>
  )
}
      `,
      'components.ts': `
export function Helpers() {
  return <div className={twMerge('rounded-xl shadow-lg', maybeClass)} />
}
      `,
      'notes.md': 'className="should-not-appear"',
      'styles.css': '.custom { color: red; }'
    })

    expect(css).toBe(
      'candidates:bg-blue-200|flex|font-bold|gap-2|grid|items-center|justify-between|rounded-xl|shadow-lg|text-red-500\n.custom { color: red; }'
    )
  })

  it('rejects when Tailwind compile fails', async () => {
    mockCompile.mockRejectedValueOnce(new Error('tailwind compile failed'))
    const { buildTailwindCss } = await loadBuildTailwindCss()

    await expect(
      buildTailwindCss({
        'App.tsx': 'export default function App() { return <div /> }'
      })
    ).rejects.toThrow('tailwind compile failed')
  })

  it('rejects when loading the Tailwind stylesheet fails', async () => {
    mockReadFileSync.mockImplementationOnce(() => {
      throw new Error('missing tailwind css')
    })
    const { buildTailwindCss } = await loadBuildTailwindCss()

    await expect(
      buildTailwindCss({
        'App.tsx': 'export default function App() { return <div /> }'
      })
    ).rejects.toThrow('missing tailwind css')
  })
})
