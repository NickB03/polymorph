import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { DataTable } from './index'

function getRenderedTableCellText(container: HTMLElement) {
  return Array.from(container.querySelectorAll('tbody td')).map(
    cell => cell.textContent
  )
}

describe('DataTable default sort guards', () => {
  it('ignores hidden default sort columns', () => {
    const { container } = render(
      <DataTable.Table
        id="hidden-default-sort"
        rowIdKey="name"
        columns={[
          { key: 'name', label: 'Name' },
          { key: 'url', label: 'URL', hidden: true }
        ]}
        data={[
          { name: 'Alpha', url: 'https://z.example' },
          { name: 'Bravo', url: 'https://a.example' }
        ]}
        defaultSort={{ by: 'url', direction: 'asc' }}
      />
    )

    expect(getRenderedTableCellText(container)).toEqual(['Alpha', 'Bravo'])
  })

  it('ignores non-sortable default sort columns', () => {
    const { container } = render(
      <DataTable.Table
        id="non-sortable-default-sort"
        rowIdKey="score"
        columns={[
          { key: 'name', label: 'Name', sortable: false },
          { key: 'score', label: 'Score' }
        ]}
        data={[
          { name: 'Bravo', score: 2 },
          { name: 'Alpha', score: 1 }
        ]}
        defaultSort={{ by: 'name', direction: 'asc' }}
      />
    )

    expect(getRenderedTableCellText(container)).toEqual([
      'Bravo',
      '2',
      'Alpha',
      '1'
    ])
  })
})
