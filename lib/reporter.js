const chalk = require("chalk");
const { highlightMatches } = require("./matcher");

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

function buildWhitelistSuggestions(matches) {
  const seen = new Set();
  const suggestions = [];

  matches.forEach((match) => {
    const target = whitelistTargetForSource(match.source);
    const key = `${match.rule.id}:${target}`;
    if (seen.has(key)) return;
    seen.add(key);
    suggestions.push({
      id: match.rule.id,
      source: match.source,
      target,
      snippet: `BasicRule wl:${match.rule.id} "mz:${target}";`,
    });
  });

  return suggestions;
}

/**
 * Generate NAXSI Score Report
 * @param {Object} request - Parsed request
 * @param {Array} matches - Array of matched rules
 * @param {Object} scores - Score breakdown
 * @returns {string} Formatted report
 */
function generateReport(request, matches, scores) {
  let report = "";

  // Header
  report += chalk.bold.cyan("=== NAXSI SCORE REPORT ===\n\n");

  // Request section
  report += chalk.bold.yellow("Request:\n");
  report += `  ${chalk.gray("URL")}         : ${request.path || "/"}\n`;

  if (Object.keys(request.query).length > 0) {
    report += `  ${chalk.gray("Query")}       : ${JSON.stringify(request.query)}\n`;
  }

  if (request.body) {
    report += `  ${chalk.gray("Body")}        : ${request.body}\n`;
  }

  if (Object.keys(request.headers).length > 0) {
    report += `  ${chalk.gray("Headers")}     : ${JSON.stringify(request.headers)}\n`;
  }

  report += "\n";

  // Matched Rules section
  if (matches.length > 0) {
    report += chalk.bold.yellow("Matched Rules:\n");

    matches.forEach((match) => {
      const rule = match.rule;
      const scoreStr = Object.entries(rule.scores)
        .map(([cat, pts]) => `${chalk.green(cat)}: +${pts}`)
        .join(", ");

      const patternType = rule.isRegex ? chalk.cyan("rx") : chalk.cyan("str");

      // Highlight the matched text
      const highlightedSource = highlightMatches(
        match.source,
        match.matched.map((m) => ({
          index: match.source.indexOf(m.matched),
          length: m.length,
        })),
        "bgRed",
      );

      report += `  [${scoreStr}] ${chalk.gray("Rule")} ${chalk.yellow(rule.id)}  (${patternType}: "${chalk.white(rule.pattern)}")  ${chalk.gray("zone=")}${chalk.magenta(match.source)}\n`;
      report += `      ${chalk.gray("Message")}: ${rule.msg}\n`;
      report += `      ${chalk.gray("Matched in")}: ${chalk.bgRed(match.text.substring(0, 100))}${match.text.length > 100 ? "..." : ""}\n`;
      report += "\n";
    });
  } else {
    report += chalk.bold.yellow("Matched Rules:\n");
    report += chalk.gray("  (no rules matched)\n\n");
  }

  const whitelistSuggestions = buildWhitelistSuggestions(matches);

  report += chalk.bold.yellow("Whitelist Suggestions:\n");
  if (whitelistSuggestions.length > 0) {
    whitelistSuggestions.forEach((item) => {
      report += `  ${chalk.gray("Rule")} ${chalk.yellow(item.id)} ${chalk.gray("zone=")}${chalk.magenta(item.source)}\n`;
      report += `      ${chalk.gray("Suggestion")}: ${chalk.cyan(item.snippet)}\n`;
    });
    report += "\n";
  } else {
    report += chalk.gray("  (no rules matched)\n\n");
  }

  // Score Summary section
  report += chalk.bold.yellow("Score Summary:\n");
  const categories = ["SQL", "XSS", "TRAVERSAL", "RFI", "EVADE", "UPLOAD"];
  categories.forEach((cat) => {
    const score = scores[cat] || 0;
    const scoreDisplay = score > 0 ? chalk.red(score) : chalk.gray(score);
    report += `  ${chalk.gray(cat.padEnd(12))} : ${scoreDisplay}\n`;
  });

  report += "\n";

  // Total and verdict
  const total = scores.TOTAL || 0;
  let verdict = "";
  let verdictColor = "green";
  let verdictIcon = "✓ ALLOWED";

  if (total >= 8) {
    verdictColor = "red";
    verdictIcon = "❌ BLOCKED";
  } else if (total >= 4) {
    verdictColor = "yellow";
    verdictIcon = "⚠️  WARNING";
  }

  const totalDisplay = chalk[verdictColor].bold(`TOTAL: ${total}`);
  const verdictDisplay = chalk[verdictColor].bold(`${verdictIcon}`);

  report += `${totalDisplay}  → ${verdictDisplay}\n\n`;

  return report;
}

/**
 * Generate simple text-only report (no colors)
 * @param {Object} request - Parsed request
 * @param {Array} matches - Array of matched rules
 * @param {Object} scores - Score breakdown
 * @returns {string} Formatted report
 */
function generatePlainReport(request, matches, scores) {
  let report = "";

  // Header
  report += "=== NAXSI SCORE REPORT ===\n\n";

  // Request section
  report += "Request:\n";
  report += `  URL         : ${request.path || "/"}\n`;

  if (Object.keys(request.query).length > 0) {
    report += `  Query       : ${JSON.stringify(request.query)}\n`;
  }

  if (request.body) {
    report += `  Body        : ${request.body}\n`;
  }

  report += "\n";

  // Matched Rules section
  if (matches.length > 0) {
    report += "Matched Rules:\n";

    matches.forEach((match) => {
      const rule = match.rule;
      const scoreStr = Object.entries(rule.scores)
        .map(([cat, pts]) => `${cat}: +${pts}`)
        .join(", ");

      const patternType = rule.isRegex ? "rx" : "str";

      report += `  [${scoreStr}] Rule ${rule.id}  (${patternType}: "${rule.pattern}")  zone=${match.source}\n`;
      report += `      Message: ${rule.msg}\n`;
      report += `      Matched in: ${match.text.substring(0, 100)}${match.text.length > 100 ? "..." : ""}\n`;
      report += "\n";
    });
  } else {
    report += "Matched Rules:\n";
    report += "  (no rules matched)\n\n";
  }

  const whitelistSuggestions = buildWhitelistSuggestions(matches);

  report += "Whitelist Suggestions:\n";
  if (whitelistSuggestions.length > 0) {
    whitelistSuggestions.forEach((item) => {
      report += `  Rule ${item.id} zone=${item.source}\n`;
      report += `      Suggestion: ${item.snippet}\n`;
    });
    report += "\n";
  } else {
    report += "  (no rules matched)\n\n";
  }

  // Score Summary section
  report += "Score Summary:\n";
  const categories = ["SQL", "XSS", "TRAVERSAL", "RFI", "EVADE", "UPLOAD"];
  categories.forEach((cat) => {
    const score = scores[cat] || 0;
    report += `  ${cat.padEnd(12)} : ${score}\n`;
  });

  report += "\n";

  // Total and verdict
  const total = scores.TOTAL || 0;
  let verdict = "";

  if (total >= 8) {
    verdict = "❌ BLOCKED";
  } else if (total >= 4) {
    verdict = "⚠️  WARNING";
  } else {
    verdict = "✓ ALLOWED";
  }

  report += `TOTAL: ${total}  → ${verdict}\n\n`;

  return report;
}

module.exports = {
  generateReport,
  generatePlainReport,
};
