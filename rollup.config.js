import { readFileSync } from "fs";
import ascii from "./build/ascii.js";
import node from "@rollup/plugin-node-resolve";
import commonjs from "rollup-plugin-commonjs";
import terser from "@rollup/plugin-terser";
import meta from "./package.json" with { type: "json" };

// const copyright = `// ${meta.homepage} v${
//   meta.version
// } Copyright ${new Date().getFullYear()} ${meta.author.name}`;

// Extract copyrights from the LICENSE.
const copyright = readFileSync("./LICENSE", "utf-8")
  .split(/\n/g)
  .filter((line) => /^Copyright\s+/.test(line))
  .map((line) => line.replace(/^Copyright\s+/, ""))
  .join(", ");

// Baked in at build time so the version Navio reports can never drift from
// package.json. src guards on `typeof`, so importing src directly (unit tests,
// a bundler pointed at src/) still works - it just reports "dev".
const versionIntro = `var __NAVIO_VERSION__ = ${JSON.stringify(meta.version)};`;

export default [
  {
    input: "src/index.js",
    plugins: [
      node({
        jsxnext: true,
        main: true,
        browser: true,
      }),
      ascii(),
    ],
    external: ["d3", "popper.js"],
    output: {
      file: "dist/navio.js",
      name: "navio",
      extend: true,
      format: "umd",
      // Expose the navio function itself as the global; see src/index.js.
      exports: "default",
      indent: false,
      // sourcemap: true,
      banner: `// ${meta.homepage} v${meta.version} Copyright ${copyright}`,
      intro: versionIntro,
      globals: {
        d3: "d3",
        "popper.js": "Popper",
      },
    },
  },
  {
    input: "src/index.esm.js",
    plugins: [
      node({
        jsxnext: true,
      }),
      ascii(),
      commonjs(),
    ],
    external: ["d3", "popper.js"],
    output: {
      file: "dist/navio.esm.js",
      name: "navio",
      extend: true,
      format: "esm",
      indent: false,
      // sourcemap: true,
      banner: `// ${meta.homepage} v${meta.version} Copyright ${copyright}`,
      intro: versionIntro,
      globals: {
        d3: "d3",
        "popper.js": "Popper",
      },
    },
  },
  {
    input: "src/index.js",
    plugins: [
      node({
        jsxnext: true,
        main: true,
        browser: true,
      }),
      ascii(),
      terser({
        output: {
          preamble: `// ${meta.homepage} v${meta.version} Copyright ${copyright}`,
          // Terser decodes \uXXXX escapes when it re-emits, which would undo
          // the ascii() plugin and leave raw glyphs in the minified bundle.
          ascii_only: true,
        },
      }),
    ],
    external: ["d3", "popper.js"],
    output: {
      file: "dist/navio.min.js",
      name: "navio",
      extend: true,
      format: "umd",
      // Expose the navio function itself as the global; see src/index.js.
      exports: "default",
      indent: false,
      intro: versionIntro,
      globals: {
        d3: "d3",
        "popper.js": "Popper",
      },
    },
  },
];
