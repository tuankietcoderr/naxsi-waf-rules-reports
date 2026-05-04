const curlInput = document.getElementById("curlInput");
const analyzeBtn = document.getElementById("analyzeBtn");
const sampleBtn = document.getElementById("sampleBtn");
const reportRoot = document.getElementById("reportRoot");
const statusBar = document.getElementById("statusBar");
const filterPanel = document.getElementById("filterPanel");
const rulesFilter = document.getElementById("rulesFilter");
const zonesFilter = document.getElementById("zonesFilter");
const rulesToggleAll = document.getElementById("rulesToggleAll");
const zonesToggleAll = document.getElementById("zonesToggleAll");
const themeToggle = document.getElementById("themeToggle");

let activeTabId = "summary";
let lastResult = null;
let selectedRules = new Set();
let selectedZones = new Set();

// Theme management
function initializeTheme() {
  const savedTheme = localStorage.getItem("theme") || "dark";
  applyTheme(savedTheme);
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("theme", theme);
  updateThemeToggleButton(theme);
}

function updateThemeToggleButton(theme) {
  if (theme === "dark") {
    themeToggle.textContent = "☀️ Light";
    themeToggle.title = "Switch to light mode";
  } else {
    themeToggle.textContent = "🌙 Dark";
    themeToggle.title = "Switch to dark mode";
  }
}

function toggleTheme() {
  const currentTheme =
    document.documentElement.getAttribute("data-theme") || "dark";
  const newTheme = currentTheme === "dark" ? "light" : "dark";
  applyTheme(newTheme);
}

// Initialize filters on page load
async function initializeFilters() {
  try {
    const response = await fetch("/api/rules");
    if (!response.ok) {
      console.error("Failed to load rules");
      return;
    }

    const data = await response.json();
    const rules = data.rules || [];

    // Display filter panel
    filterPanel.style.display = "block";

    // Populate rules filter
    selectedRules = new Set(rules.map((r) => r.id));
    rulesFilter.innerHTML = rules
      .map(
        (rule) => `
        <div class="filter-item">
          <label>
            <input type="checkbox" value="${rule.id}" class="rule-checkbox" checked />
            <span>Rule ${rule.id}: ${escapeHtml(rule.msg || "")}</span>
          </label>
        </div>
      `,
      )
      .join("");

    document.querySelectorAll(".rule-checkbox").forEach((checkbox) => {
      checkbox.addEventListener("change", handleRuleFilterChange);
    });

    rulesToggleAll.checked = true;
  } catch (error) {
    console.error("Error initializing filters:", error);
  }
}

// Initialize zones filter when result comes back
function initializeZonesFilter(matches) {
  const zoneFilterSection = document.getElementById("zoneFilterSection");
  const zones = new Set();

  matches.forEach((match) => {
    zones.add(match.source);
  });

  selectedZones = new Set(zones);

  zonesFilter.innerHTML = Array.from(zones)
    .sort()
    .map(
      (zone) => `
        <div class="filter-item">
          <label>
            <input type="checkbox" value="${zone}" class="zone-checkbox" checked />
            <span>${escapeHtml(zone)}</span>
          </label>
        </div>
      `,
    )
    .join("");

  document.querySelectorAll(".zone-checkbox").forEach((checkbox) => {
    checkbox.addEventListener("change", handleZoneFilterChange);
  });

  zonesToggleAll.checked = true;
  zoneFilterSection.style.display = "block";
}

