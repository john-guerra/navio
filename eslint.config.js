import globals from "globals";
import js from "@eslint/js";
import vitest from "@vitest/eslint-plugin";
import playwright from "eslint-plugin-playwright";
import prettier from "eslint-config-prettier";

// Flat ESM config. Division of labour:
//   ESLint   -> correctness (unused vars, unsafe patterns, real bugs)
//   Prettier -> formatting (indent, quotes, semicolons, line width)
// `prettier` MUST stay last so it can switch off every stylistic rule that
// would otherwise fight the formatter. Do not re-add formatting rules below
// it - that misordering is what produced 26 bogus `indent` errors previously.
export default [
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "coverage/**",
      "test-results/**",
      "playwright-report/**",
      "blob-report/**",
      // Demo pages - hand-authored, some legacy; not part of the shipped
      // package. `example_*` covers untracked local scratch dirs at the root.
      "examples/**",
      "example_*/**",
      "extras/**",
      // Dead and currently unbuildable: imports react/prop-types (not
      // dependencies) through a self-referential node_modules/navio path, and
      // its import in src/index.js is commented out. Tracked by #20.
      "src/NavioComponent.jsx",
    ],
  },

  js.configs.recommended,

  // Library source: runs in the browser, bundled by rollup.
  {
    files: ["src/**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        // Injected by rollup at build time (see versionIntro in
        // rollup.config.js); src guards on typeof so it is optional.
        __NAVIO_VERSION__: "readonly",
      },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      "no-console": "off", // Navio logs diagnostics deliberately; see #58.
      // `_`-prefixed names are intentional throwaways. Note the bundle is
      // parsed by rollup-plugin-ascii's very old acorn, which rejects ES2019
      // optional catch binding (`catch {}`) - so unused catch params must be
      // named `_e` rather than omitted, or `npm run build` fails.
      "no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },

  // Build tooling and configs: run in Node, not the browser.
  {
    files: ["*.config.js", "rollup.config.js", "build/**/*.js"],
    rules: {
      // build/ascii.js matches the non-ASCII range as /[^\x00-\x7F]/, which is
      // exactly the point of the file - the control characters are deliberate.
      "no-control-regex": "off",
    },
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.node },
    },
  },

  // Unit tests (Vitest).
  {
    files: ["test/unit/**/*.test.js"],
    plugins: { vitest },
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.node, ...vitest.environments.env.globals },
    },
    rules: { ...vitest.configs.recommended.rules },
  },

  // End-to-end tests (Playwright).
  {
    ...playwright.configs["flat/recommended"],
    files: ["test/e2e/**/*.spec.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.node, ...globals.browser },
    },
  },

  prettier,
];
