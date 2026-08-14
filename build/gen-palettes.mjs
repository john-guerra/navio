/**
 * Regenerate src/palettes.js.
 *
 *     npm run palettes
 *
 * The shipped categorical palettes are computed, not hand-picked, and this is
 * where. It writes plain hex arrays: the search below needs a 1.6MB naming
 * model and a colour-difference implementation, and neither has any business in
 * a widget bundle.
 *
 * The search is greedy farthest-point ("max-min") over a sampled HCL gamut,
 * with two constraints that each came from a measurement:
 *
 *   SCORED ON THE WORST VISION TYPE, not on normal vision. A palette optimised
 *   for normal vision alone measured 19.8 minimum pairwise CIEDE2000 and
 *   collapsed to 1.2 once colour-vision deficiency was simulated - worse than
 *   doing nothing about it.
 *
 *   SEARCHED ONLY OVER COLOURS PEOPLE CAN NAME. Maximising distance alone walks
 *   into the GAPS of colour space, and the gaps are where unnameable colours
 *   live: without this, 9 of 25 fell below the saliency Heer & Stone call
 *   "naming confusion", making it the worst of every palette measured on that
 *   axis - behind the ten-colour scheme it was replacing. Filtering first costs
 *   about 1.4 of separation and removes all nine.
 *
 * Measured for the shipped palette at each size (worst case across normal,
 * protanopia, deuteranopia and tritanopia):
 *
 *     n=16  dE00 9.4   n=24  7.2   n=32  5.6   n=50  4.5
 *
 * all with zero unnameable colours. The just-noticeable difference is about
 * 2.3, so even fifty categories stay above it for every kind of viewer.
 *
 * See docs/ai/COLOR-CATEGORICAL.md for the full review and its caveats.
 *
 * SOURCES
 *
 * Colour difference - CIEDE2000, validated below against the published
 * reference pairs before any palette is computed:
 *   Sharma, G., Wu, W. & Dalal, E. N. (2005). The CIEDE2000 color-difference
 *   formula: implementation notes, supplementary test data, and mathematical
 *   observations. Color Research & Application 30(1), 21-30.
 *   https://hajim.rochester.edu/ece/sites/gsharma/ciede2000/
 *
 * Colour-vision deficiency simulation - the dichromat transform applied to
 * linear-light sRGB:
 *   Vienot, F., Brettel, H. & Mollon, J. D. (1999). Digital video colourmaps
 *   for checking the legibility of displays by dichromats. Color Research &
 *   Application 24(4), 243-252.
 *
 * Naming - saliency and name distance, and the "below 0.2 is naming confusion"
 * threshold their own analyser uses:
 *   Heer, J. & Stone, M. (2012). Color naming models for color selection,
 *   image editing and palette design. Proc. ACM CHI, 1007-1016.
 *   https://vis.stanford.edu/papers/color-naming-models
 *   Implementation: https://github.com/StanfordHCI/c3 (BSD 3-clause), vendored
 *   under build/vendor/c3. Model built from Randall Munroe's XKCD colour
 *   survey, https://blog.xkcd.com/2010/05/03/color-survey-results/
 *
 * Farthest-point selection for categorical palettes:
 *   Glasbey, C., van der Heijden, G., Toh, V. F. K. & Gray, A. (2007).
 *   Colour displays for categorical images. Color Research & Application
 *   32(4), 304-309.
 *
 * The just-noticeable difference of about 2.3 used as a floor throughout:
 *   Mahy, M., Van Eycken, L. & Oosterlinck, A. (1994). Evaluation of uniform
 *   color spaces developed after the adoption of CIELAB and CIELUV. Color
 *   Research & Application 19(2), 105-121.
 */
import * as d3 from "d3";
import { writeFileSync } from "node:fs";
import { saliency, scorePalette, nameOf } from "./name-metrics.mjs";

const hex = (c) => d3.rgb(c).formatHex();
const TYPES = ["normal", "protan", "deutan", "tritan"];

// CIEDE2000 (Sharma, Wu & Dalal 2005) and Vienot 1999 dichromat simulation.
// Duplicated from examples/palettes/build-palettes.mjs deliberately: this
// script writes SHIPPED code and must not depend on an example.
const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;

