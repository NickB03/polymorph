/**
 * Synthetic traffic simulation for polymorph.fyi
 * Simulates three realistic user sessions using Playwright.
 */
import { chromium, type Page, type Browser } from 'playwright'

const BASE_URL = 'https://polymorph.fyi'

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function randomDelay(minMs: number, maxMs: number) {
  const ms = Math.floor(Math.random() * (maxMs - minMs) + minMs)
  return sleep(ms)
}

async function typeSlowly(page: Page, selector: string, text: string) {
  await page.click(selector)
  for (const char of text) {
    await page.keyboard.type(char)
    await sleep(Math.floor(Math.random() * 80 + 40))
  }
}

async function logStep(msg: string) {
  console.log(`[${new Date().toISOString()}] ${msg}`)
}

async function scrollPage(page: Page) {
  await page.evaluate(async () => {
    await new Promise<void>(resolve => {
      let totalHeight = 0
      const distance = 120
      const timer = setInterval(() => {
        window.scrollBy(0, distance)
        totalHeight += distance
        if (totalHeight >= document.body.scrollHeight * 0.8) {
          clearInterval(timer)
          resolve()
        }
      }, 180)
    })
  })
}

// ─── Session 1: Homepage browse + explore 2-3 pages ─────────────────────────

async function session1(browser: Browser) {
  logStep('=== SESSION 1: Browse & Explore ===')
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1440, height: 900 },
    locale: 'en-US',
    ignoreHTTPSErrors: true,
  })
  const page = await context.newPage()

  try {
    logStep('Navigating to homepage…')
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await randomDelay(2000, 4000)

    logStep('Reading homepage content…')
    await scrollPage(page)
    await randomDelay(3000, 5000)

    // Collect nav links
    const links = await page.$$eval(
      'a[href]',
      anchors =>
        anchors
          .map(a => ({ href: (a as HTMLAnchorElement).href, text: a.textContent?.trim() }))
          .filter(
            l =>
              l.href.startsWith('https://polymorph.fyi') &&
              !l.href.includes('#') &&
              l.text &&
              l.text.length > 0
          )
    )
    logStep(`Found ${links.length} internal links on homepage`)

    // Visit up to 2 additional pages
    const toVisit = links.slice(0, 2)
    for (const link of toVisit) {
      logStep(`Navigating to: ${link.href} ("${link.text}")`)
      await page.goto(link.href, { waitUntil: 'domcontentloaded', timeout: 30000 })
      await randomDelay(1500, 3000)
      await scrollPage(page)
      await randomDelay(2000, 4000)
    }

    logStep('Session 1 complete.')
  } catch (err) {
    logStep(`Session 1 error: ${err}`)
  } finally {
    await context.close()
  }
}

// ─── Session 2: Feature interaction / form input ─────────────────────────────

async function session2(browser: Browser) {
  logStep('=== SESSION 2: Feature Interaction ===')
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
    locale: 'en-US',
    ignoreHTTPSErrors: true,
  })
  const page = await context.newPage()

  try {
    logStep('Navigating to homepage…')
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await randomDelay(1500, 3000)

    // Try to find a chat / search / prompt input
    const inputSelectors = [
      'textarea',
      'input[type="text"]',
      'input[placeholder]',
      '[contenteditable="true"]',
    ]

    let interacted = false
    for (const selector of inputSelectors) {
      const el = await page.$(selector)
      if (el) {
        logStep(`Found input (${selector}), typing a prompt…`)
        await el.click()
        await randomDelay(500, 1000)
        await typeSlowly(page, selector, 'What is the history of the internet?')
        await randomDelay(1000, 2000)

        // Try pressing Enter to submit
        const submitBtn = await page.$('button[type="submit"], button:has-text("Send"), button:has-text("Go")')
        if (submitBtn) {
          logStep('Clicking submit button…')
          await submitBtn.click()
        } else {
          logStep('Pressing Enter to submit…')
          await page.keyboard.press('Enter')
        }

        await randomDelay(4000, 7000)
        logStep('Waiting for response / observing result…')
        await scrollPage(page)
        await randomDelay(3000, 5000)
        interacted = true
        break
      }
    }

    if (!interacted) {
      logStep('No input found — clicking around visible buttons instead…')
      const buttons = await page.$$('button')
      for (const btn of buttons.slice(0, 3)) {
        const text = await btn.textContent()
        logStep(`Clicking button: "${text?.trim()}"`)
        await btn.click().catch(() => {})
        await randomDelay(1500, 3000)
      }
    }

    logStep('Session 2 complete.')
  } catch (err) {
    logStep(`Session 2 error: ${err}`)
  } finally {
    await context.close()
  }
}

// ─── Session 3: Navigate sections, dwell on one page ─────────────────────────

async function session3(browser: Browser) {
  logStep('=== SESSION 3: Section Navigation + Dwell ===')
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
    locale: 'en-US',
    ignoreHTTPSErrors: true,
  })
  const page = await context.newPage()

  try {
    logStep('Navigating to homepage…')
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await randomDelay(1000, 2000)

    // Scroll through homepage sections slowly
    logStep('Slowly reading homepage sections…')
    await page.evaluate(async () => {
      await new Promise<void>(resolve => {
        let totalHeight = 0
        const distance = 60
        const timer = setInterval(() => {
          window.scrollBy(0, distance)
          totalHeight += distance
          if (totalHeight >= document.body.scrollHeight) {
            clearInterval(timer)
            resolve()
          }
        }, 300)
      })
    })
    await randomDelay(2000, 3500)

    // Try to find and click nav items
    const navLinks = await page.$$eval(
      'nav a, header a, [role="navigation"] a',
      anchors =>
        anchors
          .map(a => ({ href: (a as HTMLAnchorElement).href, text: a.textContent?.trim() }))
          .filter(l => l.href && !l.href.includes('#') && l.text && l.text.length > 0)
    )

    logStep(`Found ${navLinks.length} nav links`)
    const visited = new Set<string>()

    for (const link of navLinks.slice(0, 3)) {
      if (visited.has(link.href)) continue
      visited.add(link.href)
      logStep(`Visiting nav section: "${link.text}" → ${link.href}`)
      await page.goto(link.href, { waitUntil: 'domcontentloaded', timeout: 30000 })
      await randomDelay(1000, 2500)
      await scrollPage(page)
      await randomDelay(1500, 3000)
    }

    // Dwell on the last page for a while (simulating reading)
    logStep('Dwelling on current page — simulating reading…')
    await randomDelay(6000, 10000)

    // Scroll back to top
    await page.evaluate(() => window.scrollTo(0, 0))
    await randomDelay(1500, 2500)

    logStep('Session 3 complete.')
  } catch (err) {
    logStep(`Session 3 error: ${err}`)
  } finally {
    await context.close()
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  logStep('Launching Chromium browser…')
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  })

  try {
    await session1(browser)
    logStep('Pausing 8s between sessions…')
    await sleep(8000)

    await session2(browser)
    logStep('Pausing 12s between sessions…')
    await sleep(12000)

    await session3(browser)
  } finally {
    logStep('Closing browser.')
    await browser.close()
  }

  logStep('All three sessions complete.')
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
