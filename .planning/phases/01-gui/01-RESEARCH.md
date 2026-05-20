# Phase 1: GUI 框架 + 数据加载 - Research

**Researched:** 2026-05-20
**Domain:** Python Web GUI (Flask) + Static Frontend + File Parsing + BiliNote API Integration
**Confidence:** HIGH

## Summary

Phase 1 搭建本地 Web GUI 外壳和数据加载能力。后端使用 Python Flask（已预装 3.1.3）提供静态文件服务和 REST API 端点，前端使用纯 HTML/CSS/JS 实现深色主题界面。核心功能包括：用户启动脚本后浏览器自动打开、通过 `<input type="file">` 选择并加载 JSON/CSV 收藏文件、从 BiliNote API（`localhost:3015`）自动获取供应商和模型列表、视频列表展示、风格预设和自定义提示词配置。

**Primary recommendation:** Flask 3.1.3 作为后端服务，前端采用原生 HTML/CSS/JS，文件解析由 Python 后端统一处理。

### 关键发现

1. Python 3.14 环境中 `Flask 3.1.3`、`requests 2.34.2`、`Werkzeug 3.1.8` 均已安装，零额外依赖即可启动
2. 前端 `<input type="file">` + `FileReader` 读取文件内容后 POST 到后端解析，比纯前端解析更统一可靠（尤其 CSV 需要 `csv` 模块）
3. BiliNote API 确切端点格式需假设验证（基于 REQUIREMENTS.md 推断：`GET /api/providers`, `GET /api/providers/{id}/models`）
4. Bilishelf CSV 列名需推断，建议采用灵活映射策略支持多种导出格式

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### 前端架构
- **D-01:** HTML/CSS/JS 拆分为独立文件（非全部内嵌在一个 HTML 中）
- **D-02:** 深色主题用原生 CSS 变量（`--bg`, `--text` 等）手写，零依赖
- **D-03:** JS 采用事件驱动 + DOM 操作模式，原生 JS 无框架

#### BiliNote 连接策略
- **D-04:** 需要时才检测连接（用户点击加载文件或选择模型时再调 API），不阻塞启动和浏览器打开
- **D-05:** 供应商/模型列表首次获取后缓存在 JS 内存变量中，刷新页面后重新获取
- **D-06:** API 调用失败时在页面顶部显示黄色警告横幅，不弹窗打断操作

