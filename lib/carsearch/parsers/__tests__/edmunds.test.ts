import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import {
  deriveAssist,
  parseEdmundsSearchPage
} from '@/lib/carsearch/parsers/edmunds'

describe('deriveAssist', () => {
  it('derives assist from brand, trim, year, and drivetrain', () => {
    expect(
      deriveAssist({ brand: 'volvo', year: 2023, trim: 'Ultimate', awd: true })
    ).toBe('std')
    expect(
      deriveAssist({
        brand: 'volvo',
        year: 2023,
        trim: 'Twin Motor Plus',
        awd: true
      })
    ).toBe('verify')
    expect(
      deriveAssist({
        brand: 'ford',
        year: 2023,
        trim: 'Premium AWD Extended Range',
        awd: true
      })
    ).toBe('std')
    expect(
      deriveAssist({ brand: 'ford', year: 2023, trim: 'GT AWD', awd: true })
    ).toBe('std')
    expect(
      deriveAssist({ brand: 'ford', year: 2025, trim: 'Select', awd: false })
    ).toBe('verify')
    expect(
      deriveAssist({
        brand: 'polestar',
        year: 2023,
        trim: 'Long Range Dual Motor',
        awd: true
      })
    ).toBe('verify')
  })
})

describe('parseEdmundsSearchPage', () => {
  it('parses JSON-LD vehicle listings', () => {
    const html = readFileSync(
      'lib/carsearch/parsers/__tests__/fixtures/edmunds-mach-e.html',
      'utf8'
    )

    const listings = parseEdmundsSearchPage(
      html,
      'https://www.edmunds.com/used-ford-mustang-mach-e-dallas-tx/?radius=200'
    )

    expect(listings).toHaveLength(1)
    expect(listings[0]).toMatchObject({
      vin: '3FMTK3R78PMA65898',
      brand: 'ford',
      model: 'mach-e',
      price: 31722,
      miles: 14650,
      epaRangeMiles: 270,
      assist: 'std',
      awd: true,
      sourceSite: 'edmunds'
    })
    expect(listings[0].imageUrl).toContain('img-1-600x400')
    expect(listings[0].sourceUrl).toContain('/vin/3FMTK3R78PMA65898/')
  })

  it('falls back to visible listing cards when JSON-LD is absent', () => {
    const html = `
      <article data-test="vehicle-card" data-vin="YV4ED3UM9P2001234">
        <a href="/volvo/xc40-recharge/2023/vin/YV4ED3UM9P2001234/">Details</a>
        <h2>2023 Volvo XC40 Recharge Twin Motor Ultimate</h2>
        <span data-test="vehicle-price">$34,950</span>
        <span data-test="vehicle-mileage">18,200 miles</span>
        <img src="https://media.ed.edmunds-media.com/volvo-xc40.jpg" />
        <p>223 mi range. Certified. Good price. Crest Volvo Frisco, TX.</p>
      </article>
    `

    const listings = parseEdmundsSearchPage(
      html,
      'https://www.edmunds.com/used-volvo-xc40-recharge-dallas-tx/?radius=200'
    )

    expect(listings).toHaveLength(1)
    expect(listings[0]).toMatchObject({
      vin: 'YV4ED3UM9P2001234',
      brand: 'volvo',
      model: 'xc40',
      price: 34950,
      miles: 18200,
      cpo: true,
      assist: 'std',
      sourceUrl:
        'https://www.edmunds.com/volvo/xc40-recharge/2023/vin/YV4ED3UM9P2001234/'
    })
  })
})