const sampleCurl = [
  "curl 'https://sso-aicad-test-production.tgl-cloud.com/jp/login?client_id=41443fc9-36d8-4840-95d2-831794527eb5&callback_url=localhost%3A3001%2Fjp%2Fims%2Fincident%3Fstatus%3Dnew%26status%3Din_progress%26status%3Dwait_for_confirm%26status%3Dconfirmed%26status%3Ddev_confirming%26status%3Ddone%26categories%3Dimprove%26assignee%3Df72997f7-eb46-41cd-9f43-8599eeb9ba6f%26page%3D1%26manager%3Df72997f7-eb46-41cd-9f43-8599eeb9ba6f%26creator%3Dc4cf004f-2348-4292-b164-5570a3134234%26company%3Da0fdb23a-cb85-48f3-8448-5953abe244a0%26version%3Da09251ef-1b29-40df-8796-135d32ee36da%26bugType%3Dares%26funcCode%3Dmaterial_list%26createdAtFrom%3D2026-05-01%26createdAtTo%3D2026-05-08%26endDateFrom%3D2026-05-01%26priority%3Dnormal' \\",
  "  -H 'accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7' \\",
  "  -H 'accept-language: en,ja;q=0.9,vi;q=0.8' \\",
  "  -b 'role_user=system_user; NEXT_LOCALE=jp'",
].join("\n");

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function badgeForVerdict(verdict) {
  if (verdict === "BLOCKED")
    return '<span class="badge blocked">BLOCKED</span>';
  if (verdict === "WARNING")
    return '<span class="badge warning">WARNING</span>';
  return '<span class="badge allowed">ALLOWED</span>';
}

function highlightMatch(text, matches) {
  if (!text) return '<span class="muted">(empty)</span>';
  if (!matches || !matches.length) return escapeHtml(text);

  const ranges = matches
    .filter((match) => typeof match.index === "number" && match.length > 0)
    .map((match) => ({ start: match.index, end: match.index + match.length }))
    .sort((a, b) => a.start - b.start || b.end - a.end);

  const merged = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (!last || range.start > last.end) {
      merged.push({ ...range });
    } else {
      last.end = Math.max(last.end, range.end);
    }
  }

  let output = "";
  let cursor = 0;
  for (const range of merged) {
    output += escapeHtml(text.slice(cursor, range.start));
    output += `<mark>${escapeHtml(text.slice(range.start, range.end))}</mark>`;
    cursor = range.end;
  }
  output += escapeHtml(text.slice(cursor));
  return output;
}

function formatRequest(request) {
  return [
    { label: "URL", value: request.path || "/" },
    {
      label: "Query",
      value: JSON.stringify(request.query || {}),
    },
    { label: "Body", value: request.body || "(empty)" },
    {
      label: "Headers",
      value: JSON.stringify(request.headers || {}, null, 2),
    },
  ]
    .map(
      (item) => `
        <div class="kv">
          <label>${item.label}</label>
          <div class="kv-value">${escapeHtml(item.value)}</div>
        </div>
      `,
    )
    .join("");
}

function renderRulePane(match) {
  const rule = match.rule;
  const scoreChips = Object.entries(rule.scores || {})
    .map(
      ([category, points]) =>
        `<span class="chip chip-${category.toLowerCase()}">${category} +${points}</span>`,
    )
    .join("");

  return `
    <div class="rule-card">
      <div class="rule-head">
        <div>
          <div class="rule-meta">
            <span class="chip chip-rule">Rule ${rule.id}</span>
            <span class="chip chip-zone">zone=${escapeHtml(match.source)}</span>
          </div>
          <h3>${escapeHtml(rule.msg || "No message")}</h3>
        </div>
        <div class="rule-scores">${scoreChips}</div>
      </div>
      <div class="rule-pattern">${escapeHtml(
        (rule.isRegex ? "rx" : "str") + ": " + rule.pattern,
      )}</div>
      <div class="highlight-box">${highlightMatch(match.text, match.matched)}</div>
    </div>
  `;
}

function whitelistTargetForSource(source) {
  if (!source) return "$URL";
  if (source.startsWith("ARGS[")) {
    const argName = source.slice(5, -1);
    return `$ARGS_VAR:${argName}`;
  }
  if (source === "BODY") return "$BODY";
  if (source === "URL") return "$URL";
  if (source.startsWith("HEADERS[")) {
    const headerName = source.slice(8, -1);
    return `$HEADERS_VAR:${headerName}`;
  }
  if (source === "FILE_EXT") return "$FILE_EXT";
  return "$URL";
}

function populateFilters(matches) {
  // Zones filter is now populated after analysis
  initializeZonesFilter(matches);
}

