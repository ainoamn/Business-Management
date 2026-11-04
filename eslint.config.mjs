import js from '@eslint/js';
import ts from 'typescript-eslint';
export default ts.config(
  {ignores:['**/.local/**','**/dist/**','**/.next/**','**/node_modules/**','**/next-env.d.ts','**/coverage/**','**/test-results/**','**/playwright-report/**','apps/web/public/vendor/**']},
  js.configs.recommended,
  ...ts.configs.recommended,
  {files:['**/*.{js,mjs,ts,tsx}'],languageOptions:{globals:{process:'readonly',console:'readonly',Buffer:'readonly',URL:'readonly',setTimeout:'readonly',clearTimeout:'readonly',fetch:'readonly'}}},
  {files:['**/*.{ts,tsx}'],rules:{'@typescript-eslint/no-explicit-any':'error','@typescript-eslint/no-unused-vars':['error',{argsIgnorePattern:'^_'}]}}
);
