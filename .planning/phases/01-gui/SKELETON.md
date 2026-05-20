# Walking Skeleton — BiliNote 批量收藏转写工具

**Phase:** 1
**Generated:** 2026-05-20

## Capability Proven End-to-End

用户可以启动应用程序，在浏览器中看到深色主题 GUI 页面，包含文件选择、配置区和视频列表等所有功能区的占位结构。

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| HTTP 服务器 | Flask 3.1.3 | 已预装，零额外依赖；内建路由和静态文件服务；REST API 方便扩展 |
| 前端方案 | 原生 HTML/CSS/JS | D-01/D-02/D-03 锁定：独立文件、CSS 变量、事件驱动 DOM 操作 |
| 深色主题 | CSS 自定义属性（变量） | D-02 锁定：零依赖，`--bg-primary` / `--text-primary` 等变量 |
| 文件解析 | Python 后端统一处理 | CSV 需要 Python `csv.DictReader`，比前端 JS 解析更可靠 |
| BiliNote API 访问 | Flask 代理模式 | 后端通过 `requests` 代理请求 BiliNote `localhost:3015`，避免 CORS 问题 |
| API 错误处理 | 前端黄色警告横幅 | D-06 锁定：不弹窗打断操作，页面顶部横幅提示 |
| 自动打开浏览器 | Python `webbrowser.open()` | 标准库，跨平台兼容 |
| 配置方式 | 环境变量（`BILINOTE_URL`, `GUI_PORT`） | `.env` 可选，默认值 `localhost:3015` / `8765` |
| 端口 | 8765 | EDGE-06 引用，避免与常见服务冲突 |
| 供应商/模型缓存 | JS 内存变量 `state.providers` / `state.models` | D-05 锁定：刷新页面后重新获取，不持久化 |

## Stack Touched in Phase 1

- [x] Project scaffold — Flask `app.py` + 目录结构 (`templates/`, `static/css/`, `static/js/`)
- [x] Routing — `/` 渲染 `index.html` (Plan 01)；`/api/parse-file`, `/api/providers`, `/api/providers/{id}/models`, `/api/check-connection` (Plans 02-03)
- [ ] File I/O — JSON/CSV 文件解析 via `POST /api/parse-file` (Plan 02)
- [x] UI — 深色主题 CSS + 原生 JS 事件驱动 DOM 操作 (Plans 01-03)
- [x] BiliNote API 代理 — providers/models 代理端点 (Plan 03)
- [ ] 错误处理 — 黄色横幅提示 BiliNote 不可达、供应商未配置 (Plan 03)
- [x] 本地运行 — `python app.py` 启动 :8765，浏览器自动打开

## Out of Scope (Deferred to Later Slices)

- Phase 2: 批量处理执行、进度条、日志、结果保存、断点续传
- Phase 3: 单视频失败恢复、停止按钮安全、端口冲突提示、空状态引导
- v2: 多文件合并、多平台支持、并发任务、Windows exe 打包、配置持久化、模板自定义

## Subsequent Slice Plan

- Plan 02 — 文件解析 + 视频列表展示 (UI-02, UI-03, CORE-01, CORE-02)
- Plan 03 — BiliNote 集成 + 配置区 (UI-04, UI-05, EDGE-01, EDGE-02)
- Phase 2 — 核心处理 + 结果保存
- Phase 3 — 边界处理 + 打磨
