// chart.js - D3 parallel coordinates chart builder
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

// Build tooltip HTML for a state
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

// Main chart builder
// Returns { paths, xs, ys } for later manipulation
function buildChart(svgEl, data, W, H, margin, opts = {}) {
  const { region = "all", animate = false, activeOpacity = 0.3,
          onHover, onLeave } = opts;

  const iW = W - margin.left - margin.right;
  const iH = H - margin.top  - margin.bottom;

  const sel = d3.select(svgEl).attr("viewBox", `0 0 ${W} ${H}`);
  sel.selectAll("*").remove();
  const g = sel.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  // Scales
  const xs = d3.scalePoint().domain(YEARS).range([0, iW]).padding(0.1);
  const allV = data.flatMap(d => YEARS.map(y => d[y]).filter(v => v != null));
  const ys = d3.scaleLinear()
    .domain([d3.min(allV) - 1, d3.max(allV) + 1])
    .range([iH, 0]);

  const lineGen = d => d3.line()(
    YEARS.filter(y => d[y] != null).map(y => [xs(y), ys(d[y])])
  );

  // Grid lines
  ys.ticks(6).forEach(t => {
    g.append("line")
      .attr("x1", 0).attr("x2", iW)
      .attr("y1", ys(t)).attr("y2", ys(t))
      .attr("stroke", "rgba(240,237,232,0.05)")
      .attr("stroke-dasharray", "3 5");
  });

  // Axes
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

  // Filter data
  const filtered = region !== "all"
    ? data.filter(d => d.region === region)
    : data;

  // Draw lines
  const paths = g.selectAll(".sline").data(filtered).join("path")
    .attr("class","sline")
    .attr("d", lineGen)
    .attr("fill","none")
    .attr("stroke", d => REGION_COLORS[d.region])
    .attr("stroke-width",  animate ? 0   : 1.0)
    .attr("stroke-opacity", animate ? 0  : activeOpacity)
    .style("cursor","pointer");

  // Animated reveal - lines draw in one by one
  if (animate) {
    paths.each(function(d, i) {
      const len = this.getTotalLength() || 300;
      d3.select(this)
        .attr("stroke-dasharray", `${len} ${len}`)
        .attr("stroke-dashoffset", len)
        .attr("stroke-width", 1.1)
        .attr("stroke-opacity", activeOpacity)
        .transition()
        .delay(i * 16)
        .duration(550)
        .ease(d3.easeCubicOut)
        .attr("stroke-dashoffset", 0);
    });
  }

  // Hover interactions
  paths
    .on("mouseover", function(event, d) {
      paths.attr("stroke-opacity", 0.04).attr("stroke-width", 0.5);
      d3.select(this).attr("stroke-opacity",1).attr("stroke-width",3).raise();
      if (onHover) onHover(event, d);
    })
    .on("mousemove", (event, d) => { if (onHover) onHover(event, d); })
    .on("mouseleave", function() {
      paths.attr("stroke-opacity", activeOpacity).attr("stroke-width", 1.0);
      if (onLeave) onLeave();
    });

  return { paths, xs, ys };
}