### Claude's Discretion
- Python 后端 HTTP 端点具体设计（路径、请求/响应格式）
- 文件选择在前端还是后端处理，CSV 列名映射策略
- 视频列表的 HTML 具体结构和 CSS 布局细节
- 静态文件（HTML/CSS/JS）的目录组织

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UI-01 | 启动脚本后自动打开浏览器，展示深色主题网页 GUI | Flask `webbrowser.open()` + 启动模板方式已验证可行 |
| UI-02 | "选择收藏文件"按钮，弹出文件对话框，支持 .json 和 .csv | `<input type="file" accept=".json,.csv">` 标准方案 |
| UI-03 | 文件加载后展示视频列表（BV号、标题、所属收藏夹） | 后端解析后返回结构化 JSON，前端 DOM 渲染表格 |
| UI-04 | 供应商下拉从 BiliNote API 自动读取，联动加载模型 | Flask 代理 `/api/providers` 和 `/api/providers/{id}/models` |
| UI-05 | 笔记风格预设 + 自定义额外提示词输入 | 前端 `<select>` + `<textarea>` 组合 |
| CORE-01 | 解析 Bilishelf JSON 文件，提取 folders/videos | `json` 模块 + 已知嵌套结构解析 |
| CORE-02 | 解析 Bilishelf CSV 文件，提取 bvid/title/folders | `csv` 模块 + 列名映射配置 |
| EDGE-01 | BiliNote 不可达时提示"无法连接 BiliNote" | Flask 代理检测连接状态，前端黄色横幅显示 |
| EDGE-02 | 供应商未配置/无模型时提示用户先去 BiliNote 配置 | API 返回空列表时前端显示引导提示 |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 静态文件服务 | Backend (Python Flask) | -- | Flask `send_from_directory` 或模板渲染提供 HTML/CSS/JS |
| 文件选择交互 | Browser | -- | `<input type="file">` 浏览器原生对话框 |
| 文件解析 (JSON/CSV) | Backend (Python) | Browser (仅 JSON 可备选) | CSV 需要 Python `csv` 模块；JSON 双端均可但统一后端更一致 |
| 供应商/模型下拉内容 | Backend (Flask proxy) | Browser (渲染) | 后端作为代理访问 BiliNote `localhost:3015` |
| 连接检测 | Backend | Browser (显示横幅) | 后端检测 BiliNote 可达性，前端负责展示 |
| 深色主题 | Browser (CSS) | -- | 纯 CSS 变量作用域在浏览器端 |
| 浏览器自动打开 | Backend (Python) | -- | `webbrowser.open()` 在 Python 启动后调用 |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Flask | 3.1.3 | HTTP 服务器 + REST API + 静态文件服务 | **已预装**，零额外依赖；Werkzeug 3.1.8 同时已安装 |
| Python csv | stdlib | CSV 文件解析 | 标准库，Bilishelf CSV 导出解析 |
| Python json | stdlib | JSON 文件解析 | 标准库，Bilishelf JSON 导出解析 |
| Python requests | 2.34.2 | HTTP 客户端调用 BiliNote API | 已预装，同步调用简单可靠 |
| Python webbrowser | stdlib | 自动打开浏览器 | 标准库，`webbrowser.open('http://localhost:8765')` |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| python-dotenv | 1.2.2 | `.env` 配置 BiliNote URL、端口等 | 需要可配置参数时 |
| httpx | 0.28.1 | 异步 HTTP 客户端 | 已预装，后续 Phase 用于异步任务轮询 |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Flask | FastAPI + uvicorn | FastAPI 需额外安装 uvicorn（未安装）。Flask 已预装，零依赖 |
| Flask | Python http.server stdlib | `http.server` 不提供 REST API 路由功能，需自行实现路由分发 |
| Flask | Node.js http-server | 引入 Node 依赖链；本项目为 Python 工具，保持统一栈 |
| `<input type="file">` | Python tkinter.filedialog | 混合 GUI 模式；浏览器原生对话框用户体验更好 |
| 后端 CSV 解析 | 前端 JS CSV 解析 | JS 缺少标准 CSV 解析库；后端 `csv` 模块更可靠，列名映射更易维护 |

**Installation:**

Phase 1 不需要安装任何额外 Python 包。所有依赖均已预装。

```bash
# 验证预装依赖
python3 -c "import flask; print(flask.__version__)"        # 预期: 3.1.3
python3 -c "import requests; print(requests.__version__)"   # 预期: 2.34.2
python3 -c "import csv, json, webbrowser; print('OK')"     # 预期: OK
```

**Version verification:**
```bash
pip3 show Flask       # 3.1.3
pip3 show requests    # 2.34.2
pip3 show Werkzeug    # 3.1.8
```

## Architecture Patterns

### System Architecture Diagram

```
[User Browser]  <--HTTP-->  [Python Flask Server :8765]  <--HTTP-->  [BiliNote Docker :3015]
     |                            |                            |
     | HTML/CSS/JS                | /api/parse-file            | GET  /api/providers
     | (dark theme)               | /api/providers             | GET  /api/providers/{id}/models
     |                            | /api/check-connection       | POST /api/generate_note
     |                            |                            | GET  /api/task_status/{id}
     |                            |
     | 启动时: webbrowser.open()  |
     | 文件: <input type="file">  |
     | 数据: fetch() to backend   |
```

