# LocalPilot IDE

A **fully local** AI coding IDE that runs in your browser — powered by
[Ollama](https://ollama.com) and [Monaco Editor](https://microsoft.github.io/monaco-editor/)
(the same editor that powers VS Code).

```
┌──────────────────────────────────────────────────────────────┐
│  Browser  →  FastAPI backend  →  Ollama (Qwen2.5-Coder 7B)  │
│   :8000          :8000              :11434                   │
└──────────────────────────────────────────────────────────────┘
```

## Features

- **Three-panel IDE** — file explorer · Monaco code editor · AI chat
- **GitHub Copilot–style ghost text** — inline suggestions as you type
- **AI agent** — generates, edits, debugs, and explains code via chat
- **Project scaffolding** — ask the AI to create entire multi-file projects
- **File operations** — create / rename / delete files and folders
- **ZIP upload & download** — import existing projects and export results
- **Runs 100 % locally** — no data leaves your machine

## Experimental Status

This project is experimental. Initial success found - it works! Maybe larger models like 70b models will run perfectly.

## Demo

[![LocalPilot IDE Demo](https://img.youtube.com/vi/uOHrSOFp96I/maxresdefault.jpg)](https://youtu.be/uOHrSOFp96I)

Check out this demo video: [LocalPilot IDE Demo](https://youtu.be/uOHrSOFp96I)

## Quick Start

### With an NVIDIA GPU

```bash
docker compose up --build
```

### CPU only (no GPU)

```bash
docker compose -f docker-compose.yml -f docker-compose.cpu.yml up --build
```

Then open **http://localhost:8000** in your browser.

On first startup the Ollama container will pull the model (~4 GB).
You can check progress with:

```bash
docker exec -it localpilot-ollama ollama pull qwen2.5-coder:7b
```

## Project Structure

```
localpilot-ide/
├── docker-compose.yml          # GPU-enabled stack
├── docker-compose.cpu.yml      # CPU-only override
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── main.py                 # FastAPI entry point
│   ├── config.py               # Central configuration
│   ├── routers/
│   │   ├── files.py            # File CRUD + ZIP APIs
│   │   ├── chat.py             # AI chat (streaming + actions)
│   │   └── completion.py       # Inline code completion
│   └── services/
│       ├── file_service.py     # Filesystem operations
│       ├── ollama_service.py   # Ollama HTTP client
│       └── context.py          # Context-window builder
└── frontend/
    ├── index.html              # IDE shell
    ├── css/ide.css             # Dark-theme styles
    └── js/
        ├── app.js              # Boot + shared helpers
        ├── editor.js           # Monaco editor + tabs
        ├── fileExplorer.js     # Sidebar tree
        ├── chat.js             # AI chat panel
        └── completion.js       # Ghost-text completions
```

## Configuration

Environment variables (set in `docker-compose.yml`):

| Variable | Default | Description |
|---|---|---|
| `OLLAMA_BASE_URL` | `http://ollama:11434` | Ollama server URL |
| `OLLAMA_MODEL` | `qwen2.5-coder:7b` | Model to use |
| `WORKSPACE_DIR` | `/app/workspace` | Workspace mount path |

## License

MIT
