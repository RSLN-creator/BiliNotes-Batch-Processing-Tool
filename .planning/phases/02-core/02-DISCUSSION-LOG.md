# Phase 2: 核心处理 + 结果保存 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.

**Date:** 2026-05-20
**Phase:** 02-core
**Areas discussed:** 批量处理架构, 进度/日志实时更新, 停止机制, 输出目录与文件组织

---

## 批量处理架构

| Option | Description | Selected |
|--------|-------------|----------|
| 前端驱动 | JS 逐个调 POST /api/process-video，轮询 task_status | ✓ |
| 后端线程 | Python 后台线程跑循环 | |

**User's choice:** 前端驱动

---

## 进度/日志实时更新

| Option | Description | Selected |
|--------|-------------|----------|
| 定时轮询 | 每 3 秒 fetch 后端 task_status | ✓ |
| SSE 推送 | Server-Sent Events 推送 | |

**User's choice:** 定时轮询

---

## 停止机制

| Option | Description | Selected |
|--------|-------------|----------|
| 完成当前后停止 | 不中断正在进行的调用，当前完成后不再提交下一个 | ✓ |
| 立即硬停止 | 强制终止 | |

**User's choice:** 完成当前任务后停止

---

## 输出目录与文件组织

| Option | Description | Selected |
|--------|-------------|----------|
| 默认目录 + 可自定义 | ./output/ 默认，GUI 提供输入框 | ✓ |
| 每次选择 | 每次弹窗选目录 | |

**User's choice:** 默认目录 + 可自定义

---

## 文件命名

| Option | Description | Selected |
|--------|-------------|----------|
| {{bvid}} - {{title}} | BV号 + 标题 | ✓ |
| {{title}} | 仅标题 | |
| {{bvid}} | 仅 BV 号 | |

**User's choice:** `{{bvid}} - {{title}}`

---

## Claude's Discretion

- 具体 API 端点设计
- 进度条 UI 样式
- 日志颜色映射
- _已处理.json 格式
- 文件名安全处理
- 任务超时和冷却间隔
