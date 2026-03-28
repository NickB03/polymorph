import type { SearchResults } from '@/lib/types'

export function createAdvancedSearchResult(
  title = 'Advanced search result'
): SearchResults {
  return {
    results: [
      {
        title,
        url: 'https://example.com/advanced',
        content: `${title} content`
      }
    ],
    images: [],
    query: 'sleep deprivation memory',
    number_of_results: 1
  }
}
