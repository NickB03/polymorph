import { NextResponse } from 'next/server'

import {
  advancedSearchSchema,
  runAdvancedSearch
} from '@/lib/tools/search/advanced-search'

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      {
        error: 'Invalid JSON body',
        results: [],
        images: [],
        number_of_results: 0
      },
      { status: 400 }
    )
  }

  const parseResult = advancedSearchSchema.safeParse(body)
  if (!parseResult.success) {
    return NextResponse.json(
      {
        error: parseResult.error.issues
          .map(issue =>
            issue.path.length
              ? `${issue.path.join('.')}: ${issue.message}`
              : issue.message
          )
          .join(', '),
        results: [],
        images: [],
        number_of_results: 0
      },
      { status: 400 }
    )
  }

  try {
    const results = await runAdvancedSearch(parseResult.data)
    return NextResponse.json(results)
  } catch (error) {
    console.error('Advanced search error:', error)
    return NextResponse.json(
      {
        message: 'Internal Server Error',
        error: error instanceof Error ? error.message : String(error),
        query: parseResult.data.query,
        results: [],
        images: [],
        number_of_results: 0
      },
      { status: 500 }
    )
  }
}
