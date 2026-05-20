---
phase: 03-polish
plan: 01
commits: [a16aebc]
status: complete
---

# Plan 01: BiliNote API 响应修复 + 端口冲突

**Status:** Complete — 2026-05-21

## Summary
修复所有 BiliNote API 代理端点：正确端点路径（/api/get_all_providers、/api/model_enable/{id}）、{code, msg, data} 响应解包、JSON 解析修复（顶层 videos + folderId 映射）、端口冲突 try/except OSError。

## Fixes
- BiliNote 连接检测使用 /api/task_status/test（真实端点）
- POST /api/generate_note 添加 format/screenshot/link/video_understanding 字段
- providers|models 代理端点路径修正
- parse_bilishelf_json: videos 在顶层，通过 folderId 关联
- _clean_folder_name: 去掉数字前缀
- EDGE-06: 端口占用时打印明确提示
