function _1(md){return(
md`# [@observablehq/inspector@5.0.1](https://github.com/observablehq/inspector)
## also see [@observablehq/inspector](https://observablehq.com/@observablehq/inspector)
\`\`\`js
    import {inspect, Inspector} from '@tomlarkworthy/inspector'
\`\`\``
)}

function _inspect(Inspector){return(
function inspect(value) {
  const root = document.createElement("DIV");
  new Inspector(root).fulfilled(value);
  const element = root.firstChild;
  element.remove();
  element.value = value; // for viewof
  return element;
}
)}

function _src(unzip,FileAttachment){return(
unzip(FileAttachment("inspector-5@1.0.1.js.gz"))
)}

function _unzip(Response,DecompressionStream){return(
async (attachment) => {
  const response = await new Response(
    (await attachment.stream()).pipeThrough(new DecompressionStream("gzip"))
  );

  return response.blob();
}
)}

async function _Inspector(src,require)
{
  const objectURL = URL.createObjectURL(
    new Blob([src], { type: "application/javascript" })
  );
  try {
    return (await require(objectURL)).Inspector;
  } finally {
    URL.revokeObjectURL(objectURL); // Ensure URL is revoked after import
  }
}


function _isnode(Element,Text){return(
(value) => {
  return (
    (value instanceof Element || value instanceof Text) &&
    value instanceof value.constructor
  );
}
)}

export default function define(runtime, observer) {
  const main = runtime.module();
  function toString() { return this.url; }
  const fileAttachments = new Map([
    ["inspector-5@1.0.1.js.gz", {url: new URL("./files/871f5186f773c2c3a34e9c7afb4d2eca16ebdcc03c667941f864fc46ed9849119c5dfc69c0e0f9eee7c224eb7c90a04656c283a6b0a89eb967803f2925980fb9.gz", import.meta.url), mimeType: "application/gzip", toString}]
  ]);
  main.builtin("FileAttachment", runtime.fileAttachments(name => fileAttachments.get(name)));
  main.variable(observer()).define(["md"], _1);
  main.variable(observer("inspect")).define("inspect", ["Inspector"], _inspect);
  main.variable(observer("src")).define("src", ["unzip","FileAttachment"], _src);
  main.variable(observer("unzip")).define("unzip", ["Response","DecompressionStream"], _unzip);
  main.variable(observer("Inspector")).define("Inspector", ["src","require"], _Inspector);
  main.variable(observer("isnode")).define("isnode", ["Element","Text"], _isnode);
  return main;
}
