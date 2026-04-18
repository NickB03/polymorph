import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import { execSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

import eslintConfig from '../eslint.config.mjs'

type FlatConfigBlock = {
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

describe('eslint.config.mjs', () => {
  it('keeps repo-owned rule overrides at error level', () => {
    const baseRules = mergeRules(nextCoreWebVitals as FlatConfigBlock[])
    const fullRules = mergeRules(eslintConfig as FlatConfigBlock[])
    const offenders: Array<{ level: unknown; rule: string }> = []

    for (const [rule, value] of Object.entries(fullRules)) {
      if (JSON.stringify(baseRules[rule]) === JSON.stringify(value)) {
        continue
      }

      const level = Array.isArray(value) ? value[0] : value

      if (level === 'off' || level === 0 || level === 'warn' || level === 1) {
        offenders.push({ level, rule })
      }
    }

    expect(offenders).toEqual([])
  })
})

describe('eslint-disable directives', () => {
  it('every disable directive includes a `-- <reason>` justification', () => {
    let output = ''

    try {
      output = execSync(
        `grep -rEn "eslint-disable(-next-line|-line)?" ` +
          `--include="*.ts" --include="*.tsx" ` +
          `components hooks app lib tests 2>/dev/null | ` +
          `grep -v "tests/eslint-config.test.ts:" | ` +
          `grep -v -- "--" || true`,
        { encoding: 'utf8' }
      )
    } catch {
      output = ''
    }

    const offenders = output.trim().split('\n').filter(Boolean)

    expect(
      offenders,
      `bare eslint-disable directives without -- reason:\n${offenders.join('\n')}`
    ).toEqual([])
  })
})
