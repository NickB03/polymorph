export interface Scenario {
  id: string
  name: string
  turns: string[]
}

// 9 scenarios across 3 personas; 3 are picked each day via date-seeded rotation
export const SCENARIOS: Scenario[] = [
  // --- Developer ---
  {
    id: 'dev-rate-limiting',
    name: 'Developer: Rate Limiting',
    turns: [
      'How do I add rate limiting to a Next.js API route?',
      'What Redis client would you recommend for this on Vercel?'
    ]
  },
  {
    id: 'dev-typescript',
    name: 'Developer: TypeScript Patterns',
    turns: [
      'What is the difference between a TypeScript interface and a type alias?',
      'When would discriminated unions be better than class hierarchies in TypeScript?'
    ]
  },
  {
    id: 'dev-performance',
    name: 'Developer: Next.js Performance',
    turns: [
      'What are the most impactful ways to improve Next.js app performance?',
      'How does React Server Components affect bundle size and time-to-interactive?'
    ]
  },

  // --- Researcher ---
  {
    id: 'research-tls',
    name: 'Researcher: HTTPS & TLS',
    turns: [
      'Explain how HTTPS and TLS work together to secure web traffic',
      'Walk me through what actually happens during the TLS handshake in plain terms'
    ]
  },
  {
    id: 'research-rag',
    name: 'Researcher: RAG vs Fine-tuning',
    turns: [
      'What is retrieval-augmented generation and how does it compare to fine-tuning an LLM?',
      'What are the practical tradeoffs in cost, latency, and accuracy between the two approaches?'
    ]
  },
  {
    id: 'research-security',
    name: 'Researcher: Web Security',
    turns: [
      'What are the most common web application security vulnerabilities developers overlook?',
      'How do SQL injection attacks work and what are the most effective defenses?'
    ]
  },

  // --- Explorer ---
  {
    id: 'explorer-databases',
    name: 'Explorer: Database Choices',
    turns: [
      'I need to pick a database for a new side project. What are my main options?',
      'Compare PostgreSQL and SQLite for a small-to-medium web app with around 10k users'
    ]
  },
  {
    id: 'explorer-deployment',
    name: 'Explorer: Deployment Options',
    turns: [
      'What are the main options for deploying a Next.js app in 2025?',
      'What are the real cost and operational tradeoffs between Vercel, Railway, and self-hosting on a VPS?'
    ]
  },
  {
    id: 'explorer-distributed',
    name: 'Explorer: Distributed Systems',
    turns: [
      'What is the best way to learn distributed systems as a self-taught software engineer?',
      'Can you recommend specific resources for understanding consensus algorithms like Raft?'
    ]
  }
]

// Returns 3 scenarios for today, deterministic per calendar date
export function pickDailyScenarios(count = 3): Scenario[] {
  const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
  const seed = today
    .split('-')
    .reduce((acc, part) => acc * 31 + parseInt(part, 10), 7)

  const picked: Scenario[] = []
  const used = new Set<number>()
  let state = seed >>> 0

  while (picked.length < count) {
    state = Math.imul(state, 1664525) + 1013904223
    const idx = (state >>> 0) % SCENARIOS.length
    if (!used.has(idx)) {
      used.add(idx)
      picked.push(SCENARIOS[idx])
    }
  }

  return picked
}
