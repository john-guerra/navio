/**
 * A deliberately small stand-in for a faceted-search widget, written to the
 * same contract as https://observablehq.com/@john-guerra/faceted-search:
 *
 *   - returns an HTML element
 *   - element.value is the array of SURVIVING ROWS (not a filter description)
 *   - element.value.filters carries the active facets as a Map
 *   - it dispatches new Event("input", { bubbles: true }) on every change
 *
 * It exists so this example runs standalone, and - more importantly - so the
 * mismatch it illustrates is explicit: two perfectly valid reactive widgets can
 * disagree about what `.value` means. Navio's is a filter chain; this one's is
 * a row set. See the bridge in index.html.
 */
/* exported FacetStandIn */
function FacetStandIn(data, { attribs } = {}) {
  const columns = attribs || Object.keys(data[0]);
  const filters = new Map();

  const target = document.createElement("div");
  target.style.font = "12px system-ui, sans-serif";

  function apply() {
    const rows = data.filter((d) =>
      Array.from(filters.entries()).every(
        ([attr, chosen]) => chosen.size === 0 || chosen.has(String(d[attr]))
      )
    );
    // Same shape as the widget being imitated: the rows ARE the value, with
    // the facets hung off them.
    target.value = rows;
    target.value.filters = filters;
    count.textContent = `${rows.length} of ${data.length} rows`;
    target.dispatchEvent(new Event("input", { bubbles: true }));
  }

  const count = document.createElement("div");
  count.style.margin = "0 0 .5rem";
  count.style.color = "#666";
  target.appendChild(count);

  for (const attr of columns) {
    const values = Array.from(new Set(data.map((d) => String(d[attr])))).sort();
    // Only facet columns with a small, categorical-looking domain.
    if (values.length > 12) continue;

    filters.set(attr, new Set());

    const group = document.createElement("div");
    group.style.margin = "0 0 .6rem";
    const label = document.createElement("strong");
    label.textContent = attr;
    group.appendChild(label);

    for (const v of values) {
      const line = document.createElement("label");
      line.style.display = "block";
      line.style.cursor = "pointer";

      const box = document.createElement("input");
      box.type = "checkbox";
      box.addEventListener("change", () => {
        const chosen = filters.get(attr);
        if (box.checked) chosen.add(v);
        else chosen.delete(v);
        apply();
      });

      line.appendChild(box);
      line.appendChild(document.createTextNode(" " + v));
      group.appendChild(line);
    }
    target.appendChild(group);
  }

  apply();
  return target;
}
