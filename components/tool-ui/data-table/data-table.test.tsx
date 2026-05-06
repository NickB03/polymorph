import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { DataTable } from './index'
import { safeParseSerializableDataTable } from './schema'

function getRenderedTableCellText(container: HTMLElement) {
  return Array.from(container.querySelectorAll('tbody td')).map(
    cell => cell.textContent
  )
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('DataTable generated row identifiers', () => {
  it('infers a unique rowIdKey for generated table payloads', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const parsed = safeParseSerializableDataTable({
      id: 'generated-market-table',
      columns: [
        { key: 'company', label: 'Company' },
        { key: 'score', label: 'Score' }
      ],
      data: [
        { company: 'Alpha', score: 92 },
        { company: 'Beta', score: 88 }
      ]
    })

    expect(parsed?.rowIdKey).toBe('company')

    render(<DataTable.Table {...parsed!} />)

    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('uses stable row ids for mobile accordion triggers', () => {
    const parsed = safeParseSerializableDataTable({
      id: 'generated-market-table',
      columns: [
        { key: 'company', label: 'Company' },
        { key: 'score', label: 'Score' },
        { key: 'category', label: 'Category' }
      ],
      data: [
        { company: 'Alpha', score: 92, category: 'Workflow' },
        { company: 'Beta', score: 88, category: 'Planning' }
      ]
    })

    render(<DataTable.Table {...parsed!} />)

    expect(
      screen.getByRole('button', { name: /Row 1: Alpha/i })
    ).toHaveAttribute('id', 'row-id_3AAlpha-trigger')
  })
})

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
