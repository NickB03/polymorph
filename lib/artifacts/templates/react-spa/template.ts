import { Template, waitForPort } from 'e2b'

const APP_ROOT = '/home/user/app'
const DEV_SERVER_PORT = 5173

/**
 * E2B Build System 2.0 template for the React SPA artifact runtime.
 *
 * Pre-bakes Node.js 22, all npm dependencies, template configs, and
 * UI components into the image. The Vite dev server starts on boot
 * via `setStartCmd`, so sandbox creation time drops from ~75-170s
 * (cold npm install) to ~3-5s.
 *
 * Rebuild whenever template dependencies or config files change:
 *   bun run build:template
 */
export const reactSpaTemplate = Template()
  .fromNodeImage('22-slim')
  .aptInstall(['curl'])
  .setWorkdir(APP_ROOT)
  .copy('package.json', `${APP_ROOT}/package.json`)
  .copy('vite.config.ts', `${APP_ROOT}/vite.config.ts`)
  .copy('tsconfig.json', `${APP_ROOT}/tsconfig.json`)
  .copy('postcss.config.js', `${APP_ROOT}/postcss.config.js`)
  .copy('tailwind.config.js', `${APP_ROOT}/tailwind.config.js`)
  .copy('index.html', `${APP_ROOT}/index.html`)
  .copy('src/', `${APP_ROOT}/src/`)
  .npmInstall()
  .setStartCmd('npm run dev', waitForPort(DEV_SERVER_PORT))
