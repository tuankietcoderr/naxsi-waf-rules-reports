#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const chalk = require("chalk");
const {
  analyzeRequest,
  generateReport,
  generatePlainReport,
} = require("./index");

// Get arguments
const args = process.argv.slice(2);

if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
  console.log(chalk.cyan.bold("NAXSI Score Reporter CLI\n"));
  console.log(chalk.yellow("Usage:"));
  console.log(
    '  naxsi-report "<curl-command>" [--rules <rules-file>] [--plain] [--debug]\n',
  );
  console.log(chalk.yellow("Options:"));
  console.log("  <curl-command>      CURL command to analyze (required)");
  console.log(
    "  --rules <path>      Path to NAXSI rules file (default: ./reference/nasxi_core.rules)",
  );
  console.log(
    "  --plain             Generate plain text report without colors",
  );
  console.log("  --debug             Show debug information about parsing");
  console.log("  --help, -h          Show this help message\n");
  console.log(chalk.yellow("Examples:"));
  console.log('  naxsi-report "curl http://example.com/search?q=select"');
  console.log(
    "  naxsi-report \"curl -d '<script>' http://example.com\" --rules ./my-rules.txt",
  );
  console.log('  naxsi-report "curl http://example.com" --debug\n');
  process.exit(0);
}

// Parse arguments
let curlCommand = "";
let rulesPath = "";
let plainOutput = false;
let debugMode = false;
const curlParts = [];

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--rules" && i + 1 < args.length) {
    rulesPath = args[i + 1];
    i++;
  } else if (args[i] === "--plain") {
    plainOutput = true;
  } else if (args[i] === "--debug") {
    debugMode = true;
  } else {
    curlParts.push(args[i]);
  }
}

curlCommand = curlParts
  .join(" ")
  .replace(/\s+\\\s+/g, " ")
  .trim();

// Validate CURL command
if (!curlCommand) {
  console.error(chalk.red("Error: CURL command is required"));
  process.exit(1);
}

// Set default rules path if not provided
if (!rulesPath) {
  rulesPath = path.join(__dirname, "reference", "nasxi_core.rules");
}

// Check if rules file exists
if (!fs.existsSync(rulesPath)) {
  console.error(chalk.red(`Error: Rules file not found: ${rulesPath}`));
  process.exit(1);
}

try {
  // Analyze request
  const result = analyzeRequest(curlCommand, rulesPath);

  // Show debug info if requested
  if (debugMode) {
    console.log(chalk.bold.magenta("=== DEBUG INFO ===\n"));
    console.log(chalk.cyan("Parsed Request:"));
    console.log(`  URL: ${result.request.url}`);
    console.log(`  Path: ${result.request.path}`);
    console.log(`  Method: ${result.request.method}`);
    console.log(`  Query Params: ${JSON.stringify(result.request.query)}`);
    console.log(`  Body: ${result.request.body || "(empty)"}`);
    console.log(
      `  Headers: ${JSON.stringify(result.request.headers, null, 2)}`,
    );
    console.log(`  Rules Loaded: ${result.rules}`);
    console.log("\n");
  }

  // Generate and display report
  if (plainOutput) {
    console.log(
      generatePlainReport(result.request, result.matches, result.scores),
    );
  } else {
    console.log(generateReport(result.request, result.matches, result.scores));
  }

  // Exit with appropriate code
  if (result.verdict === "BLOCKED") {
    process.exit(2);
  } else if (result.verdict === "WARNING") {
    process.exit(1);
  }
} catch (error) {
  console.error(chalk.red("Error analyzing request:"));
  console.error(chalk.red(error.message));
  if (process.env.DEBUG) {
    console.error(error.stack);
  }
  process.exit(1);
}