function ciede2000(L1, a1, b1, L2, a2, b2) {
  const C1 = Math.hypot(a1, b1),
    C2 = Math.hypot(a2, b2);
  const Cbar = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cbar ** 7 / (Cbar ** 7 + 25 ** 7)));
  const a1p = (1 + G) * a1,
    a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1),
    C2p = Math.hypot(a2p, b2);
  const h1p =
    Math.abs(a1p) + Math.abs(b1) === 0
      ? 0
      : (deg(Math.atan2(b1, a1p)) + 360) % 360;
  const h2p =
    Math.abs(a2p) + Math.abs(b2) === 0
      ? 0
      : (deg(Math.atan2(b2, a2p)) + 360) % 360;
  const dLp = L2 - L1,
    dCp = C2p - C1p;
  let dhp;
  if (C1p * C2p === 0) dhp = 0;
  else if (Math.abs(h2p - h1p) <= 180) dhp = h2p - h1p;
  else if (h2p - h1p > 180) dhp = h2p - h1p - 360;
  else dhp = h2p - h1p + 360;
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(rad(dhp) / 2);
  const Lbp = (L1 + L2) / 2,
    Cbp = (C1p + C2p) / 2;
  let hbp;
  if (C1p * C2p === 0) hbp = h1p + h2p;
  else if (Math.abs(h1p - h2p) <= 180) hbp = (h1p + h2p) / 2;
  else if (h1p + h2p < 360) hbp = (h1p + h2p + 360) / 2;
  else hbp = (h1p + h2p - 360) / 2;
  const T =
    1 -
    0.17 * Math.cos(rad(hbp - 30)) +
    0.24 * Math.cos(rad(2 * hbp)) +
    0.32 * Math.cos(rad(3 * hbp + 6)) -
    0.2 * Math.cos(rad(4 * hbp - 63));
  const dTheta = 30 * Math.exp(-(((hbp - 275) / 25) ** 2));
  const Rc = 2 * Math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7));
  const Sl = 1 + (0.015 * (Lbp - 50) ** 2) / Math.sqrt(20 + (Lbp - 50) ** 2);
  const Sc = 1 + 0.045 * Cbp,
    Sh = 1 + 0.015 * Cbp * T;
  const Rt = -Math.sin(rad(2 * dTheta)) * Rc;
  return Math.sqrt(
    (dLp / Sl) ** 2 +
      (dCp / Sc) ** 2 +
      (dHp / Sh) ** 2 +
      Rt * (dCp / Sc) * (dHp / Sh)
  );
}

for (const [p, q, want] of [
  [[50, 2.6772, -79.7751], [50, 0, -82.7485], 2.0425],
  [[50, 0, 0], [50, -1, 2], 2.3669],
  [[60.2574, -34.0099, 36.2677], [60.4626, -34.1751, 39.4387], 1.2644],
]) {
  if (Math.abs(ciede2000(...p, ...q) - want) > 0.0002) {
    console.error("CIEDE2000 is wrong; refusing to generate palettes");
    process.exit(1);
  }
}

const toLin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = (c) =>
  c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
const clamp = (x) => Math.max(0, Math.min(1, x));

function simulate(colour, type) {
  if (type === "normal") return colour;
  const c = d3.rgb(colour);
  const R = toLin(c.r / 255),
    G = toLin(c.g / 255),
    B = toLin(c.b / 255);
  const L = 0.31399022 * R + 0.63951294 * G + 0.04649755 * B;
  const M = 0.15537241 * R + 0.75789446 * G + 0.08670142 * B;
  const S = 0.01775239 * R + 0.10944209 * G + 0.87256922 * B;
  let l = L,
    m = M,
    s = S;
  if (type === "protan") l = 1.05118294 * M - 0.05116099 * S;
  if (type === "deutan") m = 0.9513092 * L + 0.04866992 * S;
  if (type === "tritan") s = -0.86744736 * L + 1.86727089 * M;
  return d3
    .rgb(
      255 *
        clamp(toSrgb(clamp(5.47221206 * l - 4.6419601 * m + 0.16963708 * s))),
      255 *
        clamp(toSrgb(clamp(-1.1252419 * l + 2.29317094 * m - 0.1678952 * s))),
      255 *
        clamp(toSrgb(clamp(0.02980165 * l - 0.19318073 * m + 1.16364789 * s)))
    )
    .formatHex();
}

const de00 = (x, y) => {
  const A = d3.lab(x),
    B = d3.lab(y);
  return ciede2000(A.l, A.a, A.b, B.l, B.a, B.b);
};

/**
 * How good a colour is to meet FIRST, independent of how far it is from the
 * others. Farthest-point alone answers "which colour is most different", never
 * "which is nicest to look at", so its opening picks were a dark brown and two
 * greys - fine in a 50-colour set, poor as the first three a reader sees when a
 * column has four categories.
 *
 * Three measurable things, and no claim that this measures beauty:
 *   - saliency: can a reader name it at all (Heer & Stone).
 *   - chroma: vivid colours survive being one pixel tall; the muddy middle of
 *     the space does not. Capped, because maximum chroma is not the goal.
 *   - a fresh NAME: two blues in the first four is worse than a blue and a
 *     green, however far apart they measure.
 */
function appealOf(colour, sal, name, usedNames) {
  const chroma = Math.min(d3.hcl(colour).c, 70) / 70;
  const fresh = usedNames.has(name) ? 0.35 : 1;
  return sal * (0.4 + 0.6 * chroma) * fresh;
}

