# Phase 2: 核心处理 + 结果保存 - Research

**Researched:** 2026-05-20
**Domain:** 批量视频处理流水线、前端驱动异步任务循环、文件输出与断点续传
**Confidence:** HIGH

## Summary

Phase 2 在 Phase 1 的 Flask + 原生 JS 架构上，添加一条"前端驱动"的批量处理流水线：前端 JavaScript 逐个调用 `POST /api/process-video`，经 Flask 后端代理到 BiliNote 的 `POST /api/generate_note`，然后每 3 秒轮询 `GET /api/task-status/{id}` 直到任务完成。完成后由后端自动将结果保存为 3 个文件（.md / _原文.txt / _完整.json），并按收藏夹分子目录。`_已处理.json` 文件提供断点续传能力——启动时加载，已成功的视频自动跳过。

**不需要安装任何新 Python 或 JS 包。** 所有功能均使用 Flask（已有）、requests（已有）、Python 标准库（json、pathlib、re、time）。前端保持原生 JavaScript，无框架依赖。

**架构风险：** BiliNote 的 `POST /api/generate_note` 和 `GET /api/task_status/{id}` 的精确参数名和返回字段名尚未在运行实例上验证（基于 REQUIREMENTS.md 推断）。后端代理应做防御性序列化（`.get()` 默认值 + 日志警告）以避免完全静默失败。

**技术决策：** 采用"后端代理 + 前端驱动"模式——后端不维护任务队列或线程，仅做 API 代理和文件持久化。前端通过简单的 `for` 循环 + `setInterval` 驱动流水线，天然规避了后端线程的竞态和内存泄漏问题。

**补充说明:** 评估了是否需要 SSE 推送方案。结论是 3 秒定时轮询（D-02）对此场景足够: 笔记生成任务典型耗时 30 秒至 5 分钟，3 秒轮询的开销可忽略，且轮询比 SSE 更简单可靠（无需持久连接、无断连重连逻辑）。

**Primary recommendation:** 零新依赖、前端驱动异步循环、后端只在轮询到 SUCCESS 时写文件。

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: 前端驱动——JS 逐个调 POST /api/process-video，处理完一个再提交下一个
- D-02: 定时轮询——每 3 秒 fetch GET /api/task-status/{id} 更新进度和日志区
- D-03: 完成当前任务后停止——不中断正在进行的 API 调用，当前处理完后前端检查标志位，不提交下一个
- D-04: 默认输出到 `./output/`，GUI 中提供输入框可自定义路径
- D-05: 文件命名模板 `{{bvid}} - {{title}}`，按收藏夹分子目录：`output/收藏夹名/视频名.md`
- D-06: `_已处理.json` 实时记录完成状态（task_id, status, time），启动时加载，已成功的自动跳过
- D-07: 前端轮询后端 task_status 获取进度；日志区实时滚动，彩色区分信息/成功/错误级别

