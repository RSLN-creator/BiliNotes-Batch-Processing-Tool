# Phase 2: 核心处理 + 结果保存 - Context

**Gathered:** 2026-05-20
**Status:** Ready for planning

<domain>
## Phase Boundary

一键启动批量处理，自动生成笔记并归档。用户点击"开始"后，前端驱动逐个调用 BiliNote API 生成笔记，实时显示进度和彩色日志，完成后按收藏夹分目录输出（每个视频 3 个文件：.md / _原文.txt / _完整.json）。支持停止（完成当前任务后停）和断点续传（_已处理.json）。

</domain>

<decisions>
## Implementation Decisions

### 批量处理架构
- **D-01:** 前端驱动——JS 逐个调 POST /api/process-video，处理完一个再提交下一个
- **D-02:** 定时轮询——每 3 秒 fetch GET /api/task-status/{id} 更新进度和日志区

### 停止机制
- **D-03:** 完成当前任务后停止——不中断正在进行的 API 调用，当前处理完后前端检查标志位，不提交下一个

### 输出目录与文件组织
- **D-04:** 默认输出到 `./output/`，GUI 中提供输入框可自定义路径
- **D-05:** 文件命名模板 `{{bvid}} - {{title}}`，按收藏夹分子目录：`output/收藏夹名/视频名.md`
- **D-06:** `_已处理.json` 实时记录完成状态（task_id, status, time），启动时加载，已成功的自动跳过

### 进度与日志
- **D-07:** 前端轮询后端 task_status 获取进度；日志区实时滚动，彩色区分信息/成功/错误级别

### Claude's Discretion
- 具体 API 端点设计（/api/process-video, /api/task-status/{id}, /api/stop）
- 进度条 UI 样式和百分比计算
- 日志颜色映射（INFO/SUCCESS/ERROR/WARNING）
- `_已处理.json` 文件格式和去重逻辑
- 文件名安全处理（过滤非法字符、截断过长名称）
- 任务超时（15 分钟）和冷却间隔（3 秒）的实现

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 1 上下文
- `.planning/phases/01-gui/01-CONTEXT.md` — Phase 1 决策（D-01~D-06），Phase 2 必须兼容
- `app.py` — Phase 1 的 Flask 后端，需在其上扩展 API 端点
- `static/js/app.js` — Phase 1 的前端交互，需在其上添加批处理逻辑

### 需求文档
- `.planning/REQUIREMENTS.md` — Phase 2: UI-06~08, CORE-03~07, DATA-01~05

</canonical_refs>

<code_context>
## Existing Code Insights

### Phase 1 已实现的接口
- `GET /` — Flask 首页
- `POST /api/parse-file` — 文件解析
- `GET /api/providers` — BiliNote 供应商代理
- `GET /api/providers/<id>/models` — BiliNote 模型代理
- `GET /api/check-connection` — BiliNote 连通检测

### Phase 1 已有 DOM 元素
- `#banner` — 横幅（复用 D-06 黄色横幅）
- `#video-list` / `#video-count` — 视频列表（已有 status-badge 结构）
- `#provider-select` / `#model-select` / `#style-select` / `#prompt-input` — 配置区

### Phase 1 已有 JS 函数
- `state.videos` — 视频数据源
- `showBanner()` / `hideBanner()` — 横幅系统（复用）
- `escapeHtml()` — XSS 防护（复用）

</code_context>

<specifics>
## Specific Ideas

- 用户强调"逐个处理 + 定时轮询 + 实时记录进度"的简洁方案
- 前端驱动循环，无需后端线程或 SSE
- 进度信息实时持久化到 `_已处理.json`，支持崩溃恢复

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 02-core*
*Context gathered: 2026-05-20*
