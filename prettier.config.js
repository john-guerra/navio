// Prettier owns all formatting; ESLint owns correctness (see eslint.config.js).
// Values chosen to match the style already dominant in src/, so adopting the
// formatter produces the smallest possible diff.
export default {
  printWidth: 80,
  tabWidth: 2,
  useTabs: false,
  semi: true,
  singleQuote: false,
  trailingComma: "es5",
  bracketSpacing: true,
  arrowParens: "always",
  endOfLine: "lf",
};
