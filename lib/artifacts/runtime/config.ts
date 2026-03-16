export function getTemplateId(): string {
  return process.env.E2B_TEMPLATE_ID || 'base'
}

export function shouldSkipInstall(): boolean {
  return process.env.E2B_SKIP_INSTALL === 'true'
}