**数据流（主流程）：**
1. 用户启动 `python app.py` -> Flask 启动在 `:8765` -> `webbrowser.open('http://localhost:8765')`
2. 用户点"选择文件" -> `<input type="file">` 弹出系统对话框 -> 选择 .json/.csv
3. 前端 `FileReader` 读取文件内容 -> `POST /api/parse-file` 发送到后端
4. 后端解析 JSON/CSV -> 提取视频列表 -> 返回结构化 JSON
5. 前端渲染视频表格（BV号 + 标题 + 收藏夹）
6. 用户点击供应商下拉时 -> `GET /api/providers` -> Flask 代理请求 BiliNote -> 返回列表
7. 用户选择供应商 -> `GET /api/providers/{id}/models` -> 联级更新模型下拉
8. 若 BiliNote API 调用失败 -> 前端顶部显示黄色警告横幅

### Recommended Project Structure

```
bilinote-batch-tool/
├── app.py                    # Flask 应用入口（启动服务器 + 路由定义）
├── static/
│   ├── css/
│   │   └── style.css         # 深色主题 CSS 变量 + 布局样式
│   ├── js/
│   │   └── app.js            # 事件驱动 + DOM 操作主逻辑
│   └── favicon.ico           # （可选）浏览器标签图标
├── templates/
│   └── index.html            # 主页面 HTML 结构
├── .env                      # （可选）配置 BiliNote URL、端口等
└── .planning/                # 项目规划文件（不变）
```

**设计理由:**
- `templates/index.html` 由 Flask 的 `render_template()` 渲染，URL 路径为 `/`
- `static/css/style.css` 和 `static/js/app.js` 由 Flask 自动在 `/static/` 路径提供
- 符合 Flask 标准目录约定，无需额外配置

### Pattern 1: Event-Driven Frontend Architecture

**What:** 原生 JS 事件驱动模式，DOM 元素通过 `id` 或 `data-*` 属性关联事件处理函数

**When to use:** 所有前端交互，符合 D-03 决策

**Example:**

```javascript
// Source: [ASSUMED] Vanilla JS event-driven pattern per D-03 decision
document.addEventListener('DOMContentLoaded', () => {
  // 元素引用
  const $fileInput = document.getElementById('file-input');
  const $providerSelect = document.getElementById('provider-select');
  const $modelSelect = document.getElementById('model-select');
  const $videoList = document.getElementById('video-list');
  const $banner = document.getElementById('banner');

  // 事件绑定（事件驱动）
  $fileInput.addEventListener('change', onFileSelected);
  $providerSelect.addEventListener('change', onProviderChanged);
});

async function onFileSelected(event) {
  const file = event.target.files[0];
  if (!file) return;

  // 读取文件内容
  const text = await file.text();

  // 发送到后端解析
  const response = await fetch('/api/parse-file', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: text,
      filename: file.name,
      fileType: file.name.endsWith('.csv') ? 'csv' : 'json'
    })
  });

  if (!response.ok) {
    showBanner('文件解析失败：' + (await response.text()), 'error');
    return;
  }

  const data = await response.json();
  renderVideoList(data.videos);
}
```

### Anti-Patterns to Avoid
- **前端解析 CSV：** JS 缺少标准 CSV 解析库，列名映射复杂，易出错。始终发送到后端用 Python `csv.DictReader` 处理
- **每次操作都调 BiliNote API：** 供应商/模型列表应缓存到 JS 变量，只在刷新页面后重新获取（D-05）
- **启动即检测连接：** 遵循 D-04，不阻塞启动流程，用户需要用到 BiliNote 数据时才检测

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP 服务器 | socket 编程实现 HTTP | Flask 3.1.3 | 路由、静态文件、错误处理全部内置 |
| CSV 解析 | 手工按行 split | Python csv.DictReader | 转义、引号、逗号内换行等边缘情况 |
| 浏览器自动打开 | -- | Python webbrowser.open() | 标准库，跨平台兼容 |
| 深色主题 CSS | -- | CSS 自定义属性 (变量) | D-02 限定零依赖，CSS 变量足够 |

