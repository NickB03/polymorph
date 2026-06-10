import { describe, expect, it } from 'vitest'

import {
  awdCopy,
  driverAssistCopy,
  rangeCopy,
  warrantyCopy
} from '@/lib/carsearch/copy'

describe('carsearch copy helpers', () => {
  it('uses the preserved plain-English driver assist labels', () => {
    expect(driverAssistCopy({ assist: 'std', brand: 'ford' }).text).toBe(
      'Hands-free driving on highways (BlueCruise)'
    )
    expect(driverAssistCopy({ assist: 'std', brand: 'volvo' }).text).toBe(
      'Same safety system as your XC90 (Pilot Assist)'
    )
    expect(driverAssistCopy({ assist: 'verify', brand: 'ford' }).text).toBe(
      'Hands-free driving - verify with dealer'
    )
    expect(driverAssistCopy({ assist: 'verify', brand: 'polestar' }).text).toBe(
      'Safety system optional - verify with dealer'
    )
  })

  it('uses commute-specific range tiers', () => {
    expect(rangeCopy(240).text).toBe(
      '240-mile range - easy fit for your commute'
    )
    expect(rangeCopy(220).text).toBe(
      '220-mile range - works with home charging'
    )
    expect(rangeCopy(190).text).toBe('190-mile range - tight for daily drive')
  })

  it('uses the preserved AWD and CPO labels', () => {
    expect(awdCopy(true).text).toBe('All-wheel drive')
    expect(awdCopy(false).text).toBe('Front-wheel drive - not what you wanted')
    expect(warrantyCopy({ cpo: true, brand: 'volvo' })?.text).toBe(
      'Volvo Certified - 7yr / 100k warranty'
    )
  })
})
