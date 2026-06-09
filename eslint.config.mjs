import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import simpleImportSort from 'eslint-plugin-simple-import-sort'

const eslintConfig = [
  {
    ignores: [
      '.next/**',
      'coverage/**',
      'node_modules/**',
      '.archive/**',
      'lib/db/migrations/**',
      'services/evals/node_modules/**',
      '.claude/**',
      '.agents/**',
      'skills/**',
      'lib/canvas/compiler/vendor/*.generated.ts',
      'components/charts/**'
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
      'simple-import-sort/exports': 'error',
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'motion/react',
              message:
                'Import motion wrappers from @/components/motion/* or variants from @/lib/motion/* instead of motion/react directly.'
            }
          ]
        }
      ]
    }
  },
  {
    files: [
      'lib/motion/**/*.{ts,tsx}',
      'components/motion/**/*.{ts,tsx}',
      'components/voice/**/*.{ts,tsx}'
    ],
    rules: {
      'no-restricted-imports': 'off'
    }
  }
]

export default eslintConfig
