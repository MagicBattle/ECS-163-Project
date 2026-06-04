// main.js - page logic for The Commute Tax
// Handles counter animation, legend, tooltips, scrollytelling, and explore filters

// ── Counter Animation ─────────────────────────────────────────
// Counts up to 200 on page load to show hours lost per year
function animCounter(el, target, ms) {
  let start = null;
  (function step(ts) {
    if (!start) start = ts;
    const p = Math.min((ts - start) / ms, 1);
    el.textContent = Math.floor(p * target) + "+";
    if (p < 1) requestAnimationFrame(step);
  })(performance.now());
}
setTimeout(() => animCounter(document.getElementById("counter"), 200, 2000), 1000);

// ── Legend ────────────────────────────────────────────────────
// Builds the color legend from the region color map
const legendEl = document.getElementById("legend");
Object.entries(REGION_COLORS).forEach(([region, color]) => {
  const item = document.createElement("div");
  item.className = "legend-item";
  item.innerHTML = `<span class="legend-swatch" style="background:${color}"></span>${region}`;
  legendEl.appendChild(item);
});

// ── Tooltip ───────────────────────────────────────────────────
// Positions and shows/hides the tooltip panel
const tip = document.getElementById("tooltip");
function showTip(event, d) {
  tip.innerHTML = buildTooltipHTML(d);
  tip.style.opacity = 1;
  tip.style.left = (event.clientX + 16) + "px";
  tip.style.top  = Math.min(event.clientY - 20, window.innerHeight - 260) + "px";
}
function hideTip() { tip.style.opacity = 0; tip.classList.remove("pinned"); }

// ── Story Chart Config ────────────────────────────────────────
// Controls what data and highlights show at each scroll step

// Martini glass: start with 5 lines and reveal all 50 by step 4
const STEP_DATA_MODE = ["intro", "intro", "northeast", "all", "all"];

// Note shown below the chart at each step
const STEP_NOTES = [
  "Each line is one US state. Each axis is one year. Click any line to see that state's numbers.",
  "Commutes rose in nearly every state from 2010 to 2019. The upward drift is clear across all regions.",
  "Northeast states (red) sit at the top every year. New York, New Jersey, and Maryland all average 30+ minutes.",
  "At 2021 every single line drops. California fell from 30.7 to 27.6. New York dropped from 33 to 30.",
  "By 2022 and 2024 the lines climb back up. Scroll down to click any state in the explore section.",
];

// Which region to highlight at each step (null = no region focus)
const STEP_HIGHLIGHTS = [null, null, "Northeast", null, null];

// Which states to label with a dot at each step
const STEP_SPOTLIGHT = [
  [],
  [],
  ["New York", "New Jersey", "Maryland"],
  ["California", "New York"],
  ["California", "New York"],
];

// Only step 3 (Northeast) dims non-region lines
const STEPS_THAT_DIM = new Set([2]);

// One state per region shown on intro steps
const INTRO_STATES = ["New York", "Virginia", "Illinois", "California", "Colorado"];

const vizNote = document.getElementById("viz-note");
let storyChart = null;
let storyDeselect = () => {};
let currentStepIdx = 0;
let storyInited = false;

// ── Story Chart Size ──────────────────────────────────────────
// Measures the sticky panel to get the right chart dimensions
function getStorySize() {
  const wrap = document.querySelector(".story-viz");
  const wRect = wrap.getBoundingClientRect();
  return {
    W: Math.max(wRect.width - 32, 300),
    H: Math.max(wRect.height - 110, 280),
  };
}

// Which states to include at a given step
function getDataForStep(idx) {
  const mode = STEP_DATA_MODE[idx];
  if (mode === "intro")     return RAW_DATA.filter(d => INTRO_STATES.includes(d.state));
  if (mode === "northeast") return RAW_DATA.filter(d => d.region === "Northeast" || INTRO_STATES.includes(d.state));
  return RAW_DATA;
}

// ── Story Click Handlers ──────────────────────────────────────
// Click a line in the story chart to pin its tooltip
function handleStoryClick(event, d) {
  showTip(event, d);
  tip.classList.add("pinned");
}

// Deselect restores step highlights so the narrative stays visible
function handleStoryDeselect() {
  hideTip();
  applyStepHighlights(currentStepIdx);
}

// ── Build Story Chart ─────────────────────────────────────────
// Rebuilds the chart for a given step with the right dataset
function initStoryChart(stepIdx = 0) {
  const { W, H } = getStorySize();
  const m = { top: 52, right: 12, bottom: 40, left: 12 };
  const chartData = getDataForStep(stepIdx);
  const result = buildChart(
    document.getElementById("chart-svg"),
    chartData, W, H, m,
    {
      animate: false,
      activeOpacity: 0.75,
      clickMode: "tooltip",
      onClick: handleStoryClick,
      onLeave: handleStoryDeselect,
    }
  );
  storyChart = result;
  storyDeselect = result.deselect || (() => {});
}