function maxMin(n, { salFloor = 0, order = false } = {}) {
  let cand = [];
  for (let L = 30; L <= 85; L += 5)
    for (let C = 15; C <= 110; C += 5)
      for (let H = 0; H < 360; H += 5) {
        const c = d3.hcl(H, C, L),
          r = d3.rgb(c);
        if (
          r.r < -0.5 ||
          r.r > 255.5 ||
          r.g < -0.5 ||
          r.g > 255.5 ||
          r.b < -0.5 ||
          r.b > 255.5
        )
          continue;
        cand.push(hex(c));
      }
  if (salFloor > 0) cand = cand.filter((c) => saliency(c) >= salFloor);
  const sims = TYPES.map((t) => cand.map((c) => simulate(c, t)));
  const dist = (i, colour) =>
    Math.min(...TYPES.map((t, k) => de00(sims[k][i], simulate(colour, t))));
  // Precomputed once: nameOf walks the whole term table, and this loop runs
  // thousands of candidates times fifty picks.
  const sal = order ? cand.map(saliency) : null;
  const names = order ? cand.map(nameOf) : null;
  const used = new Set();

  let start = 0;
  if (order)
    for (let i = 1; i < cand.length; i++)
      if (
        appealOf(cand[i], sal[i], names[i], used) >
        appealOf(cand[start], sal[start], names[start], used)
      )
        start = i;
  const out = [cand[start]];
  if (order) used.add(names[start]);

  const best = new Float64Array(cand.length).fill(Infinity);
  const absorb = (colour) => {
    for (let i = 0; i < cand.length; i++)
      best[i] = Math.min(best[i], dist(i, colour));
  };
  absorb(out[0]);
  while (out.length < n && out.length < cand.length) {
    let bi = -1,
      bd = -1;
    for (let i = 0; i < cand.length; i++)
      if (best[i] > bd) {
        bd = best[i];
        bi = i;
      }
    if (order) {
      // Among the candidates ALMOST as far away as the best one, take the most
      // appealing. The 10% band is what buys a good opening sequence; widening
      // it would start costing real separation, which is the property the whole
      // palette exists for.
      const cutoff = bd * 0.9;
      let aj = bi,
        aBest = -1;
      for (let i = 0; i < cand.length; i++) {
        if (best[i] < cutoff) continue;
        const a = appealOf(cand[i], sal[i], names[i], used);
        if (a > aBest) {
          aBest = a;
          aj = i;
        }
      }
      bi = aj;
      used.add(names[bi]);
    }
    out.push(cand[bi]);
    absorb(cand[bi]);
  }
  return out;
}

const minPair = (cols, type) => {
  const c = cols.map((x) => simulate(x, type));
  let m = Infinity;
  for (let i = 0; i < c.length; i++)
    for (let j = i + 1; j < c.length; j++) m = Math.min(m, de00(c[i], c[j]));
  return m;
};
const worst = (cols) => Math.min(...TYPES.map((t) => minPair(cols, t)));

const N = 50;
const nameable = maxMin(N, { salFloor: 0.4, order: true });
const distinct = maxMin(N);

const report = (name, cols) => {
  const s = scorePalette(cols);
  console.log(
    `  ${name.padEnd(10)} n=${cols.length}  worst dE00 ${worst(cols).toFixed(1)}  mean saliency ${s.meanSaliency}  unnameable ${s.confused}`
  );
};
report("nameable", nameable);
report("distinct", distinct);

const fmt = (cols) =>
  cols
    .map((c, i) => `  "${c}",${(i + 1) % 5 === 0 ? "\n" : ""}`)
    .join("")
    .replace(/\n$/, "");

