import { chromium, type Page } from 'playwright'

const BASE_URL = 'https://polymorph.fyi'
// Vercel deployment-protection bypass token (expires ~23h from generation)
const BYPASS_URL = 'https://polymorph.fyi/?_vercel_share=CbiopubRvsKR9zDxqWBvuADHVIMnjxOr'

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function humanDelay(min = 800, max = 2400) {
  await sleep(min + Math.random() * (max - min))
}

async function scrollDown(page: Page, steps = 3) {
  for (let i = 0; i < steps; i++) {
    await page.evaluate(() => window.scrollBy(0, window.innerHeight * 0.6))
    await humanDelay(600, 1200)
  }
}

async function session1(browser: typeof chromium) {
  console.log('\n=== Session 1: Browse homepage and explore pages ===')
  const ctx = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
  })
  const page = await ctx.newPage()

  try {
    console.log('  Setting auth cookie via bypass URL...')
    await page.goto(BYPASS_URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await humanDelay(800, 1500)

    console.log('  Navigating to homepage...')
    const res = await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
    console.log(`  Status: ${res?.status()} ${res?.statusText()}`)

    await humanDelay(1500, 3000)
    await scrollDown(page, 4)

    const title = await page.title()
    console.log(`  Page title: "${title}"`)

    // Collect visible links on the page
    const links = await page.$$eval(
      'a[href]',
      (anchors, base) =>
        anchors
          .map(a => ({ href: (a as HTMLAnchorElement).href, text: (a as HTMLAnchorElement).innerText.trim() }))
          .filter(l => l.href.startsWith(base) && l.text.length > 0 && !l.href.includes('#'))
          .slice(0, 10),
      BASE_URL
    )
    console.log(`  Found ${links.length} internal links`)

    // Visit up to 2 internal pages
    const toVisit = links.slice(0, 2)
    for (const link of toVisit) {
      console.log(`  Visiting: ${link.href} ("${link.text.slice(0, 40)}")`)
      await humanDelay(1200, 2500)
      await page.goto(link.href, { waitUntil: 'domcontentloaded', timeout: 20000 })
      await humanDelay(2000, 4000)
      await scrollDown(page, 3)
    }

    console.log('  Session 1 complete.')
  } catch (err) {
    console.error(`  Session 1 error: ${(err as Error).message}`)
  } finally {
    await ctx.close()
  }
}

async function session2(browser: typeof chromium) {
  console.log('\n=== Session 2: Interact with features / chat input ===')
  const ctx = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
    ignoreHTTPSErrors: true,
  })
  const page = await ctx.newPage()

  try {
    console.log('  Setting auth cookie via bypass URL...')
    await page.goto(BYPASS_URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await humanDelay(800, 1500)

    console.log('  Navigating to homepage...')
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await humanDelay(1500, 2500)
    await scrollDown(page, 2)

    // Try common input selectors (chat box, search, forms)
    const inputSelectors = [
      'textarea',
      'input[type="text"]',
      'input[type="search"]',
      '[contenteditable="true"]',
      '[placeholder]',
    ]

    let interacted = false
    for (const sel of inputSelectors) {
      const el = await page.$(sel)
      if (el) {
        console.log(`  Found input: ${sel}`)
        await humanDelay(800, 1500)
        await el.click()
        await humanDelay(400, 800)

        const queries = [
          'What are the latest AI research trends?',
          'Help me understand quantum computing',
          'Summarize recent breakthroughs in medicine',
        ]
        const query = queries[Math.floor(Math.random() * queries.length)]
        await page.keyboard.type(query, { delay: 60 + Math.random() * 60 })
        console.log(`  Typed: "${query}"`)
        await humanDelay(1000, 2000)

        // Look for a submit button near the input
        const submitSel = 'button[type="submit"], button:has-text("Send"), button:has-text("Search"), button:has-text("Go")'
        const btn = await page.$(submitSel)
        if (btn) {
          console.log('  Clicking submit button...')
          await btn.click()
          await humanDelay(3000, 6000)
          await scrollDown(page, 3)
          console.log('  Observed response after submit.')
        } else {
          console.log('  No submit button found, pressing Enter...')
          await page.keyboard.press('Enter')
          await humanDelay(3000, 5000)
          await scrollDown(page, 2)
        }

        interacted = true
        break
      }
    }

    if (!interacted) {
      console.log('  No interactive inputs found; clicking visible buttons instead.')
      const btns = await page.$$('button')
      if (btns.length > 0) {
        const idx = Math.floor(Math.random() * Math.min(btns.length, 3))
        await btns[idx].click()
        await humanDelay(1500, 3000)
        console.log('  Clicked a button.')
      }
    }

    console.log('  Session 2 complete.')
  } catch (err) {
    console.error(`  Session 2 error: ${(err as Error).message}`)
  } finally {
    await ctx.close()
  }
}