### Claude's Discretion
- 具体 API 端点设计（/api/process-video, /api/task-status/{id}, /api/stop）
- 进度条 UI 样式和百分比计算
- 日志颜色映射（INFO/SUCCESS/ERROR/WARNING）
- `_已处理.json` 文件格式和去重逻辑
- 文件名安全处理（过滤非法字符、截断过长名称）
- 任务超时（15 分钟）和冷却间隔（3 秒）的实现

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UI-06 | 进度条 + 统计数字（总数/成功/失败/跳过/当前）+ 预计剩余时间 | 前端新增进度区域 DOM + JS 状态更新；每轮询一次更新 stats |
| UI-07 | 实时日志区，彩色区分信息/成功/错误 | 前端新增 `<div id="log-area">`，`addLog(msg, level)` 函数 + CSS 颜色类 |
| UI-08 | 「开始批量处理」和「停止」按钮，运行中开始按钮禁用 | 配置区新增 2 个按钮，`state.running` 标志控制禁用状态 |
| CORE-03 | 按收藏夹原始顺序逐个调用 `POST /api/generate_note` 提交视频 | 后端 `/api/process-video` 代理到 BiliNote；前端 `startBatch()` 循环驱动 |
| CORE-04 | 提交参数包含：video_url, platform="bilibili", quality="medium", model_name, provider_id, style, extras | 后端透传前端提交的参数，合并默认值 |
| CORE-05 | 轮询 `GET /api/task_status/{task_id}` 直到 SUCCESS/FAILED，每 5 秒一次 | 注意 CONTEXT.md D-02 决策为 3 秒（非 5 秒）。后端 `/api/task-status/{id}` 代理 |
| CORE-06 | 成功后自动提取 result.markdown 和 result.transcript.full_text 保存到文件 | 后端 `/api/task-status/{id}` 中首次检测到 SUCCESS 时触发 `save_video_output()` |
| CORE-07 | 任务间冷却 3 秒，单个任务最长等待 15 分钟后超时 | 前端 `pollTaskStatus(taskId, 900000)` 超时后 reject；`await sleep(3000)` 冷却 |
| DATA-01 | `_已处理.json` 记录已处理 BV 号（task_id, status, time），启动时加载 | 后端 `load_checkpoint()` 在模块加载时执行；`update_checkpoint()` 在 SUCCESS 后调用 |
| DATA-02 | 已成功处理的视频自动跳过（断点续传） | 前端 `isAlreadyProcessed(bvid)` 检查 `state.processedBvids` |
| DATA-03 | 输出按收藏夹名称分子目录：`输出目录/收藏夹名/视频名.md` | 后端 `pathlib.Path(output_dir) / folder_name / filename` |
| DATA-04 | 每个视频生成 3 个文件：.md（Markdown）、_原文.txt（字幕全文）、_完整.json（API 完整返回） | 后端 `save_video_output()` 写 3 个文件 |
| DATA-05 | 文件名安全处理（过滤 `\/:*?"<>|` 等非法字符，截断过长标题） | `sanitize_filename(title)` 函数：`re.sub(r'[\\/:*?"<>|]', '_', title)` + 截断 |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 提交视频到 BiliNote | API (Flask 后端) | — | 后端代理 BiliNote HTTP 调用；浏览器不能直接调用 localhost:3015（跨域） |
| 轮询任务状态 | API (Flask 后端) | Browser (JS 前端) | 后端代理 BiliNote 状态查询；前端用 setInterval 驱动定时逻辑 |
| 文件保存 | API (Flask 后端) | — | 后端有文件系统写权限；浏览器无权限 |
| 断点续传（_已处理.json） | API (Flask 后端) | Browser (JS 前端) | 后端负责持久化读写；前端在启动时加载并用于跳过逻辑 |
| 进度展示 | Browser (JS 前端) | — | DOM 更新是浏览器职责 |
| 日志展示 | Browser (JS 前端) | — | DOM 操作是浏览器职责 |
| 处理循环控制 | Browser (JS 前端) | — | D-01 指定前端驱动 |
| 停止标志 | Browser (JS 前端) | — | D-03 前端标志位 |
| 输出路径管理 | API (Flask 后端) | — | 后端使用 pathlib 创建目录 |

**关键洞察:** 这是"瘦后端、胖前端"模式。后端仅做 API 代理和文件 IO，所有流程控制（循环、暂停、停止、跳过、超时）都在浏览器 JS 中。这种架构简化了后端（无线程、无队列、无状态管理），但要求前端处理所有边缘情况（超时、错误恢复、停止响应）。

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Flask | 3.1.x | HTTP API 路由 | 已验证已安装，Phase 1 核心框架 |
| requests | 2.34.x | BiliNote HTTP 客户端 | 已验证已安装，Phase 1 已有 |

### Python Standard Library
| Module | Purpose |
|--------|---------|
| `json` | _已处理.json 读写、API 响应解析 |
| `pathlib.Path` | 输出目录创建与文件路径操作 |
| `re` | 文件名非法字符过滤 (DATA-05) |
| `time` | 时间戳生成 |
| `os` | 环境变量读取（BILINOTE_URL, OUTPUT_DIR） |

### Frontend (零依赖)
| Module | Purpose |
|--------|---------|
| Vanilla JS (ES6+) | 批量循环、轮询、DOM 更新 |
| CSS variables | 进度条、日志彩色级别、状态标签 |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| 前端驱动 | 后端 Python threading | 后端线程需处理竞态和优雅停止；前端驱动更简单且 D-01 已锁定 |
| 3 秒轮询 | SSE 推送 | SSE 需后端持久连接和连接管理，复杂度增加；轮询更简单可靠且 3 秒间隔开销可忽略 |
| 原生 JS | React/Vue | 单页无框架更简单，现有 Phase 1 已用原生 JS；D-04 已延续此模式 |

**安装：** 零新依赖。所有功能使用 Phase 1 已安装的包和 Python 标准库。

## Package Legitimacy Audit

**本阶段不安装任何外部包。** 所有功能使用：
- Phase 1 已安装的 Flask 3.1.x 和 requests 2.34.x
- Python 标准库（json, pathlib, re, time, os）
- 前端 vanilla JS（无 npm 包）

