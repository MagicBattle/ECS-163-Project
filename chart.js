// chart.js - builds the parallel coordinates chart
// Data: US Census Bureau ACS Table S0801 (data.census.gov)

const YEARS = ["2010","2011","2012","2013","2014","2015","2016","2017","2018","2019","2021","2022","2023","2024"];

const REGION_COLORS = {
  Northeast: "#FF6B6B",
  South:     "#FF9A5C",
  Midwest:   "#FFD166",
  West:      "#00D4A0",
  Mountain:  "#74B9FF",
};

const AXIS_ANNOTS = {
  "2019": { text: "pre-COVID peak", color: "#8A9EAE" },
  "2021": { text: "COVID dip",      color: "#00D4A0" },
  "2024": { text: "most recent",    color: "#8A9EAE" },
};

// ── Tooltip ───────────────────────────────────────────────────
// Builds the HTML shown when a user clicks a state line
function buildTooltipHTML(d) {
  const ch = (d["2024"] - d["2010"]).toFixed(1);
  const cc = parseFloat(ch) > 0 ? "#e85d4a" : "#2ab89a";
  const pct = d["pct60_2024"];
  const factLine = pct != null
    ? `<div class="tt-fact">In 2024, <strong>${pct}%</strong> of ${d.state} workers commuted <strong>60 or more minutes</strong> one way</div>`
    : "";
  return `
    <div class="tt-state" style="color:${REGION_COLORS[d.region]}">${d.state}</div>
    <div class="tt-region">${d.region}</div>
    <div class="tt-row"><span>2010 avg</span><span class="tt-val">${d["2010"]} min</span></div>
    <div class="tt-row"><span>2019 peak</span><span class="tt-val">${d["2019"]} min</span></div>
    <div class="tt-row"><span>2021 COVID dip</span><span class="tt-val" style="color:#00D4A0">${d["2021"]} min</span></div>
    <div class="tt-row"><span>2024 latest</span><span class="tt-val">${d["2024"]} min</span></div>
    <hr class="tt-divider">
    <div class="tt-change">Change 2010 to 2024: <span style="color:${cc};font-weight:600">${parseFloat(ch)>0?"+":""}${ch} min</span></div>
    ${factLine}
  `;
}

