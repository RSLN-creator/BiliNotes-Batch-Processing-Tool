---
phase: 03-polish
plan: 02
commits: [c8f46ba]
status: complete
---

# Plan 02: 空状态引导说明

**Status:** Complete — 2026-05-21

## Summary
初始页面（未选文件时）显示 4 步引导说明，新用户可清楚知道操作流程。

## Changes
- index.html: empty-state 替换为欢迎标题 + `<ol>` 步骤列表
- style.css: .empty-title, .empty-guide 样式

## Requirements
- EDGE-07: 无文件时显示引导说明
