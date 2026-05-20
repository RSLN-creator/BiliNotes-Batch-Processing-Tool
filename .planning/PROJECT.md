# BiliNote 批量收藏转写工具

## What This Is

一个 Python 桌面 GUI 工具，读取 Bilishelf 浏览器插件导出的 B 站收藏夹数据（CSV/JSON），自动调用本地 BiliNote Docker 服务的 API，逐个生成 AI 视频笔记，保存到指定文件夹。

## Core Value

**一键将整个 B 站收藏夹批量转为结构化笔记。** 用户只需导出收藏数据、选文件、点开始，无需手动逐个粘贴链接。

## Context

### User
个人开发者，运维自己的 BiliNote 实例（Docker GPU 版），已配置好 LLM 供应商和模型。

### Problem
- BiliNote 只支持单视频提交，没有批量接口
- Bilishelf 导出的收藏数据有几十上百个视频，手动逐个处理不可行
- 需要一个自动化工具串联"收藏数据读取 → 笔记生成 → 结果归档"

### Constraints
- 运行环境：Windows 11, Python 3.11+
- 依赖：BiliNote Docker 服务运行在 `localhost:3015`
- 无外部网络依赖（除 BiliNote API）
- 单用户、本地使用，不考虑多用户/权限

### Current State
- BiliNote 已在 Docker 中正常运行（GPU 版，含 CUDA 转写）
- Bilishelf 可导出 CSV 和 JSON 两种格式
- 已有一个命令行原型脚本

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] **UI-01**: 网页 GUI，本地 HTTP 服务 + 浏览器访问
- [ ] **UI-02**: 用户手动选择本地 JSON 或 CSV 文件
- [ ] **UI-03**: 文件加载后展示视频列表（标题、BV号、收藏夹分组）
- [ ] **UI-04**: 从 BiliNote 自动拉取供应商和模型列表，用户下拉选择
- [ ] **UI-05**: 笔记风格预设选择 + 自定义额外提示词输入
- [ ] **CORE-01**: 按收藏顺序逐个调用 BiliNote API 提交视频
- [ ] **CORE-02**: 轮询任务状态，完成后自动保存结果
- [ ] **CORE-03**: 按收藏夹名称分目录输出，每个视频生成 .md + _原文.txt + _完整.json
- [ ] **CORE-04**: 已处理 BV 号去重（断点续传，`_已处理.json`）
- [ ] **CORE-05**: 开始/停止按钮，实时进度（当前/总数/成功/失败/跳过）
- [ ] **CORE-06**: 实时日志滚动显示

### Out of Scope

- 多用户/权限系统 — 个人工具
- 视频下载/转写 — 由 BiliNote 负责
- 打包为 exe — v1 用 Python 直接运行
- 远程访问 — 仅 localhost

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Python + 内置 http.server | 零依赖部署，用户已有 Python | — Pending |
| 网页 GUI 而非 tkinter/PyQt | 开发快，UI 灵活，深色主题好看 | — Pending |
| 单文件脚本 | 工具型项目，便于分享和修改 | — Pending |
| 直接调 BiliNote REST API | 同机部署，无需中间层 | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition:**
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone:**
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-20 after initialization*
