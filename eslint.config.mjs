import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import simpleImportSort from 'eslint-plugin-simple-import-sort'

const eslintConfig = [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'lib/db/migrations/**',
      'services/evals/node_modules/**',
      '.claude/**',
      'public/canvas-vendor/**'
    ]
  },
  ...nextCoreWebVitals,
  {
    plugins: {
      'simple-import-sort': simpleImportSort
    },
    rules: {
      'simple-import-sort/imports': [
        'error',
        {
          groups: [
            ['^react', '^next'],
            ['^@?\\w'],
            ['^@/types'],
            ['^@/config'],
            ['^@/lib'],
            ['^@/hooks'],
            ['^@/components/ui'],
            ['^@/components'],
            ['^@/registry'],
            ['^@/styles'],
            ['^@/app'],
            ['^\\u0000'],
            ['^\\.\\.(?!/?$)', '^\\.\\./?$'],
            ['^\\./(?=.*/)(?!/?$)', '^\\.(?!/?$)', '^\\./?$'],
            ['^.+\\.s?css$']
          ]
        }
      ],
      'simple-import-sort/exports': 'error'
    }
  }
]

export default eslintConfig
