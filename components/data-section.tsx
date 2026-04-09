'use client'

import type { DataPart } from '@/lib/types/ai'

import { RelatedQuestions } from './related-questions'

interface DataSectionProps {
  part: DataPart
  onQuerySelect?: (query: string) => void
  isLatestMessage?: boolean
}

export function DataSection({
  part,
  onQuerySelect,
  isLatestMessage
}: DataSectionProps) {
  switch (part.type) {
    case 'data-relatedQuestions':
      if (onQuerySelect) {
        return (
          <RelatedQuestions
            data={part.data}
            onQuerySelect={onQuerySelect}
            isLatestMessage={isLatestMessage}
          />
        )
      }
      return null

    default:
      return null
  }
}
