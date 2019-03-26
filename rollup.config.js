import ascii from "rollup-plugin-ascii";
import node from "rollup-plugin-node-resolve";
import commonjs from "rollup-plugin-commonjs";
// import {terser} from "rollup-plugin-terser";
// import babel from "rollup-plugin-babel";
import * as meta from "./package.json";

const copyright = `// ${meta.homepage} v${meta.version} Copyright ${(new Date).getFullYear()} ${meta.author.name}`;

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
        browser: true
      }),
      ascii()
    ],
    external: [
      "d3",
      "d3-scale-chromatic",
      "popper.js"
    ],
    output: {
      extend: true,
      banner: copyright,
      file: "dist/navio.js",
      format: "umd",
      indent: false,
      name: "navio",
      sourcemap: true,
      globals: {
        d3:"d3",
        "d3-scale-chromatic":"d3ScaleChromatic",
        "popper.js":"Popper"
      }
    }
  },
  {
    input: "src/index.js",
    plugins: [
      // babel({
      //   exclude: "node_modules/**"
      // }),
      node({
        jsxnext: true
      }),
      ascii(),
      commonjs()
    ],
    external: [
      "d3",
      "d3-scale-chromatic",
      "popper.js"
    ],
    output: {
      extend: true,
      banner: copyright,
      file: meta.module,
      format: "esm",
      indent: false,
      sourcemap: true,
      name: "navio",
      globals: {
        d3:"d3",
        "d3-scale-chromatic":"d3ScaleChromatic",
        "popper.js":"Popper"
      }
    }
  }
];