"""BiliNote 批量收藏转写工具 — Flask GUI 后端"""
import csv
import io
import json
import os
import webbrowser
from pathlib import Path
from threading import Timer

import requests
from flask import Flask, jsonify, render_template, request

# ── 配置常量 ──────────────────────────────────────────────
BILINOTE_BASE_URL = os.getenv("BILINOTE_URL", "http://localhost:3015")
GUI_PORT = int(os.getenv("GUI_PORT", "8765"))

# ── Flask 应用 ────────────────────────────────────────────
app = Flask(__name__)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/parse-file", methods=["POST"])
def parse_file():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "无效的请求数据"}), 400
    content = data.get("content", "")
    filename = data.get("filename", "unknown")
    file_type = data.get("fileType", "")

    if not content:
        return jsonify({"error": "文件内容为空"}), 400

    try:
        if file_type == "json":
            videos = parse_bilishelf_json(content)
        elif file_type == "csv":
            videos = parse_bilishelf_csv(content)
        else:
            return jsonify({"error": f"不支持的文件类型: {file_type}"}), 400
    except json.JSONDecodeError as e:
        return jsonify({"error": f"JSON 解析失败: {e}"}), 400
    except Exception as e:
        return jsonify({"error": f"文件解析失败: {e}"}), 400

    return jsonify({"videos": videos, "total": len(videos)})


# ── 文件解析函数 ──────────────────────────────────────────

# CSV 列名别名映射（Pitfall 1: Bilishelf CSV 列名不确定）
_COLUMN_MAP = {
    "bvid": ["bvid", "bvid", "BV号", "BV", "avid", "aid"],
    "title": ["title", "标题", "视频标题", "name"],
    "folder": ["folder", "folders", "收藏夹", "folder_title", "folder_name"],
    "url": ["url", "链接", "video_url", "page_url"],
}


def _find_col(row_keys, aliases):
    """在 CSV 行键中查找匹配别名列表的第一个列名"""
    for alias in aliases:
        for key in row_keys:
            if key.strip() == alias:
                return key
    return None


def parse_bilishelf_json(content):
    """解析 Bilishelf JSON 格式的收藏数据"""
    data = json.loads(content)
    videos = []
    for folder in data.get("folders", []):
        folder_name = folder.get("title", "未分类")
        for video in folder.get("videos", []):
            videos.append({
                "bvid": video.get("bvid", ""),
                "title": video.get("title", ""),
                "url": video.get("url", ""),
                "folder": folder_name,
            })
    return videos


def parse_bilishelf_csv(content):
    """解析 Bilishelf CSV 格式的收藏数据（支持列名别名）"""
    f = io.StringIO(content)
    reader = csv.DictReader(f)
    if reader.fieldnames is None:
        return []

    keys = list(reader.fieldnames)
    col_bvid = _find_col(keys, _COLUMN_MAP["bvid"])
    col_title = _find_col(keys, _COLUMN_MAP["title"])
    col_folder = _find_col(keys, _COLUMN_MAP["folder"])
    col_url = _find_col(keys, _COLUMN_MAP["url"])

    if col_bvid is None:
        raise ValueError("CSV 中未找到 BV 号列（尝试匹配: bvid, BV号, BV 等）")

    videos = []
    for row in reader:
        videos.append({
            "bvid": (row.get(col_bvid, "") or "").strip(),
            "title": (row.get(col_title, "") or "").strip() if col_title else "",
            "folder": (row.get(col_folder, "") or "").strip() if col_folder else "未分类",
            "url": (row.get(col_url, "") or "").strip() if col_url else "",
        })
    return videos


# ── 启动入口 ──────────────────────────────────────────────
if __name__ == "__main__":
    Timer(1, lambda: webbrowser.open(f"http://localhost:{GUI_PORT}")).start()
    print(f"[*] BiliNote Batch Tool 启动中...")
    print(f"[*] 访问 http://localhost:{GUI_PORT}")
    print(f"[*] BiliNote: {BILINOTE_BASE_URL}")
    app.run(host="127.0.0.1", port=GUI_PORT, debug=False)
