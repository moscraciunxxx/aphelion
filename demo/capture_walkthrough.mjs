#!/usr/bin/env node
/**
 * Record the live instrument while the VO plays through each scene.
 * Reset happens before the camera starts so video t=0 matches timings.json.
 * During "open", mass/spin/distance move so the photon ring changes on camera.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const WORK = path.join(ROOT, "demo", "renders");
const timingsPath = path.join(WORK, "timings.json");
const outDir = path.join(WORK, "capture");
const dest = path.join(WORK, "walkthrough.webm");

const pack = JSON.parse(fs.readFileSync(timingsPath, "utf8"));
const lines = pack.lines || pack;
const last = lines[lines.length - 1];
const totalMs = Math.ceil((last.t + last.duration + 1.4) * 1000);

await fetch("http://127.0.0.1:8787/api/reset", { method: "POST" });

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--use-gl=angle", "--ignore-gpu-blocklist"],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  recordVideo: { dir: outDir, size: { width: 1440, height: 900 } },
});
const page = await context.newPage();
page.on("pageerror", (err) => console.error("pageerror", err.message));

await page.goto("http://127.0.0.1:8787/", { waitUntil: "networkidle" });
await page.waitForSelector("#observeBtn");
await page.addStyleTag({
  content: `
    .demo-focus { outline: 2px solid rgba(212,106,44,0.95) !important; outline-offset: 3px; box-shadow: 0 0 0 1px rgba(255,176,128,0.35), 0 0 28px rgba(212,106,44,0.25) !important; }
    button.demo-pulse { background: #d46a2c !important; color: #1a0d08 !important; }
  `,
});
await page.waitForTimeout(350);

async function setNum(id, value) {
  await page.$eval(
    `#${id}`,
    (el, v) => {
      el.value = String(Math.round(v * 1000) / 1000);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    },
    value,
  );
}

async function setFocus(sel, on) {
  const handle = await page.$(sel);
  if (!handle) return;
  await handle.evaluate((el, flag) => el.classList.toggle("demo-focus", flag), on);
}

const t0 = Date.now();
const elapsed = () => (Date.now() - t0) / 1000;
const clicked = new Set();
let leftLit = false;
let restoredDisk = false;
let lastAnim = -1;

async function tickVisuals(t) {
  if (t >= 1.05 && t <= 8.15) {
    const u = Math.min(1, (t - 1.05) / 7.1);
    const step = Math.floor(u * 20);
    if (step !== lastAnim) {
      lastAnim = step;
      await setNum("massSolar", 14.2 + 5.6 * u);
      await setNum("spin", 0.72 + 0.22 * u);
      await setNum("distanceMpc", 11.4 - 3.8 * u);
    }
  } else if (!restoredDisk && t > 8.15) {
    restoredDisk = true;
    await setNum("massSolar", 14.2);
    await setNum("spin", 0.72);
    await setNum("distanceMpc", 11.4);
  }

  if (t >= 8.45 && t < 14.15) {
    if (!leftLit) {
      leftLit = true;
      await setFocus(".panel.left", true);
    }
  } else if (leftLit && t >= 14.15) {
    leftLit = false;
    await setFocus(".panel.left", false);
  }
}

async function maybeClick(t) {
  for (const line of lines) {
    if (!line.click || clicked.has(line.scene)) continue;
    if (t + 0.04 < line.t) continue;
    clicked.add(line.scene);
    const sel = `#${line.click}`;
    await setFocus(sel, true);
    await page.$eval(sel, (el) => el.classList.add("demo-pulse"));
    await page.click(sel);
    console.log("click", line.scene, line.click, t.toFixed(2));
    if (line.click === "observeBtn") {
      await page.waitForFunction(() => document.getElementById("privateSky")?.textContent === "REDACTED", { timeout: 8000 });
    } else if (line.click === "issueBtn") {
      await page.waitForFunction(() => /accredited|issueInstrument/i.test(document.body.innerText), { timeout: 8000 });
    } else if (line.click === "fileBtn") {
      await page.waitForFunction(() => /DETECTION ACCEPTED/i.test(document.body.innerText), { timeout: 8000 });
    } else if (line.click === "confirmBtn") {
      await page.waitForFunction(() => /\bCONFIRMED\b/.test(document.getElementById("ledger")?.innerText || ""), { timeout: 8000 });
    }
    await page.$eval(sel, (el) => el.classList.remove("demo-pulse"));
    await setFocus(sel, false);
  }
}

while (Date.now() - t0 < totalMs) {
  const t = elapsed();
  await tickVisuals(t);
  await maybeClick(t);
  await page.waitForTimeout(80);
}

const video = page.video();
await page.close();
if (!video) throw new Error("Playwright did not record a video");
await video.saveAs(dest);
await video.delete().catch(() => {});
await context.close();
await browser.close();
const st = fs.statSync(dest);
console.log(JSON.stringify({ dest, bytes: st.size, totalMs }));