const out = `/**
 * Categorical palettes. GENERATED by build/gen-palettes.mjs - do not edit.
 *
 *     npm run palettes
 *
 * Why these and not d3.schemeCategory10: that scheme holds ten colours and
 * d3.scaleOrdinal RECYCLES them, so an eleventh category is drawn in exactly
 * the colour of the first with nothing said. It also collides for colour-blind
 * readers before it runs out - measured at 1.6 CIEDE2000 under protanopia at
 * ten categories, below the ~2.3 just-noticeable difference.
 *
 * \`nameable\` is the default. Minimum pairwise CIEDE2000, worst case across
 * normal, protanopia, deuteranopia and tritanopia:
 *
 *     n=16  9.4      n=24  7.2      n=32  5.6      n=50  4.5
 *
 * with every colour above the naming-confusion threshold.
 *
 * How these were derived, and by whom, is documented in
 * build/gen-palettes.mjs; the review behind the choices, with its caveats, is
 * in docs/ai/COLOR-CATEGORICAL.md. Each palette below cites its own source.
 */
import * as d3 from "d3";

/**
 * Maximally separated AND nameable. The default.
 *
 * Greedy farthest-point over a sampled HCL gamut (Glasbey et al. 2007), scored
 * with CIEDE2000 (Sharma et al. 2005) on the worst of normal vision and three
 * simulated deficiencies (Vienot et al. 1999), searching only over colours with
 * naming saliency >= 0.4 (Heer & Stone 2012).
 */
export const nameable = [
${fmt(nameable)}
];

/**
 * Maximally separated, ignoring whether a colour has a name. Same search as
 * 'nameable' without the saliency floor: about 1.4 more CIEDE2000 of
 * separation, at the cost of 9 of 25 colours nobody can name.
 */
export const distinct = [
${fmt(distinct)}
];

/**
 * mokole.com's generator: farthest-point over the X11 named colours, scored on
 * Euclidean CIELAB for normal vision. Vivid, and the best of the field on that
 * metric - but colour blindness is not in its objective, and its limegreen and
 * tomato are 0.7 apart under deuteranopia.
 *
 * Source: https://mokole.com/palette.html (50 colours, default luminosity
 * bounds). Note their metric is Euclidean CIELAB; Heer & Stone (2012) use
 * CIEDE2000 and warn that Euclidean CIELAB is unreliable for comparisons
 * across the whole space, which is what a minimum-pairwise score is.
 */
export const mokole = [
${fmt(
  "d3d3d3 2f4f4f 556b2f 6b8e23 a0522d a52a2a 2e8b57 228b22 708090 483d8b 008b8b 4682b4 000080 d2691e 9acd32 32cd32 daa520 8fbc8f 8b008b d2b48c 48d1cc 9932cc ff4500 ff8c00 ffd700 0000cd 00ff00 00fa9a dc143c 00bfff f4a460 0000ff a020f0 adff2f ff6347 ff00ff 1e90ff db7093 f0e68c fa8072 ffff54 dda0dd 90ee90 87ceeb ff1493 7b68ee ee82ee 7fffd4 ff69b4 ffc0cb"
    .split(" ")
    .map((h) => "#" + h)
)}
];

/**
 * What Navio drew before 0.3.0. Ten colours, and d3.scaleOrdinal recycles past
 * them. Kept so the old look is one line away. Measured at ten categories it is
 * 16.2 CIEDE2000 for normal vision but 1.6 under protanopia - below the ~2.3
 * just-noticeable difference - so two of its ten are the same colour for those
 * readers before any recycling.
 *
 * Source: d3-scale-chromatic, https://d3js.org/d3-scale-chromatic/categorical
 * (originally Tableau's 10-colour palette by way of matplotlib).
 */
export const category10 = d3.schemeCategory10.slice();

/**
 * Best salience and least name overlap of the qualitative palettes Heer & Stone
 * characterised: "The Tableau-10 palette provides the best color salience and
 * minimal name overlap."
 *
 * Source: d3-scale-chromatic, https://d3js.org/d3-scale-chromatic/categorical
 * Designed by Maureen Stone for Tableau; see Stone, M. (2006), Choosing colors
 * for data visualization, https://www.perceptualedge.com/articles/b-eye/choosing_colors.pdf
 */
export const tableau10 = d3.schemeTableau10.slice();

/**
 * Sampled at i/n rather than d3.quantize's i/(n-1). Rainbow and Sinebow are
 * CYCLICAL - t=0 and t=1 are the same colour - so quantize puts an exact
 * duplicate at the ends, which is the bug these palettes exist to avoid.
 *
 * Sources: d3-scale-chromatic, https://d3js.org/d3-scale-chromatic/cyclical
 * Sinebow is after Jim Bumgardner's and Charlie Loyd's construction,
 * https://basecase.org/env/on-rainbows
 */
export const rainbow = (n) => d3.range(n).map((i) => d3.interpolateRainbow(i / n));
export const sinebow = (n) => d3.range(n).map((i) => d3.interpolateSinebow(i / n));

/**
 * Built for SEQUENTIAL scalar data, not for categories - included because it is
 * the obvious thing to reach for. Google state it is "not perceptually linear"
 * and designed it by interactive comparison rather than by pairwise distance.
 *
 * Source: Mikhailov, A. (2019). Turbo, an improved rainbow colormap for
 * visualization. https://research.google/blog/turbo-an-improved-rainbow-colormap-for-visualization/
 * via d3-scale-chromatic, https://d3js.org/d3-scale-chromatic/sequential
 */
export const turbo = (n) => d3.quantize(d3.interpolateTurbo, n);

export const palettes = {
  nameable,
  distinct,
  mokole,
  category10,
  tableau10,
  rainbow,
  sinebow,
  turbo,
};
`;

writeFileSync(new URL("../src/palettes.js", import.meta.url), out);
console.log("wrote src/palettes.js");
