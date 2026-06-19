/**
 * Synthetic traffic generator for polymorph.fyi
 * Simulates three realistic user sessions using Playwright.
 */
import { type BrowserContext,chromium, type Page } from 'playwright'

const BASE_URL = 'https://polymorph.fyi'

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function jitter(base: number, spread = 0.3) {
  return Math.round(base + (Math.random() * 2 - 1) * base * spread)
}

function log(msg: string) {
  console.log(`[${new Date().toISOString()}] ${msg}`)
}

/** Dismiss the demo onboarding modal if present */
async function dismissModal(page: Page) {
  // Check for the radix dialog
  const dialog = page.locator('[role="dialog"][data-state="open"]')
  if (await dialog.isVisible().catch(() => false)) {
    log('  → dismissing onboarding modal')
    // Try to find a close button inside the dialog
    const closeBtn = dialog
      .locator('button')
      .filter({ hasText: /close|dismiss|skip|×|✕/i })
      .first()
    if (await closeBtn.isVisible().catch(() => false)) {
      await closeBtn.click({ timeout: 3000 }).catch(() => {})
    } else {
      // Click the video itself (the modal intercepts clicks, video click may close it)
      const video = dialog.locator('video')
      if (await video.isVisible().catch(() => false)) {
        await video.click({ timeout: 3000 }).catch(() => {})
        await sleep(500)
      }
      // Press Escape to close
      await page.keyboard.press('Escape')
    }
    await sleep(800)
  }
}

/** Try a click, catching errors so sessions don't abort */
async function tryClick(
  page: Page,
  locator: ReturnType<Page['locator']>,
  label: string
) {
  if (await locator.isVisible().catch(() => false)) {
    await locator.click({ timeout: 5000 }).catch(err => {
      log(`  ⚠ could not click ${label}: ${err.message.split('\n')[0]}`)
    })
  } else {
    log(`  – ${label} not visible, skipping`)
  }
}

// ── Session 1: Browse homepage, read content, explore 2–3 pages ──────────────
async function session1(ctx: BrowserContext) {
  const page = await ctx.newPage()
  log('Session 1 — opening homepage')

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' })
  await sleep(jitter(2000))
  await dismissModal(page)

  // Read the action menu options (Research, Compare, Latest, etc.)
  log('Session 1 — reading homepage content')
  await page.mouse.move(jitter(500, 0.2), jitter(300, 0.2))
  await sleep(jitter(1800))

  // Hover over the feature action buttons
  for (const label of ['Research', 'Compare', 'Latest']) {
    const btn = page
      .locator('button, a, [role="button"]')
      .filter({ hasText: new RegExp(`^${label}$`, 'i') })
      .first()
    if (await btn.isVisible().catch(() => false)) {
      log(`Session 1 — hovering ${label}`)
      await btn.hover({ timeout: 3000 }).catch(() => {})
      await sleep(jitter(700))
    }
  }

  // Navigate to login page and linger
  log('Session 1 — navigating to login page')
  await page
    .goto(`${BASE_URL}/auth/login`, { waitUntil: 'domcontentloaded' })
    .catch(() => {})
  await sleep(jitter(2500))

  // Move mouse as if reading
  await page.mouse.move(jitter(400, 0.2), jitter(400, 0.3))
  await sleep(jitter(1200))
  await page.mouse.move(jitter(600, 0.2), jitter(300, 0.2))
  await sleep(jitter(800))

  // Return to homepage
  log('Session 1 — returning to homepage')
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' }).catch(() => {})
  await sleep(jitter(1500))
  await dismissModal(page)

  // Scroll down
  await page.mouse.wheel(0, 300)
  await sleep(jitter(1200))

  await page.close()
  log('Session 1 — complete')
}