**Key insight:** Phase 1 天然零新依赖项。Flask, requests, webbrowser, csv, json 全部已经安装或内置。不要因为"方便"引入额外包。

## Common Pitfalls

### Pitfall 1: Bilishelf CSV 列名不确定
**What goes wrong:** 假设的 CSV 列名（如 `bvid`、`title`）与实际导出格式不匹配导致解析失败
**Why it happens:** Bilishelf 可能更新导出格式，或用户使用的版本不同
**How to avoid:** 设计灵活的列名映射。第一行检测列名，支持别名映射（如 `bvid` / `bvid` / `BV号`）。解析失败时返回明确的错误信息告诉用户哪些列缺失
**Warning signs:** 文件选择后视频列表为空；后端日志显示 KeyError

### Pitfall 2: Flask 开发服务器重启时端口占用
**What goes wrong:** 多次启动脚本（如 IDE 重新运行）导致 `Address already in use`
**Why it happens:** 前一个 Flask 进程未完全退出
**How to avoid:** 默认端口 8765（EDGE-06），启动时检测端口占用并给出清晰提示
**Warning signs:** 启动脚本后浏览器打开空白页或显示连接失败

### Pitfall 3: BiliNote API 端点未知
**What goes wrong:** 假设的 API 路径（如 `/api/providers`）实际不可用
**Why it happens:** 无法在 Research 阶段访问 BiliNote 实例验证端点
**How to avoid:** 将 BiliNote API 调用封装为可配置函数，端点路径作为常量放在文件顶部，方便用户调整
**Warning signs:** 选择供应商时下拉为空或 API 返回 404

### Pitfall 4: Windows 路径兼容性
**What goes wrong:** `\` 路径分隔符在 JSON 序列化或 URL 中出错
**Why it happens:** 此工具运行在 Windows 11，但 Python 和 HTTP 协议使用 POSIX 路径约定
**How to avoid:** 所有文件路径操作使用 `pathlib.Path`，输出路径使用 `/` 或 `os.path.join()` 确保兼容
**Warning signs:** 文件保存失败、路径包含 `\\`

## Code Examples

### 1. Flask 应用骨架（app.py）

```python
from flask import Flask, render_template, jsonify, request
import webbrowser
import json
import csv
import io
import requests
import os
import sys
from threading import Timer

app = Flask(__name__)

# BiliNote 配置（可通过 .env 或环境变量覆盖）
BILINOTE_BASE_URL = os.getenv('BILINOTE_URL', 'http://localhost:3015')
GUI_PORT = int(os.getenv('GUI_PORT', '8765'))


def open_browser():
    """延迟 1 秒打开浏览器，确保服务器已启动"""
    webbrowser.open(f'http://localhost:{GUI_PORT}')


# ========= 页面路由 =========

@app.route('/')
def index():
    return render_template('index.html')


# ========= API 路由 =========

@app.route('/api/parse-file', methods=['POST'])
def parse_file():
    """解析上传的 JSON 或 CSV 文件，返回视频列表"""
    data = request.get_json()
    content = data.get('content', '')
    filename = data.get('filename', '')
    file_type = data.get('fileType', '')

    try:
        if file_type == 'json':
            videos = parse_bilishelf_json(content)
        elif file_type == 'csv':
            videos = parse_bilishelf_csv(content)
        else:
            return jsonify({'error': '不支持的文件类型'}), 400

        return jsonify({'videos': videos, 'total': len(videos)})
    except Exception as e:
        return jsonify({'error': str(e)}), 400


