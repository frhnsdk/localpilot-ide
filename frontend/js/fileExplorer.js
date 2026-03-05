/* ═══════════════════════════════════════════════════════════════
   fileExplorer.js – Recursive workspace tree in the sidebar
   ═══════════════════════════════════════════════════════════════ */

const FileExplorer = (() => {
  const API = "/api/files";
  let treeRoot = null;

  /* ── Public ─────────────────────────────────────────────── */

  function init() {
    treeRoot = document.getElementById("file-tree");
    document.getElementById("btn-refresh").addEventListener("click", refresh);
    document.getElementById("btn-new-file").addEventListener("click", promptNewFile);
    document.getElementById("btn-new-folder").addEventListener("click", promptNewFolder);
    refresh();
  }

  async function refresh() {
    treeRoot.innerHTML = "";
    await renderDir("", treeRoot, 0);
  }

  /* ── Rendering ──────────────────────────────────────────── */

  async function renderDir(path, container, depth) {
    const items = await api(`${API}/list?path=${encodeURIComponent(path)}`);
    for (const item of items) {
      const row = document.createElement("div");
      row.className = "tree-item";
      row.style.paddingLeft = `${8 + depth * 14}px`;

      if (item.type === "folder") {
        row.innerHTML = `<i class="bi bi-chevron-right"></i>
                         <i class="bi bi-folder-fill text-warning"></i>
                         <span>${item.name}</span>`;
        row.dataset.path = item.path;
        row.dataset.open = "false";

        const childContainer = document.createElement("div");
        childContainer.className = "tree-children";
        childContainer.style.display = "none";

        row.addEventListener("click", async (e) => {
          e.stopPropagation();
          const open = row.dataset.open === "true";
          if (open) {
            childContainer.style.display = "none";
            row.dataset.open = "false";
            row.querySelector(".bi-chevron-down")?.classList.replace("bi-chevron-down", "bi-chevron-right");
          } else {
            childContainer.innerHTML = "";
            await renderDir(item.path, childContainer, depth + 1);
            childContainer.style.display = "block";
            row.dataset.open = "true";
            row.querySelector(".bi-chevron-right")?.classList.replace("bi-chevron-right", "bi-chevron-down");
          }
        });

        // Right-click context menu
        row.addEventListener("contextmenu", (e) => {
          e.preventDefault();
          showContextMenu(e, item);
        });

        container.appendChild(row);
        container.appendChild(childContainer);
      } else {
        const icon = fileIcon(item.name);
        row.innerHTML = `<i class="${icon}"></i><span>${item.name}</span>`;
        row.dataset.path = item.path;
        row.addEventListener("click", () => Editor.openFile(item.path));
        row.addEventListener("contextmenu", (e) => {
          e.preventDefault();
          showContextMenu(e, item);
        });
        container.appendChild(row);
      }
    }
  }

  /* ── Context menu ───────────────────────────────────────── */

  function showContextMenu(e, item) {
    removeContextMenu();
    const menu = document.createElement("div");
    menu.className = "ctx-menu";
    menu.style.left = e.clientX + "px";
    menu.style.top = e.clientY + "px";

    const actions = [
      { label: "Delete", action: () => deleteItem(item) },
      { label: "Rename", action: () => renameItem(item) },
    ];
    if (item.type === "folder") {
      actions.unshift({ label: "New File Here…", action: () => promptNewFile(item.path) });
      actions.unshift({ label: "New Folder Here…", action: () => promptNewFolder(item.path) });
    }

    for (const a of actions) {
      const el = document.createElement("div");
      el.className = "ctx-menu-item";
      el.textContent = a.label;
      el.addEventListener("click", () => { removeContextMenu(); a.action(); });
      menu.appendChild(el);
    }

    document.body.appendChild(menu);
    document.addEventListener("click", removeContextMenu, { once: true });
  }

  function removeContextMenu() {
    document.querySelectorAll(".ctx-menu").forEach((m) => m.remove());
  }

  /* ── CRUD helpers ───────────────────────────────────────── */

  async function promptNewFile(parentPath) {
    const parent = typeof parentPath === "string" ? parentPath : "";
    const name = prompt("New file name:", "untitled.txt");
    if (!name) return;
    const path = parent ? `${parent}/${name}` : name;
    await apiPost(`${API}/create`, { path, content: "" });
    await refresh();
    Editor.openFile(path);
  }

  async function promptNewFolder(parentPath) {
    const parent = typeof parentPath === "string" ? parentPath : "";
    const name = prompt("New folder name:");
    if (!name) return;
    const path = parent ? `${parent}/${name}` : name;
    await apiPost(`${API}/create_folder`, { path });
    await refresh();
  }

  async function deleteItem(item) {
    if (!confirm(`Delete "${item.name}"?`)) return;
    await apiPost(`${API}/delete`, { path: item.path });
    Editor.closeFileIfOpen(item.path);
    await refresh();
  }

  async function renameItem(item) {
    const newName = prompt("New name:", item.name);
    if (!newName || newName === item.name) return;
    const parts = item.path.split("/");
    parts[parts.length - 1] = newName;
    const newPath = parts.join("/");
    await apiPost(`${API}/rename`, { old_path: item.path, new_path: newPath });
    await refresh();
  }

  /* ── File icon helper ───────────────────────────────────── */

  function fileIcon(name) {
    const ext = name.split(".").pop().toLowerCase();
    const map = {
      js: "bi bi-filetype-js text-warning",
      ts: "bi bi-filetype-tsx text-info",
      py: "bi bi-filetype-py text-success",
      html: "bi bi-filetype-html text-danger",
      css: "bi bi-filetype-css text-primary",
      json: "bi bi-filetype-json text-warning",
      md: "bi bi-filetype-md text-light",
      xml: "bi bi-filetype-xml text-secondary",
      svg: "bi bi-filetype-svg text-info",
      yml: "bi bi-filetype-yml text-info",
      yaml: "bi bi-filetype-yml text-info",
    };
    return map[ext] || "bi bi-file-earmark text-secondary";
  }

  /* ── Public API ─────────────────────────────────────────── */
  return { init, refresh };
})();
