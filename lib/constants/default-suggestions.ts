/**
 * Default prompt suggestions shown in the ActionButtons component.
 * Used as instant initial state (no loading flash) and as a fallback
 * when the trending suggestions API is unavailable.
 */
export const DEFAULT_SUGGESTIONS: Record<string, string[]> = {
  research: [
    'Why is Nvidia growing so rapidly?',
    'Research the latest AI developments',
    'What are the key trends in robotics?',
    'What are the latest breakthroughs in renewable energy?'
  ],
  compare: [
    'Tesla vs BYD vs Toyota comparison',
    'Compare Next.js, Remix, and Astro',
    'AWS vs GCP vs Azure',
    'iPhone vs Android ecosystem comparison'
  ],
  latest: [
    'Latest news today',
    'What happened in tech this week?',
    'Recent breakthroughs in medicine',
    'Latest AI model releases'
  ],
  summarize: [
    'Summarize: https://arxiv.org/pdf/2504.19678',
    "Summarize this week's business news",
    'Create an executive summary of AI trends',
    'Summarize recent climate change research'
  ],
  explain: [
    'Explain neural networks simply',
    'How does blockchain work?',
    'What is quantum entanglement?',
    'Explain CRISPR gene editing'
  ]
}
