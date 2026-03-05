/* ═══════════════════════════════════════════════════════════════
   completion.js – Copilot-style inline ghost-text suggestions
   ═══════════════════════════════════════════════════════════════ */

const Completion = (() => {
  let decorations = [];     // Monaco decoration IDs for ghost text
  let pendingSuggestion = ""; // current suggestion text
  let debounceTimer = null;
  const DEBOUNCE_MS = 800;  // wait before fetching

  function init() {
    // We set up the trigger after Editor is ready
    const ed = Editor.getMonaco();
    if (!ed) return;

    // After the user types, debounce a completion request
    ed.onDidChangeModelContent(() => {
      clearGhost();
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(fetchSuggestion, DEBOUNCE_MS);
    });

    // Tab accepts the ghost text
    ed.addCommand(monaco.KeyCode.Tab, () => {
      if (pendingSuggestion) {
        acceptSuggestion();
      } else {
        // Default tab behaviour (indent)
        ed.trigger("keyboard", "tab", {});
      }
    });

    // Escape dismisses ghost text
    ed.addCommand(monaco.KeyCode.Escape, () => {
      clearGhost();
    });
  }

  /* ── Fetch suggestion from backend ──────────────────────── */

  async function fetchSuggestion() {
    const filePath = Editor.getActiveFilePath();
    if (!filePath) return;

    const ed = Editor.getMonaco();
    const model = ed.getModel();
    if (!model) return;

    const pos = ed.getPosition();
    const offset = model.getOffsetAt(pos);
    const fullText = model.getValue();
    const prefix = fullText.substring(0, offset);
    const suffix = fullText.substring(offset);

    // Don't fetch if prefix is too short
    if (prefix.trim().length < 5) return;

    try {
      const res = await apiPost("/api/complete", {
        prefix,
        suffix,
        language: model.getLanguageId(),
        file_path: filePath,
      });
      const suggestion = res.suggestion;
      if (suggestion && suggestion.trim()) {
        pendingSuggestion = suggestion;
        showGhost(pos, suggestion);
      }
    } catch {
      // Silently ignore completion errors
    }
  }

  /* ── Ghost text rendering ───────────────────────────────── */

  function showGhost(position, text) {
    const ed = Editor.getMonaco();
    // Use inline decorations (afterContentText) for the ghost preview
    const lines = text.split("\n");
    const firstLine = lines[0];
    const restLines = lines.slice(1);

    const newDecorations = [
      {
        range: new monaco.Range(
          position.lineNumber, position.column,
          position.lineNumber, position.column,
        ),
        options: {
          after: {
            content: firstLine,
            inlineClassName: "ghost-text-decoration",
          },
          description: "ghost-text",
        },
      },
    ];

    decorations = ed.deltaDecorations(decorations, newDecorations);
  }

  function clearGhost() {
    if (decorations.length) {
      const ed = Editor.getMonaco();
      decorations = ed.deltaDecorations(decorations, []);
    }
    pendingSuggestion = "";
  }

  /* ── Accept suggestion ──────────────────────────────────── */

  function acceptSuggestion() {
    const ed = Editor.getMonaco();
    const pos = ed.getPosition();
    clearGhost();
    ed.executeEdits("completion", [
      {
        range: new monaco.Range(pos.lineNumber, pos.column, pos.lineNumber, pos.column),
        text: pendingSuggestion,
      },
    ]);
    pendingSuggestion = "";
  }

  return { init };
})();