无需运行 slopcheck 或 registry 验证。

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│ Browser (前端 JS)                                                    │
│                                                                     │
│  startBatch()                                                       │
│    ├─ load checkpoint ─────────────────────┐                        │
│    │                                       │                        │
│    ▼                                       ▼                        │
│  for each video ───► isProcessed? ──YES──► skip + log               │
│                          │                                          │
│                         NO                                          │
│                          ▼                                          │
│  POST /api/process-video ──────────┐                                │
│    ◄── { task_id }                 │                                │
│                          │         │                                │
│  pollTaskStatus(task_id) │         │                                │
│    ┌─ setInterval 3s ───┤         │                                │
│    │  GET /api/task-status/{id}    │                                │
│    │    ◄── { status, result }     │                                │
│    │                              │                                 │
│    │  status === SUCCESS ──► log "完成" + updateProgress()          │
│    │  status === FAILED  ──► log "失败" + updateProgress()          │
│    │  timeout > 15min   ──► reject + log "超时"                     │
│    │                                                               │
│    ▼                                                               │
│  sleep(3000) ──► next iteration                                    │
│                                                                     │
│  [Stop clicked] state.running = false; loop breaks after current    │
└──────────┬─────────────────────────────────────┬───────────────────┘
           │ POST /api/process-video              │ GET /api/task-status/{id}
           ▼                                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Flask 后端 (app.py)                                                 │
│                                                                     │
│  POST /api/process-video                                            │
│    └─ requests.post(BILINOTE_URL/api/generate_note, json=params)    │
│    └─ return { task_id }                                            │
│                                                                     │
│  GET /api/task-status/<id>                                          │
│    └─ requests.get(BILINOTE_URL/api/task_status/{id})               │
│    └─ if SUCCESS && not saved:                                      │
│         ├─ save_video_output()  →  3 files                          │
│         ├─ update_checkpoint()  →  _已处理.json                      │
│         └─ mark saved                                               │
│    └─ return { status, result, file_paths? }                        │
│                                                                     │
│  load_checkpoint()  (module init)                                    │
│    └─ read _已处理.json → set processed_bvids                       │
└──────────┬─────────────────────────────────────┬───────────────────┘
           │ HTTP                                │ HTTP
           ▼                                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│ BiliNote Docker (localhost:3015)                                    │
