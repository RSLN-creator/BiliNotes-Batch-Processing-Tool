---
phase: 01-gui
plan: 02
commits:
  - 2fbf133
  - 78d6855
tasks: 2
status: complete
---

# Plan 02: 文件解析 + 视频列表展示

**Status:** Complete
**Started:** 2026-05-20
**Completed:** 2026-05-20

## Summary

实现文件选择、后端 JSON/CSV 解析、前端视频列表渲染的完整垂直功能。用户选择本地 Bilishelf 导出文件后，页面按收藏夹分组展示视频列表。

## Deliverables

| File | Lines | Purpose |
|------|-------|---------|
| `app.py` | +90 | POST /api/parse-file + parse_bilishelf_json/csv 函数 |
| `static/js/app.js` | 127 | 文件选择、fetch 上传、分组渲染、XSS 防护 |

## Requirements Satisfied

- **UI-02**: 文件选择按钮，支持 .json/.csv
- **UI-03**: 视频列表分组展示（BV号+标题+收藏夹+状态）
- **CORE-01**: JSON 解析（folders/videos 结构）
- **CORE-02**: CSV 解析（COLUMN_MAP 列名别名）

## Commits

- `2fbf133` feat(01-02): add /api/parse-file endpoint with JSON/CSV parsers
- `78d6855` feat(01-02): add frontend file selection and video list rendering
