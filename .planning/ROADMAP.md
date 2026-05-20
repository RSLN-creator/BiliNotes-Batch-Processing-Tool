# Roadmap — BiliNote 批量收藏转写工具

**3 phases** | **19 requirements** | Coarse granularity

---

### Phase 1: GUI 框架 + 数据加载
**Goal:** 用户能启动 GUI，选择文件，看到视频列表和模型配置
**Mode:** mvp

**Requirements:** UI-01, UI-02, UI-03, UI-04, UI-05, CORE-01, CORE-02, EDGE-01, EDGE-02

**Success Criteria:**
1. 启动脚本后浏览器自动打开深色主题界面
2. 点"选择文件"能浏览并加载 JSON/CSV，列表展示所有视频（BV号+标题+收藏夹）
3. 供应商/模型下拉从 BiliNote 自动获取，可正常选择
4. 风格预设 + 提示词输入正常
5. BiliNote 离线时显示连接失败提示

**Plans:** 3 plans

| Plan | Wave | Objective | Tasks | Requirements |
| --- | --- | --- | --- | --- |
| 01 | 1 | Walking Skeleton: Flask 服务器 + 深色主题 GUI 容器 | 3 (含 1 checkpoint) | UI-01 |
| 02 | 2 | 文件解析 + 视频列表展示 | 2 | UI-02, UI-03, CORE-01, CORE-02 |
| 03 | 3 | BiliNote 集成 + 配置区功能 | 2 | UI-04, UI-05, EDGE-01, EDGE-02 |

**UI hint:** yes

---

### Phase 2: 核心处理 + 结果保存
**Goal:** 一键启动批量处理，自动生成笔记并归档
**Mode:** mvp

**Requirements:** UI-06, UI-07, UI-08, CORE-03, CORE-04, CORE-05, CORE-06, CORE-07, DATA-01, DATA-02, DATA-03, DATA-04, DATA-05

**Success Criteria:**
1. 点"开始"后按顺序提交视频，实时显示进度（总数/成功/失败/当前）
2. 日志实时滚动，颜色区分不同级别
3. 点"停止"后完成当前任务即停
4. 已处理视频自动跳过（重启后仍有效）
5. 输出按收藏夹分目录，每个视频 3 个文件（md + 原文 + json）

**Plans:** 2 plans

| Plan | Wave | Objective | Tasks | Requirements |
| --- | --- | --- | --- | --- |
| 01 | 1 | 后端 API 端点 + 文件输出系统 | 2 | CORE-03~06, DATA-01~05 |
| 02 | 1 | 前端批处理 UI + 驱动循环 | 2 | UI-06~08, CORE-05, CORE-07 |

---

### Phase 3: 边界处理 + 打磨
**Goal:** 复杂场景不崩，体验流畅
**Mode:** mvp

**Requirements:** EDGE-03, EDGE-04, EDGE-05, EDGE-06, EDGE-07

**Success Criteria:**
1. 单视频失败后自动继续处理后续
2. 失败视频可在下次运行时重试
3. 停止按钮不中断正在进行的 API 调用
4. 端口冲突时有明确提示
5. 无文件时显示引导说明

**Plans:** 2 plans

| Plan | Wave | Objective | Tasks | Requirements |
| --- | --- | --- | --- | --- |
| 01 | 1 | BiliNote API 响应格式修复 + 端口冲突检测 | 2 | EDGE-06 |
| 02 | 2 | 供应商/模型文本输入 + 空状态引导 | 2 | EDGE-07 |

---

## Requirement Coverage

| REQ-ID | Phase |
| --- | --- |
| UI-01, UI-02, UI-03, UI-04, UI-05 | 1 |
| CORE-01, CORE-02 | 1 |
| EDGE-01, EDGE-02 | 1 |
| UI-06, UI-07, UI-08 | 2 |
| CORE-03, CORE-04, CORE-05, CORE-06, CORE-07 | 2 |
| DATA-01, DATA-02, DATA-03, DATA-04, DATA-05 | 2 |
| EDGE-03, EDGE-04, EDGE-05, EDGE-06, EDGE-07 | 3 |

100% v1 requirements covered ✓

## Traceability — Phase 1

| REQ-ID | Plan | Status |
| --- | --- | --- |
| UI-01 | 01 | Complete |
| UI-02, UI-03 | 02 | Complete |
| CORE-01, CORE-02 | 02 | Complete |
| UI-04, UI-05 | 03 | Complete |
| EDGE-01, EDGE-02 | 03 | Complete |

## Traceability — Phase 2

| REQ-ID | Plan | Status |
| --- | --- | --- |
| CORE-03, CORE-04, CORE-05, CORE-06 | 01 | Complete |
| DATA-01, DATA-02, DATA-03, DATA-04, DATA-05 | 01 | Complete |
| UI-06, UI-07, UI-08 | 02 | Complete |
| CORE-05, CORE-07 | 02 | Complete |

## Traceability — Phase 3

| REQ-ID | Plan | Status |
| --- | --- | --- |
| EDGE-03, EDGE-04, EDGE-05 | Phase 2 | Complete |
| EDGE-06 | 03-01 | Pending |
| EDGE-07 | 03-02 | Pending |
