import { chromium, type Page } from 'playwright'

const SITE = 'https://polymorph.fyi'
const BROWSERS_PATH = '/opt/pw-browsers'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const jitter = (base: number, spread = 0.4) =>
  base + (Math.random() - 0.5) * base * spread

async function humanScroll(page: Page, steps = 4) {
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, jitter(300))
    await sleep(jitter(600))
  }
}

async function logStep(label: string) {
  console.log(`  [${new Date().toISOString()}] ${label}`)
}

async function session1(browser: Awaited<ReturnType<typeof chromium.launch>>) {
  console.log('\n=== Session 1: Browse homepage + explore pages ===')
  const ctx = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1440, height: 900 },
  })
  const page = await ctx.newPage()

  try {
    await logStep('Navigating to homepage')
    const resp = await page.goto(SITE, { waitUntil: 'domcontentloaded', timeout: 30000 })
    console.log(`  Status: ${resp?.status()} ${resp?.url()}`)
    const bodyText = await page.evaluate(() => document.body?.innerText?.slice(0, 500) ?? '(empty)')
    const title = await page.title()
    console.log(`  Title: ${title}`)
    console.log(`  Body preview: ${bodyText}`)
    await sleep(jitter(1800))

    await logStep('Reading homepage — scrolling down')
    await humanScroll(page, 5)
    await sleep(jitter(2000))

    await logStep('Scrolling back up')
    await page.mouse.wheel(0, -1200)
    await sleep(jitter(1200))

    // Try to find navigation links
    const links = await page.$$eval('a[href]', (els) =>
      els
        .map((a) => ({ href: (a as HTMLAnchorElement).href, text: a.textContent?.trim() ?? '' }))
        .filter(
          (l) =>
            l.href.startsWith('https://polymorph.fyi') &&
            !l.href.includes('#') &&
            l.href !== 'https://polymorph.fyi/' &&
            l.text.length > 0,
        )
        .slice(0, 8),
    )

    console.log(`  Found ${links.length} internal links: ${links.map((l) => l.text || l.href).join(', ')}`)

    const visited: string[] = []
    for (const link of links.slice(0, 3)) {
      if (visited.includes(link.href)) continue
      visited.push(link.href)
      await logStep(`Clicking link: "${link.text}" → ${link.href}`)
      await page.goto(link.href, { waitUntil: 'domcontentloaded', timeout: 20000 })
      await sleep(jitter(1500))
      await humanScroll(page, 3)
      await sleep(jitter(2500))
    }

    // Navigate back home
    await logStep('Navigating back to homepage')
    await page.goto(SITE, { waitUntil: 'domcontentloaded', timeout: 20000 })
    await sleep(jitter(1500))
  } catch (e) {
    console.log(`  ERROR: ${(e as Error).message}`)
  } finally {
    await ctx.close()
  }
}

async function session2(browser: Awaited<ReturnType<typeof chromium.launch>>) {
  console.log('\n=== Session 2: Interact with features / forms ===')
  const ctx = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
  })
  const page = await ctx.newPage()

  try {
    await logStep('Loading site')
    const resp = await page.goto(SITE, { waitUntil: 'domcontentloaded', timeout: 30000 })
    console.log(`  Status: ${resp?.status()} ${resp?.url()}`)
    await sleep(jitter(1500))

    // Look for text inputs, textareas, search boxes
    const inputs = await page.$$('input[type="text"], input[type="search"], textarea, input:not([type])')
    console.log(`  Found ${inputs.length} text inputs`)

    if (inputs.length > 0) {
      await logStep('Clicking into first text input')
      await inputs[0].click()
      await sleep(jitter(600))

      // Type a realistic query character by character
      const query = 'AI research tools for science'
      for (const char of query) {
        await page.keyboard.type(char)
        await sleep(jitter(80))
      }
      await sleep(jitter(1200))
      await logStep(`Typed query: "${query}"`)

      // Try pressing Enter to submit
      await page.keyboard.press('Enter')
      await sleep(jitter(3000))
      await logStep('Submitted query, waiting for response')

      await humanScroll(page, 3)
      await sleep(jitter(4000))
    } else {
      await logStep('No text inputs found — scrolling and reading page')
      await humanScroll(page, 5)
      await sleep(jitter(3000))
    }

    // Look for buttons
    const buttons = await page.$$eval('button:not([disabled])', (els) =>
      els
        .map((b) => b.textContent?.trim() ?? '')
        .filter((t) => t.length > 0 && t.length < 40),
    )
    console.log(`  Visible buttons: ${buttons.slice(0, 6).join(', ')}`)

    // Try clicking a non-destructive button (Sign in, Learn more, Get started, etc.)
    const safeButtonTexts = ['sign in', 'log in', 'get started', 'learn more', 'try', 'explore', 'continue']
    const safeButton = await page.$(`button:not([disabled])`)
    if (safeButton) {
      const btnText = await safeButton.textContent()
      const isSafe = safeButtonTexts.some((t) => btnText?.toLowerCase().includes(t))
      if (isSafe) {
        await logStep(`Clicking button: "${btnText?.trim()}"`)
        await safeButton.click()
        await sleep(jitter(2000))
      }
    }
  } catch (e) {
    console.log(`  ERROR: ${(e as Error).message}`)
  } finally {
    await ctx.close()
  }
}