│                                                                     │
│  POST /api/generate_note ──► 异步任务开始                             │
│  GET  /api/task_status/{id}  ──► { status, result: { markdown,     │
│                                          transcript: { full_text }} │
└─────────────────────────────────────────────────────────────────────┘

输出文件系统:
┌─────────────────────────────────────────────┐
│ ./output/ (或自定义路径)                       │
│ ├── _已处理.json                              │
│ ├── 收藏夹A/                                 │
│ │   ├── BV1xx - 标题1.md                     │
│ │   ├── BV1xx - 标题1_原文.txt               │
│ │   ├── BV1xx - 标题1_完整.json              │
│ │   └── BV2yy - 标题2.md                     │
│ └── 收藏夹B/                                 │
│     └── ...                                  │
└─────────────────────────────────────────────┘
```

### Recommended Project Structure (Phase 2 additions)

```
app.py (extend — add routes + file utilities)
templates/
  index.html (extend — add progress/log buttons/DOM)
static/
  css/
    style.css (extend — add progress/log/status styles)
  js/
    app.js (extend — add batch processing loop + polling + UI)
```

**坚持单文件原则** — 后端保持单一 `app.py`，前端保持单一 `app.js`。不引入子模块或类，保持"工具脚本"的简洁性。

### Pattern 1: 前端驱动异步任务循环

**What:** 浏览器 JS 用 for 循环逐个提交视频到后端，对每个任务启动 3 秒定时轮询直到完成，然后处理下一个。包含冷却和超时。

**When to use:** 这是 D-01 锁定的模式。前端驱动消除了后端线程/队列的复杂度。

**Source:** Context7 not available for vanilla JS patterns; pattern derived from CONTEXT.md D-01/D-02/D-07 and standard async polling practices.

```javascript
// 前端驱动循环核心
async function startBatch() {
    state.running = true;
    updateButtons();
    addLog("批量处理开始", "info");

    const videos = state.videos;
    for (let i = 0; i < videos.length; i++) {
        if (!state.running) break; // D-03: 停止标志

        const video = videos[i];
        if (state.processedBvids.has(video.bvid)) {
            addLog(`跳过已处理: ${escapeHtml(video.title)}`, "skip");
            state.skipped++;
            updateProgress(i);
            continue;
        }

        state.currentIndex = i;
        addLog(`[${i + 1}/${videos.length}] ${escapeHtml(video.title)}`, "info");

        try {
            const taskId = await submitVideo(video);
            const result = await pollTaskStatus(taskId, 900000); // 15 min timeout
            if (result.status === "SUCCESS") {
                addLog(`完成: ${escapeHtml(video.title)}`, "success");
                state.success++;
            } else {
                addLog(`失败: ${escapeHtml(video.title)}`, "error");
                state.failed++;
            }
        } catch (err) {
            addLog(`超时/错误: ${escapeHtml(video.title)} — ${err.message}`, "error");
            state.failed++;
        }

        updateProgress(i);
        if (i < videos.length - 1 && state.running) {
            await sleep(3000); // CORE-07: 任务间冷却
        }
    }

    state.running = false;
    updateButtons();
    addLog("批量处理结束", "info");
}
```

### Pattern 2: 后端代理 + 延迟文件保存

**What:** Flask 端点 `/api/task-status/<id>` 在返回状态时检查是否首次检测到 SUCCESS。如果是则触发文件保存和 checkpoint 更新。

**When to use:** 这是默认模式。将文件保存绑定到状态轮询端点是"前端驱动"架构的自然延伸——后端不做主动推送，只在被查询时执行副作用。

```python
@app.route("/api/task-status/<task_id>")
def task_status(task_id):
    try:
        resp = requests.get(f"{BILINOTE_BASE_URL}/api/task_status/{task_id}", timeout=5)
        resp.raise_for_status()
        data = resp.json()
    except requests.RequestException as e:
        return jsonify({"status": "UNKNOWN", "error": str(e)}), 502

    status = data.get("status", "UNKNOWN")
    result = data.get("result") or {}

    # 首次检测到 SUCCESS 时保存文件
    if status == "SUCCESS" and task_id not in _completed_tasks:
        _completed_tasks.add(task_id)
        bvid = _task_map.get(task_id, {}).get("bvid", "")
        title = _task_map.get(task_id, {}).get("title", "")
        folder = _task_map.get(task_id, {}).get("folder", "未分类")
        try:
            file_paths = save_video_output(folder, bvid, title, result)
            update_checkpoint(bvid, "SUCCESS", task_id)
            data["files"] = file_paths
        except Exception as e:
            app.logger.error(f"保存文件失败: {e}")
            data["file_error"] = str(e)

    return jsonify(data)
```

### Pattern 3: 防御性文件名安全处理

**What:** 对 B 站视频标题（可能含特殊字符）进行净化，确保生成合法文件名。

**When to use:** 每次从 `result.markdown` 或 `result.transcript.full_text` 写文件前必须调用。

```python
import re

def sanitize_filename(name: str, max_length: int = 120) -> str:
    """过滤非法字符并截断。输入: B站视频标题, 输出: 安全文件名"""
    # 过滤 Windows 文件名非法字符
    safe = re.sub(r'[\\/:*?"<>|]', '_', name)
    # 去除首尾空白和点
    safe = safe.strip('. ')
    # 截断（保留扩展名空间）
    if len(safe) > max_length:
        safe = safe[:max_length].rstrip('_ ')
    return safe or "untitled"
```

### Anti-Patterns to Avoid
- **后端线程跑循环:** 违背 D-01（前端驱动）。如果后端同时跑循环和前端提交，会导致重复提交或状态混乱。坚持纯前端驱动。
- **`_已处理.json` 在写时没有原子性:** 多个文件同时写可能导致 JSON 损坏。但前端驱动一次只处理一个任务，不存在并发，所以无需 `threading.Lock`。如果未来支持并发，需改为每任务独立文件再合并。
- **ES模块或打包工具:** 单文件工具脚本用 `<script>` 直接加载即可。不需要 Webpack/Vite。
- **后端缓存任务映射在内存中不持久化:** `_task_map` 重启后丢失。这是预期的（重启后重新选择文件和启动），但实现时需注意不要在内存中积累泄漏。

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP API 服务器 | Python http.server 路由分发 | Flask `@app.route()` | 已有，Phase 1 已验证 |
| HTTP 请求 | urllib 手动构建 | `requests` 库 | 已有，处理超时/重试/JSON 序列化更简洁 |
| 文件路径操作 | 字符串拼接 | `pathlib.Path` | `Path / "subdir" / "file.md"` 跨平台安全 |

**本阶段无新依赖需求。** 所有问题场景已有标准解决方案。

## Common Pitfalls

### Pitfall 1: BiliNote API 返回格式未验证

**What goes wrong:** `POST /api/generate_note` 和 `GET /api/task_status/{id}` 的实际请求/响应字段名可能与 REQUIREMENTS.md 中假设的不同。如果 `result.markdown` 或 `result.transcript.full_text` 字段不存在，文件保存逻辑会静默写出空文件。

**Why it happens:** BiliNote 是外部 Docker 服务，其 API 文档/源码不在本项目中。研究阶段无法访问实际实例进行验证。

**How to avoid:** [ASSUMED] 后端代理端点使用 `.get("markdown", "")` 而不是 `["markdown"]`；对缺失字段记录 `app.logger.warning()`；首次 SUCCESS 后在前端日志显示文件大小供用户验证。如果字段名错误，用户会看到空文件或小文件。实施阶段应包含一个手动验证 checkpoint。

**Warning signs:** 前端显示"完成"但 `_原文.txt` 或 `.md` 文件内容为空或极小。

### Pitfall 2: Windows MAX_PATH 限制 (260 字符)

**What goes wrong:** 嵌套路径 `output/收藏夹名/BVID - 长标题_原文.txt` 在 Windows 上容易超过 260 字符。操作系统拒绝创建文件，`save_video_output()` 抛出 `OSError`。

**Why it happens:** Windows 默认路径长度限制为 260 字符（`MAX_PATH`）。中文收藏夹名（3 字节/字符 UTF-8 编码）、长标题（B 站视频标题可达 80+ 字符）、BVID（12 字符）+ 分隔符很容易叠加。

**How to avoid:** [CITED: docs.python.org/3/library/pathlib.html] `pathlib.Path` 本身不解决 MAX_PATH。需要以下组合策略：
1. `sanitize_filename()` 将标题截断到 80 字符（保留给目录名和文件后缀的空间）
2. 如果输出目录很深，考虑在失败时回退到 `\\\\?\\` 前缀（但需要绝对路径）
3. 或者在 `save_video_output()` 中 `try/except OSError` 并回退到 `bvid-only` 文件名

**Warning signs:** 处理到长标题视频时日志出现 `OSError: [Errno 2] No such file or directory` 或 `[Errno 22] Invalid argument`。

### Pitfall 3: 停止后立即重启导致重复提交

**What goes wrong:** 用户点击"停止"，当前任务完成后 `state.running = false`。但如果在最后一个轮询回调途中点击"开始"，两个 `startBatch()` 实例可能并行运行。

**Why it happens:** `startBatch()` 是 `async` 函数。JS 的 `async/await` 不会阻止新调用。如果在停止标志设置的微妙间隔中点击"开始"，两个循环共享 `state.videos` 和 `state.currentIndex`。

**How to avoid:** 在 `startBatch()` 入口处检查 `if (state.running) return;`。并且在"停止"按钮逻辑中不要重复设置 `state.running = false` 如果已经 false。简单标志守卫即可。

**Warning signs:** 前端日志出现"处理中"消息重叠。

### Pitfall 4: 前端 `setInterval` 在轮询未清理时泄漏

**What goes wrong:** `pollTaskStatus()` 中的 `setInterval` 在任务超时后如果没有被 `clearInterval()`，会继续调用后端 API，产生僵尸轮询。

**Why it happens:** 超时路径中如果忘记调用 `clearInterval(interval)`，定时器持续运行。

**How to avoid:** [CITED: MDN setInterval] 在 Promise 的 `resolve`、`reject` 和超时三条路径中都必须调用 `clearInterval()`。使用 `finally` 块确保清理：

```javascript
return new Promise((resolve, reject) => {
    const interval = setInterval(async () => {
        if (Date.now() - startTime > timeout) {
            clearInterval(interval);
            return reject(new Error("超时"));
        }
        try {
            const res = await fetch(`/api/task-status/${taskId}`);
            const data = await res.json();
            if (data.status === "SUCCESS" || data.status === "FAILED") {
                clearInterval(interval);
                resolve(data);
            }
        } catch (err) {
            clearInterval(interval);
            reject(err);
        }
    }, 3000);
});
```

### Pitfall 5: 首次回写入 `_已处理.json` 时目录不存在

**What goes wrong:** `_已处理.json` 默认在 `./output/` 下，但如果用户指定的自定义输出目录在首次处理前不存在，且尚未创建，则 `open(output_dir / "_已处理.json", "w")` 会失败。

**Why it happens:** `_已处理.json` 在文件加载时就尝试读取（加载 checkpoint），但写入只在第一个任务完成时发生。如果输出目录之前不存在，写入目录会在 `save_video_output()` 中被 `Path.mkdir(parents=True, exist_ok=True)` 创建，但 `update_checkpoint()` 可能在之前调用。

**How to avoid:** `update_checkpoint()` 中确保父目录存在：`checkpoint_path.parent.mkdir(parents=True, exist_ok=True)`。

### Pitfall 6: JSON 文件非原子写入可能导致崩溃时损坏

**What goes wrong:** 如果写入 `_已处理.json` 过程中程序崩溃，文件可能包含不完整的 JSON，下次启动时 `json.load()` 抛出异常。

**Why it happens:** `json.dump()` + `open("w")` 不是原子操作。大数据量时写入需要时间。

**How to avoid:** [CITED: docs.python.org/3/library/json.html] 写入时使用临时文件 + 重命名策略：先写 `.tmp`，再 `os.replace()` 覆盖原文件。简单方案：在 `load_checkpoint()` 中处理 `json.JSONDecodeError`，如果损坏则从头开始（丢失 checkpoint 但程序不崩溃）。

### Pitfall 7: 自定义输出路径的 `..` 路径穿越

**What goes wrong:** 如果用户输入 `../../malicious` 作为输出路径，理论上可以写出到项目目录之外。

**Why it happens:** 用户输入直接传递给 `Path(output_dir)`。

**How to avoid:** 虽然本项目是单用户本地工具，风险极低，但做基础防护：`Path(output_dir).resolve()` 确保路径合理。或者文档中说明"输出目录相对于项目根目录"。

## Code Examples

### 后端: `/api/process-video` 和 `/api/task-status/<id>`

```python
# 添加到 app.py

# ── 内存状态 ──────────────────────────────────────────────
_task_map = {}  # task_id -> { bvid, title, folder, style, ... }
_completed_tasks = set()  # 已保存文件的 task_id（防重复写入）
OUTPUT_DIR = Path(os.getenv("OUTPUT_DIR", "./output"))
CHECKPOINT_FILE = "_已处理.json"

# ── 处理端点 ──────────────────────────────────────────────

@app.route("/api/process-video", methods=["POST"])
def process_video():
    """提交一个视频到 BiliNote 生成笔记"""
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "无效的请求数据"}), 400

    bvid = data.get("bvid", "")
    title = data.get("title", "")
    folder = data.get("folder", "未分类")

    params = {
        "video_url": data.get("url", f"https://www.bilibili.com/video/{bvid}"),
        "platform": "bilibili",
        "quality": "medium",
        "model_name": data.get("model_name", ""),
        "provider_id": data.get("provider_id", ""),
        "style": data.get("style", "detailed"),
        "extras": data.get("extras", ""),
    }

    try:
        resp = requests.post(
            f"{BILINOTE_BASE_URL}/api/generate_note",
            json=params,
            timeout=10,
        )
        resp.raise_for_status()
        task_data = resp.json()
        task_id = task_data.get("task_id", "")
    except requests.RequestException as e:
        return jsonify({"error": f"提交到 BiliNote 失败: {e}"}), 502

    # 缓存上下文供后续文件保存使用
    _task_map[task_id] = {"bvid": bvid, "title": title, "folder": folder}
    return jsonify({"task_id": task_id})


