import { describe, it, expect } from "vitest";
import { createCanvasRenderer } from "../../src/render/canvas.js";

// A recording 2D context: enough surface for the painters to run real code
// rather than stubs, and to assert the exact call order they produce.
function fakeContext() {
  const calls = [];
  return {
    calls,
    save: () => calls.push(["save"]),
    restore: () => calls.push(["restore"]),
    beginPath: () => calls.push(["beginPath"]),
    closePath: () => calls.push(["closePath"]),
    moveTo: (x, y) => calls.push(["moveTo", x, y]),
    lineTo: (x, y) => calls.push(["lineTo", x, y]),
    stroke: () => calls.push(["stroke"]),
    fill: () => calls.push(["fill"]),
    set lineWidth(v) {
      calls.push(["lineWidth", v]);
    },
    set strokeStyle(v) {
      calls.push(["strokeStyle", v]);
    },
    set fillStyle(v) {
      calls.push(["fillStyle", v]);
    },
  };
}

function buildCtx(overrides = {}) {
  return {
    nv: { DEBUG: false, ...overrides.nv },
    context: overrides.context,
    data: [],
    dataIs: [],
    links: [],
    visibleLinks: [],
    selectedFlags: new Uint8Array(0),
    colScales: new Map(),
    idOf: (i) => i,
    getAttrib: (row, a) => row[a],
    getAttribName: (a) => a,
    visibleAttribs: () => [],
    indexOfRow: (r) => r,
    posAt: () => 0,
    isMissing: (v) => v === undefined || v === null,
    theme: () => ({ border: "#000" }),
    divisionsColour: () => "#ccc",
    ...overrides,
  };
}

describe("createCanvasRenderer construction contract", () => {
  it("drawLine strokes an open path through every point", () => {
    const context = fakeContext();
    const { drawLine } = createCanvasRenderer(buildCtx({ context }));
    drawLine(
      [
        { x: 1, y: 2 },
        { x: 3, y: 4 },
      ],
      2,
      "red",
      false
    );
    expect(context.calls).toEqual([
      ["beginPath"],
      ["moveTo", 1, 2],
      ["lineTo", 3, 4],
      ["lineWidth", 2],
      ["strokeStyle", "red"],
      ["stroke"],
    ]);
  });

  it("drawLine fills and closes when close is true", () => {
    const context = fakeContext();
    const { drawLine } = createCanvasRenderer(buildCtx({ context }));
    drawLine([{ x: 0, y: 0 }], 1, "blue", true);
    expect(context.calls).toEqual([
      ["beginPath"],
      ["moveTo", 0, 0],
      ["lineWidth", 1],
      ["fillStyle", "blue"],
      ["closePath"],
      ["fill"],
    ]);
  });

  // The contract this module exists to honour. `context` is assigned in
  // init() (src/navio.js:979), long after this factory is constructed, so a
  // renderer that captured ctx.context by VALUE would hold undefined forever
  // and throw on the first paint. Same class of bug as geom's yScales getter.
  it("reads the CURRENT context, not one captured at construction", () => {
    let context = null;
    const ctx = buildCtx();
    Object.defineProperty(ctx, "context", { get: () => context });
    const { drawLine } = createCanvasRenderer(ctx);

    // Constructed while context is still null - exactly navio's real order.
    context = fakeContext();
    drawLine([{ x: 7, y: 8 }], 1, "green", false);
    expect(context.calls).toContainEqual(["moveTo", 7, 8]);
  });
});
