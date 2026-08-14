/** Write docs/ai/API.md. See build/gen-api-docs.js for why it is generated. */
import { writeFileSync } from "node:fs";
import { renderApiDocs } from "./gen-api-docs.js";

const OUT = new URL("../docs/ai/API.md", import.meta.url);
writeFileSync(OUT, renderApiDocs() + "\n");
console.log("wrote docs/ai/API.md");