@app.route("/api/task-status/<task_id>")
def task_status(task_id):
    """查询 BiliNote 任务状态，SUCCESS 时写文件"""
    try:
        resp = requests.get(
            f"{BILINOTE_BASE_URL}/api/task_status/{task_id}", timeout=5
        )
        resp.raise_for_status()
        data = resp.json()
    except requests.RequestException as e:
        return jsonify({"status": "UNKNOWN", "error": str(e)}), 502

    status = data.get("status", "UNKNOWN")
    result = data.get("result") or {}

    # 仅在首次检测到 SUCCESS 时保存文件
    if status == "SUCCESS" and task_id not in _completed_tasks:
        _completed_tasks.add(task_id)
        ctx = _task_map.get(task_id, {})
        try:
            file_paths = save_video_output(
                folder_name=ctx.get("folder", "未分类"),
                bvid=ctx.get("bvid", ""),
                title=ctx.get("title", ""),
                result=result,
                output_dir=Path(request.args.get("output_dir", OUTPUT_DIR)),
            )
            update_checkpoint(ctx.get("bvid", ""), "SUCCESS", task_id)
            data["files"] = file_paths
        except Exception as e:
            app.logger.error(f"保存文件失败: {e}", exc_info=True)
            data["file_error"] = str(e)

    return jsonify(data)
