# Phase 1: GUI 框架 + 数据加载 - Context

**Gathered:** 2026-05-20
**Status:** Ready for planning

<domain>
## Phase Boundary

搭建本地 Web GUI 外壳 + 数据加载能力。用户启动脚本后浏览器自动打开深色主题界面，可选择并加载 CSV/JSON 收藏文件，看到视频列表（BV 号 + 标题 + 收藏夹），通过 BiliNote API 获取并选择供应商/模型，配置笔记风格预设和自定义提示词。

</domain>

<decisions>
## Implementation Decisions

### 前端架构
- **D-01:** HTML/CSS/JS 拆分为独立文件（非全部内嵌在一个 HTML 中）
- **D-02:** 深色主题用原生 CSS 变量（`--bg`, `--text` 等）手写，零依赖
- **D-03:** JS 采用事件驱动 + DOM 操作模式，原生 JS 无框架

### BiliNote 连接策略
- **D-04:** 需要时才检测连接（用户点击加载文件或选择模型时再调 API），不阻塞启动和浏览器打开
- **D-05:** 供应商/模型列表首次获取后缓存在 JS 内存变量中，刷新页面后重新获取
- **D-06:** API 调用失败时在页面顶部显示黄色警告横幅，不弹窗打断操作

### Claude's Discretion
- Python 后端 HTTP 端点具体设计（路径、请求/响应格式）
- 文件选择在前端还是后端处理，CSV 列名映射策略
- 视频列表的 HTML 具体结构和 CSS 布局细节
- 静态文件（HTML/CSS/JS）的目录组织

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

No external specs — requirements fully captured in `.planning/REQUIREMENTS.md` (Phase 1: UI-01~05, CORE-01~02, EDGE-01~02) and decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

Greenfield project — no existing code. All code in this phase is new.

</code_context>

<specifics>
## Specific Ideas

- 用户强调"直接调 BiliNote REST API + 读取本地文件 + 按顺序显示进度"，保持简单直接
- 深色主题为默认且唯一主题

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-gui*
*Context gathered: 2026-05-20*
