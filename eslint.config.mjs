import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettierConfig from "eslint-config-prettier";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettierConfig,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "playwright-report/**",
    "test-results/**",
    // Git worktrees (Agent tool isolation:"worktree" runs) live inside the
    // repo at .claude/worktrees/<name>/ — each is a FULL separate checkout
    // with its own .next build output. The plain ".next/**" glob above is
    // root-relative and does not match nested paths, so without this,
    // ESLint walks and lints another session's entire build artifacts.
    "**/.claude/worktrees/**",
  ]),
]);

export default eslintConfig;
