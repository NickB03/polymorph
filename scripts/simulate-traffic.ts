/**
 * Synthetic traffic simulator for polymorph.fyi
 * Three realistic user sessions using Playwright.
 */
import { chromium, Browser, Page, BrowserContext } from 'playwright'

const BASE_URL = 'https://polymorph.fyi'

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const jitter = (base: number, spread = 0.3) =>
  base + (Math.random() * 2 - 1) * base * spread

async function humanScroll(page: Page, steps = 4) {
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, jitter(300, 0.4))
    await sleep(jitter(600, 0.5))
  }
}

async function log(msg: string) {
  console.log(`[${new Date().toISOString()}] ${msg}`)
}

// ---------------------------------------------------------------------------
// Session 1 — Homepage browse, read content, explore 2–3 pages
// ---------------------------------------------------------------------------
async function session1(browser: Browser) {
  log('=== SESSION 1: Browse homepage + explore pages ===')
  const ctx = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1440, height: 900 },
    locale: 'en-US',
    ignoreHTTPSErrors: true,
  })
  const page = await ctx.newPage()

  try {
    log('  → Navigating to homepage')
    const resp = await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
    log(`  → Status: ${resp?.status()} ${resp?.statusText()}`)

    await sleep(jitter(1500))
    log('  → Reading homepage — scrolling down')
    await humanScroll(page, 5)

    await sleep(jitter(2000))

    // Collect all internal links visible on the page
    const links = await page.$$eval(
      'a[href]',
      (els, base) =>
        els
          .map(el => (el as HTMLAnchorElement).href)
          .filter(h => h.startsWith(base) && h !== base && !h.includes('#')),
      BASE_URL,
    )
    const unique = [...new Set(links)].slice(0, 5)
    log(`  → Found ${unique.length} internal links: ${unique.join(', ')}`)

    // Visit up to 3 pages
    const toVisit = unique.slice(0, 3)
    for (const url of toVisit) {
      log(`  → Navigating to ${url}`)
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 })
      await sleep(jitter(1200))
      await humanScroll(page, 3)
      await sleep(jitter(2500, 0.4))
    }

    log('  ✓ Session 1 complete')
  } catch (err) {
    log(`  ✗ Session 1 error: ${(err as Error).message}`)
  } finally {
    await ctx.close()
  }
}

// ---------------------------------------------------------------------------
// Session 2 — Interact with feature/form (input, buttons)
// ---------------------------------------------------------------------------
async function session2(browser: Browser) {
  log('=== SESSION 2: Feature interaction / form ===')
  const ctx = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
    locale: 'en-US',
    ignoreHTTPSErrors: true,
  })
  const page = await ctx.newPage()

  try {
    log('  → Navigating to homepage')
    const resp = await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
    log(`  → Status: ${resp?.status()} ${resp?.statusText()}`)

    await sleep(jitter(1000))
    await humanScroll(page, 2)
    await sleep(jitter(1000))

    // Try to find and interact with a text input / chat box
    const inputSelectors = [
      'textarea',
      'input[type="text"]',
      'input[type="search"]',
      '[role="textbox"]',
      '[placeholder*="search" i]',
      '[placeholder*="ask" i]',
      '[placeholder*="message" i]',
      '[placeholder*="type" i]',
    ]

    let interacted = false
    for (const sel of inputSelectors) {
      const el = page.locator(sel).first()
      if ((await el.count()) > 0) {
        log(`  → Found input with selector: ${sel}`)
        await el.click()
        await sleep(jitter(600))
        const queries = [
          'What is polymorph?',
          'Tell me about AI research tools',
          'How does generative UI work?',
        ]
        const query = queries[Math.floor(Math.random() * queries.length)]
        await page.keyboard.type(query, { delay: jitter(80, 0.4) })
        log(`  → Typed: "${query}"`)
        await sleep(jitter(1200))

        // Submit — try Enter key, then a submit button
        await page.keyboard.press('Enter')
        log('  → Submitted with Enter key')
        await sleep(jitter(3000, 0.3))
        interacted = true
        break
      }
    }

    if (!interacted) {
      log('  → No interactive input found; clicking buttons instead')
      const btns = page.locator('button').all()
      const buttons = await btns
      log(`  → Found ${buttons.length} buttons`)
      for (const btn of buttons.slice(0, 3)) {
        try {
          const visible = await btn.isVisible()
          const enabled = await btn.isEnabled()
          if (visible && enabled) {
            const text = await btn.textContent()
            log(`  → Clicking button: "${text?.trim()}"`)
            await btn.click()
            await sleep(jitter(1500))
          }
        } catch {
          // skip unclickable buttons
        }
      }
    }

    log('  ✓ Session 2 complete')
  } catch (err) {
    log(`  ✗ Session 2 error: ${(err as Error).message}`)
  } finally {
    await ctx.close()
  }
}

// ---------------------------------------------------------------------------
// Session 3 — Navigate sections, linger on at least one page
// ---------------------------------------------------------------------------
async function session3(browser: Browser) {
  log('=== SESSION 3: Section navigation + dwell time ===')
  const ctx = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
    locale: 'en-US',
    ignoreHTTPSErrors: true,
  })
  const page = await ctx.newPage()

  try {
    log('  → Navigating to homepage')
    const resp = await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
    log(`  → Status: ${resp?.status()} ${resp?.statusText()}`)

    await sleep(jitter(2000))

    // Collect nav links (header/footer navigation)
    const navLinks = await page.$$eval(
      'nav a[href], header a[href], footer a[href]',
      (els, base) =>
        els
          .map(el => ({ href: (el as HTMLAnchorElement).href, text: el.textContent?.trim() }))
          .filter(({ href }) => href.startsWith(base) && !href.includes('#')),
      BASE_URL,
    )
    log(`  → Found ${navLinks.length} nav links`)

    // Visit homepage with deep reading
    log('  → Deep reading homepage (lingering)')
    await humanScroll(page, 8)
    await sleep(jitter(4000, 0.3))

    // Navigate 3–4 sections, scrolling and pausing on each
    const sections = [...new Map(navLinks.map(l => [l.href, l])).values()].slice(0, 4)
    for (const { href, text } of sections) {
      log(`  → Navigating to section: "${text}" → ${href}`)
      await page.goto(href, { waitUntil: 'domcontentloaded', timeout: 20000 })
      await sleep(jitter(1500))
      await humanScroll(page, 4)

      // Linger longer on the first section (simulate "reading")
      const dwell = sections.indexOf({ href, text } as any) === 0 ? jitter(6000, 0.2) : jitter(2500, 0.4)
      await sleep(dwell)
    }

    // If no nav links, scroll through homepage thoroughly
    if (sections.length === 0) {
      log('  → No nav links found; thorough homepage scroll')
      await humanScroll(page, 12)
      await sleep(jitter(5000))
    }

    log('  ✓ Session 3 complete')
  } catch (err) {
    log(`  ✗ Session 3 error: ${(err as Error).message}`)
  } finally {
    await ctx.close()
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  log('Launching Chromium (headless)')
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })

  try {
    // Session 1
    await session1(browser)
    log('Pausing between sessions (5–8 s)…')
    await sleep(jitter(6500, 0.2))

    // Session 2
    await session2(browser)
    log('Pausing between sessions (4–7 s)…')
    await sleep(jitter(5500, 0.2))

    // Session 3
    await session3(browser)
  } finally {
    await browser.close()
    log('Browser closed. All sessions done.')
  }
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
