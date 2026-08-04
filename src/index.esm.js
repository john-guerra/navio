import navio from "./navio.js";
import NavioWidget from "./NavioWidget.js";

// ESM entry: named exports are safe here. The UMD entry (src/index.js) must
// stay default-only - see the note there.
navio.NavioWidget = NavioWidget;

export default navio;
export { navio, NavioWidget };