function handleRuleFilterChange(e) {
  const ruleId = parseInt(e.target.value);
  if (e.target.checked) {
    selectedRules.add(ruleId);
  } else {
    selectedRules.delete(ruleId);
  }
  updateToggleAllState();
  rerenderResult();
}

function handleZoneFilterChange(e) {
  const zone = e.target.value;
  if (e.target.checked) {
    selectedZones.add(zone);
  } else {
    selectedZones.delete(zone);
  }
  updateToggleAllState();
  rerenderResult();
}

function updateToggleAllState() {
  const allRuleCheckboxes = document.querySelectorAll(".rule-checkbox");
  const allZoneCheckboxes = document.querySelectorAll(".zone-checkbox");

  const allRulesChecked = Array.from(allRuleCheckboxes).every(
    (cb) => cb.checked,
  );
  const allZonesChecked = Array.from(allZoneCheckboxes).every(
    (cb) => cb.checked,
  );

  rulesToggleAll.checked = allRulesChecked;
  zonesToggleAll.checked = allZonesChecked;
}

function handleRulesToggleAll(e) {
  document.querySelectorAll(".rule-checkbox").forEach((checkbox) => {
    checkbox.checked = e.target.checked;
    if (e.target.checked) {
      selectedRules.add(parseInt(checkbox.value));
    } else {
      selectedRules.delete(parseInt(checkbox.value));
    }
  });
  rerenderResult();
}

function handleZonesToggleAll(e) {
  document.querySelectorAll(".zone-checkbox").forEach((checkbox) => {
    checkbox.checked = e.target.checked;
    if (e.target.checked) {
      selectedZones.add(checkbox.value);
    } else {
      selectedZones.delete(checkbox.value);
    }
  });
  rerenderResult();
}

function getFilteredMatches(matches) {
  return matches.filter(
    (match) =>
      selectedRules.has(match.rule.id) && selectedZones.has(match.source),
  );
}

function rerenderResult() {
  if (!lastResult) return;
  const filteredMatches = getFilteredMatches(lastResult.matches || []);
  const filteredResult = {
    ...lastResult,
    matches: filteredMatches,
  };
  renderResultInternal(filteredResult);
}

function renderWhitelistSection(matches) {
  const snippets = matches.map((match) => {
    const target = whitelistTargetForSource(match.source);
    return {
      id: match.rule.id,
      source: match.source,
      snippet: `BasicRule wl:${match.rule.id} "mz:${target}";`,
    };
  });

  return `
    <div class="kv">
      <label>Whitelist Suggestions</label>
      ${
        snippets.length
          ? `<div class="whitelist-list">${snippets
              .map(
                (item) => `
                  <div class="whitelist-item">
                    <div class="whitelist-meta">
                      <span class="chip chip-rule">Rule ${item.id}</span>
                      <span class="summary-zone">${escapeHtml(item.source)}</span>
                    </div>
                    <pre class="whitelist-snippet"><code>${escapeHtml(item.snippet)}</code></pre>
                  </div>
                `,
              )
              .join("")}</div>`
          : '<div class="empty-state">No whitelist suggestions because no rules matched.</div>'
      }
    </div>
  `;
}

function setActiveTab(tabId) {
  activeTabId = tabId;
  const tabs = reportRoot.querySelectorAll("[data-tab]");
  const panes = reportRoot.querySelectorAll("[data-pane]");

  tabs.forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.tab === tabId);
  });

  panes.forEach((pane) => {
    pane.classList.toggle("active", pane.dataset.pane === tabId);
  });
}

