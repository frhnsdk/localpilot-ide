/* ═══════════════════════════════════════════════════════════════
   chat.js – AI assistant chat panel with streaming responses
   ═══════════════════════════════════════════════════════════════ */

const Chat = (() => {
  let history = [];  // {role, content}

  function init() {
    const input = document.getElementById("chat-input");
    const sendBtn = document.getElementById("btn-send-chat");

    sendBtn.addEventListener("click", send);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        send();
      }
    });
  }

  async function send() {
    const input = document.getElementById("chat-input");
    const text = input.value.trim();
    if (!text) return;
    input.value = "";

    // Add user message
    history.push({ role: "user", content: text });
    appendBubble("user", text);

    // Prepare streaming assistant bubble
    const bubble = appendBubble("assistant", "");
    const contentEl = bubble.querySelector(".msg-content");

    // Container for file-action badges (shown below explanation)
    const actionsEl = document.createElement("div");
    actionsEl.className = "file-actions";
    bubble.appendChild(actionsEl);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history,
          current_file: Editor.getActiveFilePath(),
        }),
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let full = "";
      let fileActions = [];
      let streamDone = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);

          if (data === "[DONE]") {
            streamDone = true;
            break;
          }

          // Real-time file action events from backend
          if (data.startsWith("[FILE_ACTION]")) {
            const action = JSON.parse(data.slice(13));
            fileActions.push(action);
            appendActionBadge(actionsEl, action);
            FileExplorer.refresh();  // real-time tree update
            continue;
          }

          // Normal text chunk – show cleaned version (strip action blocks)
          full += data;
          contentEl.innerHTML = renderMarkdown(stripActionBlocks(full));
        }
        scrollChat();
        if (streamDone) break;
      }

      // Final clean-up of displayed text
      const cleanText = stripActionBlocks(full);
      contentEl.innerHTML = renderMarkdown(cleanText);

      // Store only the clean explanation in history
      history.push({ role: "assistant", content: cleanText });

      // Auto-open the last created/edited file
      if (fileActions.length > 0) {
        const last = fileActions[fileActions.length - 1];
        if (last.action !== "delete_file" && last.action !== "create_folder") {
          Editor.openFile(last.path);
        }
      }
    } catch (err) {
      contentEl.textContent = `Error: ${err.message}`;
    }
  }

  /* ── Bubble rendering ───────────────────────────────────── */

  function appendBubble(role, text) {
    const container = document.getElementById("chat-messages");
    const div = document.createElement("div");
    div.className = `chat-msg ${role}`;

    const label = document.createElement("div");
    label.className = "small fw-bold mb-1";
    label.textContent = role === "user" ? "You" : "LocalPilot";
    label.style.color = role === "user" ? "#58a6ff" : "#3fb950";

    const content = document.createElement("div");
    content.className = "msg-content";
    content.innerHTML = renderMarkdown(text);

    div.appendChild(label);
    div.appendChild(content);
    container.appendChild(div);
    scrollChat();
    return div;
  }

  function scrollChat() {
    const el = document.getElementById("chat-messages");
    el.scrollTop = el.scrollHeight;
  }

  /* ── Strip ACTION blocks from displayed text ─────────────── */

  function stripActionBlocks(text) {
    if (!text) return "";
    // Remove full action blocks: ACTION...CONTENT...```
    let cleaned = text.replace(
      /ACTION:\s*(?:create_file|edit_file|delete_file|create_folder)\s*\nPATH:\s*.+?\s*\n(?:CONTENT:\s*\n```[\s\S]*?```\s*)?/g,
      ""
    );
    // Trim leftover blank lines
    cleaned = cleaned.replace(/\n{3,}/g, "\n\n").trim();
    return cleaned;
  }

  /* ── File-action badges ─────────────────────────────────── */

  function appendActionBadge(container, action) {
    const badge = document.createElement("div");
    badge.className = "file-action-badge";
    const icons = {
      create_file:   "bi-file-earmark-plus",
      edit_file:     "bi-pencil-square",
      delete_file:   "bi-trash",
      create_folder: "bi-folder-plus",
    };
    const labels = {
      create_file:   "Created",
      edit_file:     "Modified",
      delete_file:   "Deleted",
      create_folder: "Created folder",
    };
    const icon = icons[action.action] || "bi-file-earmark";
    const label = labels[action.action] || action.action;
    badge.innerHTML = `<i class="bi ${icon}"></i> ${label}: <strong>${action.path}</strong>`;

    // Clicking a badge opens the file
    if (action.action !== "delete_file" && action.action !== "create_folder") {
      badge.style.cursor = "pointer";
      badge.addEventListener("click", () => Editor.openFile(action.path));
    }
    container.appendChild(badge);
  }

  /* ── Minimal Markdown renderer ──────────────────────────── */

  function renderMarkdown(text) {
    if (!text) return "";
    let html = escapeHtml(text);

    // Code blocks: ```lang\n...\n```  (small inline snippets only)
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, _lang, code) => {
      return `<pre><code>${code}</code></pre>`;
    });
    // Inline code
    html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
    // Bold
    html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    // Newlines → <br>
    html = html.replace(/\n/g, "<br>");
    return html;
  }

  function escapeHtml(s) {
    return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  return { init };
})();
