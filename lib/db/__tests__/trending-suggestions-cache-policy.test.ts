import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

function readRepoFile(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8')
}

describe('trending suggestions cache policies', () => {
  it('does not define a public write policy in the schema', () => {
    const schemaSource = readRepoFile('lib/db/schema.ts')

    expect(schemaSource).not.toContain(
      "pgPolicy('server_write_trending_suggestions_cache'"
    )
  })

  it('does not create a public write policy in the migration', () => {
    const migrationSource = readRepoFile(
      'drizzle/0017_add_trending_suggestions_cache.sql'
    )

    expect(migrationSource).not.toMatch(
      /CREATE POLICY[\s\S]+ON "trending_suggestions_cache"[\s\S]+FOR (ALL|INSERT|UPDATE|DELETE)/i
    )
  })

  it('drops the public write policy in a follow-up migration', () => {
    const migrationSource = readRepoFile(
      'drizzle/0018_drop_trending_suggestions_public_write_policy.sql'
    )

    expect(migrationSource).toContain(
      'DROP POLICY IF EXISTS "server_write_trending_suggestions_cache"'
    )
  })
})
