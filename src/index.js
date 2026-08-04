import navio from "./navio.js";
import NavioWidget from "./NavioWidget.js";

// This entry is default-only on purpose. The UMD builds expose a single global,
// and adding a named export alongside the default turns that global into a
// namespace object - `new navio(...)` then throws "navio is not a constructor"
// for every existing user. Hanging the widget off the function keeps the global
// callable and still reaches it as `navio.NavioWidget`.
//
// src/index.esm.js is the ESM entry and does offer named exports, since ESM has
// no such ambiguity.
navio.NavioWidget = NavioWidget;

export default navio;