async function session3(browser: Awaited<ReturnType<typeof chromium.launch>>) {
  console.log('\n=== Session 3: Navigate sections, dwell time ===')
  const ctx = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
  })
  const page = await ctx.newPage()

  try {
    await logStep('Loading site')
    const resp = await page.goto(SITE, { waitUntil: 'domcontentloaded', timeout: 30000 })
    console.log(`  Status: ${resp?.status()} ${resp?.url()}`)
    await sleep(jitter(2000))

    await logStep('Deep read of homepage — slow scroll')
    for (let i = 0; i < 8; i++) {
      await page.mouse.wheel(0, jitter(250))
      await sleep(jitter(900))
    }
    await sleep(jitter(3000))

    // Gather all unique internal paths
    const allLinks = await page.$$eval('a[href]', (els) =>
      [...new Set(
        els
          .map((a) => (a as HTMLAnchorElement).href)
          .filter(
            (h) =>
              h.startsWith('https://polymorph.fyi') &&
              !h.includes('#') &&
              h !== 'https://polymorph.fyi/',
          ),
      )].slice(0, 10),
    )
    console.log(`  Discovered ${allLinks.length} unique internal pages`)

    // Visit 2 pages with meaningful dwell
    for (const href of allLinks.slice(0, 2)) {
      await logStep(`Navigating to ${href}`)
      await page.goto(href, { waitUntil: 'domcontentloaded', timeout: 20000 })
      await sleep(jitter(1800))

      await logStep('Reading content — slow scroll')
      for (let i = 0; i < 6; i++) {
        await page.mouse.wheel(0, jitter(220))
        await sleep(jitter(1100))
      }
      // Dwell on the page
      await sleep(jitter(5000))
      await logStep(`Finished reading ${href}`)
    }

    // Return home and linger
    await logStep('Back to homepage, lingering')
    await page.goto(SITE, { waitUntil: 'domcontentloaded', timeout: 20000 })
    await sleep(jitter(2000))
    await humanScroll(page, 4)
    await sleep(jitter(2500))
  } catch (e) {
    console.log(`  ERROR: ${(e as Error).message}`)
  } finally {
    await ctx.close()
  }
}

async function main() {
  console.log('Starting synthetic traffic simulation on polymorph.fyi')
  console.log(`Time: ${new Date().toISOString()}`)

  const browser = await chromium.launch({
    executablePath: `${BROWSERS_PATH}/chromium-1194/chrome-linux/chrome`,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--ignore-certificate-errors',
    ],
  })

  try {
    await session1(browser)
    console.log('\n--- Pause between sessions (natural gap) ---')
    await sleep(jitter(8000, 0.3))

    await session2(browser)
    console.log('\n--- Pause between sessions ---')
    await sleep(jitter(6000, 0.3))

    await session3(browser)
  } finally {
    await browser.close()
    console.log('\nAll sessions complete. Browser closed.')
  }
}

main().catch((e) => {
  console.error('Fatal:', e)
  process.exit(1)
})