def parse_bilishelf_json(content):
    """解析 Bilishelf JSON 格式"""
    data = json.loads(content)
    videos = []

    # Bilishelf JSON 结构：{ "folders": [{ "title": "...", "videos": [...] }] }
    folders = data.get('folders', [])
    for folder in folders:
        folder_name = folder.get('title', '未命名收藏夹')
        for video in folder.get('videos', []):
            videos.append({
                'bvid': video.get('bvid', ''),
                'title': video.get('title', ''),
                'url': video.get('url', ''),
                'folder': folder_name
            })

    return videos


def parse_bilishelf_csv(content):
    """解析 Bilishelf CSV 格式，支持灵活的列名映射"""
    reader = csv.DictReader(io.StringIO(content))
    videos = []
    # 兼容多种可能的列名
    COLUMN_MAP = {
        'bvid': ['bvid', 'bvid', 'BV号', 'BV', 'avid', 'aid'],
        'title': ['title', '标题', '视频标题', 'name'],
        'folder': ['folder', 'folders', '收藏夹', 'folder_title', 'folder_name'],
        'url': ['url', '链接', 'video_url', 'page_url'],
    }

    for row in reader:
        video = {}
        for target, aliases in COLUMN_MAP.items():
            for alias in aliases:
                if alias in row and row[alias].strip():
                    video[target] = row[alias].strip()
                    break
            if target not in video:
                video[target] = ''
        videos.append(video)

    return videos


@app.route('/api/providers')
def get_providers():
    """代理获取 BiliNote 供应商列表"""
    try:
        resp = requests.get(f'{BILINOTE_BASE_URL}/api/providers', timeout=5)
        resp.raise_for_status()
        data = resp.json()
        return jsonify({'connected': True, 'providers': data})
    except requests.RequestException:
        return jsonify({
            'connected': False,
            'providers': [],
            'error': '无法连接 BiliNote 服务'
        })


@app.route('/api/providers/<provider_id>/models')
def get_models(provider_id):
    """代理获取指定供应商的模型列表"""
    try:
        resp = requests.get(
            f'{BILINOTE_BASE_URL}/api/providers/{provider_id}/models',
            timeout=5
        )
        resp.raise_for_status()
        data = resp.json()
        return jsonify({'connected': True, 'models': data})
    except requests.RequestException:
        return jsonify({
            'connected': False,
            'models': [],
            'error': '无法连接 BiliNote 服务'
        })


@app.route('/api/check-connection')
def check_connection():
    """检查 BiliNote 服务连接状态"""
    try:
        resp = requests.get(f'{BILINOTE_BASE_URL}/api/providers', timeout=3)
        return jsonify({'connected': resp.ok})
    except requests.RequestException:
        return jsonify({'connected': False})


# ========= 启动入口 =========

if __name__ == '__main__':
    # 延迟打开浏览器
    Timer(1, open_browser).start()
    print(f'[*] BiliNote Batch Tool 启动中...')
    print(f'[*] 访问 http://localhost:{GUI_PORT}')
    print(f'[*] BiliNote: {BILINOTE_BASE_URL}')
    app.run(host='127.0.0.1', port=GUI_PORT, debug=False)
```

### 2. CSS 深色主题变量（style.css）

```css
/* Source: [CITED: D-02 decision from CONTEXT.md — hand-written CSS variables] */

