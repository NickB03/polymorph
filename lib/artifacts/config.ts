/**
 * Artifacts feature configuration (client-side).
 *
 * Feature-gated behind NEXT_PUBLIC_ENABLE_ARTIFACTS (mirrors ENABLE_VOICE pattern).
 * The server-side ENABLE_ARTIFACTS gates the actual tool availability in the agent;
 * this flag controls whether UI surfaces (e.g. the Build pill) are shown.
 */

export function isArtifactsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_ARTIFACTS === 'true'
}
