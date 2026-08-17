import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { observe } from "../src/physics.js";
import { getContract, resetContract } from "../src/store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, "..", "public");
const PORT = Number(process.env.PORT || 8787);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".wav": "audio/wav",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};

function json(res, code, body) {
  const payload = JSON.stringify(body);
  res.writeHead(code, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "access-control-allow-origin": "*",
  });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

function serveStatic(req, res) {
  const url = new URL(req.url, "http://127.0.0.1");
  let rel = decodeURIComponent(url.pathname);
  if (rel === "/") rel = "/index.html";
  const file = path.normalize(path.join(PUBLIC, rel));
  if (!file.startsWith(PUBLIC)) {
    res.writeHead(403);
    res.end("forbidden");
    return;
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("not found");
      return;
    }
    res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream" });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "content-type",
    });
    res.end();
    return;
  }

  try {
    if (req.method === "GET" && url.pathname === "/api/health") {
      const c = getContract();
      return json(res, 200, { ok: true, contractId: c.contractId, network: c.network });
    }
    if (req.method === "GET" && url.pathname === "/api/ledger") {
      return json(res, 200, getContract().getPublicState());
    }
    if (req.method === "POST" && url.pathname === "/api/reset") {
      return json(res, 200, resetContract().getPublicState());
    }
    if (req.method === "POST" && url.pathname === "/api/observe") {
      const body = await readBody(req);
      const obs = observe(body);
      return json(res, 200, {
        snr: obs.snr,
        snrMilli: obs.snrMilli,
        snrBand: obs.snrBand,
        peak: obs.peak,
        skyHash: obs.skyHash,
        strainHash: obs.strainHash,
        photonSphere: obs.photonSphere,
        isco: obs.isco,
      });
    }
    if (req.method === "POST" && url.pathname === "/api/issue") {
      const body = await readBody(req);
      return json(res, 200, getContract().issueInstrument(body));
    }
    if (req.method === "POST" && url.pathname === "/api/file") {
      const body = await readBody(req);
      const obs = observe(body);
      const result = getContract().fileDetection({
        instrumentClass: body.instrumentClass,
        minSnrBand: body.minSnrBand,
        epoch: body.epoch,
        observerSecret: body.observerSecret,
        skyHash: obs.skyHash,
        strainHash: obs.strainHash,
        snrMilli: obs.snrMilli,
        instrumentSecret: body.instrumentSecret,
      });
      return json(res, 200, result);
    }
    if (req.method === "POST" && url.pathname === "/api/confirm") {
      return json(res, 200, getContract().confirmDetection());
    }
    if (req.method === "GET" || req.method === "HEAD") {
      return serveStatic(req, res);
    }
    res.writeHead(404);
    res.end("not found");
  } catch (err) {
    json(res, 400, { ok: false, error: String(err.message || err) });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  process.stdout.write(`aphelion listening http://127.0.0.1:${PORT}\n`);
});
