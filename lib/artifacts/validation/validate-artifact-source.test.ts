import { describe, expect, it } from 'vitest'

import { normalizeImports } from './normalize-imports'
import { validateArtifactSource } from './validate-artifact-source'

describe('normalizeImports', () => {
  it('rewrites fake shadcn package imports to local ui paths', () => {
    const result = normalizeImports(
      `import { Button } from 'shadcn/ui'\nimport { Card } from '@shadcn/ui'`
    )
    expect(result.code).toContain("from '@/components/ui/button'")
    expect(result.code).toContain("from '@/components/ui/card'")
    expect(result.repaired).toBe(true)
  })

  it('rewrites "shadcn/ui/button" style imports to local paths', () => {
    const result = normalizeImports(`import { Button } from 'shadcn/ui/button'`)
    expect(result.code).toContain("from '@/components/ui/button'")
    expect(result.repaired).toBe(true)
  })

  it('leaves valid local @/components/ui imports unchanged', () => {
    const code = `import { Button } from '@/components/ui/button'`
    const result = normalizeImports(code)
    expect(result.code).toBe(code)
    expect(result.repaired).toBe(false)
  })

  it('rewrites next/link to a simple anchor element hint', () => {
    const result = normalizeImports(`import Link from 'next/link'`)
    expect(result.code).not.toContain('next/link')
    expect(result.repaired).toBe(true)
  })

  it('rewrites next/image to a plain img hint', () => {
    const result = normalizeImports(`import Image from 'next/image'`)
    expect(result.code).not.toContain('next/image')
    expect(result.repaired).toBe(true)
  })

  it('handles multiple imports on separate lines', () => {
    const code = [
      `import { Button } from 'shadcn/ui'`,
      `import { cn } from '@/lib/utils'`,
      `import { Card } from '@shadcn/ui/card'`
    ].join('\n')
    const result = normalizeImports(code)
    expect(result.code).toContain("from '@/components/ui/button'")
    expect(result.code).toContain("from '@/lib/utils'")
    expect(result.code).toContain("from '@/components/ui/card'")
  })

  it('handles imports with named and default exports', () => {
    const result = normalizeImports(
      `import { Button, buttonVariants } from 'shadcn/ui'`
    )
    // When multiple named exports come from a generic shadcn path,
    // normalize to the first component's path
    expect(result.code).toContain("from '@/components/ui/button'")
    expect(result.repaired).toBe(true)
  })
})