```

### 后端: 文件保存和 checkpoint 工具函数

```python
# ── 文件名安全处理 ────────────────────────────────────────

def sanitize_filename(name: str, max_len: int = 80) -> str:
    """DATA-05: 过滤 \\/:*?"<>| 等非法字符，去除首尾空白和点，截断过长名称"""
    safe = re.sub(r'[\\/:*?"<>|]', '_', name)
    safe = safe.strip('. ')
    if len(safe) > max_len:
        safe = safe[:max_len].rstrip('_ ')
    return safe or "untitled"


# ── 文件保存 ──────────────────────────────────────────────

def save_video_output(folder_name: str, bvid: str, title: str,
                       result: dict, output_dir: Path = OUTPUT_DIR) -> dict:
    """DATA-03/04: 按收藏夹分目录，保存 3 个文件"""
    safe_title = sanitize_filename(title)
    safe_folder = sanitize_filename(folder_name, max_len=60)
    base_name = f"{bvid} - {safe_title}"

    video_dir = output_dir / safe_folder
    video_dir.mkdir(parents=True, exist_ok=True)

    md_content = result.get("markdown", "") or ""
    transcript = result.get("transcript", {}) or {}
    full_text = transcript.get("full_text", "") or ""
    raw_json = json.dumps(result, ensure_ascii=False, indent=2)

    paths = {}
    paths["md"] = str(video_dir / f"{base_name}.md")
    paths["txt"] = str(video_dir / f"{base_name}_原文.txt")
    paths["json"] = str(video_dir / f"{base_name}_完整.json")

    (video_dir / f"{base_name}.md").write_text(md_content, encoding="utf-8")
    (video_dir / f"{base_name}_原文.txt").write_text(full_text, encoding="utf-8")
    (video_dir / f"{base_name}_完整.json").write_text(raw_json, encoding="utf-8")

    return paths


