import type { LucideIcon } from 'lucide-react'
import { LayoutGrid, Microscope, Search, Wand2 } from 'lucide-react'

export type CategoryId = 'chat-search' | 'research' | 'build' | 'generative-ui'

export interface Category {
  id: CategoryId
  title: string
  description: string
  Icon: LucideIcon
}

export const CATEGORIES: Category[] = [
  {
    id: 'chat-search',
    title: 'Chat & Search',
    description:
      'Ask anything and get answers grounded in real-time web search.',
    Icon: Search
  },
  {
    id: 'research',
    title: 'Research',
    description:
      'Multi-step research with a live activity panel and inline citations.',
    Icon: Microscope
  },
  {
    id: 'build',
    title: 'Build',
    description:
      'Generate interactive HTML, React components, and full landing pages.',
    Icon: Wand2
  },
  {
    id: 'generative-ui',
    title: 'Generative UI',
    description:
      'Tool results render as interactive maps, charts, and live UI components.',
    Icon: LayoutGrid
  }
]
