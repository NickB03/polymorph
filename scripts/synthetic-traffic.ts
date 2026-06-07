import { type Browser, chromium, type Page } from 'playwright'

const BASE_URL = 'https://polymorph.fyi'

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function randomBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

async function humanPause(min = 800, max = 2400) {
  await sleep(randomBetween(min, max))
}

async function scrollDown(page: Page, steps = 3) {
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, randomBetween(200, 500))
    await humanPause(400, 900)
  }
}

async function session1(browser: Browser) {
  console.log('\n=== SESSION 1: Homepage browse & page exploration ===')
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    viewport: { width: 1440, height: 900 }
  })
  const page = await context.newPage()

  try {
    console.log('  Navigating to homepage…')
    const res = await page.goto(BASE_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    })
    console.log(`  Status: ${res?.status()}`)
    await humanPause(1500, 3000)

    console.log('  Reading homepage content…')
    await scrollDown(page, 4)
    await humanPause(2000, 3500)

    // Grab all internal links
    const links = await page.$$eval(
      'a[href]',
      (els, base) =>
        els
          .map(el => (el as HTMLAnchorElement).href)
          .filter(
            h => h.startsWith(base) && !h.includes('#') && h !== base + '/'
          ),
      BASE_URL
    )
    const uniqueLinks = [...new Set(links)].slice(0, 5)
    console.log(
      `  Found ${uniqueLinks.length} internal links: ${uniqueLinks.join(', ')}`
    )

    // Visit up to 2 additional pages
    for (const link of uniqueLinks.slice(0, 2)) {
      console.log(`  Visiting: ${link}`)
      await page.goto(link, { waitUntil: 'domcontentloaded', timeout: 20000 })
      await humanPause(1200, 2000)
      await scrollDown(page, 3)
      await humanPause(2000, 4000)
    }

    // Go back to homepage
    console.log('  Returning to homepage…')
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 20000 })
    await humanPause(1000, 2000)
    console.log('  Session 1 complete.')
  } catch (err) {
    console.error(`  Session 1 error: ${(err as Error).message}`)
  } finally {
    await context.close()
  }
}

async function session2(browser: Browser) {
  console.log('\n=== SESSION 2: Feature / form interaction ===')
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 }
  })
  const page = await context.newPage()

  try {
    console.log('  Navigating to homepage…')
    const res = await page.goto(BASE_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    })
    console.log(`  Status: ${res?.status()}`)
    await humanPause(1000, 2000)

    // Try to find and interact with any input / textarea (chat, search, etc.)
    const inputSelectors = [
      'textarea',
      'input[type="text"]',
      'input[type="search"]',
      'input[placeholder]'
    ]
    let interacted = false
    for (const sel of inputSelectors) {
      const el = await page.$(sel)
      if (el && (await el.isVisible())) {
        console.log(`  Found input: ${sel} — typing a message…`)
        await el.click()
        await humanPause(400, 700)
        await el.type('What can you help me research today?', {
          delay: randomBetween(60, 120)
        })
        await humanPause(800, 1500)

        // Look for a submit button
        const submitSel = [
          'button[type="submit"]',
          'button[aria-label*="send" i]',
          'button[aria-label*="submit" i]'
        ]
        for (const btnSel of submitSel) {
          const btn = await page.$(btnSel)
          if (btn && (await btn.isVisible())) {
            console.log(`  Clicking submit: ${btnSel}`)
            await btn.click()
            await humanPause(2000, 4000)
            break
          }
        }

        // Try pressing Enter as fallback
        if (!interacted) {
          console.log('  Pressing Enter to submit…')
          await el.press('Enter')
          await humanPause(2500, 5000)
        }
        interacted = true
        break
      }
    }

    if (!interacted) {
      console.log(
        '  No visible input found — scrolling and clicking buttons instead…'
      )
      await scrollDown(page, 3)
      const buttons = await page.$$('button:not([disabled])')
      for (const btn of buttons.slice(0, 3)) {
        if (await btn.isVisible()) {
          const label = await btn.textContent()
          console.log(`  Clicking button: "${label?.trim()}"`)
          await btn.click()
          await humanPause(1000, 2500)
        }
      }
    }

    await scrollDown(page, 2)
    await humanPause(1500, 2500)
    console.log('  Session 2 complete.')
  } catch (err) {
    console.error(`  Session 2 error: ${(err as Error).message}`)
  } finally {
    await context.close()
  }
}

async function session3(browser: Browser) {
  console.log('\n=== SESSION 3: Section navigation & dwell time ===')
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    userAgent:
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 }
  })
  const page = await context.newPage()

  try {
    console.log('  Navigating to homepage…')
    const res = await page.goto(BASE_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    })
    console.log(`  Status: ${res?.status()}`)
    await humanPause(1000, 2000)

    // Scroll slowly through the page — simulating a careful reader
    console.log('  Slowly reading the page…')
    for (let i = 0; i < 6; i++) {
      await page.mouse.wheel(0, randomBetween(100, 300))
      await humanPause(700, 1800)
    }

    // Find nav links and visit sections
    const navLinks = await page.$$eval(
      'nav a[href], header a[href]',
      (els, base) =>
        els
          .map(el => ({
            href: (el as HTMLAnchorElement).href,
            text: el.textContent?.trim() || ''
          }))
          .filter(l => l.href.startsWith(base)),
      BASE_URL
    )
    console.log(
      `  Nav links found: ${navLinks.map(l => l.text || l.href).join(', ')}`
    )

    for (const link of navLinks.slice(0, 3)) {
      console.log(`  Visiting nav section: "${link.text}" → ${link.href}`)
      await page.goto(link.href, {
        waitUntil: 'domcontentloaded',
        timeout: 20000
      })
      await humanPause(1500, 2500)
      await scrollDown(page, 4)
      // Spend extra dwell time on first section
      if (navLinks.indexOf(link) === 0) {
        console.log('  Dwelling on this section…')
        await humanPause(5000, 8000)
      } else {
        await humanPause(2000, 3500)
      }
    }

    // If no nav links, fall back to scrolling homepage sections
    if (navLinks.length === 0) {
      console.log('  No nav links — scrolling through homepage sections…')
      await page.goto(BASE_URL, {
        waitUntil: 'domcontentloaded',
        timeout: 20000
      })
      await scrollDown(page, 8)
      await humanPause(5000, 8000)
    }

    console.log('  Session 3 complete.')
  } catch (err) {
    console.error(`  Session 3 error: ${(err as Error).message}`)
  } finally {
    await context.close()
  }
}

async function main() {
  console.log('Launching browser…')
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--ignore-certificate-errors']
  })

  try {
    await session1(browser)
    // Natural gap between sessions
    console.log('\nPausing between sessions (3–6 s)…')
    await sleep(randomBetween(3000, 6000))

    await session2(browser)
    console.log('\nPausing between sessions (4–7 s)…')
    await sleep(randomBetween(4000, 7000))

    await session3(browser)
  } finally {
    await browser.close()
    console.log('\nBrowser closed. Synthetic traffic complete.')
  }
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
