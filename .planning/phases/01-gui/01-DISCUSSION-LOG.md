# Phase 1: GUI 框架 + 数据加载 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-20
**Phase:** 01-gui
**Areas discussed:** 前端架构, BiliNote 连接策略

---

## 前端架构

### HTML/CSS/JS 组织方式

| Option | Description | Selected |
|--------|-------------|----------|
| 全部内嵌在一个 HTML 文件 | 所有代码写在一个 .html 的 `<style>` 和 `<script>` 中 | |
| 拆分为独立 CSS/JS 文件 | HTML/CSS/JS 各自独立文件 | ✓ |

**User's choice:** 拆分为独立 CSS/JS 文件

### CSS 方案

| Option | Description | Selected |
|--------|-------------|----------|
| 原生 CSS 变量 + 手写 | CSS 自定义属性定义深色主题，零依赖 | ✓ |
| 轻量 CSS 框架 | Picocss 或 MVP.css | |
| 你决定 | Claude 选最合适的 | |

**User's choice:** 原生 CSS 变量 + 手写深色主题

### JS 交互模式

| Option | Description | Selected |
|--------|-------------|----------|
| 事件驱动 + DOM 操作 | 按需监听用户操作，直接操作 DOM | ✓ |
| 简单状态对象 + 渲染函数 | 维护 state 对象，变化时调 render() | |
| 你决定 | Claude 选最合适的 | |

**User's choice:** 事件驱动 + DOM 操作

---

## BiliNote 连接策略

### 连接检测时机

| Option | Description | Selected |
|--------|-------------|----------|
| 页面加载时检测 | 打开页面即调 API | |
| 需要时才检测 | 用户操作时才调 API | ✓ |
| 启动脚本时检测 | Python 启动后先 ping | |

**User's choice:** 需要时才检测

### 缓存策略

| Option | Description | Selected |
|--------|-------------|----------|
| 内存缓存 | JS 变量缓存，刷新后重新获取 | ✓ |
| 不缓存 | 每次调 API 获取最新 | |

**User's choice:** 内存缓存

### 错误提示

| Option | Description | Selected |
|--------|-------------|----------|
| 下拉框内提示 | 红色占位文字 | |
| 页面顶部横幅 | 黄色警告横幅 | ✓ |

**User's choice:** 页面顶部横幅

---

## Claude's Discretion

- Python 后端 HTTP 端点具体设计
- 文件选择在前端还是后端处理
- CSV 列名映射策略
- 视频列表 HTML 结构和 CSS 布局细节
- 静态文件目录组织

## Deferred Ideas

None
