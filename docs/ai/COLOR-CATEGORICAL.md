# Categorical colour when there are many categories

## What this is for

Navio colours a categorical attribute with `d3.scaleOrdinal(d3.schemeCategory10)`
(`src/navio.js`, `nv.defaultColorCategorical`). `scaleOrdinal` recycles its
range, so category 11 is drawn in exactly the colour of category 1 and nothing
says so. We are deciding what to replace that with. This document is the
literature review behind that decision: what the visualization research
community has actually established about how many categories colour can carry,
which palette systems exist, which metrics to trust, and what to do when there
are more categories than colour can encode.

It exists as a separate document because most published advice assumes a
legend-and-lookup chart with marks a reader fixates on one at a time. Navio is
not that. Navio draws **one pixel row per record**, one column per attribute,
and the reader is asking "are the reds clumped at the top?" — a pattern and
clustering question — with exact identification available on hover. Several
well-known recommendations do not transfer, and §7 says which and why.

Every empirical claim below has a citation. Where I could not verify something,
it is marked. Numbers taken from this project's own measurements are labelled
**[measured here]** and were not re-derived.

---

## Bottom line

1. **There is no palette that makes 25 categories work in 1px rows.** The
   size-dependent colour-difference models (Stone et al. 2014; Szafir 2018) all
   run out before a 1px mark. Extrapolating them past their fitted range gives
   required separations that exceed the sRGB gamut. Choosing a better palette
   raises the ceiling from "about 8" to "about 10–12", not to 25.

2. **Replace `schemeCategory10` anyway.** The current default's real defect is
   not that 10 is too few, it is that exceeding 10 is *silent*. A CVD-aware
   max-min palette (min pairwise ΔE00 7.1 at n=25, worst case across normal
   vision and three simulated deficiencies **[measured here]**) strictly
   dominates every concatenation and every `quantize`d continuous scheme we
   measured. It costs nothing to adopt and removes an exact-collision bug.

3. **Cap the number of colours drawn, and say so.** The community's escapes —
   group the tail into "other", switch to an ordinal/sequential encoding,
   highlight one category at a time — are the actual answer above ~10
   categories. Navio already has the machinery for two of the three
   (`scaleOrdered`, `scaleText`, hover, drill-down).

4. **The variable that decides legibility in Navio is run length, not palette
   quality.** A category occupying 40 consecutive rows is a 40px band and sits
   comfortably inside every measured model. A category scattered as isolated
   single rows is below every measured model regardless of its colour. Sorting
   the column is therefore a stronger intervention than any palette change
   (Haroz & Whitney 2012, §6).

5. **Our metric and the literature's metrics are not the same scale.** Our
   measurements are CIEDE2000; the size models are CIELAB ΔE\*ab; Petroff's are
   CAM02-UCS. They cannot be compared without conversion, and we have not done
   it. See §8.

---

## 1. How many categories colour can carry

**Miller's 7±2 is not the source and should not be cited here.** It is a
short-term-memory result about chunks of information, not a result about
simultaneous colour discrimination. The colour-specific evidence is separate and
gives similar numbers for different reasons.

