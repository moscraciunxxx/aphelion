(function () {
  const $ = (id) => document.getElementById(id);
  const fileMode = location.protocol === "file:";
  if (fileMode) document.body.classList.add("file");

  const canvas = $("horizon");
  let horizon = null;
  try {
    horizon = window.AphelionHorizon.init(canvas);
    if (horizon && horizon.error) $("vizErr").textContent = horizon.error;
  } catch (err) {
    $("vizErr").textContent = String(err.message || err);
  }

  const fields = [
    "massSolar",
    "spin",
    "raHours",
    "decDeg",
    "distanceMpc",
    "instrumentClass",
    "minSnrBand",
    "epoch",
    "observerSecret",
    "instrumentSecret",
  ];

  function val(id) {
    const el = $(id);
    if (el.type === "number") return Number(el.value);
    return el.value;
  }

  function payload() {
    const o = {};
    for (const id of fields) o[id] = val(id);
    o.t0 = o.epoch;
    return o;
  }

  function hexSecret() {
    const a = new Uint8Array(32);
    crypto.getRandomValues(a);
    return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
  }

  $("observerSecret").value = hexSecret();
  $("instrumentSecret").value = hexSecret();

  function syncViz() {
    if (!horizon || horizon.error) return;
    horizon.mass = val("massSolar");
    horizon.spin = val("spin");
    horizon.dist = val("distanceMpc");
  }
  ["massSolar", "spin", "distanceMpc"].forEach((id) => {
    $(id).addEventListener("input", syncViz);
  });
  syncViz();

  function setLedger(publicState, proof) {
    const el = $("ledger");
    if (!publicState) {
      el.textContent = "no public state";
      return;
    }
    const hud = $("publicHud");
    if (hud && publicState.detectionCount > 0) {
      hud.innerHTML =
        "Public ledger: SNR band <b>" +
        publicState.snrBand +
        "</b> (≥ 8.00) · status <b>" +
        publicState.status +
        "</b> · detections <b>" +
        publicState.detectionCount +
        "</b>";
    }
    el.innerHTML = [
      kv("contract", publicState.contractId),
      kv("status", publicState.status),
      kv("instrument class", publicState.instrumentClass),
      kv("SNR band", publicState.snrBand),
      kv("epoch", publicState.epoch),
      kv("detections", publicState.detectionCount),
      kv("nullifier", publicState.nullifier),
      kv("attestation", publicState.attestationRoot),
      kv("tag", publicState.contractTag),
      proof
        ? kv("proof", proof.accepted ? "accepted · " + proof.circuit : "rejected")
        : "",
    ].join("");
  }

  function kv(k, v) {
    return `<div><span class="k">${k}</span> <span class="v">${escapeHtml(String(v))}</span></div>`;
  }
  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[c]));
  }

  async function api(path, body) {
    if (fileMode) throw new Error("Serve this page: npm start → http://127.0.0.1:8787");
    const res = await fetch(path, {
      method: body === undefined ? "GET" : "POST",
      headers: { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok || data.ok === false) throw new Error(data.error || res.statusText);
    return data;
  }

  function flash(msg, bad) {
    $("msg").textContent = msg || "";
    $("msg").className = bad ? "err" : "err ok";
  }

  $("observeBtn").addEventListener("click", async () => {
    try {
      const obs = await api("/api/observe", payload());
      $("privateSnr").textContent = obs.snr.toFixed(2);
      $("privateBand").textContent = String(obs.snrBand);
      $("privateSky").textContent = "REDACTED";
      $("privateStrain").textContent = obs.strainHash.slice(0, 12) + "… (hash only)";
      flash("private photometry computed — sky not on the ledger");
    } catch (err) {
      flash(String(err.message || err), true);
    }
  });

  $("issueBtn").addEventListener("click", async () => {
    try {
      const out = await api("/api/issue", {
        instrumentClass: val("instrumentClass"),
        minSnrBand: val("minSnrBand"),
        instrumentSecret: val("instrumentSecret"),
      });
      setLedger(out.public, out.proof);
      flash("instrument accredited — secret never left the witness");
    } catch (err) {
      flash(String(err.message || err), true);
    }
  });

  $("fileBtn").addEventListener("click", async () => {
    try {
      const ledger = await api("/api/ledger");
      const unissued =
        !ledger ||
        ledger.status === "EMPTY" ||
        !ledger.attestationRoot ||
        /^0+$/.test(String(ledger.attestationRoot));
      if (unissued) {
        await api("/api/issue", {
          instrumentClass: val("instrumentClass"),
          minSnrBand: val("minSnrBand"),
          instrumentSecret: val("instrumentSecret"),
        });
      }
      const out = await api("/api/file", payload());
      setLedger(out.public, out.proof);
      $("result").textContent =
        out.proof && out.proof.accepted
          ? "DETECTION ACCEPTED · public band only"
          : "rejected";
      $("result").dataset.filled = "1";
      flash("circuit accepted the witness; RA/Dec/strain absent from public state");
    } catch (err) {
      flash(String(err.message || err), true);
    }
  });

  $("confirmBtn").addEventListener("click", async () => {
    try {
      const out = await api("/api/confirm", {});
      setLedger(out.public, out.proof);
      flash("consortium confirmed the public detection");
    } catch (err) {
      flash(String(err.message || err), true);
    }
  });

  if (!fileMode) {
    api("/api/ledger")
      .then((p) => setLedger(p))
      .catch(() => {});
  }

  function tick() {
    const d = new Date();
    $("utc").textContent = d.toISOString().replace(".000", "");
  }
  tick();
  setInterval(tick, 1000);
})();
