/* ═══════════════════════════════════════════════════════════════
   editor.js – Monaco Editor integration with tabs
   ═══════════════════════════════════════════════════════════════ */

const Editor = (() => {
  let monacoEditor = null;   // Monaco instance
  let tabs = {};              // path → { model, viewState, modified }
  let activeTab = null;       // path of the currently shown tab

  /* ── Initialise Monaco ──────────────────────────────────── */

  function init() {
    return new Promise((resolve) => {
      require.config({
        paths: { vs: "https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs" },
      });
      require(["vs/editor/editor.main"], () => {
        monacoEditor = monaco.editor.create(
          document.getElementById("editor-container"),
          {
            theme: "vs-dark",
            automaticLayout: true,
            fontSize: 14,
            fontFamily: "'Cascadia Code', 'Fira Code', Consolas, monospace",
            minimap: { enabled: true },
            scrollBeyondLastLine: false,
            suggestOnTriggerCharacters: true,
            tabSize: 2,
            wordWrap: "on",
            renderWhitespace: "selection",
            cursorBlinking: "smooth",
            smoothScrolling: true,
            padding: { top: 8 },
          }
        );

        // Track cursor position for status bar
        monacoEditor.onDidChangeCursorPosition((e) => {
          const pos = e.position;
          document.getElementById("status-cursor").textContent =
            `Ln ${pos.lineNumber}, Col ${pos.column}`;
        });

        // Mark tab modified on content change
        monacoEditor.onDidChangeModelContent(() => {
          if (activeTab && tabs[activeTab]) {
            tabs[activeTab].modified = true;
            renderTabs();
          }
        });

        // Ctrl+S to save
        monacoEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
          saveActive();
        });

        resolve();
      });
    });
  }

  /* ── Tab management ─────────────────────────────────────── */

  async function openFile(path) {
    // If already in a tab, reload its content from disk then switch
    if (tabs[path]) {
      await reloadFile(path);
      switchTab(path);
      return;
    }

    // Fetch file content
    const res = await api(`/api/files/read?path=${encodeURIComponent(path)}`);
    const lang = languageForPath(path);
    const model = monaco.editor.createModel(res.content, lang);

    tabs[path] = { model, viewState: null, modified: false };
    renderTabs();
    switchTab(path);
  }

  async function reloadFile(path) {
    const tab = tabs[path];
    if (!tab) return;
    try {
      const res = await api(`/api/files/read?path=${encodeURIComponent(path)}`);
      tab.model.setValue(res.content);
      tab.modified = false;
      renderTabs();
    } catch { /* file may have been deleted */ }
  }

  function switchTab(path) {
    // Save view state of the current tab
    if (activeTab && tabs[activeTab]) {
      tabs[activeTab].viewState = monacoEditor.saveViewState();
    }
    activeTab = path;
    const tab = tabs[path];
    monacoEditor.setModel(tab.model);
    if (tab.viewState) monacoEditor.restoreViewState(tab.viewState);
    monacoEditor.focus();
    document.getElementById("status-file").textContent = path;
    renderTabs();
  }

  function closeTab(path) {
    const tab = tabs[path];
    if (!tab) return;
    if (tab.modified && !confirm(`"${path}" has unsaved changes. Close anyway?`)) return;
    tab.model.dispose();
    delete tabs[path];

    if (activeTab === path) {
      const remaining = Object.keys(tabs);
      if (remaining.length) {
        switchTab(remaining[remaining.length - 1]);
      } else {
        activeTab = null;
        monacoEditor.setModel(null);
        document.getElementById("status-file").textContent = "No file open";
      }
    }
    renderTabs();
  }

  function closeFileIfOpen(path) {
    // Close tab if the file was deleted externally
    if (tabs[path]) {
      tabs[path].modified = false; // don't nag
      closeTab(path);
    }
  }

  function renderTabs() {
    const container = document.getElementById("editor-tabs");
    container.innerHTML = "";
    for (const path of Object.keys(tabs)) {
      const el = document.createElement("div");
      el.className = "editor-tab" + (path === activeTab ? " active" : "");
      if (tabs[path].modified) el.classList.add("modified");

      const name = path.split("/").pop();
      el.innerHTML = `<span class="tab-name">${name}</span>
                      <span class="tab-close">&times;</span>`;
      el.querySelector(".tab-name").addEventListener("click", () => switchTab(path));
      el.querySelector(".tab-close").addEventListener("click", (e) => {
        e.stopPropagation();
        closeTab(path);
      });
      el.title = path;
      container.appendChild(el);
    }
  }

  /* ── Save ────────────────────────────────────────────────── */

  async function saveActive() {
    if (!activeTab || !tabs[activeTab]) return;
    const content = tabs[activeTab].model.getValue();
    await apiPost("/api/files/write", { path: activeTab, content });
    tabs[activeTab].modified = false;
    renderTabs();
  }

  /* ── Getters ─────────────────────────────────────────────── */

  function getMonaco() { return monacoEditor; }
  function getActiveFilePath() { return activeTab; }
  function getActiveContent() {
    return activeTab && tabs[activeTab] ? tabs[activeTab].model.getValue() : "";
  }

  /* ── Language detection ─────────────────────────────────── */

  function languageForPath(path) {
    const ext = path.split(".").pop().toLowerCase();
    const map = {
      js: "javascript", jsx: "javascript",
      ts: "typescript", tsx: "typescript",
      py: "python",
      html: "html", htm: "html",
      css: "css", scss: "scss", less: "less",
      json: "json",
      md: "markdown",
      yaml: "yaml", yml: "yaml",
      xml: "xml", svg: "xml",
      sh: "shell", bash: "shell",
      sql: "sql",
      java: "java",
      c: "c", cpp: "cpp", h: "c", hpp: "cpp",
      go: "go", rs: "rust", rb: "ruby", php: "php",
      toml: "ini",
    };
    return map[ext] || "plaintext";
  }

  return { init, openFile, closeFileIfOpen, saveActive, getMonaco, getActiveFilePath, getActiveContent };
})();
