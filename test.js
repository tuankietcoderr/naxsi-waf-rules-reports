#!/usr/bin/env node

const chalk = require("chalk");
const { analyzeRequest, generateReport } = require("./index");
const path = require("path");

console.log(chalk.bold.cyan("Testing NAXSI Score Reporter...\n"));

const rulesPath = path.join(__dirname, "reference", "nasxi_core.rules");

// Test cases
const testCases = [
  {
    name: "SQL Injection Test",
    curl: 'curl "http://example.com/search?q=select+1+from+users"',
  },
  {
    name: "XSS Test",
    curl: 'curl -d \'{"x":"<script>alert(1)</script>"}\' http://example.com/api',
  },
  {
    name: "Path Traversal Test",
    curl: 'curl "http://example.com/file?path=../../../etc/passwd"',
  },
  {
    name: "Multiple Threats",
    curl: "curl \"http://example.com/upload.php?action=view&id=1' OR '1'='1&payload=<img+src=x+onerror=alert(1)>\"",
  },
  {
    name: "Clean Request",
    curl: 'curl "http://example.com/api/users?page=1&sort=name"',
  },
];

// Run tests
testCases.forEach((testCase, index) => {
  console.log(chalk.bold.magenta(`\n[Test ${index + 1}] ${testCase.name}`));
  console.log(chalk.gray("─".repeat(60)));

  try {
    const result = analyzeRequest(testCase.curl, rulesPath);
    console.log(generateReport(result.request, result.matches, result.scores));
  } catch (error) {
    console.error(chalk.red(`Error: ${error.message}`));
  }
});

console.log(chalk.bold.cyan("\nTests completed!"));
