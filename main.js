// main.js - page logic for The Commute Tax
// Handles: counter animation, tooltip, scrollytelling, explore filters

// ── COUNTER ANIMATION ─────────────────────────────────────────────
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

// ── LEGEND ────────────────────────────────────────────────────────
const legendEl = document.getElementById("legend");
Object.entries(REGION_COLORS).forEach(([region, color]) => {
  const item = document.createElement("div");
  item.className = "legend-item";
  item.innerHTML = `<span class="legend-swatch" style="background:${color}"></span>${region}`;
  legendEl.appendChild(item);
});

// ── TOOLTIP ───────────────────────────────────────────────────────
const tip = document.getElementById("tooltip");
function showTip(event, d) {
  tip.innerHTML = buildTooltipHTML(d);
  tip.style.opacity = 1;
  tip.style.left = (event.clientX + 16) + "px";
  tip.style.top  = Math.min(event.clientY - 20, window.innerHeight - 260) + "px";
}
function hideTip() { tip.style.opacity = 0; }

// ── STORY CHART ───────────────────────────────────────────────────
let storyChart = null;

const STEP_NOTES = [
  "Each line is one US state. Each axis is one year. Height = avg commute time in minutes.",
  "Lines move upward from 2010 to 2019. Commutes went up in almost every state, every year.",
  "The red lines (Northeast) sit at the top on every axis. They have the longest commutes.",
  "At 2021, every line drops. Remote work cut commutes for the first time in 10 years.",
  "By 2022 and 2024 the lines go back up. Commutes came back once offices reopened.",
  "Hover any line to see that state's numbers. Use the filters below to look at one region at a time.",
];

// Which region to highlight per step (null = show all equally)
const STEP_HIGHLIGHTS = [null, null, "Northeast", null, null, null];

const vizNote = document.getElementById("viz-note");

function getStorySize() {
  const wrap = document.querySelector(".story-viz");
  return {
    W: Math.max(wrap.clientWidth - 60, 300),
    H: Math.max(window.innerHeight * 0.58, 320),
  };
}

function initStoryChart(animate) {
  const { W, H } = getStorySize();
  const m = { top: 52, right: 12, bottom: 40, left: 12 };
  storyChart = buildChart(
    document.getElementById("chart-svg"),
    RAW_DATA, W, H, m,
    { animate, activeOpacity: 0.3, onHover: showTip, onLeave: hideTip }
  );
}

function applyStep(idx) {
  if (!storyChart) return;
  const region = STEP_HIGHLIGHTS[idx];
  storyChart.paths
    .transition().duration(500)
    .attr("stroke-opacity", d => region ? (d.region === region ? 0.85 : 0.03) : 0.3)
    .attr("stroke-width",   d => region ? (d.region === region ? 1.8  : 0.5)  : 1.0);

  vizNote.style.opacity = 0;
  setTimeout(() => { vizNote.textContent = STEP_NOTES[idx]; vizNote.style.opacity = 1; }, 220);
}

// ── SCROLLYTELLING ────────────────────────────────────────────────
const steps = document.querySelectorAll(".step");
const factCards = document.querySelectorAll(".fact-card");
let storyAnimated = false;

const stepObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    const idx = parseInt(entry.target.dataset.step);
    steps.forEach(s => s.classList.remove("active"));
    entry.target.classList.add("active");

    if (!storyAnimated) {
      storyAnimated = true;
      initStoryChart(true);
      setTimeout(() => applyStep(idx), 300);
    } else {
      applyStep(idx);
    }

    // Show fact cards when their step is active
    factCards.forEach(card => {
      const cardStep = parseInt(card.dataset.step);
      card.classList.toggle("visible", cardStep === idx);
    });
  });
}, { threshold: 0.45 });

steps.forEach(s => stepObserver.observe(s));

// Initialize on load (no animation yet)
initStoryChart(false);

// ── EXPLORE CHART ─────────────────────────────────────────────────
let currentRegion = "all";
let exploreAnimated = false;

function getExploreSize() {
  const sec = document.getElementById("explore");
  return {
    W: Math.min(sec.clientWidth, 1200),
    H: Math.max(window.innerHeight * 0.72, 500),
  };
}

function redrawExplore(animate) {
  const { W, H } = getExploreSize();
  const m = { top: 60, right: 16, bottom: 44, left: 16 };
  buildChart(
    document.getElementById("explore-svg"),
    RAW_DATA, W, H, m,
    {
      region: currentRegion,
      animate,
      activeOpacity: currentRegion === "all" ? 0.3 : 0.7,
      onHover: showTip,
      onLeave: hideTip,
    }
  );
}

// Animate when explore section scrolls into view
const exploreObserver = new IntersectionObserver(entries => {
  if (entries[0].isIntersecting && !exploreAnimated) {
    exploreAnimated = true;
    redrawExplore(true);
  }
}, { threshold: 0.1 });
exploreObserver.observe(document.getElementById("explore"));

// Initial render without animation
redrawExplore(false);

// Filter buttons
document.querySelectorAll(".filter-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    currentRegion = btn.dataset.region;
    redrawExplore(true);
  });
});

// Resize handler
window.addEventListener("resize", () => {
  initStoryChart(false);
  redrawExplore(false);
});