// ── Apply Step Highlights ─────────────────────────────────────
// Transitions line opacity and width based on the current step
function applyStepHighlights(idx) {
  if (!storyChart) return;
  const region    = STEP_HIGHLIGHTS[idx];
  const spotlight = STEP_SPOTLIGHT[idx] || [];
  const dimOthers = STEPS_THAT_DIM.has(idx);

  storyChart.paths
    .transition().duration(550).ease(d3.easeCubicOut)
    .attr("stroke-opacity", d => {
      if (spotlight.includes(d.state)) return 1;
      if (region && d.region === region) return 0.95;
      if (dimOthers && region) return 0.08;
      return 0.75;
    })
    .attr("stroke-width", d => {
      if (spotlight.includes(d.state)) return 3;
      if (region && d.region === region) return 1.9;
      return 1.5;
    });

  drawSpotlightLabels(spotlight, storyChart);
}

// ── Apply Step ────────────────────────────────────────────────
// Rebuilds the chart and applies highlights for the given step
function applyStep(idx) {
  hideTip();
  initStoryChart(idx);
  applyStepHighlights(idx);

  vizNote.style.opacity = 0;
  setTimeout(() => { vizNote.textContent = STEP_NOTES[idx]; vizNote.style.opacity = 1; }, 220);
}

// ── Spotlight Labels ──────────────────────────────────────────
// Draws a dot and state name on the 2024 axis for spotlighted states
function drawSpotlightLabels(stateNames, chart) {
  const svg = d3.select(document.getElementById("chart-svg"));
  svg.selectAll(".spotlight-label").remove();
  if (!stateNames.length) return;

  const lastYear = "2024";
  stateNames.forEach(name => {
    const d = RAW_DATA.find(r => r.state === name);
    if (!d || !d[lastYear]) return;
    const x = chart.xs(lastYear);
    const y = chart.ys(d[lastYear]);
    const color = REGION_COLORS[d.region];

    svg.select("g").append("circle")
      .attr("class", "spotlight-label")
      .attr("cx", x).attr("cy", y).attr("r", 5)
      .attr("fill", color).attr("stroke", "#060D14").attr("stroke-width", 1.5)
      .style("pointer-events", "none");

    // Label sits to the left of the dot so it stays inside the SVG
    svg.select("g").append("text")
      .attr("class", "spotlight-label")
      .attr("x", x - 8).attr("y", y + 4)
      .attr("text-anchor", "end")
      .attr("fill", color).attr("font-size", "11px").attr("font-weight", "700")
      .attr("font-family", "DM Sans, sans-serif")
      .style("pointer-events", "none")
      .text(name);
  });
}

// ── Scrollytelling ────────────────────────────────────────────
// Finds whichever step center is closest to the viewport center.
// old method sometimes skipped steps, so I swapped to this method
const steps = document.querySelectorAll(".step");
const factCards = document.querySelectorAll(".fact-card");

function getClosestStep() {
  const mid = window.innerHeight * 0.5;
  let closest = null;
  let closestDist = Infinity;
  steps.forEach(step => {
    const rect = step.getBoundingClientRect();
    const stepMid = (rect.top + rect.bottom) / 2;
    const dist = Math.abs(stepMid - mid);
    if (dist < closestDist) { closestDist = dist; closest = step; }
  });
  return closest;
}

function onScroll() {
  const activeStep = getClosestStep();
  if (!activeStep) return;
  const idx = parseInt(activeStep.dataset.step);
  if (idx === currentStepIdx && storyInited) return;
  currentStepIdx = idx;

  steps.forEach(s => s.classList.remove("active"));
  activeStep.classList.add("active");

  storyInited = true;
  applyStep(idx);

  factCards.forEach(card => {
    card.classList.toggle("visible", parseInt(card.dataset.step) === idx);
  });
}

// Limit scroll events with requestAnimationFrame
let scrollTicking = false;
window.addEventListener("scroll", () => {
  if (!scrollTicking) {
    requestAnimationFrame(() => { onScroll(); scrollTicking = false; });
    scrollTicking = true;
  }
});

onScroll();

// ── Init Story Chart ──────────────────────────────────────────
// Deferred until layout is settled so sizing is accurate
function doInitStory() {
  initStoryChart(0);
  applyStepHighlights(0);

  // Redraw if the panel resizes (font load, layout shifts, etc.)
  const storyViz = document.querySelector(".story-viz");
  if (storyViz && typeof ResizeObserver !== "undefined") {
    let roTimer;
    new ResizeObserver(() => {
      clearTimeout(roTimer);
      roTimer = setTimeout(() => {
        initStoryChart(currentStepIdx);
        applyStepHighlights(currentStepIdx);
      }, 80);
    }).observe(storyViz);
  }
}
requestAnimationFrame(() => requestAnimationFrame(doInitStory));

