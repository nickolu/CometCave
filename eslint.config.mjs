import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'
import importPlugin from 'eslint-plugin-import'

const eslintConfig = [
  {
    ignores: ['.next/**', 'node_modules/**'],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    plugins: {
      import: importPlugin,
    },
    rules: {
      // Keep import statements grouped + ordered consistently (auto-fixable).
      'import/order': [
        'error',
        {
          groups: [
            'builtin',
            'external',
            'internal',
            'parent',
            'sibling',
            'index',
            'object',
            'type',
          ],
          pathGroups: [
            // Treat your TS path alias as "internal".
            { pattern: '@/**', group: 'internal', position: 'before' },
          ],
          pathGroupsExcludedImportTypes: ['builtin'],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
          warnOnUnassignedImports: true,
        },
      ],

      // Sort named imports within a single import (auto-fixable).
      // We let `import/order` handle the ordering of whole import declarations.
      'sort-imports': [
        'error',
        {
          ignoreCase: false,
          ignoreDeclarationSort: true,
          ignoreMemberSort: false,
          memberSyntaxSortOrder: ['none', 'all', 'multiple', 'single'],
          allowSeparatedGroups: true,
        },
      ],

      'import/newline-after-import': 'error',
      'import/no-duplicates': 'error',

      // Prefer TS path aliases (`@/…`) over parent relative imports (`../…`).
      // This keeps imports stable when files move and avoids deep relative chains.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../*'],
              message: 'Avoid parent relative imports. Use the `@/` path alias instead.',
            },
          ],
        },
      ],
    },
  },
  // ── Design-system token guardrails ───────────────────────────────
  // Block hex color literals and legacy primitive tokens in component code.
  // Allowed in: token definitions, config, tests, stories, prototypes, assets.
  {
    files: ['src/**/*.{js,jsx,ts,tsx}'],
    ignores: [
      'src/app/globals.css',
      'src/app/ring-toss/**',
      'src/**/*.test.*',
      'src/**/*.spec.*',
      'src/**/*.stories.*',
    ],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Literal[value=/^#[0-9a-fA-F]{3,8}$/]',
          message:
            'No hex color literals in component code. Use a design-system token (e.g. var(--ds-primary) or the Tailwind class bg-ds-primary). See docs/design-system.md.',
        },
        {
          selector: 'TemplateElement[value.raw=/(^|\\s|"|\'|`)(space-black|space-dark|space-grey|space-purple|space-purple-light|space-blue|cream-white|space-gold|grey-500)(\\s|"|\'|`|$)/]',
          message:
            'Legacy primitive token detected. Use semantic tokens instead (e.g. bg-ds-surface, text-on-surface). See docs/design-system.md.',
        },
        {
          selector: 'Literal[value=/(?:^|\\s|"|\'|`)(space-black|space-dark|space-grey|space-purple|space-purple-light|space-blue|cream-white|space-gold|grey-500)(?:\\s|"|\'|`|$)/]',
          message:
            'Legacy primitive token detected. Use semantic tokens instead (e.g. bg-ds-surface, text-on-surface). See docs/design-system.md.',
        },
      ],
    },
  },
]

export default eslintConfig
