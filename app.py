"""BiliNote 批量收藏转写工具 — Flask GUI 后端"""
import csv
import io
import json
import os
import re
import time
import webbrowser
from pathlib import Path
from threading import Timer

import requests
from flask import Flask, jsonify, render_template, request

# ── 配置常量 ──────────────────────────────────────────────
BILINOTE_BASE_URL = os.getenv("BILINOTE_URL", "http://localhost:3015")
GUI_PORT = int(os.getenv("GUI_PORT", "8765"))
OUTPUT_DIR = Path(os.getenv("OUTPUT_DIR", "./output"))
_CHECKPOINT_FILE = "_已处理.json"

# ── 内存状态 ──────────────────────────────────────────────
_task_map: dict = {}           # task_id -> {bvid, title, folder}
_completed_tasks: set = set()  # 已保存文件的 task_id
_processed_bvids: set = set()  # 已成功处理的 BV 号

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


# ── BiliNote API 代理端点 ─────────────────────────────────

@app.route("/api/providers")
def get_providers():
    try:
        resp = requests.get(f"{BILINOTE_BASE_URL}/api/providers", timeout=5)
        resp.raise_for_status()
        return jsonify({"connected": True, "providers": resp.json()})
    except requests.RequestException:
        return jsonify({"connected": False, "providers": [], "error": "无法连接 BiliNote 服务"})


@app.route("/api/providers/<provider_id>/models")
def get_provider_models(provider_id):
    try:
        resp = requests.get(
            f"{BILINOTE_BASE_URL}/api/providers/{provider_id}/models", timeout=5
        )
        resp.raise_for_status()
        return jsonify({"connected": True, "models": resp.json()})
    except requests.RequestException:
        return jsonify({"connected": False, "models": [], "error": "无法连接 BiliNote 服务"})


@app.route("/api/check-connection")
def check_connection():
    try:
        resp = requests.get(f"{BILINOTE_BASE_URL}/api/providers", timeout=3)
        return jsonify({"connected": resp.ok})
    except requests.RequestException:
        return jsonify({"connected": False})


# ── Phase 2: 批量处理端点 ─────────────────────────────────

@app.route("/api/process-video", methods=["POST"])
def process_video():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "无效的请求数据"}), 400

    bvid = data.get("bvid", "")
    title = data.get("title", "")
    folder = data.get("folder", "未分类")
    url = data.get("url", f"https://www.bilibili.com/video/{bvid}")

    params = {
        "video_url": url,
        "platform": "bilibili",
        "quality": "medium",
        "model_name": data.get("model_name", ""),
        "provider_id": data.get("provider_id", ""),
        "style": data.get("style", "detailed"),
        "extras": data.get("extras", ""),
    }

    try:
        resp = requests.post(
            f"{BILINOTE_BASE_URL}/api/generate_note", json=params, timeout=10
        )
        resp.raise_for_status()
        task_id = resp.json().get("task_id", "")
        _task_map[task_id] = {"bvid": bvid, "title": title, "folder": folder}
        return jsonify({"task_id": task_id})
    except requests.RequestException as e:
        app.logger.error("提交到 BiliNote 失败: %s", e)
        return jsonify({"error": f"提交到 BiliNote 失败: {e}"}), 502


@app.route("/api/task-status/<task_id>")
def task_status(task_id):
    try:
        resp = requests.get(
            f"{BILINOTE_BASE_URL}/api/task_status/{task_id}", timeout=5
        )
        resp.raise_for_status()
        data = resp.json()
    except requests.RequestException as e:
        return jsonify({"status": "UNKNOWN", "error": str(e)}), 502

    status = data.get("status", "UNKNOWN")
    result = data.get("result") or {}

    if status == "SUCCESS" and task_id not in _completed_tasks:
        _completed_tasks.add(task_id)
        ctx = _task_map.get(task_id, {})
        try:
            files = save_video_output(
                ctx.get("folder", "未分类"),
                ctx.get("bvid", ""),
                ctx.get("title", ""),
                result,
                OUTPUT_DIR,
            )
            data["files"] = files
            update_checkpoint(ctx.get("bvid", ""), "SUCCESS", task_id)
        except Exception as e:
            app.logger.error("保存文件失败: %s", e)
            data["file_error"] = str(e)

    return jsonify(data)