// ── Chart Builder ─────────────────────────────────────────────
// Draws the full parallel coordinates chart into svgEl
// clickMode "tooltip" = story chart, click shows info without dimming others
// clickMode "lock"    = explore chart, click locks state and dims the rest
// Returns { paths, xs, ys, deselect } for use by main.js
function buildChart(svgEl, data, W, H, margin, opts = {}) {
  const { region = "all", animate = false, activeOpacity = 0.75,
          onClick, onLeave, clickMode = null } = opts;

  const iW = W - margin.left - margin.right;
  const iH = H - margin.top  - margin.bottom;

  const sel = d3.select(svgEl).attr("viewBox", `0 0 ${W} ${H}`);
  sel.selectAll("*").remove();
  const g = sel.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  // ── Scales ────────────────────────────────────────────────────
  // X: one position per year, Y: shared commute time range
  const xs = d3.scalePoint().domain(YEARS).range([0, iW]).padding(0.1);
  const allV = data.flatMap(d => YEARS.map(y => d[y]).filter(v => v != null));
  const ys = d3.scaleLinear()
    .domain([d3.min(allV) - 1, d3.max(allV) + 1])
    .range([iH, 0]);

  const lineGen = d => d3.line()(
    YEARS.filter(y => d[y] != null).map(y => [xs(y), ys(d[y])])
  );

  // ── Grid Lines ────────────────────────────────────────────────
  // Faint horizontal guides behind the data lines
  ys.ticks(6).forEach(t => {
    g.append("line")
      .attr("x1", 0).attr("x2", iW)
      .attr("y1", ys(t)).attr("y2", ys(t))
      .attr("stroke", "rgba(240,237,232,0.05)")
      .attr("stroke-dasharray", "3 5");
  });

  // ── Axes ──────────────────────────────────────────────────────
  // One vertical axis per year, with year label on top and annotations below
  YEARS.forEach(y => {
    const ax = g.append("g").attr("transform", `translate(${xs(y)},0)`);
    ax.call(d3.axisLeft(ys).ticks(5).tickFormat(d => d + "m").tickSize(3))
      .call(g2 => g2.select(".domain").attr("stroke","rgba(240,237,232,0.2)"))
      .call(g2 => g2.selectAll("text")
        .attr("fill","#8A9EAE").attr("font-size","9px")
        .attr("font-family","DM Sans,sans-serif"))
      .call(g2 => g2.selectAll(".tick line")
        .attr("stroke","rgba(240,237,232,0.12)"));

    const isSpecial = y === "2019" || y === "2024";
    ax.append("text")
      .attr("y", -16).attr("text-anchor","middle")
      .attr("fill",  y === "2021" ? "#00D4A0" : isSpecial ? "#F0EDE8" : "#8A9EAE")
      .attr("font-size",   isSpecial ? "12px" : "10px")
      .attr("font-weight", isSpecial ? "700"  : "400")
      .attr("font-family", "Bebas Neue,sans-serif")
      .attr("letter-spacing","0.04em")
      .text(y === "2021" ? "2021*" : y);

    if (AXIS_ANNOTS[y]) {
      ax.append("text")
        .attr("y", iH + 18).attr("text-anchor","middle")
        .attr("fill", AXIS_ANNOTS[y].color)
        .attr("font-size","7.5px")
        .attr("font-family","DM Sans,sans-serif")
        .text(AXIS_ANNOTS[y].text);
    }
  });

  // ── Draw Lines ────────────────────────────────────────────────
  // One path per state, colored by region
  const filtered = region !== "all"
    ? data.filter(d => d.region === region)
    : data;

  const paths = g.selectAll(".sline").data(filtered).join("path")
    .attr("class","sline")
    .attr("d", lineGen)
    .attr("fill","none")
    .attr("stroke", d => REGION_COLORS[d.region])
    .attr("stroke-width",  animate ? 0   : 1.6)
    .attr("stroke-opacity", animate ? 0  : activeOpacity)
    .style("cursor", clickMode ? "pointer" : "default");

  // ── Animated Reveal ───────────────────────────────────────────
  // Lines draw in one by one when the chart first appears
  if (animate) {
    paths.each(function(d, i) {
      const len = this.getTotalLength() || 300;
      d3.select(this)
        .attr("stroke-dasharray", `${len} ${len}`)
        .attr("stroke-dashoffset", len)
        .attr("stroke-width", 1.6)
        .attr("stroke-opacity", activeOpacity)
        .transition()
        .delay(i * 16)
        .duration(550)
        .ease(d3.easeCubicOut)
        .attr("stroke-dashoffset", 0);
    });
  }

  // ── Click Mode: Tooltip ───────────────────────────────────────
  // Used in the story chart. Click highlights that line but keeps
  // all other lines at their step-applied opacity.
  if (clickMode === "tooltip") {
    let selected = null;

    function restorePrev() {
      if (!selected) return;
      d3.select(selected)
        .attr("stroke-width",   selected.__origW)
        .attr("stroke-opacity", selected.__origO);
    }

    function deselectTooltip() {
      restorePrev();
      selected = null;
      if (onLeave) onLeave();
    }

    sel.on("click", function(event) {
      if (event.target === svgEl || event.target.tagName === "svg") deselectTooltip();
    });

    paths.on("click", function(event, d) {
      event.stopPropagation();
      if (selected === this) { deselectTooltip(); return; }
      restorePrev();
      selected = this;
      this.__origW = d3.select(this).attr("stroke-width");
      this.__origO = d3.select(this).attr("stroke-opacity");
      d3.select(this).attr("stroke-width", 3.5).attr("stroke-opacity", 1).raise();
      if (onClick) onClick(event, d);
    });

    return { paths, xs, ys, deselect: deselectTooltip };
  }

  // ── Click Mode: Lock ──────────────────────────────────────────
  // Used in the explore chart. Click locks that state and dims everything else.
  if (clickMode === "lock") {
    let selected = null;

    function deselectLock() {
      if (!selected) return;
      selected = null;
      paths.transition().duration(300)
        .attr("stroke-opacity", activeOpacity).attr("stroke-width", 1.6);
      if (onLeave) onLeave();
    }

    sel.on("click", function(event) {
      if (event.target === svgEl || event.target.tagName === "svg") deselectLock();
    });

    paths.on("click", function(event, d) {
      event.stopPropagation();
      if (selected === this) { deselectLock(); return; }
      selected = this;
      paths.transition().duration(300)
        .attr("stroke-opacity", 0.1).attr("stroke-width", 0.8);
      d3.select(this).transition().duration(300)
        .attr("stroke-opacity", 1).attr("stroke-width", 3.5);
      d3.select(this).raise();
      if (onClick) onClick(event, d);
    });

    return { paths, xs, ys, deselect: deselectLock };
  }

  return { paths, xs, ys, deselect: () => {} };
}