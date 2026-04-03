import type {
  EvalCase,
  EvalConversationMessage,
  EvalModelType,
  EvalSearchMode,
  EvalSuite
} from '../types'

const CORPUS_VERSION = 'v1'

function user(text: string): EvalConversationMessage {
  return {
    role: 'user',
    parts: [{ type: 'text', text }]
  }
}

function assistant(text: string): EvalConversationMessage {
  return {
    role: 'assistant',
    parts: [{ type: 'text', text }]
  }
}

function caseSpec({
  id,
  suite,
  conversation,
  searchMode,
  modelType,
  tags,
  requiresTextAnswer = true,
  requiresCitations = false,
  allowsInteractiveOnly = true
}: {
  id: string
  suite: EvalSuite
  conversation: EvalConversationMessage[]
  searchMode: EvalSearchMode
  modelType: EvalModelType
  tags: string[]
  requiresTextAnswer?: boolean
  requiresCitations?: boolean
  allowsInteractiveOnly?: boolean
}): EvalCase {
  return {
    id,
    suite,
    conversation,
    searchMode,
    modelType,
    tags,
    requiresTextAnswer,
    requiresCitations,
    allowsInteractiveOnly
  }
}

const CAPABILITY_CASES: EvalCase[] = [
  caseSpec({
    id: 'cap-factual-lookup',
    suite: 'capability',
    conversation: [
      user('What is the difference between a compiler and an interpreter?')
    ],
    searchMode: 'chat',
    modelType: 'speed',
    tags: ['factual', 'evergreen']
  }),
  caseSpec({
    id: 'cap-comparison',
    suite: 'capability',
    conversation: [
      user(
        'Compare static site generation and server-side rendering for a documentation site.'
      )
    ],
    searchMode: 'research',
    modelType: 'quality',
    tags: ['comparison', 'evergreen'],
    requiresCitations: true
  }),
  caseSpec({
    id: 'cap-multi-hop',
    suite: 'capability',
    conversation: [
      user(
        'Explain how DNS, TLS, and HTTPS work together when I open a website.'
      )
    ],
    searchMode: 'research',
    modelType: 'quality',
    tags: ['multi-hop', 'evergreen'],
    requiresCitations: true
  }),
  caseSpec({
    id: 'cap-how-to',
    suite: 'capability',
    conversation: [
      user('How would I add rate limiting to a Next.js route handler?')
    ],
    searchMode: 'chat',
    modelType: 'speed',
    tags: ['how-to', 'evergreen']
  }),
  caseSpec({
    id: 'cap-ambiguity',
    suite: 'capability',
    conversation: [
      user(
        'I need something fast, reliable, and cheap for backend storage. What should I use?'
      )
    ],
    searchMode: 'chat',
    modelType: 'speed',
    tags: ['ambiguous', 'clarification']
  }),
  caseSpec({
    id: 'cap-citation-critical',
    suite: 'capability',
    conversation: [
      user('What does the GDPR say about processing personal data lawfully?')
    ],
    searchMode: 'research',
    modelType: 'quality',
    tags: ['citation-critical', 'evergreen'],
    requiresCitations: true
  }),
  caseSpec({
    id: 'cap-long-form',
    suite: 'capability',
    conversation: [
      user(
        'Summarize the tradeoffs between keyword search and vector search for product discovery.'
      )
    ],
    searchMode: 'research',
    modelType: 'quality',
    tags: ['long-form', 'synthesis'],
    requiresCitations: true
  }),
  caseSpec({
    id: 'cap-multi-turn',
    suite: 'capability',
    conversation: [
      user('I am choosing between Postgres and SQLite.'),
      assistant(
        'What matters most: local-first simplicity, or multi-user concurrency and durability?'
      ),
      user(
        'I care most about multi-user concurrency and production reliability.'
      )
    ],
    searchMode: 'chat',
    modelType: 'speed',
    tags: ['multi-turn', 'decision-support']
  })
]

const REGRESSION_CASES: EvalCase[] = [
  caseSpec({
    id: 'reg-direct-answer',
    suite: 'regression',
    conversation: [
      user('Give me a concise definition of eventual consistency.')
    ],
    searchMode: 'chat',
    modelType: 'speed',
    tags: ['concise', 'direct-answer']
  }),
  caseSpec({
    id: 'reg-research-mode',
    suite: 'regression',
    conversation: [
      user(
        'What are the key differences between server components and client components in React?'
      )
    ],
    searchMode: 'research',
    modelType: 'quality',
    tags: ['research', 'react'],
    requiresCitations: true
  }),
  caseSpec({
    id: 'reg-follow-up',
    suite: 'regression',
    conversation: [
      user('Explain observability in software systems.'),
      assistant(
        'Observability is the ability to infer internal state from external outputs.'
      ),
      user('Now contrast traces, metrics, and logs in one short answer.')
    ],
    searchMode: 'chat',
    modelType: 'speed',
    tags: ['follow-up', 'observability']
  })
]

const SMOKE_CASES: EvalCase[] = [
  caseSpec({
    id: 'smoke-basic',
    suite: 'smoke',
    conversation: [
      user('What is a healthy default timeout for a long-running HTTP request?')
    ],
    searchMode: 'chat',
    modelType: 'speed',
    tags: ['smoke']
  }),
  caseSpec({
    id: 'smoke-research',
    suite: 'smoke',
    conversation: [user('Compare REST and GraphQL in two sentences.')],
    searchMode: 'research',
    modelType: 'quality',
    tags: ['smoke', 'comparison'],
    requiresCitations: true
  })
]

export function getCorpusVersion(): string {
  return CORPUS_VERSION
}

export function getAllCases(): EvalCase[] {
  return [...CAPABILITY_CASES, ...REGRESSION_CASES, ...SMOKE_CASES]
}

export function getCasesForSuite(
  suite: Exclude<EvalSuite, 'traffic-monitor'>
): EvalCase[] {
  switch (suite) {
    case 'capability':
      return [...CAPABILITY_CASES]
    case 'regression':
      return [...REGRESSION_CASES]
    case 'smoke':
      return [...SMOKE_CASES]
  }
}

export function getSmoketestCases(count = 1): EvalCase[] {
  return SMOKE_CASES.slice(0, Math.max(1, count))
}

export function getCasesForEvaluation(
  suite: 'capability' | 'regression'
): EvalCase[] {
  return getCasesForSuite(suite)
}
