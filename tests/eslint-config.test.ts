import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import eslintConfig from '../eslint.config.mjs'

type FlatConfigBlock = {
  files?: unknown
  rules?: Record<string, unknown>
}

function mergeRules(blocks: FlatConfigBlock | FlatConfigBlock[]) {
  const merged: Record<string, unknown> = {}

  for (const block of Array.isArray(blocks) ? blocks : [blocks]) {
    if (!block || typeof block !== 'object') continue
    Object.assign(merged, block.rules ?? {})
  }

  return merged
}

const eslintConfigSource = readFileSync(
  `${process.cwd()}/eslint.config.mjs`,
  'utf8'
)

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function getRuleLevel(value: unknown) {
  return Array.isArray(value) ? value[0] : value
}

function isDowngradeLevel(level: unknown) {
  return level === 'off' || level === 0 || level === 'warn' || level === 1
}

function hasConfigDowngradeJustification(
  rule: string,
  source: string = eslintConfigSource
) {
  const rulePattern = new RegExp(
    String.raw`['"]${escapeRegExp(rule)}['"]\s*:\s*(?:\[\s*)?(?:['"](?:off|warn)['"]|[01]\b)`
  )
  const lines = source.split('\n')

  for (const [index, line] of lines.entries()) {
    if (!rulePattern.test(line)) continue

    if (/\/\/.*\S/.test(line)) {
      return true
    }

    const previousLine = lines[index - 1]?.trim() ?? ''
    if (
      previousLine.startsWith('//') ||
      previousLine.startsWith('/*') ||
      previousLine.startsWith('*') ||
      previousLine.endsWith('*/')
    ) {
      return true
    }
  }

  return false
}

function getGlobalRuleDowngradeOffenders(
  baseRules: Record<string, unknown>,
  fullRules: Record<string, unknown>
) {
  const offenders: Array<{ level: unknown; rule: string }> = []

  for (const [rule, value] of Object.entries(fullRules)) {
    if (JSON.stringify(baseRules[rule]) === JSON.stringify(value)) {
      continue
    }

    const level = getRuleLevel(value)
    if (!isDowngradeLevel(level)) {
      continue
    }

    if (!hasConfigDowngradeJustification(rule)) {
      offenders.push({ level, rule })
    }
  }

  return offenders
}

function parseBareDisableDirectiveOffenders(output: string) {
  return output
    .trim()
    .split('\n')
    .filter(Boolean)
    .filter(line => !/--\s+\S/.test(line))
}

function getBareDisableDirectiveOffenders() {
  const trackedLintFiles = [
    '*.js',
    '*.jsx',
    '*.ts',
    '*.tsx',
    '*.mjs',
    '*.cjs',
    ':(exclude)tests/eslint-config.test.ts'
  ]

  let output = ''

  try {
    output = execSync(
      `git grep -nE "eslint-disable(-next-line|-line)?" -- ${trackedLintFiles
        .map(pattern => `'${pattern}'`)
        .join(' ')}`,
      { encoding: 'utf8' }
    )
  } catch {
    output = ''
  }

  return parseBareDisableDirectiveOffenders(output)
}

describe('lint policy helpers', () => {
  it('accepts a justified config-level downgrade', () => {
    const source = `
rules: {
  // Temporary until upstream rule handles request-time refs correctly.
  'react-hooks/refs': 'off'
}
`

    expect(hasConfigDowngradeJustification('react-hooks/refs', source)).toBe(
      true
    )
  })

  it('flags bare disables from repo-owned mjs files', () => {
    const grepOutput = [
      'eslint.config.mjs:10:// eslint-disable-next-line react-hooks/refs',
      'components/foo.tsx:20:// eslint-disable-next-line react-hooks/refs -- justified'
    ].join('\n')

    expect(parseBareDisableDirectiveOffenders(grepOutput)).toEqual([
      'eslint.config.mjs:10:// eslint-disable-next-line react-hooks/refs'
    ])
  })
})

describe('eslint.config.mjs', () => {
  it('requires justification for repo-owned global rule downgrades', () => {
    const baseRules = mergeRules(
      (nextCoreWebVitals as FlatConfigBlock[]).filter(block => !block.files)
    )
    const fullRules = mergeRules(
      (eslintConfig as FlatConfigBlock[]).filter(block => !block.files)
    )

    expect(
      getGlobalRuleDowngradeOffenders(baseRules, fullRules),
      `global repo-owned rule downgrades need a justification in eslint.config.mjs.\nbase rules checked: ${Object.keys(baseRules).length}\nfull rules checked: ${Object.keys(fullRules).length}`
    ).toEqual([])
  })
})

describe('eslint-disable directives', () => {
  it('require a `-- <reason>` justification across tracked JS and TS files', () => {
    const offenders = getBareDisableDirectiveOffenders()

    expect(
      offenders,
      `bare eslint-disable directives without -- reason:\n${offenders.join('\n')}`
    ).toEqual([])
  })
})