describe('validateArtifactSource', () => {
  describe('template-owned file protection', () => {
    it('rejects writes to package.json', () => {
      const result = validateArtifactSource({
        filePath: 'package.json',
        content: '{ "dependencies": {} }'
      })
      expect(result.valid).toBe(false)
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: 'TEMPLATE_OWNED_FILE' })
      )
    })

    it('rejects writes to vite.config.ts', () => {
      const result = validateArtifactSource({
        filePath: 'vite.config.ts',
        content: 'export default {}'
      })
      expect(result.valid).toBe(false)
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: 'TEMPLATE_OWNED_FILE' })
      )
    })

    it('rejects writes to tailwind.config.js', () => {
      const result = validateArtifactSource({
        filePath: 'tailwind.config.js',
        content: 'module.exports = {}'
      })
      expect(result.valid).toBe(false)
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: 'TEMPLATE_OWNED_FILE' })
      )
    })

    it('rejects writes to tsconfig.json', () => {
      const result = validateArtifactSource({
        filePath: 'tsconfig.json',
        content: '{}'
      })
      expect(result.valid).toBe(false)
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: 'TEMPLATE_OWNED_FILE' })
      )
    })

    it('rejects writes to template-owned component files', () => {
      const result = validateArtifactSource({
        filePath: 'src/components/ui/button.tsx',
        content: 'export const Button = () => <button />'
      })
      expect(result.valid).toBe(false)
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: 'TEMPLATE_OWNED_FILE' })
      )
    })

    it('rejects writes to index.html', () => {
      const result = validateArtifactSource({
        filePath: 'index.html',
        content: '<!DOCTYPE html><html></html>'
      })
      expect(result.valid).toBe(false)
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: 'TEMPLATE_OWNED_FILE' })
      )
    })

    it('rejects writes to postcss.config.js', () => {
      const result = validateArtifactSource({
        filePath: 'postcss.config.js',
        content: 'module.exports = {}'
      })
      expect(result.valid).toBe(false)
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: 'TEMPLATE_OWNED_FILE' })
      )
    })

    it('returns early on template-owned file without checking imports', () => {
      // If the file is template-owned, validation should stop before import checks
      const result = validateArtifactSource({
        filePath: 'package.json',
        content: '{ "dependencies": { "axios": "1.0.0" } }'
      })
      // Should have exactly one error (TEMPLATE_OWNED_FILE), not UNSUPPORTED_PACKAGE
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].code).toBe('TEMPLATE_OWNED_FILE')
    })

    it('allows writes to src/App.tsx', () => {
      const result = validateArtifactSource({
        filePath: 'src/App.tsx',
        content: 'export default function App() { return <div>Hello</div> }'
      })
      expect(result.valid).toBe(true)
    })

    it('allows writes to new src/ files', () => {
      const result = validateArtifactSource({
        filePath: 'src/pages/Dashboard.tsx',
        content: 'export default function Dashboard() { return <div /> }'
      })
      expect(result.valid).toBe(true)
    })
  })

  describe('import validation', () => {
    it('rejects Next.js-only imports', () => {
      const result = validateArtifactSource({
        filePath: 'src/App.tsx',
        content: `import { useRouter } from 'next/navigation'\nexport default function App() { return <div /> }`
      })
      expect(result.valid).toBe(false)
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: 'BANNED_IMPORT' })
      )
    })

    it('rejects next/server imports', () => {
      const result = validateArtifactSource({
        filePath: 'src/App.tsx',
        content: `import { NextResponse } from 'next/server'`
      })
      expect(result.valid).toBe(false)
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: 'BANNED_IMPORT' })
      )
    })

    it('rejects unsupported npm package imports', () => {
      const result = validateArtifactSource({
        filePath: 'src/App.tsx',
        content: `import axios from 'axios'\nexport default function App() { return <div /> }`
      })
      expect(result.valid).toBe(false)
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: 'UNSUPPORTED_PACKAGE' })
      )
    })

    it('allows preinstalled package imports', () => {
      const result = validateArtifactSource({
        filePath: 'src/App.tsx',
        content: `import { motion } from 'framer-motion'\nexport default function App() { return <motion.div /> }`
      })
      expect(result.valid).toBe(true)
    })

    it('allows react and react-dom imports', () => {
      const result = validateArtifactSource({
        filePath: 'src/App.tsx',
        content: `import React, { useState } from 'react'\nexport default function App() { return <div /> }`
      })
      expect(result.valid).toBe(true)
    })

    it('allows local @/components/ui/* imports', () => {
      const result = validateArtifactSource({
        filePath: 'src/App.tsx',
        content: `import { Button } from '@/components/ui/button'\nexport default function App() { return <Button /> }`
      })
      expect(result.valid).toBe(true)
    })

    it('allows relative imports', () => {
      const result = validateArtifactSource({
        filePath: 'src/pages/Home.tsx',
        content: `import { Header } from '../components/Header'\nexport default function Home() { return <Header /> }`
      })
      expect(result.valid).toBe(true)
    })

    it('allows @/lib/utils imports', () => {
      const result = validateArtifactSource({
        filePath: 'src/App.tsx',
        content: `import { cn } from '@/lib/utils'\nexport default function App() { return <div className={cn('foo')} /> }`
      })
      expect(result.valid).toBe(true)
    })
  })

  describe('repairable errors', () => {
    it('returns repairable flag for shadcn-style imports', () => {
      const result = validateArtifactSource({
        filePath: 'src/App.tsx',
        content: `import { Button } from 'shadcn/ui'`
      })
      // shadcn imports are auto-repaired during normalization
      // so validation after normalization should pass
      expect(result.valid).toBe(true)
      expect(result.repaired).toBe(true)
    })

    it('returns repaired code when imports are fixable', () => {
      const result = validateArtifactSource({
        filePath: 'src/App.tsx',
        content: `import { Button } from '@shadcn/ui'\nexport default function App() { return <Button /> }`
      })
      expect(result.valid).toBe(true)
      expect(result.repaired).toBe(true)
      expect(result.repairedContent).toContain("from '@/components/ui/button'")
    })
  })

  describe('structured error reporting', () => {
    it('returns multiple errors for multiple violations', () => {
      const result = validateArtifactSource({
        filePath: 'package.json',
        content: '{}'
      })
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors[0]).toHaveProperty('code')
      expect(result.errors[0]).toHaveProperty('message')
    })
  })
})
