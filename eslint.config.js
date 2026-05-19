import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // Codebase has 600+ pre-existing any usages — warn instead of error so CI
      // passes while we incrementally clean them up (Tier 3 work in checklist).
      '@typescript-eslint/no-explicit-any': 'warn',
      // shared.tsx exports constants alongside components — acceptable for now.
      'react-refresh/only-export-components': 'warn',
    },
  },
])
