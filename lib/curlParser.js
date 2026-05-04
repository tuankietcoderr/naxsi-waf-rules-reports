const url = require("url");

/**
 * Parse CURL command into request components
 * @param {string} curlCommand - Full CURL command
 * @returns {Object} Parsed request data
 */
function parseCurl(curlCommand) {
  const request = {
    url: "",
    method: "GET",
    query: {},
    body: "",
    headers: {},
    originalUrl: "",
    path: "",
  };

  // Remove 'curl ' prefix if present and handle multi-line CURL
  let cmd = curlCommand.trim();
  if (cmd.toLowerCase().startsWith("curl ")) {
    cmd = cmd.substring(5).trim();
  }

  // Handle multi-line CURL commands (with backslash line continuation)
  cmd = cmd
    .split("\n")
    .map((line) => line.replace(/\\\s*$/, "").trim()) // Remove trailing backslash
    .filter((line) => line.length > 0)
    .join(" "); // Join lines with space
  // Parse method flag
  const methodMatch = cmd.match(
    /\s-X\s+(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)/i,
  );
  if (methodMatch) {
    request.method = methodMatch[1].toUpperCase();
  }

  // Parse URL - handle both quoted and unquoted URLs
  let urlMatch = cmd.match(/['"`]([^\s'"`]+)['"`]/);
  if (!urlMatch) {
    urlMatch = cmd.match(/(https?:\/\/[^\s]+?)(?:\s-|$)/);
  }

  if (urlMatch) {
    const urlStr = urlMatch[1];
    if (
      urlStr &&
      (urlStr.startsWith("http://") || urlStr.startsWith("https://"))
    ) {
      request.url = urlStr;
      request.originalUrl = urlStr;

      try {
        const urlObj = new url.URL(urlStr);
        request.path = urlObj.pathname;

        // Parse query parameters (URLSearchParams auto-decodes URL-encoded values)
        if (urlObj.search) {
          const params = new url.URLSearchParams(urlObj.search);
          for (const [key, value] of params) {
            request.query[key] = value; // Already decoded
          }
        }
      } catch (e) {
        // Fallback: simple path extraction
        request.path =
          urlStr.split("?")[0].split("/").slice(2).join("/") || "/";
      }
    }
  }

  // Parse headers (-H flag)
  const headerRegex = /-H\s+['"`]([^'"`]+?)['"`]/g;
  let headerMatch;
  while ((headerMatch = headerRegex.exec(cmd)) !== null) {
    const headerLine = headerMatch[1];
    const colonIdx = headerLine.indexOf(":");
    if (colonIdx !== -1) {
      const key = headerLine.substring(0, colonIdx).trim();
      const value = headerLine.substring(colonIdx + 1).trim();
      request.headers[key] = value;
    }
  }

  // Parse cookies (-b flag) and add to Cookie header
  const cookieRegex = /-b\s+['"`]([^'"`]+?)['"`]/g;
  const cookieMatches = Array.from(cmd.matchAll(cookieRegex));
  const cookies = [];

  for (const match of cookieMatches) {
    const cookieStr = match[1].trim();
    if (cookieStr) {
      cookies.push(cookieStr);
    }
  }

  if (cookies.length > 0) {
    request.headers["Cookie"] = cookies.join("; ");
  }

  // Parse body (data) - support multiple curl flags (quoted & unquoted)
  function escapeForRegex(s) {
    return s.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
  }

  function matchFlagValue(flag) {
    const esc = escapeForRegex(flag);
    // quoted value: check single-quoted, double-quoted, and backtick separately
    const singleRe = new RegExp(esc + "\\s+'([^']*)'");
    let m = cmd.match(singleRe);
    if (m) return m[1];
    const doubleRe = new RegExp(esc + '\\s+"([^\"]*)"');
    m = cmd.match(doubleRe);
    if (m) return m[1];
    const backtickRe = new RegExp(esc + "\\s+`([^`]*)`");
    m = cmd.match(backtickRe);
    if (m) return m[1];
    // unquoted single-token value (not starting with - to avoid matching next flag)
    const uRe = new RegExp(esc + "\\s+([^\\s-][^\\s]*)");
    m = cmd.match(uRe);
    if (m) return m[1];
    return null;
  }

  const dataFlags = [
    "-d",
    "--data",
    "--data-raw",
    "--data-binary",
    "--data-ascii",
  ];
  for (const f of dataFlags) {
    const val = matchFlagValue(f);
    if (val) {
      request.body = val;
      break;
    }
  }

  return request;
}

/**
 * Extract all text values from request that should be scanned
 * @param {Object} request - Parsed request
 * @param {string} zone - Zone name (ARGS, BODY, URL, HEADERS_VAR)
 * @returns {Array} Array of {text, source} objects
 */
function extractZoneData(request, zone) {
  const data = [];

  if (zone === "ARGS") {
    // Extract from query parameters
    Object.entries(request.query).forEach(([key, value]) => {
      data.push({ text: key, source: `ARGS[${key}]` });
      data.push({ text: value, source: `ARGS[${key}]` });
    });
  } else if (zone === "BODY") {
    if (request.body) {
      data.push({ text: request.body, source: "BODY" });
    }
  } else if (zone === "URL") {
    // URL zone should be just the path without query parameters
    data.push({ text: request.path || "/", source: "URL" });
  } else if (zone.startsWith("$HEADERS_VAR:")) {
    const headerName = zone.split(":")[1];
    if (request.headers[headerName]) {
      data.push({
        text: request.headers[headerName],
        source: `HEADERS[${headerName}]`,
      });
    }
  } else if (zone === "FILE_EXT") {
    // Extract file extension from URL path
    const match = request.path.match(/\.([a-zA-Z0-9]+)$/);
    if (match) {
      data.push({ text: match[0], source: "FILE_EXT" });
    }
  }

  return data;
}

module.exports = {
  parseCurl,
  extractZoneData,
};