@app.route("/api/checkpoint")
def get_checkpoint():
    return jsonify({"processed": sorted(list(_processed_bvids))})


# ── 文件解析函数 ──────────────────────────────────────────

# CSV 列名别名映射（Pitfall 1: Bilishelf CSV 列名不确定）
_COLUMN_MAP = {
    "bvid": ["bvid", "bvid", "BV号", "BV", "avid", "aid"],
    "title": ["title", "标题", "视频标题", "name"],
    "folder": ["folder", "folders", "收藏夹", "folder_title", "folder_name"],
    "url": ["url", "链接", "video_url", "page_url"],
}


def _find_col(row_keys, aliases):
    for alias in aliases:
        for key in row_keys:
            if key.strip() == alias:
                return key
    return None


def parse_bilishelf_json(content):
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


# ── Phase 2: 工具函数 ─────────────────────────────────────

def sanitize_filename(name, max_len=80):
    """过滤非法字符并截断文件名"""
    result = re.sub(r'[\\/:*?"<>|]', '_', name)
    result = result.strip(". ")
    if len(result) > max_len:
        result = result[:max_len].rstrip("_ ")
    return result or "untitled"


def save_video_output(folder_name, bvid, title, result, output_dir):
    """保存视频笔记到磁盘，每个视频 3 个文件"""
    safe_folder = sanitize_filename(folder_name, max_len=60)
    safe_title = sanitize_filename(title, max_len=80)
    base_name = f"{bvid} - {safe_title}"
    dest_dir = output_dir / safe_folder
    dest_dir.mkdir(parents=True, exist_ok=True)

    md_content = result.get("markdown", "") or ""
    transcript = result.get("transcript", {}) or {}
    full_text = transcript.get("full_text", "") or ""

    paths = {}

    md_path = dest_dir / f"{base_name}.md"
    md_path.write_text(md_content, encoding="utf-8")
    paths["md"] = str(md_path)

    txt_path = dest_dir / f"{base_name}_原文.txt"
    txt_path.write_text(full_text, encoding="utf-8")
    paths["txt"] = str(txt_path)

    json_path = dest_dir / f"{base_name}_完整.json"
    json_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    paths["json"] = str(json_path)

    return paths


def load_checkpoint(output_dir=None):
    """从磁盘加载已处理记录"""
    if output_dir is None:
        output_dir = OUTPUT_DIR
    path = output_dir / _CHECKPOINT_FILE
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        app.logger.warning("Checkpoint 文件损坏，将从头开始")
        return {}


def update_checkpoint(bvid, status, task_id, output_dir=None):
    """原子写入已处理记录到 checkpoint 文件"""
    if output_dir is None:
        output_dir = OUTPUT_DIR
    output_dir.mkdir(parents=True, exist_ok=True)
    path = output_dir / _CHECKPOINT_FILE

    records = load_checkpoint(output_dir)
    records[bvid] = {
        "task_id": task_id,
        "status": status,
        "time": time.strftime("%Y-%m-%dT%H:%M:%S"),
    }

    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(str(tmp), str(path))


# ── 模块初始化：加载 checkpoint ───────────────────────────
_checkpoint_data = load_checkpoint()
for _bvid, _rec in _checkpoint_data.items():
    if _rec.get("status") == "SUCCESS":
        _processed_bvids.add(_bvid)
app.logger.info("从 checkpoint 加载了 %d 个已处理视频", len(_processed_bvids))


# ── 启动入口 ──────────────────────────────────────────────
if __name__ == "__main__":
    Timer(1, lambda: webbrowser.open(f"http://localhost:{GUI_PORT}")).start()
    print(f"[*] BiliNote Batch Tool 启动中...")
    print(f"[*] 访问 http://localhost:{GUI_PORT}")
    print(f"[*] BiliNote: {BILINOTE_BASE_URL}")
    print(f"[*] 输出目录: {OUTPUT_DIR.resolve()}")
    app.run(host="127.0.0.1", port=GUI_PORT, debug=False)