:root {
  --bg-primary: #1a1b1e;
  --bg-secondary: #25262b;
  --bg-tertiary: #2c2e33;
  --text-primary: #c1c2c5;
  --text-secondary: #909296;
  --text-muted: #5c5f66;
  --border: #373a40;
  --accent: #4c6ef5;
  --accent-hover: #3b5bdb;
  --success: #40c057;
  --warning: #fab005;
  --warning-bg: #3d3100;
  --error: #fa5252;
  --error-bg: #3d1111;
  --font-mono: 'Consolas', 'Courier New', monospace;
  --radius: 6px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  background: var(--bg-primary);
  color: var(--text-primary);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  line-height: 1.6;
  min-height: 100vh;
}
```

### 3. 前端 HTML 结构（index.html）

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BiliNote 批量收藏转写</title>
  <link rel="stylesheet" href="/static/css/style.css">
</head>
<body>
  <!-- 警告横幅 -->
  <div id="banner" class="banner hidden"></div>

  <!-- 主容器 -->
  <div class="container">
    <!-- 顶部：标题 + 文件选择 -->
    <header class="header">
      <h1>BiliNote 批量收藏转写</h1>
      <div class="file-section">
        <button id="select-file-btn" class="btn btn-primary">选择收藏文件</button>
        <input type="file" id="file-input" accept=".json,.csv" hidden>
        <span id="file-name" class="file-name"></span>
      </div>
    </header>

    <!-- 配置区：供应商 + 模型 + 风格 -->
    <section class="config-section">
      <div class="config-row">
        <div class="config-group">
          <label for="provider-select">供应商</label>
          <select id="provider-select">
            <option value="">-- 请先选择供应商 --</option>
          </select>
        </div>
        <div class="config-group">
          <label for="model-select">模型</label>
          <select id="model-select" disabled>
            <option value="">-- 请先选择供应商 --</option>
          </select>
        </div>
      </div>
      <div class="config-row">
        <div class="config-group">
          <label for="style-select">笔记风格</label>
          <select id="style-select">
            <option value="detailed">详细笔记</option>
            <option value="summary">简洁摘要</option>
            <option value="mindmap">思维导图式</option>
            <option value="study">学习笔记</option>
            <option value="technical">技术文档</option>
          </select>
        </div>
        <div class="config-group">
          <label for="prompt-input">额外提示词（可选）</label>
          <textarea id="prompt-input" rows="2" placeholder="输入额外的提示词或要求..."></textarea>
        </div>
      </div>
    </section>

    <!-- 视频列表 -->
    <section class="video-section">
      <div class="video-header">
        <h2>视频列表</h2>
        <span id="video-count" class="video-count">共 0 个视频</span>
      </div>
      <div id="video-list" class="video-list">
        <div class="empty-state">请先选择收藏文件</div>
      </div>
    </section>
  </div>

  <script src="/static/js/app.js"></script>
</body>
</html>
```

### 4. JS DOM 操作模式（app.js）

