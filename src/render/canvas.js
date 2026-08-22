/**
 * navio's canvas painters: everything that draws to the 2D context.
 *
 * Built ONCE, in the closure, after the settings module is destructured
 * (src/navio.js:1258-1269) - `theme` and `divisionsColour` come from there.
 *
 * `context`, `data`, `dataIs`, `links`, `visibleLinks`, `selectedFlags` and
 * `colScales` are all reassigned during the widget's life - `context` in
 * init(), the rest on data changes and at destroy - so they cross as GETTERS
 * and are read at call time. Everything else here is either `nv` (never
 * rebound), a hoisted function declaration, or a `const` from the settings
 * module, and is safe as a plain value. This is the same contract
 * src/geometry.js documents, and CLAUDE.md's "a module gets GETTERS, not
 * values" landmine is about exactly this.
 *
 * `geom` is NOT a ctx entry - it is passed per call, because every one of
 * these functions already takes it.
 *
 * See docs/ai/2026-08-21-navio-canvas-renderer-design.md.
 *
 * @param {object} ctx - { nv, get context(), get data(), get dataIs(),
 *   get links(), get visibleLinks(), get selectedFlags(), get colScales(),
 *   idOf, getAttrib, getAttribName, visibleAttribs, indexOfRow, posAt,
 *   isMissing, theme, divisionsColour }
 */
export function createCanvasRenderer(ctx) {
  /**
   * Stroke or fill a path of already-mapped SCREEN points.
   *
   * This is the one painter that takes no `geom`: its caller
   * (drawLevelConnections) builds the path in (attribute, record) space and
   * maps the whole thing through geom.toXY before calling here, so by this
   * point the coordinates are screen x/y and must not be transposed again.
   */
  function drawLine(points, width, color, close) {
    const context = ctx.context;
    context.beginPath();
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      if (i === 0) {
        context.moveTo(p.x, p.y);
      } else {
        context.lineTo(p.x, p.y);
      }
    }
    context.lineWidth = width;
    if (close) {
      context.fillStyle = color;
      context.closePath();
      context.fill();
    } else {
      context.strokeStyle = color;
      context.stroke();
    }
  }

  return { drawLine };
}