**Healey (1996) — seven, under isoluminance.** Healey ran target-identification
studies with 38 observers, varying the number of colours on screen (3, 5, 7, 9)
while holding colour distance and linear separation constant around a maximum
inscribed circle in a CIELUV isoluminant slice. Three and five colours gave flat
response-time curves (parallel search) with ~2.5% error. At seven colours error
was 3.3% but green and green-yellow targets showed serial search. At nine, mean
error rose to 8.1% (14% for G, GY, RP). After adding colour-category
differentiation, a tuned seven-colour set with neighbour distance 59.4 ΔE\*
(CIELUV) and linear separation 24.6 gave 5.2% error and much flatter curves. His
conclusion: *"It appears that seven isoluminant colours is the maximum we can
display at one time, while still allowing rapid and accurate identification of
any one of the colours."*
[PDF](https://www.csc2.ncsu.edu/faculty/healey/download/viz.96.pdf) ·
Healey, C. G. (1996). Choosing effective colours for data visualization. *Proc.
IEEE Visualization '96*, 263–270.

Note the constraint: **isoluminant**. Healey deliberately gave up the lightness
axis. Palettes that use lightness (Okabe-Ito, Tol, Petroff) are not bound by his
seven.

**Haroz & Whitney (2012) — capacity is set by the task and by grouping.** Best
paper at VisWeek 2012. They separated three tasks: search for a known target,
search for an unknown oddball, and judging how many categories are present
(subitizing). Known-target search stayed fast and >95% accurate as variety grew.
Oddball search and subitizing degraded sharply, and **subitizing accuracy fell
toward chance (50%) as the number of colours increased, with grouping producing
"a dramatic improvement"**. Their local-vs-global analysis found that variety
*immediately adjacent to the target* had no effect on performance; total variety
on screen did. Their guideline 6.3 is titled "When there are many categories:
Less is more", and their third conclusion is *"For difficult tasks, aim to reduce
variety in the entire view rather than optimizing small regions."*
[PDF](http://steveharoz.com/research/attention/papers/Haroz_Whitney_2012_InfoVis.pdf) ·
Haroz, S. & Whitney, D. (2012). *IEEE TVCG* 18(12), 2402–2410.
They tested up to 7 colour varieties, so they give no number above that.

**Gramazio, Laidlaw & Schloss (2017) — error rises steeply from 3 to 8.** In
their Experiment 1 discrimination task, total errors were 79/660 (12%) for
3-colour palettes, 119/660 (18%) for 5, and 190/660 (29%) for 8 — a significant
effect of palette size (F(2,57) = 30.801, p < .001). Participant discard rates
for poor accuracy also rose with palette size. They also report that **all four
of their palette scores decline significantly with palette size**, because
adding colours leaves fewer regions of colour space and adds pairs that can go
bad.
[PDF](https://vis.cs.brown.edu/docs/pdf/Gramazio-2016-CCD.pdf)

**Petroff (2021/2024) — the achievable max-min distance falls with n.** Using
CAM02-UCS distance with the worst case taken across simulated protan, deutan and
tritan deficiencies at all severities, the best minimum pairwise distance he
could find was **24.3 for 6 colours, 20.2 for 8, 18.0 for 10** under loose
lightness constraints, and 23.6 / 19.6 / 16.9 under the tighter constraints he
finally used. He set his generation thresholds at 20 / 18 / 16 respectively. He
did not attempt sets larger than ten.
[arXiv:2107.02270](https://arxiv.org/abs/2107.02270) ·
Petroff, M. A. (2024). Accessible Color Sequences for Data Visualization.

**Boynton (1989) — eleven colours are almost never confused.** Frequently cited
as the naming-based ceiling. *Unverified*: I confirmed the paper exists ("Eleven
Colors That Are Almost Never Confused", SPIE Human Vision, Visual Processing,
and Digital Display) but could not read it, so I cannot report its method or
error rates.

**Where the literature disagrees.** Healey says seven *for rapid identification
under isoluminance*. Colorgorical will generate up to 22 before it exhausts
colour space but calls that "inadvisable". Munzner's textbook is commonly
summarised as "around a dozen"; I could only verify that number from her lecture
slides (["around 8-14 colors" for discrete separated
patches](https://www.cs.ubc.ca/~tmm/courses/533-09/slides/color-4x4.pdf)), not
from the book itself. These are not contradictory so much as answers to
different questions: *identify one named colour on demand* is harder than
*notice that two adjacent regions differ*, which is the Navio task (§7).

The honest summary: **8 is safe, 10 is the practical industry ceiling, 12 is
optimistic, and past ~12 you are trading exact identification for something
else.**

---

## 2. Named palette-generation systems

| System | Optimises | Ceiling | CVD-aware? | Implementation |
|---|---|---|---|---|
| Glasbey et al. 2007 | max-min Euclidean distance in CIELAB | arbitrary n; distributed palette has 32 | **No** (plain CIELAB) | Python `glasbey` (lmcinnes), R `pals`, `colorcet` |
| Colorgorical (2017) | weighted sum of perceptual distance (CIEDE2000), name difference, name uniqueness, pair preference | ~22 before colour space is exhausted; authors call that inadvisable | **No** — listed as future work | Web tool, <http://vrl.cs.brown.edu/color> |
| i want hue (Jacomy 2013) | k-means or force-vector spread over a user-constrained CIELAB region | arbitrary n | Yes, optional protan/deutan/tritan modes | Web tool + `iwanthue` npm package |
| Okabe & Ito 2008 | hand-designed for CVD | 8 | **Yes**, by design | Fixed hex list, <https://jfly.uni-koeln.de/color/> |
| Paul Tol | hand-designed schemes (bright, high-contrast, vibrant, muted, medium-contrast) | 7–9 per qualitative scheme | **Yes** for the named schemes | Fixed hex lists; ports in R `khroma`, many others |
| ColorBrewer (Harrower & Brewer 2003) | expert iterative design for choropleth maps | **12** (`Set3`, `Paired`); most are 8–9 | Partially — the site flags which schemes are CVD-safe | `chroma.brewer`, `d3-scale-chromatic` |
| Petroff 2024 | ML aesthetic-preference model × CVD/greyscale/contrast/nameability constraints | 6, 8, 10 (three published sequences) | **Yes**, Machado 2009 at all severities, three deficiency types | Published hex lists + code |

Sources: Glasbey, C. et al. (2007). Colour displays for categorical images.
*Color Research & Application* 32, 304–309.
[Wiley](https://onlinelibrary.wiley.com/doi/abs/10.1002/col.20327) ·
[glasbey docs](https://glasbey.readthedocs.io/en/latest/) (its "Colour-blind
Safe Palettes" section is a modern addition, not in the 2007 paper) ·
[i want hue](https://medialab.github.io/iwanthue/) ·
[Tol](https://sronpersonalpages.nl/~pault/) (the `personal.sron.nl` mirror did
not resolve for me; the `sronpersonalpages.nl` host did) ·
Harrower, M. & Brewer, C. (2003). ColorBrewer.org. *The Cartographic Journal*
40(1), 27–37.

Two findings worth carrying forward:

- **Petroff measured `Category10` directly.** Taking its first ten colours, the
  running minimum pairwise CAM02-UCS distance under his CVD metric is
  100.0, 54.1, 3.4, 3.4, 2.0, 2.0, 2.0, 2.0, 2.0, 2.0 — i.e. **by the fifth
  colour it is already unusable for CVD viewers**, and it never recovers. Okabe-Ito
  over eight colours gives 100.0, 77.2, 49.3, 13.8, 13.8, 13.1, 13.1, 11.0. He
  concludes that Matplotlib and the other codes defaulting to Category 10 "fared
  the worst".
- **Colorgorical's aggregation matches ours.** They score a palette by its
  *worst* pair, on the explicit assumption that "a palette is only as
  discriminable or preferable as the worst-performing pair of colors in it".
  That is the same min-pairwise statistic we measured.

**Availability note for Navio.** `d3` and `popper.js` are external (see
`CLAUDE.md`); adding a palette *library* as a runtime dependency is against the
grain of this repo. All of the systems above can be run offline and their output
baked in as a hex array, which is what Navio should do.

---

## 3. Metrics: what ΔE does and does not tell you

**CIE76 (plain Euclidean CIELAB) is not good enough.** CIELAB is not
perceptually uniform, particularly for blues and near-neutrals. CIEDE2000 (Luo,
Cui & Rigg 2001) adds lightness, chroma and hue weighting functions, a
chroma–hue interaction term specifically to fix blues, and a rescaling of a\* to
fix greys.
[Wiley](https://onlinelibrary.wiley.com/doi/10.1002/col.1049) ·
Colorgorical explicitly cites CIELAB's non-uniformity as a defect of Healey's
and Maxwell's earlier methods and adopts CIEDE2000 for that reason. `chroma.js`
implements `deltaE` as CIEDE2000 (Bruce Lindbloom's formulation), so the metric
is available in JS without new machinery.

**What a JND actually is here.** Mahy, Van Eycken & Oosterlinck (1994) give an
average CIELAB JND of **2.3**, against CIELAB's theoretical 1.0 — cited via
Stone et al. 2014. Note that 2.3 is a ΔE\*ab figure. Using 2.3 as a *ΔE00*
threshold, as this project's measurements do, is a common convention, not a
result. It is probably conservative in the wrong direction: ΔE00 compresses
relative to ΔE\*ab, so a ΔE00 of 2.3 is generally a *larger* physical difference
than a ΔE\*ab of 2.3.

**CAM02-UCS adds viewing conditions.** It derives from CIECAM02 (Moroney et al.
2002; Luo & Li 2013) and models adaptation and surround, which CIELAB does not.
Petroff chose it over CIELAB for exactly that reason. It is not available in
`d3-color` or `chroma.js`; `culori` and Python's `colorspacious` have it.

**Name difference is a separate axis, and may matter more than ΔE.** Heer &
Stone (2012) built colour-naming models from the 153 most common names in
Randall Munroe's XKCD colour survey (~3.4M responses) and derived a *name
difference* metric — the difference between two colours' name-association
distributions — plus a *name uniqueness*/saliency measure of how specifically a
colour is named.
[Stanford Vis Group](http://vis.stanford.edu/papers/color-naming-models) ·
Heer, J. & Stone, M. (2012). *Proc. ACM CHI*, 1007–1016.

**Read directly (2026-08-14).** This section was originally written from
Colorgorical's and Petroff's descriptions of the paper; the paper itself is now
in hand and the second-hand summary above holds. Four things it adds that the
descriptions did not, and one of them changes a decision:

1. **They use CIEDE2000 as their primary colour distance metric**, and say why:
   Euclidean CIELAB "measurements made within a local patch of L\*a\*b\* space
   tend to correlate well with human judgments; however, global measurements
   across the color space can exhibit significant discrepancies." A palette's
   minimum pairwise distance IS a global measurement, so this is a direct
   argument that ΔE00 is the right metric for scoring a palette and ΔE\*ab is
   not. Note the size models (Stone et al. 2014; Szafir 2018) still report
   ΔE\*ab, so the two literatures genuinely differ - but for *palette scoring*
   specifically, the field's own answer is ΔE00.
2. **Name distance is the cosine** between the two colours' `p(W|c)` name
   distributions; Hellinger distance gives "qualitatively similar results".
3. **Saliency below 0.2 marks a colour with high naming confusion** - a usable
   threshold, not just a relative ranking.
4. **Tableau-10 scores best** of the qualitative palettes they characterise
   ("best color salience and minimal name overlap"); ColorBrewer also limits
   overlap; Excel and The Economist show "high naming overlap and lower salience
   colors."

Their design rule for categorical palettes is explicit: *"minimize name overlap
(to avoid ambiguity) and maximize salience (to avoid confusion and aid memory)"*
- and they flag automating exactly that as future work, which is what
`examples/palettes/build-palettes.mjs` could do.

The model and a JavaScript implementation are open source at
<http://vis.stanford.edu/color-names>.

**Caveat worth carrying:** the XKCD respondents were 74.6% native English
speakers and about 68% male (103,430 male / 41,464 female sessions). Colour
naming is language- and culture-specific, so a naming model built on this data
describes English naming. For a widget whose users are international, treat name
metrics as a tiebreaker rather than a primary objective.

Why this matters: **two colours can be well separated in ΔE and still share a
name**, which breaks verbal reference ("the blue one" when three are blue).
Colorgorical measured which score predicts discrimination performance and found
**name difference was the most predictive slider for response time at every
palette size, ahead of perceptual distance** — consistent, they note, with
Demiralp et al.'s earlier finding that name difference is a better distance
measure than perceptual difference. Petroff independently added a colour-saliency
term "to facilitate verbal and written descriptions" and found it did *not*
correlate with aesthetic preference, so it can be optimised alongside without
conflict.

**Practical consequence for us:** a pure max-min ΔE00 palette is very likely to
contain several colours that are separable but share a name. If the tooltip is
the identification mechanism (Navio's case), that costs less than it would in a
legend chart — but it still costs something in speech and in bug reports.

---

## 4. Colour-vision deficiency

**Prevalence.** Birch (2012), the standard reference: red-green deficiency is
about **8% in European Caucasian men and about 0.4% in women**, and between 4%
and 6.5% in men of Chinese and Japanese ethnicity.
[JOSA A 29(3), 313–320](https://opg.optica.org/josaa/abstract.cfm?uri=josaa-29-3-313).
Petroff, citing Birch, is careful to say "there are no reliable global
estimates" and gives the figure as "as high as 8% in certain sub-populations".
Breakdown by type is dominated by deuteranomaly; tritan deficiencies and
monochromacy are much rarer. The commonly quoted split (of the 8%: ~5%
deuteranomalous, ~1% each deuteranope/protanope/protanomalous) comes from
advocacy material rather than a primary source I verified — treat it as
approximate.

**Simulation methods, and which to use.**

- **Viénot, Brettel & Mollon (1999)**, *Color Research & Application* 24(4),
  243–252 — a fast LMS-space matrix method for protanopia and deuteranopia. Its
  tritanopia simulation is widely regarded as inaccurate; the R `colorspace`
  documentation says so explicitly.
  [Wiley](https://onlinelibrary.wiley.com/doi/10.1002/(SICI)1520-6378(199908)24:4%3C243::AID-COL5%3E3.0.CO;2-3)
- **Machado, Oliveira & Fernandes (2009)**, *IEEE TVCG* 15(6), 1291–1298 — a
  physiologically-based model derived from the stage theory of colour vision that
  handles normal vision, **anomalous trichromacy at a continuous severity
  parameter**, and dichromacy in one framework, validated against CVD and
  non-CVD observer groups.
  [Author page](https://www.inf.ufrgs.br/~oliveira/pubs_files/CVD_Simulation/CVD_Simulation.html)

**Use Machado.** Petroff chose it precisely for the severity parameter, and
enforced his minimum distance across *all* integer severities 1–100 for
deuteranomaly, protanomaly and tritanomaly, taking the minimum. That is stricter
than simulating dichromacy alone, and it is the right shape for a library
default. One implementation trap he flags: Machado 2009 does not specify whether
its matrices apply to gamma-encoded or linear sRGB; the paper's own figures used
gamma-encoded values, while Petroff, Nuñez et al. and Harding et al. all apply
them to **linear** sRGB.

**What designers actually do.** Three approaches, in increasing rigour: hand-design
against simulated views (Okabe-Ito, Tol); enforce a minimum distance in the
simulated spaces during generation (Petroff, modern `glasbey`); or ignore it
entirely (Glasbey 2007, Colorgorical, ColorBrewer's qualitative schemes beyond
the ones flagged safe). Petroff's table shows the difference is not subtle:
Category 10's minimum drops to 2.0 CAM02-UCS units under CVD, Okabe-Ito's stays
at 11.0.

Tol's "bright" scheme is a useful caution: it scored poorly on Petroff's
*worst-case-across-all-three* metric but performed well for deuteranopia and
protanopia, which it was designed for and which are far more common than
tritanopia. Optimising the worst case across all three costs you something real.
Our own measurement uses the worst case across all three **[measured here]**, so
it is on the strict side of this trade-off.

---

## 5. Size: the part that actually decides this for Navio

This is the most important section for us, and it is the one most often missing
from palette advice.

**Colour discriminability depends on mark size, strongly.** Colour standards are
defined for 2° or 10° targets — roughly 50 and 250 CSS pixels wide for a web
observer. Visualizations use marks far smaller, so CIELAB "systematically
underestimates the perceived differences between colors" (Szafir 2018).

### Stone, Szafir & Setlur (2014) — squares, 6° down to 1/3°

They rescaled CIELAB from crowdsourced experiments (624 participants, 11 target
sizes) and fit

> ND(p, s) = p · (A + B/s)

with `s` in degrees of visual angle, `p` in 0–1, and

| axis | A | B |
|---|---|---|
| L\* | 10.16 | 1.50 |
| a\* | 10.68 | 3.08 |
| b\* | 10.70 | 5.74 |

Their headline: the theoretical CIELAB JND of 1.0 is, under realistic
uncontrolled viewing at 2°, closer to **6**; at 0.33° it is closer to **11**,
"with an even stronger variation in weightings along the three axes". Their
conclusion states a minimum step of **5 to 6 CIELAB units** for 2°-or-larger
shapes.
[PDF](https://graphics.cs.wisc.edu/Papers/2014/SAS14/2014CIC_48_Stone_v3.pdf) ·
*Color and Imaging Conference* 2014, 253–258.

Note `B`: the **b\* (yellow–blue) axis degrades nearly 4× faster with shrinking
size than L\***. Their own words: "small shapes need to be much more colorful to
be usefully distinct."

### Szafir (2018) — points, bars and lines, and the elongation result

The follow-up study measured three mark types in real chart contexts (D3-rendered
scatterplots, bar charts, line graphs, with grey distractors, marks separated by
5° of visual angle). Two results matter here:

1. **Elongated marks are significantly easier.** "Color encodings on elongated
   marks, such as those used in bar charts and line graphs, are significantly more
   discriminable than equally thick point marks." For bars, discriminability
   improves with the length:thickness ratio and behaves asymptotically — past a
   certain elongation, extra length stops helping.
2. **Measured thresholds for thin lines.** Line thicknesses from 0.05° to 0.35°.
   ND(50%) in ΔE\*ab:

| thickness | px | ND(50%) L\* | a\* | b\* |
|---|---|---|---|---|
| 0.05° | 2 | 15.35 | 13.92 | 19.47 |
| 0.10° | 3 | 11.98 | 11.57 | 16.15 |
| 0.15° | 4 | 8.69 | 10.28 | 15.17 |
| 0.25° | 6 | 7.74 | 9.39 | 13.75 |
| 0.30° | 7 | 7.23 | 8.15 | 12.43 |
| 0.35° | 9 | 6.92 | 7.79 | 11.05 |

[PDF](https://danielleszafir.com/colordiff_vis2017.pdf) · Szafir, D. A. (2018).
Modeling Color Difference for Visualization Design. *IEEE TVCG* 24(1), 392–401.

Note again that **b\* is the worst axis at every size**. Both papers agree on
that. They *disagree* on which axis is best: Stone's squares put L\* clearly
first, while Szafir's 2px lines put a\* marginally ahead of L\* (13.92 vs 15.35).
Do not over-read either; the safe joint conclusion is "avoid separating
categories primarily along yellow–blue at small sizes."

Szafir applied these models back to ColorBrewer and found that **13 of the 18
nine-step sequential ramps do not retain 1 JND between adjacent steps** at
Tableau's default 10px points and 4px lines. Expert-curated encodings are not
automatically size-robust.

**An implementation exists in the d3 ecosystem**:
[`d3-jnd`](https://github.com/connorgr/d3-jnd) (BSD-3, depends only on
`d3-color`) implements the Stone et al. 2014 model as `d3.noticeablyDifferent(a,
b, size, percent)` and `d3.jndInterval(size, percent)`. Tableau 10 also ships
size-dependent JND models.

### What these models say about a 1px row — and where they stop

Navio's marks (verified in `src/navio.js`): columns are `nv.attribWidth = 15`
px with `xScale.paddingInner(0.1)`, so ≈13.5px drawn; each record is a canvas
line of `Math.ceil(yScales[level].bandwidth())` px, i.e. **minimum 1px**. One
record's mark is therefore about **13.5 × 1 px, aspect ratio ≈13:1** — an
elongated mark, in Szafir's taxonomy, not a point.

At Szafir's assumed 96 dpi and 30″ viewing distance, **1 CSS px ≈ 0.020° of
visual angle**. Both models were fitted well above that:

- Stone 2014 covers 6° down to 0.333°. A 1px row is **16× below** its smallest
  fitted size. Extrapolating anyway gives ND(50) ≈ **43 (L\*), 82 (a\*), 149
  (b\*)**. The b\* value exceeds the entire b\* range of the sRGB gamut, and 43
  on L\* is 43% of the full 0–100 lightness range — about three distinguishable
  levels. This is an extrapolation far outside the fitted range and should be
  read as "the model has nothing to say here", not as a prediction.
- Szafir 2018's line models are fitted from 0.05° (2px) up. Their form is inverse
  in thickness — I reconstructed it as `ND(p,s) = p / (m₀ − m₁/s)` with
  (m₀, m₁) = (0.0742, 0.0023) for L\*, (0.0623, 0.0015) for a\*, (0.0425,
  0.0009) for b\*, and verified the reconstruction reproduces the measured
  table above to within ~0.2–2.5 ΔE across 0.05°–0.35°. That fit has **poles at
  s = m₁/m₀ ≈ 0.031° (L\*), 0.024° (a\*), 0.021° (b\*)** — about 1.6px, 1.2px
  and 1.1px. In other words the published line model's required ΔE **diverges at
  roughly one pixel**. That is a fit artefact of an inverse function outside its
  range, not a claim that 1px rows are invisible. But it means there is **no
  published measurement covering a 1px mark**, and every measured trend points
  the same direction.

**Small-field tritanopia** is the classical vision-science name for the
phenomenon behind the large `B` coefficient on b\* — blue–yellow discrimination
collapsing for very small stimuli. *Unverified*: I did not find a primary
citation I could read, so it appears here only as a label for the effect that
Stone 2014 and Szafir 2018 both measured directly.

---

## 6. When you genuinely have more categories than colour can carry

The recommendations below are largely practitioner consensus rather than
controlled results; I mark the ones with experimental backing.

**Group the tail into "other".** Keep the top *k* categories by frequency (or by
a caller-supplied importance), and give everything else one neutral colour. This
is the standard newsroom practice ([Datawrapper, "10 ways to use fewer colors in
your data visualizations"](https://www.datawrapper.de/blog/10-ways-to-use-fewer-colors-in-your-data-visualizations)).
*Backing*: indirect — Haroz & Whitney's conclusion that reducing total variety in
the view, rather than optimising locally, is what helps difficult tasks.

**Order the categories and use a sequential encoding instead.** If the attribute
has any natural order — counts, dates, ranks, sizes, even alphabetical — encoding
it as ordinal on a perceptually uniform ramp converts "which category is this?"
into "roughly where in the ordering is this?", which is often the question
actually being asked. It also degrades more gracefully at small sizes, since a
sequential ramp varies mostly in lightness, the axis Stone 2014 measured as most
robust to shrinking. Perceptually uniform ramps (viridis, cividis) exist for
exactly this; cividis (Nuñez, Anderton & Renslow 2018) is additionally optimised
for CVD.

**Small multiples / one category at a time.** Haroz & Whitney's guideline 6.2
("If you cannot group, change the task") and 6.3 both point here: *"a perhaps
more deterministic alternative is to limit the visualization to only show a
couple of categories at a time. The user would be required to interact to see
different categories, but the limited information on the display could be
analyzed within the limits of attention."* **This is their experimentally-backed
recommendation, not a style preference.**

**Direct labelling.** Removes the need for colour to carry identity at all; lets
several categories share a colour. Impractical for 1px rows, practical for the
per-level headers and chips Navio already draws.

**Interactive highlight-on-hover.** Cheapest version of "one category at a time".
Haroz & Whitney's guideline 6.2 also covers the complementary case: *knowing* the
target's appearance in advance dramatically improves search, which is what a
legend or a hover preview provides.

**Align the spatial layout with the colour dimension.** Haroz & Whitney's first
guideline, and their strongest experimental result: grouping produced "a dramatic
improvement" in oddball search and subitizing accuracy. In Navio this is free —
it is what sorting by the column does.

---

## 7. Applying this to Navio

### Where chart-generic advice does not transfer

- **Navio's task is not identification.** Healey's seven-colour limit is about
  *finding a specified colour among distractors*, and Colorgorical's error rates
  are from a matching task. Navio's reader asks "is this clumped?" and gets exact
  identity from the tooltip. Discriminating *adjacent bands* is an easier task
  than identifying an isolated mark against a remembered legend, so the numbers
  in §1 are a lower bound on what Navio can carry, not an upper bound. I found no
  study measuring the band-boundary task directly; this is inference, not a
  result.
- **Navio's marks are elongated, which helps.** Szafir 2018 measured that lines
  and bars are significantly more discriminable than equally thick points. A
  13.5 × 1 px row is a very elongated mark. Palette advice calibrated on
  scatterplot points is pessimistic for Navio.
- **But Navio's marks are thinner than anything measured.** 1px ≈ 0.020°, below
  Szafir's thinnest line (0.05°) and 16× below Stone's smallest square (0.333°).
  No published model covers it.
- **The mark that matters is the band, not the row.** A category occupying *k*
  consecutive rows draws as a 13.5 × *k* px block. At *k* ≥ 6 that is ≥0.25° and
  lands squarely inside Szafir's measured range (ND(50%) ≈ 7.7–13.8 ΔE\*ab). At
  *k* = 1 it is off the end of every model. **This is the single most important
  transfer:** Navio's colour legibility is governed by run length, which is
  governed by the sort order, not by the palette.
- **Sorting flips Navio between Haroz & Whitney's two conditions.** Sorted by a
  categorical column, that column is their *grouped* layout — their best case.
  Sorted by a different column, the same categorical column becomes their
  *random* layout — their worst case, where subitizing falls toward chance. A
  Navio user does both, on the same column, seconds apart.
- **One caution against an obvious optimisation.** It is tempting to assign
  colours so that *adjacent* bands are maximally distinct (the Palettailor idea:
  Lu et al. 2021 optimise assignment against the data's spatial distribution,
  *IEEE TVCG* 27(2), 475–484). Haroz & Whitney measured that local variety around
  the target had **no** effect while global variety did — for their oddball task.
  These are different tasks and the results are not strictly in conflict, but the
  tension is real and I would not build adjacency-aware assignment on the
  assumption that it helps until we measure it here.
- **Large bands suppress small ones.** Lee, Sips & Seidel (2013) introduce "class
  visibility" on the observation that "large coherent groups visually suppress
  smaller groups and are often visually dominant in images", and optimise colour
  assignment against it (*IEEE TVCG* 19(10), 1746–1757). Navio's sorted columns
  are exactly large-coherent-groups-plus-slivers. *I read the abstract and the
  authors' slides, not the full paper.*

### Recommendation

**Adopt the CVD-aware max-min palette as `nv.defaultColorCategorical`, cap it,
and make exhaustion visible.**

1. **Bake in the CVD-aware greedy max-min palette.** At n=25 it holds min
   pairwise ΔE00 7.1 worst-case across normal/protan/deutan/tritan **[measured
   here]**, against 2.6 for a normal-vision-only max-min, 1.2 for
   `quantize(Turbo)`, 0.6 for the four-scheme concatenation and for
   `quantize(Spectral)`, and 0.0 for both recycled `schemeCategory10` and the
   cyclical schemes. There is no argument for any of the alternatives. Ship it as
   a static hex array — do not add a generator dependency.

2. **Draw at most *k* categories in colour; everything past *k* is one neutral
   grey "other", ordered by frequency.** I would set `k` at **10**, matching the
   present behaviour's apparent capacity and the industry ceiling, and make it a
   settings-panel option so a user with 14 well-separated categories can raise it.
   The palette still needs to be good out to 25 because the cap is a default, not
   a hard limit.

3. **Make exhaustion loud.** The current bug is not "only 10 colours", it is that
   the 11th category is *silently* the 1st's colour. A badge on the column header
   and a line in the tooltip ("+14 more categories shown as other") converts a
   silent wrong answer into a visible limitation. This is the highest-value change
   in the list and it is nearly free.

4. **Offer the ordinal escape, which Navio already has.** `scaleText` already
   buckets a high-cardinality text column by its first *n* characters and maps the
   bucket index onto `d3.interpolateGreys`; `scaleOrdered` maps an ordered domain
   onto `d3.interpolateOranges`. Reclassifying a high-cardinality categorical
   attribute as *ordered* is therefore a one-line change for the user and is the
   literature's recommended escape (§6). Surface it: when a column exceeds the
   cap, the "other" badge should offer "show as ordered" as an action.

5. **Do not chase the b\* axis.** Both size models agree yellow–blue is the worst
   axis at small sizes. Any hand-tuning of the palette should preserve lightness
   and red–green spread in preference to blue–yellow spread.

6. **Bias palette generation toward name difference, not just ΔE.** Colorgorical
   found name difference more predictive of discrimination performance than
   perceptual distance at every palette size; Petroff found nameability
   uncorrelated with aesthetics, so it is nearly free to add. Our greedy currently
   optimises ΔE00 alone **[measured here]** — adding a name-difference term is a
   cheap improvement with published support.

### Trade-offs, stated plainly

- **A max-min palette is ugly.** Colorgorical measured the trade-off directly:
  preference ratings *fall* as perceptual distance and name difference rise. A
  25-colour max-min set will contain browns, olives and muddy pinks. Navio has
  historically shipped a pretty default. This change makes it less pretty on
  purpose.
- **Capping at 10 loses information.** Some users legitimately have 15 categories
  and can tell them apart on a large widget. That is why the cap is an option.
- **Worst-case-across-three-CVD-types costs distance.** Tol's bright scheme shows
  you can do better for the two common deficiencies by giving up tritanopia. Our
  metric does not make that trade. If 7.1 proves too constraining at n=25,
  dropping tritanopia from the worst case is the first lever to pull, and it is a
  defensible one on prevalence grounds (§4).
- **None of this fixes 1px.** If a user has 25 categories scattered as single
  rows through 100k records, no palette makes that readable. The honest answer is
  sort the column, or use the ordinal encoding, or filter.

---

## 8. What I could not verify, and what should be measured next

- **The three metrics in play are not the same scale.** Our measurements are
  CIEDE2000; Stone 2014 and Szafir 2018 are CIELAB ΔE\*ab; Petroff is CAM02-UCS.
  "min ΔE00 7.1" cannot be compared against "ND(50%) = 15.35 ΔE\*ab" or against
  "min 16 CAM02-UCS" without conversion. **This is the biggest gap in the current
  analysis.** Re-expressing our palette's minimum pairwise distance in ΔE\*ab
  would say directly whether it clears Szafir's 2px line threshold — a
  ten-line computation that would settle the central question.
- ~~**Heer & Stone 2012** — could not read the paper.~~ **Resolved
  2026-08-14**: read directly from a local copy. The second-hand summary held;
  see the additions in §3, including that they use CIEDE2000 as their primary
  distance metric and warn that Euclidean CIELAB is unreliable for global
  comparisons across the space.
- **Boynton 1989** — existence confirmed, contents not read.
- **Munzner's "around a dozen"** — verified only from her 2009 lecture slides,
  not from *Visualization Analysis and Design*.
- **Ware, *Information Visualization: Perception for Design*** — I could not find
  a verifiable quotation of a specific number, so it is not cited above. Anyone
  with the book should check chapter 4.
- **Lee, Sips & Seidel 2013** — abstract and authors' slides only.
- **Mittelstädt et al. 2014**, "Methods for Compensating Contrast Effects in
  Information Visualization" (*Computer Graphics Forum* 33, 231–240) — relevant,
  because Navio's bands are *adjacent* whereas Szafir separated marks by 5°, so
  simultaneous contrast applies to us and not to her measurements. Bibliographic
  record only; not read.
- **Small-field tritanopia** — named above as a label only, no primary citation.
- **The band-boundary task has no measurement I could find.** Everything in §1 is
  identification or oddball search. If Navio wants a real number for "how many
  categories can a reader tell apart as adjacent 1px bands", that experiment does
  not appear to exist and would have to be run.

---

## References

- Birch, J. (2012). Worldwide prevalence of red-green color deficiency. *JOSA A*
  29(3), 313–320. <https://opg.optica.org/josaa/abstract.cfm?uri=josaa-29-3-313>
- Boynton, R. M. (1989). Eleven colors that are almost never confused. *SPIE
  Human Vision, Visual Processing, and Digital Display*. *(unverified)*
- Glasbey, C., van der Heijden, G., Toh, V. F. K. & Gray, A. (2007). Colour
  displays for categorical images. *Color Research & Application* 32, 304–309.
  <https://onlinelibrary.wiley.com/doi/abs/10.1002/col.20327>
- Gramazio, C. C., Laidlaw, D. H. & Schloss, K. B. (2017). Colorgorical: creating
  discriminable and preferable color palettes for information visualization.
  *IEEE TVCG* 23(1), 521–530.
  <https://vis.cs.brown.edu/docs/pdf/Gramazio-2016-CCD.pdf> · tool:
  <http://vrl.cs.brown.edu/color>
- Haroz, S. & Whitney, D. (2012). How capacity limits of attention influence
  information visualization effectiveness. *IEEE TVCG* 18(12), 2402–2410.
  <http://steveharoz.com/research/attention/papers/Haroz_Whitney_2012_InfoVis.pdf>
- Harrower, M. & Brewer, C. A. (2003). ColorBrewer.org: an online tool for
  selecting colour schemes for maps. *The Cartographic Journal* 40(1), 27–37.
  <https://colorbrewer2.org/>
- Healey, C. G. (1996). Choosing effective colours for data visualization. *Proc.
  IEEE Visualization '96*, 263–270.
  <https://www.csc2.ncsu.edu/faculty/healey/download/viz.96.pdf>
- Heer, J. & Stone, M. (2012). Color naming models for color selection, image
  editing and palette design. *Proc. ACM CHI*, 1007–1016.
  <https://dl.acm.org/doi/10.1145/2207676.2208547> *(read in full)*
- Jacomy, M. (2013). i want hue. <https://medialab.github.io/iwanthue/>
- Lee, S., Sips, M. & Seidel, H.-P. (2013). Perceptually driven visibility
  optimization for categorical data visualization. *IEEE TVCG* 19(10),
  1746–1757. <https://ieeexplore.ieee.org/document/6365630/> *(abstract only)*
- Lu, K. et al. (2021). Palettailor: discriminable colorization for categorical
  data. *IEEE TVCG* 27(2), 475–484. <https://arxiv.org/abs/2009.02969>
- Luo, M. R., Cui, G. & Rigg, B. (2001). The development of the CIE 2000
  colour-difference formula: CIEDE2000. *Color Research & Application* 26(5),
  340–350. <https://onlinelibrary.wiley.com/doi/10.1002/col.1049>
- Machado, G. M., Oliveira, M. M. & Fernandes, L. A. F. (2009). A
  physiologically-based model for simulation of color vision deficiency. *IEEE
  TVCG* 15(6), 1291–1298.
  <https://www.inf.ufrgs.br/~oliveira/pubs_files/CVD_Simulation/CVD_Simulation.html>
- Mahy, M., Van Eycken, L. & Oosterlinck, A. (1994). Evaluation of uniform color
  spaces developed after the adoption of CIELAB and CIELUV. *Color Research &
  Application* 19(2), 105–121. *(cited via Stone et al. 2014)*
- Okabe, M. & Ito, K. (2008). Color Universal Design.
  <https://jfly.uni-koeln.de/color/>
- Petroff, M. A. (2024). Accessible color sequences for data visualization.
  <https://arxiv.org/abs/2107.02270>
- Stone, M., Szafir, D. A. & Setlur, V. (2014). An engineering model for color
  difference as a function of size. *Color and Imaging Conference* 2014,
  253–258.
  <https://graphics.cs.wisc.edu/Papers/2014/SAS14/2014CIC_48_Stone_v3.pdf>
- Szafir, D. A. (2018). Modeling color difference for visualization design.
  *IEEE TVCG* 24(1), 392–401. <https://danielleszafir.com/colordiff_vis2017.pdf>
  · data: <https://cmci.colorado.edu/visualab/VisColors/>
- Tol, P. Colour schemes. <https://sronpersonalpages.nl/~pault/>
- Viénot, F., Brettel, H. & Mollon, J. D. (1999). Digital video colourmaps for
  checking the legibility of displays by dichromats. *Color Research &
  Application* 24(4), 243–252.
  <https://onlinelibrary.wiley.com/doi/10.1002/(SICI)1520-6378(199908)24:4%3C243::AID-COL5%3E3.0.CO;2-3>
- `d3-jnd` (Gramazio), implementing Stone et al. 2014.
  <https://github.com/connorgr/d3-jnd>