```javascript
// Source: [ASSUMED] Event-driven vanilla JS pattern per D-03

// === 状态 ===
const state = {
  videos: [],           // 当前加载的视频列表
  providers: [],        // 缓存的供应商列表
  models: [],           // 缓存的模型列表
  selectedFile: null,   // 当前选择的文件
};

// === DOM 引用 ===
const $ = (id) => document.getElementById(id);
const fileInput = $('file-input');
const selectFileBtn = $('select-file-btn');
const fileName = $('file-name');
const providerSelect = $('provider-select');
const modelSelect = $('model-select');
const videoList = $('video-list');
const videoCount = $('video-count');
const banner = $('banner');

// === 事件绑定 ===

selectFileBtn.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  state.selectedFile = file;
  fileName.textContent = file.name;
  await loadFile(file);
});

providerSelect.addEventListener('change', async () => {
  const providerId = providerSelect.value;
  modelSelect.disabled = !providerId;
  modelSelect.innerHTML = '<option value="">加载中...</option>';
  if (providerId) await loadModels(providerId);
});

// === 核心函数 ===

async function loadFile(file) {
  try {
    const text = await file.text();
    const fileType = file.name.endsWith('.csv') ? 'csv' : 'json';

    const resp = await fetch('/api/parse-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: text, filename: file.name, fileType })
    });

    if (!resp.ok) {
      const err = await resp.text();
      showBanner('文件解析失败：' + err, 'error');
      return;
    }

    const data = await resp.json();
    state.videos = data.videos;
    renderVideoList(data.videos);
    hideBanner();
  } catch (err) {
    showBanner('文件读取失败：' + err.message, 'error');
  }

  // 加载文件后顺便检测 BiliNote 连接（D-04: 需要时检测）
  await loadProviders();
}

async function loadProviders() {
  try {
    const resp = await fetch('/api/providers');
    const data = await resp.json();

    if (!data.connected) {
      showBanner('无法连接 BiliNote，请确认服务已启动', 'warning');
      providerSelect.innerHTML = '<option value="">BiliNote 未连接</option>';
      return;
    }

    hideBanner();
    state.providers = data.providers;

    if (data.providers.length === 0) {
      showBanner('BiliNote 中未配置供应商，请先在 BiliNote 中添加', 'warning');
      providerSelect.innerHTML = '<option value="">暂无供应商</option>';
      return;
    }

    providerSelect.innerHTML = '<option value="">-- 选择供应商 --</option>'
      + data.providers.map(p =>
          `<option value="${p.id}">${p.name}</option>`
        ).join('');
  } catch (err) {
    showBanner('无法连接 BiliNote：' + err.message, 'warning');
  }
}

function renderVideoList(videos) {
  if (videos.length === 0) {
    videoList.innerHTML = '<div class="empty-state">文件中未找到视频数据</div>';
    videoCount.textContent = '共 0 个视频';
    return;
  }

  videoCount.textContent = `共 ${videos.length} 个视频`;

  // 按收藏夹分组渲染
  const grouped = {};
  for (const v of videos) {
    const folder = v.folder || '未分类';
    if (!grouped[folder]) grouped[folder] = [];
    grouped[folder].push(v);
  }

  let html = '';
  for (const [folder, fvideos] of Object.entries(grouped)) {
    html += `<div class="folder-group">
      <h3 class="folder-title">${escapeHtml(folder)} (${fvideos.length})</h3>
      <table class="video-table">
        <thead><tr>
          <th>BV号</th><th>标题</th><th>状态</th>
        </tr></thead>
        <tbody>`;
    for (const v of fvideos) {
      html += `<tr>
        <td class="bvid">${escapeHtml(v.bvid)}</td>
        <td>${escapeHtml(v.title)}</td>
        <td><span class="status-badge status-pending">待处理</span></td>
      </tr>`;
    }
    html += `</tbody></table></div>`;
  }
  videoList.innerHTML = html;
}

// === UI 辅助 ===

function showBanner(message, type = 'warning') {
  banner.textContent = message;
  banner.className = `banner banner-${type}`;
}

function hideBanner() {
  banner.className = 'banner hidden';
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Python http.server | Flask 3.1.3 | 本版本 | Flask 已预装且提供 REST API 路由；`http.server` 需手工路由分法 |
| tkinter/PyQt GUI | Web GUI | 项目启动时 | 用户选择 Web GUI（开发快，UI 灵活，深色主题好看） |

**Deprecated/outdated:**
- Python 内置 `http.server`：可用于静态文件，但无 API 路由功能，需手工实现
- Flask 开发服务器（`app.run()`）：生产环境需 WSGI 服务器，但本项目仅 localhost 使用，开发服务器足够

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | BiliNote API 端点格式：`GET /api/providers` 返回供应商列表，`GET /api/providers/{id}/models` 返回模型列表 | Standard Stack, Code Examples | 端点路径不同需调整；API 认证方式不同需补充 |
| A2 | Bilishelf JSON 结构为 `{ "folders": [{ "title": "...", "videos": [...] }] }` | Code Examples | 嵌套结构不同需调整解析逻辑 |
| A3 | Bilishelf CSV 可能包含列 `bvid`, `title`, `folder`/`folders` 等字段 | Code Examples | 列名不同需修改 COLUMN_MAP；可先用用户提供的 CSV 样本验证 |
| A4 | CSS 变量深色主题方案足以覆盖所有 UI 样式需求 | Standard Stack | 复杂组件（表格、下拉）可能需要超出变量的样式调整，但不影响架构 |
| A5 | `POST /api/generate_note` 接受 `video_url`, `platform`, `quality`, `model_name`, `provider_id`, `style`, `extras` 参数 | REQUIREMENTS.md 引用 | Phase 2 实际调用时需验证参数名称和格式 |

**If this table is empty:** n/a

## Open Questions

1. **BiliNote API 确切端点是什么？**
   - What we know: BiliNote 运行在 `localhost:3015`，有 REST API。REQUIREMENTS.md 中提及 `POST /api/generate_note` 和 `GET /api/task_status/{task_id}`
   - What's unclear: 供应商和模型列表的准确端点路径和返回格式（假设为 `GET /api/providers`）
   - Recommendation: 实现时端点路径以常量形式放在文件顶部，用户运行 `app.py` 后可访问 `/api/providers` 实际测试；若 404，用户可编辑常量调整

2. **Bilishelf CSV 实测列名是什么？**
   - What we know: Bilishelf 导出 CSV 和 JSON 两种格式
   - What's unclear: CSV 的准确列名和分隔符
   - Recommendation: 实现时采用前 1 行检测 + 别名映射策略；Phase 1 实施后使用用户实际导出的 CSV 文件验证并固化映射

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Python 3.x | 全部 | yes | 3.14 | -- |
| Flask | HTTP 服务 + API | yes | 3.1.3 | Python http.server（需要手动实现路由） |
| requests | BiliNote API 调用 | yes | 2.34.2 | urllib3/httpx 均已安装 |
| csv, json, webbrowser | 文件解析 + 浏览器打开 | yes (stdlib) | -- | -- |
| BiliNote Docker | 供应商/模型数据 | 外部依赖 | -- | -- |
| Node.js | 本阶段不需要 | yes (v24.14.1) | -- | Phase 1 不使用 |

**Missing dependencies with no fallback:**
- BiliNote Docker 服务 (localhost:3015) -- 用户需自行启动；未启动时 GUI 可正常打开但显示连接失败横幅（EDGE-01）

**Missing dependencies with fallback:** None

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | localhost only, single user |
| V3 Session Management | no | no sessions needed |
| V4 Access Control | no | single user tool |
| V5 Input Validation | yes | 文件解析时验证 JSON/CSV 格式合法性，防止异常输入导致崩溃 |
| V6 Cryptography | no | 全 localhost，不传输敏感数据 |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| 超大文件 OOM | Denial of Service | 在 `POST /api/parse-file` 中对文件内容长度限制（默认 50MB） |
| 路径遍历 | Tampering | 输出路径拼接前验证文件名（`pathlib.Path.resolve().relative_to()`），Phase 2 实施 |

## Sources

### Primary (HIGH confidence)
- **Context**: `.planning/phases/01-gui/01-CONTEXT.md` -- Locked decisions D-01 through D-06
- **Requirements**: `.planning/REQUIREMENTS.md` -- UI-01~05, CORE-01~02, EDGE-01~02
- **Environment**: `pip3 list` 确认 Flask 3.1.3, requests 2.34.2, Werkzeug 3.1.8, httpx 0.28.1, tqdm 4.67.3 已安装
- **Python stdlib**: `csv`, `json`, `webbrowser`, `pathlib` -- 标准库，无需安装

### MEDIUM confidence
- BiliNote API 端点格式基于 REQUIREMENTS.md 推断
- Bilishelf JSON/CSV 导出结构基于常见实践推断
- `POST /api/generate_note` 参数名称基于 REQUIREMENTS.md CORE-04 引用

### LOW confidence
- BiliNote provider/model API 确切路径和返回格式 -- 未能在研究阶段访问实例验证

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- 所有包已预装，版本确认
- Architecture: HIGH -- Flask + vanilla JS 是成熟的本地工具模式
- Pitfalls: MEDIUM -- BiliNote API 端点和 CSV 列名尚未实际验证

**Research date:** 2026-05-20
**Valid until:** 2026-06-20 (Flask/Python 稳定栈)