# ── Checkpoint 管理 ─────────────────────────────────────

def load_checkpoint(output_dir: Path = OUTPUT_DIR) -> dict:
    """DATA-01: 加载 _已处理.json，返回 { bvid: { task_id, status, time } }"""
    path = output_dir / CHECKPOINT_FILE
    if not path.exists():
        return {}
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        app.logger.warning(f"checkpoint 文件损坏，从头开始: {path}")
        return {}


def update_checkpoint(bvid: str, status: str, task_id: str,
                      output_dir: Path = OUTPUT_DIR):
    """DATA-01: 追加一条完成记录到 _已处理.json"""
    path = output_dir / CHECKPOINT_FILE
    path.parent.mkdir(parents=True, exist_ok=True)

    records = load_checkpoint(output_dir)
    records[bvid] = {
        "task_id": task_id,
        "status": status,
        "time": time.strftime("%Y-%m-%dT%H:%M:%S"),
    }

    # 使用临时文件 + 重命名避免写入损坏
    tmp = path.with_suffix(".tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False, indent=2)
    os.replace(str(tmp), str(path))  # Windows 上 os.replace 是原子的


# ── 模块初始化 ──────────────────────────────────────────
_processed_bvids = set()
_checkpoint_data = load_checkpoint()
for bvid, info in _checkpoint_data.items():
    if info.get("status") == "SUCCESS":
        _processed_bvids.add(bvid)
```

### 前端: 批量处理入口和按钮绑定

```javascript
// 添加到 app.js state 对象
const state = {
    videos: [],
    selectedFile: null,
    providers: [],
    models: [],
    // --- Phase 2 新增 ---
    running: false,
    stopRequested: false,
    processedBvids: new Set(),
    currentIndex: 0,
    stats: { total: 0, success: 0, failed: 0, skipped: 0 },
    outputDir: './output',
};

// 新 DOM 引用
let startBtn, stopBtn, progressBar, progressText, logArea;
let totalSpan, successSpan, failedSpan, skippedSpan, currentSpan;
let outputDirInput;

// 在 DOMContentLoaded 中初始化
startBtn = $("start-btn");
stopBtn = $("stop-btn");
progressBar = $("progress-bar");
progressText = $("progress-text");
logArea = $("log-area");
totalSpan = $("stat-total");
successSpan = $("stat-success");
failedSpan = $("stat-failed");
skippedSpan = $("stat-skipped");
currentSpan = $("stat-current");
outputDirInput = $("output-dir");

startBtn.addEventListener("click", startBatch);
stopBtn.addEventListener("click", stopBatch);

// 加载 checkpoint（在文件加载后调用）
async function loadCheckpoint() {
    // 不需要调后端——checkpoint 在后端管理
    // 前端只需要在启动时读 state.videos 的 bvid
    // 实际跳过逻辑在后端 process-video 也可做，但前端跳过可以省一次 API 调用
    // 更简单：启动时调 GET /api/checkpoint 获取已处理的 bvid 集合
    try {
        const res = await fetch("/api/checkpoint");
        const data = await res.json();
        state.processedBvids = new Set(data.processed || []);
    } catch {
        state.processedBvids = new Set();
    }
}

// 在后端添加:
// @app.route("/api/checkpoint")
// def get_checkpoint():
//     return jsonify({"processed": list(_processed_bvids)})
```

## Runtime State Inventory

> 此阶段为新增功能阶段（非重命名/重构/迁移），跳过运行时状态盘点。

**Trigger check:** Phase 2 is greenfield feature addition (not rename/refactor/migration). Category not applicable.

## Open Questions

1. **BiliNote API 字段名验证**
   - What we know: REQUIREMENTS.md 假设 `POST /api/generate_note` 参数为 video_url, platform, quality, model_name, provider_id, style, extras；返回包含 task_id。`GET /api/task_status/{id}` 返回包含 status, result.markdown, result.transcript.full_text。
   - What's unclear: 实际 BiliNote API 的精确字段名、嵌套结构、大小写。
   - Recommendation: [ASSUMED] Planner 应添加一个 checkpoint 任务：在 Phase 2 实施时先手动测试真实 BiliNote 实例的 API 返回格式，然后调整假设的字段映射。时间段：< 10 分钟。

2. **输出目录是否为相对 `app.py` 路径？**
   - What we know: D-04 默认 `./output/`，前端输入框可自定义。代码中 `OUTPUT_DIR = Path(os.getenv("OUTPUT_DIR", "./output"))`。
   - What's unclear: 自定义路径应该相对于工作目录还是绝对路径？如果是相对路径，是相对于 `app.py` 的位置还是启动目录？
   - Recommendation: 用 `Path(output_dir).resolve()` 解析为绝对路径。前端输入框支持绝对路径和相对路径两种。如果相对则相对于 `os.getcwd()`（即启动 `python app.py` 的目录）。

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python 3.x | 全部 | yes | 3.14.4 | -- |
| Flask | HTTP 服务 + API | yes | 3.1.x | -- (Phase 1 已验证) |
| requests | BiliNote API 调用 | yes | 2.34.x | -- (Phase 1 已验证) |
| re, json, pathlib, time, os | 文件操作 + 字符串处理 | yes (stdlib) | -- | -- |
| BiliNote Docker | 笔记生成 | 外部依赖 | -- | -- |

**Missing dependencies with no fallback:**
- BiliNote Docker 服务 (localhost:3015) — 用户需自行启动；未启动时处理所有视频会失败（显示在日志中）。Phase 1 已有连接检测横幅。

**Missing dependencies with fallback:** 无。

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | localhost only, single user |
| V3 Session Management | no | no sessions needed |
| V4 Access Control | no | single user tool |
| V5 Input Validation | yes | 输出路径自定义输入框应验证；BiliNote API 返回的 JSON 使用 `.get()` 防御性访问；文件名过滤非法字符 |
| V6 Cryptography | no | 全 localhost，不传输敏感数据 |

### Known Threat Patterns for {Flask + vanilla JS}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| 路径穿越 (Path Traversal) | Tampering | 自定义输出路径使用 `Path.resolve()` 确保预期位置；文件名经过 `sanitize_filename()` 过滤非法字符和路径分隔符 |
| JSON 注入 (JSON Injection) | Tampering | BiliNote 返回的 markdown/transcript 内容直接写入文件，不执行内容。无注入风险 |

**Phase 2 不涉及：** 用户认证、会话管理、加密、网络传输安全。全部操作在 localhost 上。

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | BiliNote API `POST /api/generate_note` 接受参数 `video_url, platform, quality, model_name, provider_id, style, extras` | Standard Stack, Architecture Patterns, Code Examples | 字段名不同需在实施时调整；后端代理用 `.get()` 和参数映射封装一层隔离 |
| A2 | BiliNote API `GET /api/task_status/{id}` 返回 `{ status, result: { markdown, transcript: { full_text } } }` | Architecture Patterns, Code Examples | 字段名/嵌套不同则文件保存逻辑静默失败（写空文件）。需实施时验证 |
| A3 | BiliNote API `POST /api/generate_note` 接受 `provider_id` 和 `model_name` 而非 `provider` 和 `model` | Code Examples | 参数名不同导致 BiliNote 忽略值，使用默认模型。需实施时验证 |
| A4 | 文件名截断到 80 个中文字符（~240 UTF-8 字节）足够避免 Windows MAX_PATH 问题 | Common Pitfalls | 极端文件名仍可能超 260 字符；实施时需在 `save_video_output()` 中添加 `try/except OSError` 回退到 bvid-only 文件名 |
| A5 | `_已处理.json` 的格式为 `{ bvid: { task_id, status, time } }` 是可行的 | Common Pitfalls, Code Examples | 格式错误不影响程序可用性（`json.JSONDecodeError` 被捕获后从头开始） |
| A6 | `os.replace()` 在 Windows 上是原子操作 | Code Examples | 在某些 Windows 配置（不同文件系统？）上可能失败；实施时确认兼容性 |

**本阶段所有 claims 均为 ASSUMED** — 无 Context7 或官方文档可用，所有推断基于 REQUIREMENTS.md 和标准实践。

## Sources

### Primary (HIGH confidence)
- CONTEXT.md `02-CONTEXT.md` — Locked decisions D-01 through D-07, Claude's Discretion
- REQUIREMENTS.md — All requirement specs for UI-06~08, CORE-03~07, DATA-01~05
- `app.py` — Existing Phase 1 Flask code to extend
- `static/js/app.js` — Existing Phase 1 frontend code to extend
- `static/css/style.css` — Existing CSS variables and themes to extend

### MEDIUM confidence
- Phase 1 research `01-RESEARCH.md` — BiliNote API assumptions inherited from Phase 1

### LOW confidence
- BiliNote API actual field names and response structure — not verified against running instance

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — 零新依赖，所有工具已在 Phase 1 验证
- Architecture: HIGH — 前端驱动 + 定时轮询是成熟模式，D-01/D-02 已锁定
- Pitfalls: MEDIUM — 主要风险是 BiliNote API 字段名未验证和 Windows MAX_PATH
- Code examples: MEDIUM — 基于 REQUIREMENTS.md 推断的字段名需要实施时验证

**Research date:** 2026-05-20
**Valid until:** 2026-06-20 (Flask/Python/stdlib 稳定，BiliNote API 需实施时验证)
