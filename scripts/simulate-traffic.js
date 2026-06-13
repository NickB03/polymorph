/**
 * Synthetic traffic simulation for polymorph.fyi
 * Three realistic user sessions with natural pacing.
 */
const { chromium } = require('/opt/node22/lib/node_modules/playwright')

const BASE_URL = 'https://polymorph.fyi'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Random pause between min and max ms to mimic human pacing
const pause = (min, max) => sleep(min + Math.random() * (max - min))

async function session1(browser) {
  console.log('\n=== Session 1: Browse homepage and explore pages ===')
  const ctx = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
  })
  const page = await ctx.newPage()

  try {
    console.log('  → Navigating to homepage')
    const resp = await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
    console.log(`  ✓ Homepage loaded — status ${resp?.status()}`)
    await pause(2000, 4000)

    // Scroll through the homepage like a reader
    for (let i = 0; i < 4; i++) {
      await page.mouse.wheel(0, 300 + Math.random() * 200)
      await pause(600, 1400)
    }
    console.log('  ✓ Scrolled homepage')

    // Collect internal links
    const links = await page.$$eval(
      'a[href]',
      (els, base) =>
        els
          .map((a) => a.href)
          .filter((h) => h.startsWith(base) && !h.includes('#') && h !== base)
          .slice(0, 6),
      BASE_URL,
    )
    console.log(`  ℹ Found ${links.length} internal links`)

    // Visit up to 2 pages
    const toVisit = [...new Set(links)].slice(0, 2)
    for (const url of toVisit) {
      await pause(1500, 3000)
      console.log(`  → Navigating to ${url}`)
      const r = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 })
      console.log(`  ✓ Loaded — status ${r?.status()}`)
      await pause(2000, 4000)
      // Simulate reading by scrolling
      for (let i = 0; i < 3; i++) {
        await page.mouse.wheel(0, 250 + Math.random() * 150)
        await pause(700, 1500)
      }
    }
  } catch (err) {
    console.error('  ✗ Session 1 error:', err.message)
  } finally {
    await ctx.close()
    console.log('  Session 1 complete')
  }
}

async function session2(browser) {
  console.log('\n=== Session 2: Feature interaction / form inputs ===')
  const ctx = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
    ignoreHTTPSErrors: true,
  })
  const page = await ctx.newPage()

  try {
    console.log('  → Navigating to homepage')
    const resp = await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
    console.log(`  ✓ Homepage loaded — status ${resp?.status()}`)
    await pause(1500, 2500)

    // Dismiss any modal/dialog (e.g. demo video overlay) before interacting
    await page.keyboard.press('Escape')
    await pause(500, 800)
    const dialog = await page.$('[role="dialog"][data-state="open"]')
    if (dialog) {
      const closeBtn = await page.$('[aria-label="Close"], button:has-text("Close"), [data-state="open"] button')
      if (closeBtn) await closeBtn.click()
      else await page.keyboard.press('Escape')
      await pause(400, 700)
    }

    // Look for a chat / prompt input (polymorph's main interaction)
    const inputSelectors = [
      'textarea',
      'input[type="text"]',
      'input[placeholder]',
      '[contenteditable="true"]',
      '[role="textbox"]',
    ]

    let inputEl = null
    for (const sel of inputSelectors) {
      inputEl = await page.$(sel)
      if (inputEl) {
        console.log(`  ✓ Found input via selector: ${sel}`)
        break
      }
    }

    if (inputEl) {
      await inputEl.click()
      await pause(500, 1000)
      const queries = [
        'What is the latest research on quantum computing?',
        'Explain how large language models work',
        'Summarize recent advances in renewable energy',
      ]
      const query = queries[Math.floor(Math.random() * queries.length)]
      console.log(`  → Typing: "${query}"`)
      await inputEl.type(query, { delay: 60 + Math.random() * 60 })
      await pause(800, 1500)

      // Try to submit with Enter or a submit button
      const submitBtn = await page.$('button[type="submit"], button:has-text("Send"), button:has-text("Search"), button:has-text("Ask")')
      if (submitBtn) {
        console.log('  → Clicking submit button')
        await submitBtn.click()
      } else {
        console.log('  → Pressing Enter to submit')
        await page.keyboard.press('Enter')
      }
      await pause(3000, 6000)
      console.log('  ✓ Submitted prompt, waiting for response')
    } else {
      console.log('  ℹ No interactive input found on homepage — clicking around')
      const buttons = await page.$$('button')
      console.log(`  ℹ Found ${buttons.length} buttons`)
      if (buttons.length > 0) {
        const btn = buttons[Math.floor(Math.random() * Math.min(buttons.length, 5))]
        const txt = await btn.textContent()
        console.log(`  → Clicking button: "${txt?.trim()}"`)
        await btn.click()
        await pause(1500, 3000)
      }
    }

    // Scroll to see any response
    for (let i = 0; i < 5; i++) {
      await page.mouse.wheel(0, 200 + Math.random() * 150)
      await pause(500, 1000)
    }
  } catch (err) {
    console.error('  ✗ Session 2 error:', err.message)
  } finally {
    await ctx.close()
    console.log('  Session 2 complete')
  }
}

