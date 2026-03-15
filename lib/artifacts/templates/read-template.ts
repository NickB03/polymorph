import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

let cachedTemplateFilesPromise: Promise<Record<string, string>> | null = null

const TEMPLATE_ROOT = path.join(
  process.cwd(),
  'lib',
  'artifacts',
  'templates',
  'react-spa'
)

async function walkTemplateDirectory(
  dirPath: string,
  rootPath: string
): Promise<Record<string, string>> {
  const entries = await readdir(dirPath, { withFileTypes: true })
  const fileMaps = await Promise.all(
    entries.map(async entry => {
      const absolutePath = path.join(dirPath, entry.name)
      if (entry.isDirectory()) {
        return walkTemplateDirectory(absolutePath, rootPath)
      }

      const relativePath = path.relative(rootPath, absolutePath)
      const content = await readFile(absolutePath, 'utf8')
      return { [relativePath]: content }
    })
  )

  return Object.assign({}, ...fileMaps)
}

export async function readTemplateFiles(): Promise<Record<string, string>> {
  if (!cachedTemplateFilesPromise) {
    cachedTemplateFilesPromise = walkTemplateDirectory(
      TEMPLATE_ROOT,
      TEMPLATE_ROOT
    )
  }

  return cachedTemplateFilesPromise
}
