# NAXSI Score Reporter

CLI tool to calculate NAXSI WAF rules from HTTP requests, highlighting matched text support.

## Installation

```bash
git clone https://github.com/tuankietcoderr/naxsi-waf-rules-reports.git
cd path\to\naxsi-waf-rules-reports
npm install
npm link
```

## Usage

### 1. Run using CLI

```bash
# Basic
node cli.js "curl http://example.com/search?q=select+1"
# or
naxsi-score "curl http://example.com/search?q=select+1"

# Multi-line CURL (with backslash)
node cli.js "curl 'http://example.com/search?q=test' \\
  -H 'User-Agent: Mozilla' \\
  -b 'session_id=abc123'"
# or
naxsi-score "curl 'http://example.com/search?q=test' \\
  -H 'User-Agent: Mozilla' \\
  -b 'session_id=abc123'"

# With options
node cli.js "curl http://example.com" --rules ./reference/naxsi_core.rules --plain --debug
# or
naxsi-score "curl http://example.com" --rules ./reference/naxsi_core.rules --plain --debug
```

### 2. Use as module

```javascript
const { analyzeRequest, generateReport } = require("./index");

const result = analyzeRequest(
  'curl "http://example.com/search?q=select+1"',
  "./reference/naxsi_core.rules",
);

console.log(generateReport(result.request, result.matches, result.scores));
```

### 3. Run tests

```bash
node test.js
```

## Features

- ✅ Parse CURL commands (URL, query params, body, headers)
- ✅ Match patterns from rules file (string matching and regex)
- ✅ Score by category (SQL, XSS, TRAVERSAL, RFI, etc.)
- ✅ Highlight matched text with chalk (color codes)
- ✅ Comprehensive report with violations details
- ✅ Exit codes for integration with CI/CD

## Output Format

```
=== NAXSI SCORE REPORT ===

Request:
  URL         : /search
  Query       : {"q":"select 1"}
  Body        : {"x":"<script>alert(1)</script>"}

Matched Rules:
  [SQL: +8, XSS: +8] Rule 1000  (rx: "select|union|...") zone=ARGS
      Message: sql keywords
      Matched in: select 1

  [XSS: +8] Rule 1302  (str: "<") zone=BODY
      Message: html open tag
      Matched in: <script>

Whitelist Suggestions:
  Rule 1000 zone=ARGS
      Suggestion: BasicRule wl:1000 "mz:$ARGS";
  Rule 1302 zone=BODY
      Suggestion: BasicRule wl:1302 "mz:$BODY";

Score Summary:
  SQL          : 8
  XSS          : 8
  TRAVERSAL    : 0
  RFI          : 0

TOTAL: 16  → ❌ BLOCKED
```

## Exit Codes

- `0` - ALLOWED (score < 4)
- `1` - WARNING (score 4-7)
- `2` - BLOCKED (score >= 8)

## Options

| Option           | Description                                                      |
| ---------------- | ---------------------------------------------------------------- |
| `--rules <path>` | Path to NAXSI rules file (default: ./reference/naxsi_core.rules) |
| `--plain`        | Generate plain text report (without colors)                      |
| `--help, -h`     | Show help message                                                |

## Examples

### SQL Injection

```bash
naxsi-score "curl 'http://localhost/user?id=1 OR 1=1'"
```

### XSS Attack

```bash
naxsi-score "curl -d '<img src=x onerror=alert(1)>' http://localhost/upload"
```

### Path Traversal

```bash
naxsi-score "curl 'http://localhost/file?path=../../../../etc/passwd'"
```

### Multiple Threats

```bash
naxsi-score "curl 'http://localhost/search?q=<script>alert(1)</script> UNION SELECT * FROM users'"
```

## Scoring Rules

- **SQL**: Detects SQL injection keywords and operators
- **XSS**: Detects HTML tags and JavaScript patterns
- **TRAVERSAL**: Detects path traversal attempts
- **RFI**: Detects remote file inclusion attempts
- **EVADE**: Detects encoding bypass attempts
- **UPLOAD**: Detects malicious file uploads

## Structure

```
.
├── lib/
│   ├── ruleParser.js    # Parse NAXSI rules file
│   ├── curlParser.js    # Parse CURL commands
│   ├── matcher.js       # Pattern matching & scoring
│   └── reporter.js      # Report generation
├── reference/
│   └── naxsi_core.rules # NAXSI rules database
├── public/
│   └── app.js           # Web interface (optional)
│   └── index.html       # Web interface (optional)
│   └── styles.css       # Web interface styles (optional)
├── cli.js               # CLI interface
├── index.js             # Main module
├── server.js            # (Optional) HTTP server for web interface
├── test.js              # Test suite
└── package.json         # Dependencies
```

## Dependencies

- `chalk` - Color highlighting
- `url` - URL parsing (built-in)

## License

MIT
