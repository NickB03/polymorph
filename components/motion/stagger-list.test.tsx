import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { StaggerList } from './stagger-list'

describe('StaggerList', () => {
  it('caps stagger delay: items 1-10 scale by index, items 11+ receive delay 0.5', () => {
    const items = Array.from({ length: 15 }, (_, i) => ({ id: `i-${i}` }))

    render(
      <StaggerList items={items} getKey={item => item.id} ariaLabel="test-list">
        {item => <span data-testid={`content-${item.id}`}>{item.id}</span>}
      </StaggerList>
    )

    const list = screen.getByRole('list', { name: 'test-list' })
    const children = list.querySelectorAll('li')

    expect(children.length).toBe(15)

    // Items 0-9 get index * 0.05
    for (let i = 0; i < 10; i++) {
      const delay = parseFloat(children[i].getAttribute('data-stagger-delay')!)
      expect(delay).toBeCloseTo(i * 0.05, 5)
    }

    // Items 10-14 all get the capped 0.5 delay
    for (let i = 10; i < 15; i++) {
      const delay = parseFloat(children[i].getAttribute('data-stagger-delay')!)
      expect(delay).toBe(0.5)
    }
  })

  it('renders item content via the render prop', () => {
    render(
      <StaggerList
        items={[{ id: 'a' }, { id: 'b' }]}
        getKey={item => item.id}
        ariaLabel="two-list"
      >
        {(item, index, isLast) => (
          <span data-testid={item.id}>
            {item.id}/{index}/{isLast ? 'last' : 'mid'}
          </span>
        )}
      </StaggerList>
    )

    expect(screen.getByTestId('a')).toHaveTextContent('a/0/mid')
    expect(screen.getByTestId('b')).toHaveTextContent('b/1/last')
  })
})
