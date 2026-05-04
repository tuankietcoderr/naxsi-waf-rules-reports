const fs = require("fs");
const path = require("path");

/**
 * Parse NAXSI rules file
 * @param {string} rulesPath - Path to rules file
 * @returns {Array} Array of parsed rules
 */
function parseRulesFile(rulesPath) {
  const content = fs.readFileSync(rulesPath, "utf8");
  const rules = [];

  // Split by lines and filter empty lines
  const lines = content.split("\n").filter((line) => line.trim());

  lines.forEach((line) => {
    const rule = parseRuleLine(line);
    if (rule) {
      rules.push(rule);
    }
  });

  return rules;
}

/**
 * Parse a single rule line
 * @param {string} line - Rule line
 * @returns {Object|null} Parsed rule or null
 */
function parseRuleLine(line) {
  // Match: MainRule "str:pattern" "msg:description" ... "s:$CATEGORY:score" id:1001;
  // The rule line format is: MainRule <pairs> id:<id>;
  
  // First extract ID
  const idMatch = line.match(/id:(\d+);/);
  if (!idMatch) return null;
  
  const id = parseInt(idMatch[1]);
  
  // Extract all quoted pairs: "key:value" or "key:value1|value2"
  const pairRegex = /"([^"]+?)"/g;
  const pairs = {};
  let match;
  
  while ((match = pairRegex.exec(line)) !== null) {
    const pair = match[1];
    const colonIdx = pair.indexOf(':');
    if (colonIdx !== -1) {
      const key = pair.substring(0, colonIdx).toLowerCase();
      const value = pair.substring(colonIdx + 1);
      pairs[key] = value;
    }
  }
  
  // Extract pattern (str: or rx:)
  let pattern = null;
  let isRegex = false;
  
  if (pairs.str) {
    pattern = pairs.str;
    isRegex = false;
  } else if (pairs.rx) {
    pattern = pairs.rx;
    isRegex = true;
  }
  
  // Extract message
  const msg = pairs.msg || '';
  
  // Extract zones (mz:)
  const zones = pairs.mz ? pairs.mz.split('|').map(z => z.trim()) : [];
  
  // Extract score (s:)
  // Format: "$SQL:4" or "$SQL:4,$XSS:8"
  const scoreData = {};
  if (pairs.s) {
    const scores = pairs.s.split(',');
    scores.forEach(score => {
      const scoreTrim = score.trim();
      const parts = scoreTrim.split(':');
      if (parts.length === 2) {
        const category = parts[0].replace('$', '');
        const points = parseInt(parts[1]);
        if (!isNaN(points)) {
          scoreData[category] = points;
        }
      }
    });
  }
  
  return {
    id,
    pattern,
    msg,
    isRegex,
    zones,
    scores: scoreData
  };
}

module.exports = {
  parseRulesFile,
  parseRuleLine,
};
