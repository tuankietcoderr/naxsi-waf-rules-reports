const path = require("path");
const { parseRulesFile } = require("./lib/ruleParser");
const { parseCurl, extractZoneData } = require("./lib/curlParser");
const { checkRuleMatch, calculateScore } = require("./lib/matcher");
const { generateReport, generatePlainReport } = require("./lib/reporter");

/**
 * Analyze HTTP request against NAXSI rules
 * @param {string} curlCommand - CURL command to analyze
 * @param {string} rulesPath - Path to NAXSI rules file
 * @param {Object} options - Additional options
 * @returns {Object} Analysis result with matches and scores
 */
function analyzeRequest(curlCommand, rulesPath, options = {}) {
  // Parse rules file
  const rules = parseRulesFile(rulesPath);

  // Parse CURL request
  const request = parseCurl(curlCommand);
  console.log({ curlCommand, body: request.body });

  // Find matching rules
  const matches = [];

  rules.forEach((rule) => {
    if (!rule.pattern || rule.zones.length === 0) {
      return;
    }

    // Extract data from all specified zones
    const zoneDataList = [];
    rule.zones.forEach((zone) => {
      const data = extractZoneData(request, zone);
      zoneDataList.push(...data);
    });

    // Check if rule matches
    const match = checkRuleMatch(rule, zoneDataList);
    if (match) {
      matches.push(match);
    }
  });

  // Calculate scores
  const scores = calculateScore(matches);

  return {
    request,
    rules: rules.length,
    matches,
    scores,
    verdict:
      scores.TOTAL >= 8 ? "BLOCKED" : scores.TOTAL >= 4 ? "WARNING" : "ALLOWED",
  };
}

module.exports = {
  analyzeRequest,
  parseRulesFile,
  parseCurl,
  generateReport,
  generatePlainReport,
  calculateScore,
};