async function session3(browser: typeof chromium) {
  console.log('\n=== Session 3: Navigate sections, dwell on content ===')
  const ctx = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
    ignoreHTTPSErrors: true,
  })
  const page = await ctx.newPage()

  try {
    console.log('  Setting auth cookie via bypass URL...')
    await page.goto(BYPASS_URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await humanDelay(800, 1500)

    console.log('  Navigating to homepage...')
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await humanDelay(2000, 3500)
    await scrollDown(page, 5)

    // Try nav/menu links
    const navLinks = await page.$$eval(
      'nav a, header a, [role="navigation"] a',
      (els, base) =>
        (els as HTMLAnchorElement[])
          .map(a => ({ href: a.href, text: a.innerText.trim() }))
          .filter(l => l.href.startsWith(base) && l.text.length > 0)
          .slice(0, 5),
      BASE_URL
    )
    console.log(`  Found ${navLinks.length} nav links`)

    if (navLinks.length > 0) {
      for (const link of navLinks.slice(0, 3)) {
        console.log(`  Navigating to nav link: ${link.href} ("${link.text.slice(0, 40)}")`)
        await humanDelay(1500, 3000)
        await page.goto(link.href, { waitUntil: 'domcontentloaded', timeout: 20000 })
        // Dwell longer on first nav page
        const dwell = link === navLinks[0] ? 6000 + Math.random() * 4000 : 2500 + Math.random() * 2000
        console.log(`  Dwelling ${Math.round(dwell / 1000)}s...`)
        await sleep(dwell)
        await scrollDown(page, 4)
      }
    } else {
      // Fall back to any internal links
      const links = await page.$$eval(
        'a[href]',
        (anchors, base) =>
          (anchors as HTMLAnchorElement[])
            .map(a => ({ href: a.href, text: a.innerText.trim() }))
            .filter(l => l.href.startsWith(base) && l.text.length > 0)
            .slice(0, 3),
        BASE_URL
      )
      for (const link of links) {
        console.log(`  Visiting: ${link.href}`)
        await humanDelay(1500, 2500)
        await page.goto(link.href, { waitUntil: 'domcontentloaded', timeout: 20000 })
        await humanDelay(3000, 6000)
        await scrollDown(page, 3)
      }
    }

    // Go back to homepage and dwell
    console.log('  Returning to homepage for final dwell...')
    await humanDelay(1000, 2000)
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 20000 })
    await sleep(5000 + Math.random() * 3000)
    await scrollDown(page, 2)

    console.log('  Session 3 complete.')
  } catch (err) {
    console.error(`  Session 3 error: ${(err as Error).message}`)
  } finally {
    await ctx.close()
  }
}

async function main() {
  console.log('Launching Chromium...')
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  })

  try {
    await session1(browser)
    await sleep(4000 + Math.random() * 3000) // natural gap between sessions

    await session2(browser)
    await sleep(5000 + Math.random() * 4000)

    await session3(browser)
  } finally {
    await browser.close()
    console.log('\nAll sessions complete. Browser closed.')
  }
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
