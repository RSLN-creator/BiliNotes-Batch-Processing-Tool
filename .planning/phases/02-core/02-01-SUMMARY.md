---
phase: 02-core
plan: 01
commits: [da64ac0]
tasks: 2
status: complete
---

# Plan 01: 后端 API 端点 + 文件输出系统

**Status:** Complete | **Completed:** 2026-05-20

## Summary
在 app.py 中添加批量处理所需的 3 个 API 端点和 4 个工具函数：视频提交代理、任务状态轮询 + 自动保存、checkpoint 断点续传。

## Deliverables
- `app.py` +166 lines: sanitize_filename, save_video_output, load_checkpoint, update_checkpoint
- POST /api/process-video → 代理 BiliNote
- GET /api/task-status/{id} → 轮询 + 首次 SUCCESS 自动保存
- GET /api/checkpoint → 返回已处理列表

## Requirements: CORE-03~06, DATA-01~05
