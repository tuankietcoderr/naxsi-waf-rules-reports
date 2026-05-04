#!/usr/bin/env node

const fs = require("fs");
const http = require("http");
const path = require("path");
const { analyzeRequest } = require("./index");
const { parseRulesFile } = require("./lib/ruleParser");

const port = Number(process.env.PORT || 3000);
const rootDir = __dirname;
const publicDir = path.join(rootDir, "public");
const rulesPath = path.join(rootDir, "reference", "naxsi_core.rules");

function send(res, statusCode, body, contentType) {
  res.writeHead(statusCode, {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function sendJson(res, statusCode, payload) {
  send(
    res,
    statusCode,
    JSON.stringify(payload),
    "application/json; charset=utf-8",
  );
}

function readFileSafe(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function collectBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 5_000_000) {
        reject(new Error("Request body too large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

async function handleAnalyze(req, res) {
  try {
    const bodyText = await collectBody(req);
    const payload = bodyText ? JSON.parse(bodyText) : {};
    const curl = String(payload.curl || "")
      .replace(/\r\n/g, "\n")
      .trim();
    const selectedRuleIds = Array.isArray(payload.selectedRuleIds)
      ? payload.selectedRuleIds.map((id) => parseInt(id))
      : null;

    if (!curl) {
      sendJson(res, 400, { error: "curl is required" });
      return;
    }

    if (!fs.existsSync(rulesPath)) {
      sendJson(res, 500, { error: `Rules file not found: ${rulesPath}` });
      return;
    }

    const result = analyzeRequest(curl, rulesPath, {
      filterRuleIds: selectedRuleIds,
    });
    sendJson(res, 200, { result });
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
}

async function handleGetRules(req, res) {
  try {
    if (!fs.existsSync(rulesPath)) {
      sendJson(res, 500, { error: `Rules file not found: ${rulesPath}` });
      return;
    }

    const allRules = parseRulesFile(rulesPath);
    const rules = allRules.map((rule) => ({
      id: rule.id,
      msg: rule.msg,
    }));

    sendJson(res, 200, { rules });
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
}

const server = http.createServer((req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);

  if (requestUrl.pathname === "/api/analyze" && req.method === "POST") {
    handleAnalyze(req, res);
    return;
  }

  if (requestUrl.pathname === "/api/rules" && req.method === "GET") {
    handleGetRules(req, res);
    return;
  }

  if (requestUrl.pathname === "/health") {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (requestUrl.pathname === "/") {
    send(
      res,
      200,
      readFileSafe(path.join(publicDir, "index.html")),
      "text/html; charset=utf-8",
    );
    return;
  }

  if (requestUrl.pathname === "/app.js") {
    send(
      res,
      200,
      readFileSafe(path.join(publicDir, "app.js")),
      "application/javascript; charset=utf-8",
    );
    return;
  }

  if (requestUrl.pathname === "/styles.css") {
    send(
      res,
      200,
      readFileSafe(path.join(publicDir, "styles.css")),
      "text/css; charset=utf-8",
    );
    return;
  }

  send(res, 404, "Not found", "text/plain; charset=utf-8");
});

server.listen(port, "0.0.0.0", () => {
  console.log(`NAXSI web UI running at ${port}`);
  console.log(`Rules file: ${rulesPath}`);
});