// ── Session 2: Interact with the main chat form ───────────────────────────────
async function session2(ctx: BrowserContext) {
  const page = await ctx.newPage()
  log('Session 2 — opening homepage')

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' })
  await sleep(jitter(2500))
  await dismissModal(page)

  // Click the Research feature pill
  log('Session 2 — clicking Research feature pill')
  const researchBtn = page
    .locator('button, a, [role="button"]')
    .filter({ hasText: /^research$/i })
    .first()
  await tryClick(page, researchBtn, 'Research pill')
  await sleep(jitter(1200))

  // Find the chat textarea and type a query
  const chatInput = page
    .locator('textarea, [contenteditable="true"], [role="textbox"]')
    .first()
  if (await chatInput.isVisible().catch(() => false)) {
    log('Session 2 — typing query in chat input')
    await chatInput.click({ timeout: 5000 }).catch(() => {})
    await sleep(jitter(500))

    const query = 'What are the latest developments in AI research?'
    await page.keyboard.type(query, { delay: jitter(60, 0.5) })
    await sleep(jitter(1800))

    // Revise: clear and retype
    log('Session 2 — revising query')
    await page.keyboard.press('Control+A')
    await sleep(jitter(400))

    const query2 = 'Compare GPT-4 and Claude capabilities'
    await page.keyboard.type(query2, { delay: jitter(60, 0.5) })
    await sleep(jitter(1500))

    // Submit
    log('Session 2 — submitting query')
    await page.keyboard.press('Enter')
    await sleep(jitter(4000))
  } else {
    log('Session 2 — chat input not found, scrolling instead')
    await page.mouse.wheel(0, 400)
    await sleep(jitter(2000))
  }

  // Click the Compare button
  log('Session 2 — clicking Compare pill')
  const compareBtn = page
    .locator('button, a, [role="button"]')
    .filter({ hasText: /^compare$/i })
    .first()
  await tryClick(page, compareBtn, 'Compare pill')
  await sleep(jitter(1500))

  await page.close()
  log('Session 2 — complete')
}

// ── Session 3: Navigate sections, spend time on one page ─────────────────────
async function session3(ctx: BrowserContext) {
  const page = await ctx.newPage()
  log('Session 3 — opening homepage')

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' })
  await sleep(jitter(2000))
  await dismissModal(page)

  // Scroll slowly through the page
  log('Session 3 — scrolling through homepage content')
  for (let i = 0; i < 4; i++) {
    await page.mouse.wheel(0, jitter(250, 0.3))
    await sleep(jitter(900))
  }

  // Hover feature pills
  for (const label of ['Explain', 'Build', 'Summarize']) {
    const btn = page
      .locator('button, a, [role="button"]')
      .filter({ hasText: new RegExp(`^${label}$`, 'i') })
      .first()
    if (await btn.isVisible().catch(() => false)) {
      log(`Session 3 — hovering ${label}`)
      await btn.hover({ timeout: 3000 }).catch(() => {})
      await sleep(jitter(800))
    }
  }

  // Spend time on the login page
  log('Session 3 — spending time on login page')
  await page
    .goto(`${BASE_URL}/auth/login`, { waitUntil: 'domcontentloaded' })
    .catch(() => {})
  await sleep(jitter(4000))

  // Mouse movements as if reading a login form
  for (let i = 0; i < 3; i++) {
    await page.mouse.move(jitter(500, 0.3), jitter(400 + i * 60, 0.2))
    await sleep(jitter(1000))
  }

  // Back to homepage
  log('Session 3 — navigating back to homepage')
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' }).catch(() => {})
  await sleep(jitter(1500))
  await dismissModal(page)

  // Click the Latest pill
  log('Session 3 — clicking Latest pill')
  const latestBtn = page
    .locator('button, a, [role="button"]')
    .filter({ hasText: /^latest$/i })
    .first()
  await tryClick(page, latestBtn, 'Latest pill')
  await sleep(jitter(2500))

  await page.close()
  log('Session 3 — complete')
}

// ── Main ─────────────────────────────────────────────────────────────────────
;(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: [
      '--ignore-certificate-errors',
      '--no-sandbox',
      '--disable-setuid-sandbox'
    ]
  })

  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64; rv:126.0) Gecko/20100101 Firefox/126.0'
  ]

  const viewports = [
    { width: 1440, height: 900 },
    { width: 1280, height: 800 },
    { width: 1920, height: 1080 }
  ]

  try {
    // Session 1
    log('=== Starting Session 1 ===')
    const ctx1 = await browser.newContext({
      userAgent: userAgents[0],
      viewport: viewports[0],
      ignoreHTTPSErrors: true
    })
    await session1(ctx1)
    await ctx1.close()

    await sleep(jitter(4000, 0.4))

    // Session 2
    log('=== Starting Session 2 ===')
    const ctx2 = await browser.newContext({
      userAgent: userAgents[1],
      viewport: viewports[1],
      ignoreHTTPSErrors: true
    })
    await session2(ctx2)
    await ctx2.close()

    await sleep(jitter(5000, 0.4))

    // Session 3
    log('=== Starting Session 3 ===')
    const ctx3 = await browser.newContext({
      userAgent: userAgents[2],
      viewport: viewports[2],
      ignoreHTTPSErrors: true
    })
    await session3(ctx3)
    await ctx3.close()

    log('=== All sessions complete ===')
  } catch (err) {
    console.error('Traffic simulation error:', err)
    process.exit(1)
  } finally {
    await browser.close()
  }
})()
