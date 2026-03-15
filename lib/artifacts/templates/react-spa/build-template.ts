import { defaultBuildLogger, Template } from 'e2b'

import { reactSpaTemplate } from './template'

const TEMPLATE_NAME = 'polymorph-react-spa'

async function main() {
  if (!process.env.E2B_API_KEY) {
    console.error('E2B_API_KEY environment variable is required')
    process.exit(1)
  }

  console.log(`Building E2B template "${TEMPLATE_NAME}"...`)
  console.log('This may take a few minutes on first build.\n')

  const buildInfo = await Template.build(reactSpaTemplate, TEMPLATE_NAME, {
    cpuCount: 2,
    memoryMB: 2048,
    onBuildLogs: defaultBuildLogger({ minLevel: 'info' })
  })

  console.log('\nTemplate built successfully!')
  console.log(`  Name:        ${buildInfo.name}`)
  console.log(`  Template ID: ${buildInfo.templateId}`)
  console.log(`  Build ID:    ${buildInfo.buildId}`)
  console.log(`  Tags:        ${buildInfo.tags.join(', ') || '(none)'}`)
  console.log('\nSet these environment variables:')
  console.log(`  E2B_TEMPLATE_ID=${TEMPLATE_NAME}`)
  console.log('  E2B_SKIP_INSTALL=true')
}

main().catch(error => {
  console.error('Template build failed:', error)
  process.exit(1)
})
