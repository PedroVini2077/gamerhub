import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // Regras de "React Compiler readiness" do preset recommended (v6+):
      // disparam em padrões idiomáticos e funcionando (fetch+setState em effect,
      // ref "latest value" no render, Date.now() no render). Como o projeto NÃO
      // usa o React Compiler, elas não trazem ganho de runtime — rebaixadas a
      // `warn` para o baseline refletir problemas reais. O fix "de verdade" dos
      // data-fetch (React Query) está no BACKLOG. As regras de correção de fato
      // (rules-of-hooks, no-unused-vars) permanecem como `error`.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/immutability': 'warn',
      // Apenas DX/HMR (Fast Refresh), sem impacto em produção:
      'react-refresh/only-export-components': 'warn',
    },
  },
])
