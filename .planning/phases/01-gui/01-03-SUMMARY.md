---
phase: 01-gui
plan: 03
commits:
  - 76f1ec9
  - 692b5c6
tasks: 2
status: complete
---

# Plan 03: BiliNote 集成 + 配置区功能

**Status:** Complete
**Started:** 2026-05-20
**Completed:** 2026-05-20

## Summary

连接 BiliNote 服务，实现供应商/模型下拉联动、笔记风格预设和额外提示词配置。BiliNote 离线时显示黄色警告横幅（不弹窗）。

## Deliverables

| File | Lines | Purpose |
|------|-------|---------|
| `app.py` | +33 | 3 个代理端点：/api/providers, /api/providers/<id>/models, /api/check-connection |
| `static/js/app.js` | +100 | loadProviders/loadModels/onProviderChanged，横幅系统 |

## Requirements Satisfied

- **UI-04**: 供应商/模型下拉联动，从 BiliNote API 自动获取
- **UI-05**: 笔记风格 5 个预设 + 额外提示词文本框
- **EDGE-01**: BiliNote 不可达时黄色横幅提示（不弹窗）
- **EDGE-02**: 供应商未配置时提示先去 BiliNote 添加

## Commits

- `76f1ec9` feat(01-03): add BiliNote API proxy endpoints
- `692b5c6` feat(01-03): add BiliNote provider/model loading with banner system
