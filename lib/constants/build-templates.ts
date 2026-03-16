export interface BuildTemplate {
  key: string
  label: string
  prompt: string
  thumbnail: string
}

/**
 * Build template cards shown in the ActionButtons component
 * when artifacts are enabled. Each template provides a starting
 * prompt and thumbnail for a category of artifact.
 */
export const BUILD_TEMPLATES: BuildTemplate[] = [
  {
    key: 'website',
    label: 'Websites',
    prompt:
      'Build a modern, responsive landing page with a hero section, features grid, testimonials, and footer',
    thumbnail: '/images/build-templates/website.svg'
  },
  {
    key: 'game',
    label: 'Games',
    prompt:
      'Build a fun, interactive browser game with score tracking, animations, and a restart button',
    thumbnail: '/images/build-templates/game.svg'
  },
  {
    key: 'dashboard',
    label: 'Dashboards',
    prompt:
      'Build an analytics dashboard with interactive charts, stat cards, and a sidebar navigation',
    thumbnail: '/images/build-templates/dashboard.svg'
  }
]
