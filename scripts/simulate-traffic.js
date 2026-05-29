// Synthetic traffic simulator for polymorph.fyi
// Simulates three realistic user sessions with natural pacing

const { chromium } = require('/opt/node22/lib/node_modules/playwright')

const BASE_URL = 'https://polymorph.fyi'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const randMs = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min

async function session1(browser) {
  console.log('\n=== Session 1: Homepage browse & page exploration ===')
  const ctx = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1440, height: 900 },
  })
  const page = await ctx.newPage()

  try {
    console.log('  Navigating to homepage...')
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
    console.log(`  Title: ${await page.title()}`)
    await sleep(randMs(2000, 4000)) // read homepage

    // Scroll down to simulate reading
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollBy(0, 400))
      await sleep(randMs(800, 1500))
    }
    console.log('  Scrolled through homepage content')

    // Collect visible links
    const links = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll('a[href]'))
      return anchors
        .map((a) => a.href)
        .filter(
          (h) =>
            h.startsWith(window.location.origin) &&
            !h.includes('#') &&
            h !== window.location.href
        )
        .slice(0, 10)
    })
    console.log(`  Found ${links.length} internal links`)

    // Visit up to 2 additional pages
    const visited = []
    for (const link of links.slice(0, 2)) {
      if (visited.includes(link)) continue
      visited.push(link)
      console.log(`  Navigating to: ${link}`)
      await page.goto(link, { waitUntil: 'domcontentloaded', timeout: 30000 })
      console.log(`    Title: ${await page.title()}`)
      await sleep(randMs(1500, 3000))
      // Scroll a bit
      await page.evaluate(() => window.scrollBy(0, 300))
      await sleep(randMs(500, 1000))
      await page.evaluate(() => window.scrollBy(0, 300))
      await sleep(randMs(1000, 2000))
    }

    // Navigate back to homepage
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await sleep(randMs(1000, 2000))
    console.log('  Session 1 complete.')
  } catch (err) {
    console.log(`  Session 1 error: ${err.message}`)
  } finally {
    await ctx.close()
  }
}

async function session2(browser) {
  console.log('\n=== Session 2: Feature/form interaction ===')
  const ctx = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
  })
  const page = await ctx.newPage()

  try {
    console.log('  Navigating to homepage...')
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
    console.log(`  Title: ${await page.title()}`)
    await sleep(randMs(1500, 2500))

    // Look for interactive elements: inputs, buttons, textareas
    const inputs = await page.$$('input[type="text"], input[type="email"], textarea')
    if (inputs.length > 0) {
      console.log(`  Found ${inputs.length} input field(s), typing into first...`)
      await inputs[0].click()
      await sleep(randMs(300, 600))
      const sampleQueries = [
        'What are the latest trends in AI research?',
        'Explain quantum computing',
        'Best practices for modern web development',
      ]
      const query = sampleQueries[Math.floor(Math.random() * sampleQueries.length)]
      await inputs[0].type(query, { delay: randMs(60, 120) })
      await sleep(randMs(800, 1500))
      console.log(`  Typed: "${query}"`)

      // Look for a submit button nearby
      const buttons = await page.$$('button[type="submit"], button')
      if (buttons.length > 0) {
        console.log('  Clicking submit/primary button...')
        await buttons[0].click()
        await sleep(randMs(2000, 4000)) // wait for response
      }
    } else {
      console.log('  No input fields found on homepage; clicking available buttons...')
      const buttons = await page.$$('button, [role="button"]')
      for (const btn of buttons.slice(0, 3)) {
        try {
          const visible = await btn.isVisible()
          const text = await btn.textContent()
          if (visible && text && text.trim().length > 0) {
            console.log(`  Clicking button: "${text.trim().slice(0, 40)}"`)
            await btn.click()
            await sleep(randMs(1000, 2000))
            break
          }
        } catch (_) {}
      }
    }

    await sleep(randMs(1500, 2500))
    console.log('  Session 2 complete.')
  } catch (err) {
    console.log(`  Session 2 error: ${err.message}`)
  } finally {
    await ctx.close()
  }
}

async function session3(browser) {
  console.log('\n=== Session 3: Section navigation with dwell time ===')
  const ctx = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
  })
  const page = await ctx.newPage()

  try {
    console.log('  Navigating to homepage...')
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
    console.log(`  Title: ${await page.title()}`)
    await sleep(randMs(2500, 4000)) // longer initial dwell

    // Gather nav links
    const navLinks = await page.evaluate(() => {
      const selectors = 'nav a[href], header a[href], [role="navigation"] a[href]'
      const anchors = Array.from(document.querySelectorAll(selectors))
      return anchors
        .map((a) => ({ href: a.href, text: a.textContent.trim() }))
        .filter(
          (l) =>
            l.href.startsWith(window.location.origin) &&
            !l.href.includes('#') &&
            l.href !== window.location.href &&
            l.text.length > 0
        )
    })
    console.log(`  Found ${navLinks.length} nav link(s)`)

    // Also grab any footer or section links
    const allLinks = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll('a[href]'))
      return anchors
        .map((a) => ({ href: a.href, text: a.textContent.trim() }))
        .filter(
          (l) =>
            l.href.startsWith(window.location.origin) &&
            !l.href.includes('#') &&
            l.href !== window.location.href &&
            l.text.length > 0
        )
    })

    const uniqueLinks = [...navLinks, ...allLinks].reduce((acc, l) => {
      if (!acc.find((x) => x.href === l.href)) acc.push(l)
      return acc
    }, [])

    console.log(`  Total unique internal links: ${uniqueLinks.length}`)

    // Visit 3 sections, spending more time on second one
    const toVisit = uniqueLinks.slice(0, 3)
    for (let i = 0; i < toVisit.length; i++) {
      const link = toVisit[i]
      console.log(`  Navigating to section: "${link.text}" → ${link.href}`)
      await page.goto(link.href, { waitUntil: 'domcontentloaded', timeout: 30000 })
      console.log(`    Title: ${await page.title()}`)

      const dwellMs = i === 1 ? randMs(5000, 8000) : randMs(2000, 3500)
      console.log(`    Dwelling for ~${Math.round(dwellMs / 1000)}s...`)

      // Slow scroll to simulate reading
      const steps = Math.floor(dwellMs / 800)
      for (let s = 0; s < steps; s++) {
        await page.evaluate(() => window.scrollBy(0, 200))
        await sleep(randMs(600, 900))
      }
    }

    // Return to homepage for natural session end
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await sleep(randMs(1500, 2500))
    console.log('  Session 3 complete.')
  } catch (err) {
    console.log(`  Session 3 error: ${err.message}`)
  } finally {
    await ctx.close()
  }
}

async function main() {
  console.log('Launching Chromium...')
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--ignore-certificate-errors'],
  })

  console.log('Browser launched. Starting sessions...')

  await session1(browser)
  await sleep(randMs(4000, 7000)) // natural gap between sessions

  await session2(browser)
  await sleep(randMs(5000, 9000))

  await session3(browser)

  await browser.close()
  console.log('\nAll sessions complete. Browser closed.')
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
