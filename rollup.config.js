import {readFileSync} from "fs";
import ascii from "rollup-plugin-ascii";
import node from "@rollup/plugin-node-resolve";
import commonjs from "rollup-plugin-commonjs";
import terser from "@rollup/plugin-terser";
// import babel from "rollup-plugin-babel";
import meta from "./package.json" assert { type: "json" };

// const copyright = `// ${meta.homepage} v${
//   meta.version
// } Copyright ${new Date().getFullYear()} ${meta.author.name}`;

// Extract copyrights from the LICENSE.
const copyright = readFileSync("./LICENSE", "utf-8")
  .split(/\n/g)
  .filter(line => /^Copyright\s+/.test(line))
  .map(line => line.replace(/^Copyright\s+/, ""))
  .join(", ");

export default [
  {
    input: "src/index.js",
    plugins: [
      // babel({
      //   exclude: "node_modules/**"
      // }),
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
      indent: false,
      // sourcemap: true,
      banner: `// ${meta.homepage} v${meta.version} Copyright ${copyright}`,
      globals: {
        d3: "d3",
        "popper.js": "Popper",
      },
    },
  },
  {
    input: "src/index.js",
    plugins: [
      // babel({
      //   exclude: "node_modules/**"
      // }),
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
      terser({ output: { preamble: `// ${meta.homepage} v${meta.version} Copyright ${copyright}` } }),
    ],
    external: ["d3", "popper.js"],
    output: {
      file: "dist/navio.min.js",
      name: "navio",
      extend: true,
      format: "umd",
      indent: false,
      globals: {
        d3: "d3",
        "popper.js": "Popper",
      },
    },
  },
];