function renderResultInternal(result) {
  const categories = ["SQL", "XSS", "TRAVERSAL", "RFI", "EVADE", "UPLOAD"];
  const request = result.request || { query: {}, headers: {} };
  const matches = result.matches || [];
  const tabs = [
    { id: "summary", label: "Summary" },
    ...matches.map((match, index) => ({
      id: `rule-${match.rule.id}-${index}`,
      label: `Rule ${match.rule.id}`,
    })),
  ];
  const initialTabId = tabs.some((tab) => tab.id === activeTabId)
    ? activeTabId
    : "summary";

  statusBar.innerHTML = `
    <span class="muted">TOTAL score ${result.scores.TOTAL}</span>
    ${badgeForVerdict(result.verdict)}
  `;

  const scoresHtml = categories
    .map((category) => {
      const value = result.scores[category] || 0;
      return `<div class="score-row"><span>${category}</span><strong>${value}</strong></div>`;
    })
    .join("");

  const summaryPane = `
    <section class="report-pane${initialTabId === "summary" ? " active" : ""}" data-pane="summary">
      <div class="report-grid">
        <div class="kv">
          <label>Request</label>
          <div class="request-grid">${formatRequest(request)}</div>
        </div>
        <div class="kv">
          <label>Score Summary</label>
          <div class="score-grid">${scoresHtml}</div>
        </div>
      </div>
      <div class="kv">
        <label>Matched Rules</label>
        ${
          matches.length
            ? `<div class="rule-summary-list">${matches
                .map(
                  (match) => `
                    <div class="rule-summary-item">
                      <span class="chip chip-rule">Rule ${match.rule.id}</span>
                      <span class="summary-msg">${escapeHtml(match.rule.msg || "No message")}</span>
                      <span class="summary-zone">${escapeHtml(match.source)}</span>
                    </div>
                  `,
                )
                .join("")}</div>`
            : '<div class="empty-state">No rules matched with current filters.</div>'
        }
      </div>
      ${renderWhitelistSection(matches)}
    </section>
  `;

  const rulePanes = matches
    .map(
      (match, index) => `
        <section class="report-pane" data-pane="rule-${match.rule.id}-${index}">
          ${renderRulePane(match)}
        </section>
      `,
    )
    .join("");

  reportRoot.innerHTML = `
    <div class="report-tabs" role="tablist" aria-label="Matched rule tabs">
      ${tabs
        .map(
          (tab) => `
            <button class="report-tab${tab.id === initialTabId ? " active" : ""}" data-tab="${tab.id}" type="button">
              ${escapeHtml(tab.label)}
            </button>
          `,
        )
        .join("")}
    </div>
    <div class="report-panes">
      ${summaryPane}
      ${rulePanes}
    </div>
  `;

  reportRoot.querySelectorAll("[data-tab]").forEach((tab) => {
    tab.addEventListener("click", () => setActiveTab(tab.dataset.tab));
  });

  setActiveTab(initialTabId);
}

function renderResult(result) {
  lastResult = result;
  populateFilters(result.matches || []);
  renderResultInternal(result);
}

async function analyze() {
  const curl = curlInput.value.trim();
  if (!curl) {
    reportRoot.innerHTML =
      '<div class="empty-state">Paste a curl command first.</div>';
    statusBar.innerHTML =
      '<span class="muted">Waiting for input...</span><span class="badge allowed">ALLOWED</span>';
    return;
  }

  analyzeBtn.disabled = true;
  analyzeBtn.textContent = "Analyzing...";

  try {
    const selectedRuleIds = Array.from(selectedRules);

    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ curl, selectedRuleIds }),
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Analysis failed");
    }

    renderResult(payload.result);
  } catch (error) {
    reportRoot.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
    statusBar.innerHTML =
      '<span class="muted">Analysis failed</span><span class="badge warning">ERROR</span>';
  } finally {
    analyzeBtn.disabled = false;
    analyzeBtn.textContent = "Analyze Report";
  }
}

analyzeBtn.addEventListener("click", analyze);
sampleBtn.addEventListener("click", () => {
  curlInput.value = sampleCurl;
  analyze();
});

curlInput.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
    analyze();
  }
});

rulesToggleAll.addEventListener("change", handleRulesToggleAll);
zonesToggleAll.addEventListener("change", handleZonesToggleAll);
themeToggle.addEventListener("click", toggleTheme);

// Initialize on page load
document.addEventListener("DOMContentLoaded", () => {
  initializeTheme();
  initializeFilters();
});
