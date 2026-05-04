const chalk = require("chalk");

/**
 * Check if a pattern matches in text
 * @param {string} pattern - Pattern to match (string or regex)
 * @param {string} text - Text to search in
 * @param {boolean} isRegex - Whether pattern is regex
 * @returns {Array} Array of {index, length, matched} or empty array
 */
function matchPattern(pattern, text, isRegex) {
  if (!pattern || !text) return [];

  const matches = [];

  try {
    if (isRegex) {
      // Convert pattern string to regex
      const regex = new RegExp(pattern, "gi");
      let match;
      while ((match = regex.exec(text)) !== null) {
        matches.push({
          index: match.index,
          length: match[0].length,
          matched: match[0],
        });
      }
    } else {
      // String matching (case-insensitive)
      const lowerText = text.toLowerCase();
      const lowerPattern = pattern.toLowerCase();
      let startIndex = 0;

      while (
        (startIndex = lowerText.indexOf(lowerPattern, startIndex)) !== -1
      ) {
        matches.push({
          index: startIndex,
          length: pattern.length,
          matched: text.substring(startIndex, startIndex + pattern.length),
        });
        startIndex += pattern.length;
      }
    }
  } catch (e) {
    console.error(`Error matching pattern "${pattern}":`, e.message);
  }

  return matches;
}

/**
 * Highlight matched text in a string using chalk
 * @param {string} text - Original text
 * @param {Array} matches - Array of match objects with index and length
 * @param {string} color - Color to use (red, yellow, cyan, etc.)
 * @returns {string} Highlighted text
 */
function highlightMatches(text, matches, color = "red") {
  if (!matches || matches.length === 0) return text;

  // Sort matches by index in reverse to avoid offset issues
  const sorted = [...matches].sort((a, b) => b.index - a.index);
  let result = text;

  const colorFn = chalk[color] || chalk.red;

  sorted.forEach((match) => {
    const before = result.substring(0, match.index);
    const highlighted = colorFn.bold(
      result.substring(match.index, match.index + match.length),
    );
    const after = result.substring(match.index + match.length);
    result = before + highlighted + after;
  });

  return result;
}

/**
 * Check if rule matches in request data
 * @param {Object} rule - Rule object
 * @param {Array} zoneDataList - Array of {text, source} from zones
 * @returns {Object} Match result or null
 */
function checkRuleMatch(rule, zoneDataList) {
  if (!rule.pattern) return null;

  for (const zoneData of zoneDataList) {
    const matches = matchPattern(rule.pattern, zoneData.text, rule.isRegex);

    if (matches.length > 0) {
      return {
        rule,
        matched: matches,
        text: zoneData.text,
        source: zoneData.source,
      };
    }
  }

  return null;
}

/**
 * Calculate total score from matched rules
 * @param {Array} matches - Array of match results
 * @returns {Object} Score breakdown by category and total
 */
function calculateScore(matches) {
  const scores = {
    SQL: 0,
    XSS: 0,
    TRAVERSAL: 0,
    RFI: 0,
    EVADE: 0,
    UPLOAD: 0,
  };

  matches.forEach((match) => {
    if (match.rule.scores) {
      Object.entries(match.rule.scores).forEach(([category, points]) => {
        if (category in scores) {
          scores[category] += points;
        }
      });
    }
  });

  const total = Object.values(scores).reduce((a, b) => a + b, 0);

  return {
    ...scores,
    TOTAL: total,
  };
}

module.exports = {
  matchPattern,
  highlightMatches,
  checkRuleMatch,
  calculateScore,
};