async function session3(browser) {
  console.log('\n=== Session 3: Navigate sections, dwell on content ===')
  const ctx = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
    ignoreHTTPSErrors: true,
  })
  const page = await ctx.newPage()

  try {
    console.log('  → Navigating to homepage')
    const resp = await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
    console.log(`  ✓ Homepage loaded — status ${resp?.status()}`)
    await pause(2000, 3500)

    // Simulate reading with slow scroll
    for (let i = 0; i < 6; i++) {
      await page.mouse.wheel(0, 200 + Math.random() * 100)
      await pause(1000, 2000)
    }

    // Find nav links — broaden selector to catch SPAs using divs/buttons too
    const navLinks = await page.$$eval(
      'nav a, header a, [role="navigation"] a, a[href^="/"]',
      (els, base) =>
        els
          .map((a) => ({ href: a.href, text: (a.textContent || a.getAttribute('aria-label') || '').trim() }))
          .filter((l) => l.href && l.href.startsWith(base) && l.text),
      BASE_URL,
    )
    console.log(`  ℹ Nav links: ${navLinks.map((l) => l.text).join(', ')}`)

    // Click up to 3 nav destinations
    for (const link of navLinks.slice(0, 3)) {
      if (!link.href.startsWith(BASE_URL) && !link.href.startsWith('/')) continue
      await pause(1500, 3000)
      console.log(`  → Navigating to "${link.text}" (${link.href})`)
      try {
        const r = await page.goto(link.href, { waitUntil: 'domcontentloaded', timeout: 20000 })
        console.log(`  ✓ Loaded — status ${r?.status()}`)
        // Dwell: slow scroll to simulate reading
        for (let i = 0; i < 5; i++) {
          await page.mouse.wheel(0, 180 + Math.random() * 120)
          await pause(1200, 2500)
        }
        // Move mouse around as if reading
        await page.mouse.move(300 + Math.random() * 600, 200 + Math.random() * 400)
        await pause(500, 1000)
        await page.mouse.move(200 + Math.random() * 800, 300 + Math.random() * 300)
        await pause(800, 1500)
      } catch (e) {
        console.log(`  ℹ Skipping ${link.href}: ${e.message}`)
      }
    }

    // Return to homepage at end
    await pause(2000, 4000)
    console.log('  → Returning to homepage')
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 20000 })
    await pause(2000, 3000)
  } catch (err) {
    console.error('  ✗ Session 3 error:', err.message)
  } finally {
    await ctx.close()
    console.log('  Session 3 complete')
  }
}

async function main() {
  console.log('Starting synthetic traffic simulation for polymorph.fyi')
  console.log(`Time: ${new Date().toISOString()}\n`)

  const browser = await chromium.launch({
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
    console.log('\n⏸  Pausing 8–12s between sessions (natural gap)…')
    await pause(8000, 12000)

    await session2(browser)
    console.log('\n⏸  Pausing 10–15s between sessions…')
    await pause(10000, 15000)

    await session3(browser)
  } finally {
    await browser.close()
    console.log('\n✓ All sessions complete. Browser closed.')
  }
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
