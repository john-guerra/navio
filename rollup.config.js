import ascii from "rollup-plugin-ascii";
import node from "rollup-plugin-node-resolve";
import {terser} from "rollup-plugin-terser";
import * as meta from "./package.json";

const copyright = `// ${meta.homepage} v${meta.version} Copyright ${(new Date).getFullYear()} ${meta.author.name}`;

export default [
  {
    input: "src/navio.js",
    plugins: [
      node({
        jsxnext: true,
        main: true,
        browser: true
      }),
      ascii()
    ],
    external: ["d3", "d3-scale-chromatic"],
    output: {
      extend: true,
      banner: copyright,
      file: "dist/navio.js",
      format: "umd",
      indent: false,
      name: "navio",
      globals: {
        d3:"d3",
        "d3-scale-chromatic":"d3"
      }
    }
  },
  {
    input: "src/navio",
    plugins: [
      node({
        jsxnext: true,
        main: true,
        browser: true
      }),
      ascii(),
      terser({output: {preamble: copyright}})
    ],
    external: ["d3", "d3-scale-chromatic"],
    output: {
      extend: true,
      file: "dist/navio.min.js",
      format: "umd",
      indent: false,
      name: "navio",
      globals: {
        d3:"d3",
        "d3-scale-chromatic":"d3"
      }
    }
  }
];