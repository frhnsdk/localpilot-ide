/* ═══════════════════════════════════════════════════════════════
   app.js – Boot-up orchestrator & shared utilities
   ═══════════════════════════════════════════════════════════════ */

/* ── Shared HTTP helpers (used by all modules) ────────────── */

async function api(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

async function apiPost(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

/* ── Boot sequence ────────────────────────────────────────── */

(async () => {
  // 1. Initialise Monaco editor (async – loads from CDN)
  await Editor.init();

  // 2. Initialise sidebar file explorer
  FileExplorer.init();

  // 3. Initialise inline completion
  Completion.init();

  // 4. Initialise AI chat
  Chat.init();

  // 5. Wire up toolbar buttons
  setupToolbar();

  // 6. Wire up resizable panels
  setupResize();

  console.log("🚀 LocalPilot IDE ready");
})();

/* ── Toolbar wiring ───────────────────────────────────────── */

function setupToolbar() {
  // Upload ZIP
  document.getElementById("btn-upload-zip").addEventListener("click", () => {
    document.getElementById("zip-input").click();
  });
  document.getElementById("zip-input").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    await fetch("/api/files/upload_zip", { method: "POST", body: form });
    FileExplorer.refresh();
    e.target.value = "";
  });

  // Download ZIP
  document.getElementById("btn-download-zip").addEventListener("click", () => {
    window.location.href = "/api/files/download_zip";
  });

  // Toggle chat panel
  document.getElementById("btn-toggle-chat").addEventListener("click", () => {
    document.getElementById("chat-panel").classList.toggle("hidden");
  });
}

/* ── Resizable panels ─────────────────────────────────────── */

function setupResize() {
  makeResizable("resize-sidebar", "sidebar", true);
  makeResizable("resize-chat", "chat-panel", false);
}

function makeResizable(handleId, panelId, isLeft) {
  const handle = document.getElementById(handleId);
  const panel = document.getElementById(panelId);
  let startX, startW;

  handle.addEventListener("mousedown", (e) => {
    startX = e.clientX;
    startW = panel.offsetWidth;
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    e.preventDefault();
  });

  function onMove(e) {
    const dx = e.clientX - startX;
    const newW = isLeft ? startW + dx : startW - dx;
    const min = parseInt(getComputedStyle(panel).minWidth) || 160;
    const max = parseInt(getComputedStyle(panel).maxWidth) || 600;
    panel.style.width = Math.min(max, Math.max(min, newW)) + "px";
  }

  function onUp() {
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup", onUp);
  }
}
