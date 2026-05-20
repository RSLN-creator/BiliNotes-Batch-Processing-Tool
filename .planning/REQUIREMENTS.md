# BiliNote 批量收藏转写工具 — 需求文档 v1

## v1 Requirements

### UI — 用户界面

- [ ] **UI-01**: 启动脚本后自动打开浏览器，展示深色主题网页 GUI
- [ ] **UI-02**: "选择收藏文件"按钮，弹出系统文件选择对话框，支持 `.json` 和 `.csv`
- [ ] **UI-03**: 文件加载后展示视频列表（BV号、标题、所属收藏夹），显示已处理/未处理状态
- [ ] **UI-04**: 供应商下拉列表（从 BiliNote API 自动读取），选择后联动加载该供应商的已启用模型
- [ ] **UI-05**: 笔记风格预设下拉（详细笔记/简洁摘要/思维导图式/学习笔记/技术文档）+ 自定义额外提示词输入框
- [ ] **UI-06**: 进度条 + 统计数字（总数/成功/失败/跳过/当前进度）+ 预计剩余时间
- [ ] **UI-07**: 实时日志区，彩色区分信息/成功/错误
- [ ] **UI-08**: 「开始批量处理」和「停止」按钮，运行中开始按钮禁用

### CORE — 核心处理逻辑

- [ ] **CORE-01**: 解析 Bilishelf JSON 文件，提取 `folders`（收藏夹名）和 `videos`（bvid/title/url/folderId）
- [ ] **CORE-02**: 解析 Bilishelf CSV 文件，提取 bvid/title/folders
- [ ] **CORE-03**: 按收藏夹原始顺序逐个调用 `POST /api/generate_note` 提交视频
- [ ] **CORE-04**: 提交参数包含：video_url, platform="bilibili", quality="medium", model_name, provider_id, style, extras
- [ ] **CORE-05**: 轮询 `GET /api/task_status/{task_id}` 直到 SUCCESS/FAILED，每 5 秒一次
- [ ] **CORE-06**: 成功后自动提取 result.markdown 和 result.transcript.full_text 保存到文件
- [ ] **CORE-07**: 任务间冷却 3 秒，单个任务最长等待 15 分钟后超时

### DATA — 数据持久化

- [ ] **DATA-01**: `_已处理.json` 记录已处理 BV 号（task_id, status, time），启动时加载
- [ ] **DATA-02**: 已成功处理的视频自动跳过（断点续传）
- [ ] **DATA-03**: 输出按收藏夹名称分子目录：`输出目录/收藏夹名/视频名.md`
- [ ] **DATA-04**: 每个视频生成 3 个文件：`.md`（Markdown 笔记）、`_原文.txt`（字幕全文）、`_完整.json`（API 完整返回）
- [ ] **DATA-05**: 文件名安全处理（过滤 `\/:*?"<>|` 等非法字符，截断过长标题）

### EDGE — 边界与异常

- [ ] **EDGE-01**: BiliNote 服务不可达时，GUI 启动即提示"无法连接 BiliNote"
- [ ] **EDGE-02**: 供应商未配置/无模型时，提示用户先去 BiliNote 配置
- [ ] **EDGE-03**: 单个视频失败不影响后续：记录失败状态，继续处理下一个
- [ ] **EDGE-04**: 重复提交同一 BV 号：如果上次状态为 SUCCESS 则跳过，FAILED 则允许重试
- [ ] **EDGE-05**: 用户点击停止：完成当前任务后停止（不硬中断正在进行的 API 调用）
- [ ] **EDGE-06**: GUI 启动端口（8765）被占用时，提示用户关闭占用进程
- [ ] **EDGE-07**: 没有可用收藏文件时，显示引导说明

## v2 Requirements (Deferred)

- [ ] 支持批量选择多个 JSON/CSV 文件合并处理
- [ ] 支持其他平台（YouTube、抖音）的收藏导出
- [ ] 任务并发处理（如同时跑 3 个视频）
- [ ] 打包为 Windows exe（PyInstaller）
- [ ] 配置文件持久化（记住上次选择的文件、供应商、模型、风格）
- [ ] 笔记模板自定义（用户编辑 Markdown 模板）

## Out of Scope

- 视频下载/转写 — 由 BiliNote 后端负责
- 多用户/权限 — 个人工具
- 远程 Web 访问 — 仅 localhost
- LLM API Key 管理 — 在 BiliNote 中配置
- 收藏数据自动同步 — 用户手动从 Bilishelf 导出

## Traceability

| REQ-ID | Phase | Plan | Status |
|--------|-------|------|--------|
| UI-01, UI-02 | 1 | TBD | Pending |
| UI-03, UI-04, UI-05 | 1 | TBD | Pending |
| CORE-01, CORE-02 | 1 | TBD | Pending |
| EDGE-01, EDGE-02 | 1 | TBD | Pending |
| UI-06, UI-07, UI-08 | 2 | TBD | Pending |
| CORE-03~07 | 2 | TBD | Pending |
| DATA-01~05 | 2 | TBD | Pending |
| EDGE-03~07 | 3 | TBD | Pending |

---
*Last updated: 2026-05-20*
