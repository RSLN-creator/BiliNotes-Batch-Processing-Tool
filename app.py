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

def _bili_get(path, timeout=5):
    """调用 BiliNote GET API，返回 (connected, data_list)"""
    resp = requests.get(f"{BILINOTE_BASE_URL}{path}", timeout=timeout)
    body = resp.json()
    if body.get("code") == 0:
        return True, body.get("data", [])
    return True, []


@app.route("/api/providers")
def get_providers():
    try:
        connected, providers = _bili_get("/api/get_all_providers")
        return jsonify({"connected": connected, "providers": providers})
    except requests.RequestException:
        return jsonify({"connected": False, "providers": [], "error": "无法连接 BiliNote 服务"})


@app.route("/api/providers/<provider_id>/models")
def get_provider_models(provider_id):
    try:
        connected, models = _bili_get(f"/api/model_enable/{provider_id}")
        return jsonify({"connected": connected, "models": models})
    except requests.RequestException:
        return jsonify({"connected": False, "models": [], "error": "无法连接 BiliNote 服务"})


@app.route("/api/check-connection")
def check_connection():
    try:
        connected, _ = _bili_get("/api/task_status/test", timeout=3)
        return jsonify({"connected": connected})
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
        "format": ["markdown"],
        "style": data.get("style", "detailed"),
        "screenshot": False,
        "link": False,
        "video_understanding": False,
    }
    if data.get("extras"):
        params["extras"] = data["extras"]

    try:
        resp = requests.post(
            f"{BILINOTE_BASE_URL}/api/generate_note", json=params, timeout=10
        )
        body = resp.json()
        if body.get("code") != 0:
            code = body.get("code", -1)
            msg = body.get("msg", "未知错误")
            return jsonify({"error": f"BiliNote API 错误 (code={code}): {msg}"}), 502
        task_id = body["data"]["task_id"]
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
        body = resp.json()
        if body.get("code") != 0:
            return jsonify({"status": "ERROR", "error": body.get("msg", "")})
        inner = body.get("data", {})
        status = inner.get("status", "PENDING")
        result = inner.get("result") or {}
    except requests.RequestException as e:
        return jsonify({"status": "UNKNOWN", "error": str(e)}), 502

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
            inner["files"] = files
            update_checkpoint(ctx.get("bvid", ""), "SUCCESS", task_id)
        except Exception as e:
            app.logger.error("保存文件失败: %s", e)
            inner["file_error"] = str(e)

    return jsonify(inner)


@app.route("/api/checkpoint")
def get_checkpoint():
    return jsonify({"processed": sorted(list(_processed_bvids))})


# ── 文件解析函数 ──────────────────────────────────────────

_COLUMN_MAP = {
    "bvid": ["bvid", "bvid", "BV号", "BV", "avid", "aid"],
    "title": ["title", "标题", "视频标题", "name"],
    "folder": ["folder", "folders", "收藏夹", "folder_title", "folder_name"],
    "url": ["url", "链接", "video_url", "page_url", "bvidUrl"],
}


def _find_col(row_keys, aliases):
    for alias in aliases:
        for key in row_keys:
            if key.strip() == alias:
                return key
    return None


def _clean_folder_name(name):
    """去掉 '0-竞赛！' 类的数字前缀"""
    if name and name[0].isdigit():
        return name.split("-", 1)[-1] if "-" in name else name
    return name


def parse_bilishelf_json(content):
    """解析 Bilishelf JSON — videos 在顶层，通过 folderId 关联收藏夹"""
    data = json.loads(content)

    # 构建 folderId → 文件夹名 映射
    folder_map = {}
    for f in data.get("folders", []):
        name = _clean_folder_name(f.get("name", ""))
        folder_map[f["id"]] = name or "默认"

    # videos 在顶层
    videos = []
    for v in data.get("videos", []):
        bvid = (v.get("bvid") or "").strip()
        if not bvid:
            continue
        fid = v.get("folderId", v.get("folder_id", 1))
        videos.append({
            "bvid": bvid,
            "title": (v.get("title") or "").strip(),
            "url": v.get("bvidUrl", f"https://www.bilibili.com/video/{bvid}/"),
            "folder": folder_map.get(fid, "默认"),
        })
    return videos


def parse_bilishelf_csv(content):
    """解析 Bilishelf CSV — 支持列名别名和数字前缀清理"""
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
        bvid = (row.get(col_bvid, "") or "").strip()
        if not bvid:
            continue
        folder = (row.get(col_folder, "") or "").strip() if col_folder else ""
        folder = _clean_folder_name(folder) or "未分类"
        url = (row.get(col_url, "") or "").strip() if col_url else f"https://www.bilibili.com/video/{bvid}/"
        videos.append({
            "bvid": bvid,
            "title": (row.get(col_title, "") or "").strip() if col_title else "",
            "folder": folder,
            "url": url,
        })
    return videos


# ── Phase 2: 工具函数 ─────────────────────────────────────

def sanitize_filename(name, max_len=80):
    result = re.sub(r'[\\/:*?"<>|]', '_', name)
    result = result.strip(". ")
    if len(result) > max_len:
        result = result[:max_len].rstrip("_ ")
    return result or "untitled"


def save_video_output(folder_name, bvid, title, result, output_dir):
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
    try:
        app.run(host="127.0.0.1", port=GUI_PORT, debug=False)
    except OSError as e:
        print(f"\n[!] 端口 {GUI_PORT} 已被占用，请关闭占用进程后重试")
        print(f"    错误详情: {e}")
        import sys; sys.exit(1)
