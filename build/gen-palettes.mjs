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
 * See docs/ai/COLOR-CATEGORICAL.md for sourcing, and for the caveat that the
 * naming model describes ENGLISH naming.
 */
import * as d3 from "d3";
import { writeFileSync } from "node:fs";
import { saliency, scorePalette } from "./name-metrics.mjs";

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

function maxMin(n, { salFloor = 0 } = {}) {
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
  const out = [cand[0]];
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
const nameable = maxMin(N, { salFloor: 0.4 });
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
 * with every colour above the naming-confusion threshold. See
 * docs/ai/COLOR-CATEGORICAL.md.
 */
import * as d3 from "d3";

/** Maximally separated AND nameable. The default. */
export const nameable = [
${fmt(nameable)}
];

/** Maximally separated, ignoring whether a colour has a name. */
export const distinct = [
${fmt(distinct)}
];

/**
 * mokole.com's generator: farthest-point over the X11 named colours, scored on
 * Euclidean CIELAB for normal vision. Vivid, and the best of the field on that
 * metric - but colour blindness is not in its objective, and its limegreen and
 * tomato are 0.7 apart under deuteranopia.
 */
export const mokole = [
${fmt(
  "d3d3d3 2f4f4f 556b2f 6b8e23 a0522d a52a2a 2e8b57 228b22 708090 483d8b 008b8b 4682b4 000080 d2691e 9acd32 32cd32 daa520 8fbc8f 8b008b d2b48c 48d1cc 9932cc ff4500 ff8c00 ffd700 0000cd 00ff00 00fa9a dc143c 00bfff f4a460 0000ff a020f0 adff2f ff6347 ff00ff 1e90ff db7093 f0e68c fa8072 ffff54 dda0dd 90ee90 87ceeb ff1493 7b68ee ee82ee 7fffd4 ff69b4 ffc0cb"
    .split(" ")
    .map((h) => "#" + h)
)}
];

/** What Navio drew before 0.3.0. Ten colours, and it recycles past them. */
export const category10 = d3.schemeCategory10.slice();

/** Best salience and least name overlap of the palettes Heer & Stone measured. */
export const tableau10 = d3.schemeTableau10.slice();

/**
 * Sampled at i/n rather than d3.quantize's i/(n-1). Rainbow and Sinebow are
 * CYCLICAL - t=0 and t=1 are the same colour - so quantize puts an exact
 * duplicate at the ends, which is the bug these palettes exist to avoid.
 */
export const rainbow = (n) => d3.range(n).map((i) => d3.interpolateRainbow(i / n));
export const sinebow = (n) => d3.range(n).map((i) => d3.interpolateSinebow(i / n));

/** Built for sequential data. Included because it is the obvious thing to try. */
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
