# Phase 3: 边界处理 + 打磨 - Context

**Gathered:** 2026-05-20
**Status:** Ready for planning

<domain>
## Phase Boundary

处理剩余边界场景和 bug 修复。Phase 2 已覆盖 EDGE-03/04/05 大部分，本阶段聚焦：
- EDGE-06: 端口冲突检测
- EDGE-07: 空状态引导说明
- BiliNote 连接 bug 修复（用户反馈：BiliNote 已启动但显示未连接）
</domain>

<decisions>
## Implementation Decisions

### 端口冲突 (EDGE-06)
- **D-01:** `app.run()` 包裹 try/except OSError，捕获端口占用错误，输出明确提示"端口 8765 已被占用，请关闭占用进程后重试"

### 空状态引导 (EDGE-07)  
- **D-02:** 初始页面（未选文件时）显示引导步骤：1) 从 Bilishelf 导出收藏文件 2) 点击"选择收藏文件" 3) 选好模型和风格 4) 点"开始批量处理"

### BiliNote 连接修复
- **D-03:** 验证实际 BiliNote API 端点路径，修复 /api/providers 代理（当前假设的路径可能不匹配实际 BiliNote 版本）

### Claude's Discretion
- BiliNote API 端点具体路径（需根据实际运行实例调整）
- 端口冲突的 try/except 方式
- 引导文字内容
</decisions>

<canonical_refs>
## Canonical References

- `app.py` — 当前后端代码
- `.planning/REQUIREMENTS.md` — EDGE-03~07

</canonical_refs>

<code_context>
## Existing Code Insights

Phase 2 已实现：
- EDGE-03: startBatch 循环中 try/catch，单个失败继续
- EDGE-04: FAILED 不加入 processedBvids，允许重试
- EDGE-05: stopRequested 标志位，完成当前即停

需修复：
- BiliNote 代理端点路径可能不正确
</code_context>

<specifics>
## Specific Ideas

- 用户反馈 BiliNote 连接检测误报——需要验证 BiliNote 实际 API 端点
</specifics>

<deferred>
## Deferred Ideas

None.
</deferred>

---

*Phase: 03-polish*
*Context gathered: 2026-05-20*
