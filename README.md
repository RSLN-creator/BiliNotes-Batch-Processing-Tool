# BiliNote 批量收藏转写工具

批量调用 BiliNotes Docker 容器，对 B站收藏夹视频进行笔记转写。

## 前置要求

1. **Python 3.8+**（安装时勾选 "Add Python to PATH"）
2. **BiliNotes Docker 容器**已启动并运行在 `http://localhost:3015`

## 使用方法

1. 双击 `启动.bat`（首次运行会自动安装依赖）
2. 浏览器打开 `http://localhost:8765`
3. 上传 B站收藏夹导出 CSV，或手动输入 BV号
4. 选择转写参数，点击开始处理

## 文件说明

| 文件 | 说明 |
|------|------|
| `app.py` | 主程序 |
| `启动.bat` | 命令行启动（有窗口） |
| `启动(静默).vbs` | 静默启动（无窗口） |
| `requirements.txt` | Python 依赖 |
| `templates/index.html` | 页面模板 |
| `static/css/style.css` | 样式 |
| `static/js/app.js` | 前端逻辑 |

## 同步到 BiliNotes

批量工具处理的任务不会自动出现在 BiliNotes 前端列表中。如需同步：

1. 点击页面顶部「🔄 同步到 BiliNotes」按钮
2. 复制同步脚本
3. 打开 BiliNotes 页面 → F12 → Console → 粘贴执行
4. 刷新 BiliNotes 页面即可看到

## 输出

处理结果保存在 `output/` 目录下，按视频分文件夹，包含笔记(MD)、字幕(TXT)、完整数据(JSON)等。