// ── Explore Chart ─────────────────────────────────────────────
// The free-exploration section at the bottom of the page
let currentRegion = "all";
let exploreAnimated = false;
let exploreDeselect = () => {};
let exploreResult = null;

function getExploreSize() {
  const sec = document.getElementById("explore");
  return {
    W: Math.min(sec.clientWidth - 32, 1200),
    H: Math.max(window.innerHeight * 0.72, 500),
  };
}

// ── Explore Click Handlers ────────────────────────────────────
// Click a line to lock it and show its tooltip
function handleExploreClick(event, d) {
  showTip(event, d);
  tip.classList.add("pinned");
  const exploreNote = document.getElementById("explore-note");
  if (exploreNote) {
    exploreNote.textContent = `Showing: ${d.state} - click the line again or click empty space to deselect`;
    exploreNote.style.opacity = 1;
  }
}

function handleExploreDeselect() {
  hideTip();
  const exploreNote = document.getElementById("explore-note");
  if (exploreNote) {
    exploreNote.textContent = "Click any line to lock it in focus. Click again or click empty space to deselect.";
    exploreNote.style.opacity = 0.7;
  }
}

function redrawExplore(animate) {
  const { W, H } = getExploreSize();
  const m = { top: 60, right: 16, bottom: 44, left: 16 };
  const result = buildChart(
    document.getElementById("explore-svg"),
    RAW_DATA, W, H, m,
    {
      region: currentRegion,
      animate,
      activeOpacity: currentRegion === "all" ? 0.65 : 0.85,
      clickMode: "lock",
      onClick: handleExploreClick,
      onLeave: handleExploreDeselect,
    }
  );
  exploreResult = result;
  exploreDeselect = result.deselect || (() => {});
}

// Animate when explore section scrolls into view for the first time
const exploreObserver = new IntersectionObserver(entries => {
  if (entries[0].isIntersecting && !exploreAnimated) {
    exploreAnimated = true;
    redrawExplore(true);
  }
}, { threshold: 0.1 });
exploreObserver.observe(document.getElementById("explore"));
requestAnimationFrame(() => requestAnimationFrame(() => redrawExplore(false)));

// Region filter buttons
document.querySelectorAll(".filter-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    currentRegion = btn.dataset.region;
    handleExploreDeselect();
    // Clear search when switching region
    const searchEl = document.getElementById("state-search");
    if (searchEl) { searchEl.value = ""; document.getElementById("search-clear").style.display = "none"; }
    redrawExplore(true);
  });
});

// ── State Search ──────────────────────────────────────────────
// Highlights a matching state as the user types
const searchEl = document.getElementById("state-search");
const clearEl  = document.getElementById("search-clear");

function applySearch(query) {
  if (!exploreResult || !exploreResult.paths) return;
  const q = query.trim().toLowerCase();

  if (!q) {
    // Reset to normal
    exploreResult.paths
      .transition().duration(300)
      .attr("stroke-opacity", currentRegion === "all" ? 0.65 : 0.85)
      .attr("stroke-width", 1.6);
    return;
  }

  // Find best matching state by prefix
  const match = RAW_DATA.find(d => d.state.toLowerCase().startsWith(q));

  exploreResult.paths
    .transition().duration(300)
    .attr("stroke-opacity", d => match && d.state === match.state ? 1 : 0.06)
    .attr("stroke-width",   d => match && d.state === match.state ? 3.5 : 0.8);

  // Raise matched line to top so it renders above everything else
  if (match) exploreResult.paths.filter(d => d.state === match.state).raise();
}

if (searchEl) {
  searchEl.addEventListener("input", () => {
    const q = searchEl.value;
    clearEl.style.display = q ? "block" : "none";
    applySearch(q);
  });

  clearEl.addEventListener("click", () => {
    searchEl.value = "";
    clearEl.style.display = "none";
    applySearch("");
  });
}

// Redraw on window resize
window.addEventListener("resize", () => {
  initStoryChart(currentStepIdx);
  applyStepHighlights(currentStepIdx);
  redrawExplore(false);
});

// ── Click Outside to Close ────────────────────────────────────
// Clicking anywhere outside the charts or tooltip closes it
document.addEventListener("click", (event) => {
  const storySvg   = document.getElementById("chart-svg");
  const exploreSvg = document.getElementById("explore-svg");
  const tooltip    = document.getElementById("tooltip");

  const inStory   = storySvg   && storySvg.contains(event.target);
  const inExplore = exploreSvg && exploreSvg.contains(event.target);
  const inTooltip = tooltip    && tooltip.contains(event.target);

  if (!inStory && !inExplore && !inTooltip) {
    storyDeselect();
    exploreDeselect();
  }
});