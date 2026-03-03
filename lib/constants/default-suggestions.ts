/**
 * Default prompt suggestions shown in the ActionButtons component.
 * Used as instant initial state (no loading flash) and as a fallback
 * when the trending suggestions API is unavailable.
 */
export const DEFAULT_SUGGESTIONS: Record<string, string[]> = {
  research: [
    'Why is antibiotic resistance accelerating?',
    'How does sleep deprivation affect memory?',
    'What drives inflation in housing markets?',
    'Why has nuclear fusion taken decades to commercialize?'
  ],
  compare: [
    'Nuclear vs solar for baseload power',
    'Passive vs active investing strategies',
    'Electric vs hydrogen fuel cell vehicles',
    'Public vs private space exploration programs'
  ],
  latest: [
    'Latest breakthroughs in AI research',
    'What happened in space exploration this week?',
    'Recent discoveries in marine biology',
    'Latest findings in longevity research'
  ],
  summarize: [
    'Summarize the key findings on neural scaling laws',
    'Key takeaways from recent climate reports',
    'Summarize the state of global chip manufacturing',
    'Create an executive summary of AI trends'
  ],
  explain: [
    'Explain how mRNA vaccines work',
    'What causes ocean acidification?',
    'How does the placebo effect work?',
    'Explain how large language models are trained'
  ]
}
