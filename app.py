"""BiliNote 批量收藏转写工具 — Flask GUI 后端"""
import csv
import io
import json
import os
import re
import subprocess
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


@app.route("/api/transcriber-config")
def get_transcriber_config():
    try:
        resp = requests.get(f"{BILINOTE_BASE_URL}/api/transcriber_config", timeout=5)
        body = resp.json()
        if body.get("code") == 0:
            return jsonify({"connected": True, "data": body.get("data", {})})
        return jsonify({"connected": True, "data": {}})
    except requests.RequestException:
        return jsonify({"connected": False, "data": {}})


@app.route("/api/transcriber-models-status")
def get_transcriber_models_status():
    try:
        resp = requests.get(f"{BILINOTE_BASE_URL}/api/transcriber_models_status", timeout=5)
        body = resp.json()
        if body.get("code") == 0:
            return jsonify({"connected": True, "data": body.get("data", {})})
        return jsonify({"connected": True, "data": {}})
    except requests.RequestException:
        return jsonify({"connected": False, "data": {}})


@app.route("/api/pick-directory")
def pick_directory():
    """Windows 原生文件夹选择对话框"""
    try:
        ps_cmd = (
            "Add-Type -AssemblyName System.Windows.Forms; "
            "$f = New-Object System.Windows.Forms.FolderBrowserDialog; "
            "$f.Description = '选择输出目录'; "
            "$f.ShowDialog() | Out-Null; "
            "$f.SelectedPath"
        )
        result = subprocess.run(
            ["powershell", "-Command", ps_cmd],
            capture_output=True, text=True, timeout=30,
        )
        path = result.stdout.strip()
        if path:
            return jsonify({"path": path})
        return jsonify({"path": None})
    except Exception:
        return jsonify({"path": None})


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
    output_dir = Path(data.get("output_dir", str(OUTPUT_DIR)))
    save_opts = data.get("save_options", ["markdown", "transcript", "json"])

    params = {
        "video_url": url,
        "platform": "bilibili",
        "quality": data.get("quality", "medium"),
        "model_name": data.get("model_name", ""),
        "provider_id": data.get("provider_id", ""),
        "format": data.get("format", ["markdown"]),
        "style": data.get("style", "detailed"),
        "screenshot": data.get("screenshot", False),
        "link": data.get("link", False),
        "video_understanding": data.get("video_understanding", False),
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
        _task_map[task_id] = {
            "bvid": bvid, "title": title, "folder": folder,
            "output_dir": str(output_dir), "save_opts": save_opts,
        }
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
        transcript_info = result.get("transcript") or {}
        transcript_lang = ""
        if isinstance(transcript_info, dict):
            transcript_lang = transcript_info.get("language", "")
        inner["transcript_source"] = "ai_subtitle" if transcript_lang.startswith("ai-") else "local"
        try:
            files = save_video_output(
                ctx.get("folder", "未分类"),
                ctx.get("bvid", ""),
                ctx.get("title", ""),
                result,
                Path(ctx.get("output_dir", str(OUTPUT_DIR))),
                ctx.get("save_opts", ["markdown", "transcript", "json"]),
            )
            inner["files"] = files
            update_checkpoint(
                ctx.get("bvid", ""), "SUCCESS", task_id,
                Path(ctx.get("output_dir", str(OUTPUT_DIR))),
                folder=ctx.get("folder", "未分类"),
                title=ctx.get("title", ""),
                transcript_source=inner["transcript_source"],
            )
        except Exception as e:
            app.logger.error("保存文件失败: %s", e)
            inner["file_error"] = str(e)

    if status == "FAILED" and task_id not in _completed_tasks:
        _completed_tasks.add(task_id)
        ctx = _task_map.get(task_id, {})
        update_checkpoint(
            ctx.get("bvid", ""), "FAILED", task_id,
            folder=ctx.get("folder", "未分类"),
            title=ctx.get("title", ""),
        )

    return jsonify(inner)


@app.route("/api/force-retranscribe", methods=["POST"])
def force_retranscribe():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "无效的请求数据"}), 400
    bvid = data.get("bvid", "")
    if not bvid:
        return jsonify({"error": "缺少 bvid"}), 400
    records = load_checkpoint()
    rec = records.get(bvid)
    if not rec:
        return jsonify({"error": "未找到该视频的处理记录"}), 404
    task_id = rec.get("task_id", "")
    deleted = []
    docker_ok = False
    if task_id:
        try:
            proc = subprocess.run(
                ["docker", "exec", "bilinote-backend", "rm", "-f",
                 f"/app/note_results/{task_id}_transcript.json",
                 f"/app/note_results/{task_id}_audio.json",
                 f"/app/note_results/{task_id}.json",
                 f"/app/note_results/{task_id}.status.json"],
                capture_output=True, text=True, timeout=10,
            )
            if proc.returncode == 0:
                docker_ok = True
                deleted = [f"{task_id}_transcript.json", f"{task_id}_audio.json",
                           f"{task_id}.json", f"{task_id}.status.json"]
            else:
                app.logger.warning("删除BiliNotes缓存失败, returncode=%d, stderr=%s", proc.returncode, proc.stderr)
        except Exception as e:
            app.logger.warning("删除BiliNotes缓存失败: %s", e)
    if not docker_ok and task_id:
        return jsonify({"error": "无法删除BiliNotes容器内缓存，请确认Docker容器正在运行", "bvid": bvid}), 503
    if bvid in records:
        del records[bvid]
        _save_checkpoint_file(records)
    if task_id in _completed_tasks:
        _completed_tasks.discard(task_id)
    if task_id in _task_map:
        del _task_map[task_id]
    return jsonify({"ok": True, "bvid": bvid, "deleted_cache": deleted})


@app.route("/api/backfill-transcript-source", methods=["POST"])
def backfill_transcript_source():
    records = load_checkpoint()
    updated = 0
    for bvid, rec in records.items():
        if rec.get("status") != "SUCCESS":
            continue
        if rec.get("transcript_source"):
            continue
        task_id = rec.get("task_id", "")
        source = ""
        output_dir = Path(rec.get("output_dir", str(OUTPUT_DIR)))
        safe_folder = sanitize_filename(rec.get("folder", "未分类"), max_len=60)
        safe_title = sanitize_filename(rec.get("title", ""), max_len=80)
        dir_name = f"{bvid} - {safe_title}"
        json_path = output_dir / safe_folder / dir_name / "完整.json"
        if not json_path.exists() and output_dir.exists():
            for d in output_dir.rglob(bvid + "*"):
                if d.is_dir():
                    candidate = d / "完整.json"
                    if candidate.exists():
                        json_path = candidate
                        break
        if json_path.exists():
            try:
                data = json.loads(json_path.read_text(encoding="utf-8"))
                transcript = data.get("transcript") or {}
                if isinstance(transcript, dict):
                    lang = transcript.get("language", "")
                    source = "ai_subtitle" if lang.startswith("ai-") else "local"
            except Exception:
                source = "unknown"
        if not source and task_id:
            try:
                resp = requests.get(
                    f"{BILINOTE_BASE_URL}/api/task_status/{task_id}", timeout=5
                )
                body = resp.json()
                if body.get("code") == 0:
                    inner = body.get("data", {})
                    result = inner.get("result") or {}
                    transcript_info = result.get("transcript") or {}
                    if isinstance(transcript_info, dict):
                        lang = transcript_info.get("language", "")
                        source = "ai_subtitle" if lang.startswith("ai-") else "local"
            except Exception:
                pass
        if source:
            rec["transcript_source"] = source
            updated += 1
        else:
            rec["transcript_source"] = "unknown"
            updated += 1
    if updated > 0:
        _save_checkpoint_file(records)
    return jsonify({"ok": True, "updated": updated, "total": len(records)})


@app.route("/api/checkpoint")
def get_checkpoint():
    records = load_checkpoint()
    return jsonify({"records": records, "processed": sorted([b for b, r in records.items() if r.get("status") == "SUCCESS"])})


@app.route("/api/checkpoint/<bvid>", methods=["DELETE"])
def delete_checkpoint(bvid):
    records = load_checkpoint()
    if bvid in records:
        del records[bvid]
        _save_checkpoint_file(records)
        _processed_bvids.discard(bvid)
        return jsonify({"ok": True})
    return jsonify({"ok": True})


@app.route("/api/open-file")
def open_local_file():
    file_path = request.args.get("path", "")
    if not file_path:
        return jsonify({"error": "未指定文件路径"}), 400
    p = Path(file_path)
    if not p.exists():
        return jsonify({"error": f"文件不存在: {file_path}"}), 404
    try:
        os.startfile(str(p))
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/get-output-files/<bvid>")
def get_output_files(bvid):
    records = load_checkpoint()
    rec = records.get(bvid)
    if not rec:
        return jsonify({"files": []})
    output_dir = Path(rec.get("output_dir", str(OUTPUT_DIR)))
    safe_folder = sanitize_filename(rec.get("folder", "未分类"), max_len=60)
    safe_title = sanitize_filename(rec.get("title", ""), max_len=80)
    dir_name = f"{bvid} - {safe_title}"
    dest_dir = output_dir / safe_folder / dir_name
    files = []
    if dest_dir.exists():
        for f in dest_dir.iterdir():
            if f.is_file() and not f.name.startswith("_"):
                files.append({"name": f.name, "path": str(f.resolve())})
    if not files and output_dir.exists():
        for d in output_dir.rglob(bvid + "*"):
            if d.is_dir():
                for f in d.iterdir():
                    if f.is_file() and not f.name.startswith("_"):
                        files.append({"name": f.name, "path": str(f.resolve())})
                if files:
                    dest_dir = d
                    break
    return jsonify({"files": files, "dir": str(dest_dir.resolve()) if dest_dir.exists() else ""})


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
    content = content.lstrip('\ufeff')
    header_line = content.split('\n', 1)[0]
    header_fields = _split_csv_row(header_line)
    col_bvid = _find_col(header_fields, _COLUMN_MAP["bvid"])
    col_title = _find_col(header_fields, _COLUMN_MAP["title"])
    col_folder = _find_col(header_fields, _COLUMN_MAP["folder"])
    col_url = _find_col(header_fields, _COLUMN_MAP["url"])
    if col_bvid is None:
        raise ValueError("CSV 中未找到 BV 号列（尝试匹配: bvid, BV号, BV 等）")
    bvid_idx = header_fields.index(col_bvid)
    title_idx = header_fields.index(col_title) if col_title else -1
    url_idx = header_fields.index(col_url) if col_url else -1
    folder_idx = header_fields.index(col_folder) if col_folder else -1
    bvid_pattern = re.compile(r'^BV[0-9A-Za-z]{6,}$')
    bv_positions = [m.start() for m in re.finditer(r'BV[0-9A-Za-z]{10},', content)]
    videos = []
    for i, pos in enumerate(bv_positions):
        end = bv_positions[i + 1] if i + 1 < len(bv_positions) else len(content)
        rec = content[pos:end].rstrip().rstrip(',')
        rec_oneline = rec.replace('\n', ' ').replace('\r', ' ')
        while '  ' in rec_oneline:
            rec_oneline = rec_oneline.replace('  ', ' ')
        row = _split_csv_row(rec_oneline)
        bvid_val = (row[bvid_idx] if bvid_idx < len(row) else "").strip()
        if not bvid_val or not bvid_pattern.match(bvid_val):
            continue
        title_val = (row[title_idx].strip() if title_idx >= 0 and title_idx < len(row) else "")
        folder_val = (row[folder_idx].strip() if folder_idx >= 0 and folder_idx < len(row) else "")
        folder_val = _clean_folder_name(folder_val) or "未分类"
        url_val = (row[url_idx].strip() if url_idx >= 0 and url_idx < len(row) else "") or f"https://www.bilibili.com/video/{bvid_val}/"
        videos.append({"bvid": bvid_val, "title": title_val, "folder": folder_val, "url": url_val})
    return videos


def _split_csv_row(line):
    result = []
    current = []
    in_quotes = False
    for ch in line:
        if ch == '"':
            in_quotes = not in_quotes
            current.append(ch)
        elif ch == ',' and not in_quotes:
            result.append(''.join(current).strip())
            current = []
        else:
            current.append(ch)
    result.append(''.join(current).strip())
    return result

# ── Phase 2: 工具函数 ─────────────────────────────────────

def sanitize_filename(name, max_len=80):
    result = re.sub(r'[\\/:*?"<>|]', '_', name)
    result = result.strip(". ")
    if len(result) > max_len:
        result = result[:max_len].rstrip("_ ")
    return result or "untitled"


def save_video_output(folder_name, bvid, title, result, output_dir, save_opts=None):
    """保存视频笔记 —— 每个视频独立子目录"""
    if save_opts is None:
        save_opts = ["markdown", "transcript", "json"]
    safe_folder = sanitize_filename(folder_name, max_len=60)
    safe_title = sanitize_filename(title, max_len=80)
    dir_name = f"{bvid} - {safe_title}"
    dest_dir = output_dir / safe_folder / dir_name
    dest_dir.mkdir(parents=True, exist_ok=True)

    paths = {}
    # Markdown 笔记
    if "markdown" in save_opts:
        md_content = result.get("markdown", "") or ""
        if md_content:
            md_path = dest_dir / f"笔记.md"
            md_path.write_text(md_content, encoding="utf-8")
            paths["md"] = str(md_path)
    # 原文/字幕
    if "transcript" in save_opts:
        transcript = result.get("transcript", {}) or {}
        full_text = transcript.get("full_text", "") or ""
        if full_text:
            txt_path = dest_dir / f"原文.txt"
            txt_path.write_text(full_text, encoding="utf-8")
            paths["txt"] = str(txt_path)
    # 完整 JSON
    if "json" in save_opts:
        json_path = dest_dir / f"完整.json"
        json_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
        paths["json"] = str(json_path)
    # 思维导图 (如果 BiliNote 返回了)
    if "mindmap" in save_opts:
        mindmap = result.get("mindmap", "") or ""
        if mindmap:
            mm_path = dest_dir / f"思维导图.md"
            mm_path.write_text(mindmap, encoding="utf-8")
            paths["mindmap"] = str(mm_path)

    return paths


def load_checkpoint(output_dir=None):
    if output_dir is None:
        output_dir = OUTPUT_DIR
    path = Path(output_dir) / _CHECKPOINT_FILE
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        app.logger.warning("Checkpoint 文件损坏，将从头开始")
        return {}


def update_checkpoint(bvid, status, task_id, output_dir=None, folder="", title="", transcript_source=""):
    actual_output_dir = str(output_dir) if output_dir else str(OUTPUT_DIR)
    records = load_checkpoint()
    records[bvid] = {
        "task_id": task_id,
        "status": status,
        "time": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "folder": folder,
        "title": title,
        "output_dir": actual_output_dir,
        "transcript_source": transcript_source,
    }
    _save_checkpoint_file(records)


def _save_checkpoint_file(records):
    checkpoint_dir = Path(OUTPUT_DIR)
    checkpoint_dir.mkdir(parents=True, exist_ok=True)
    path = checkpoint_dir / _CHECKPOINT_FILE
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(str(tmp), str(path))


# ── 模块初始化：加载 checkpoint ───────────────────────────
_checkpoint_data = load_checkpoint()
for _bvid, _rec in _checkpoint_data.items():
    if _rec.get("status") == "SUCCESS":
        _processed_bvids.add(_bvid)
app.logger.info("从 checkpoint 加载了 %d 个已处理视频", len(_processed_bvids))


@app.route("/api/copy-files", methods=["POST"])
def copy_files():
    import shutil
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "无效的请求数据"}), 400
    dest_dir = data.get("dest_dir", "")
    file_type = data.get("file_type", "md")
    if not dest_dir:
        return jsonify({"error": "未指定目标目录"}), 400
    dest = Path(dest_dir)
    dest.mkdir(parents=True, exist_ok=True)
    records = load_checkpoint()
    copied = 0
    errors = []
    for bvid, rec in records.items():
        if rec.get("status") != "SUCCESS":
            continue
        rec_output_dir = Path(rec.get("output_dir", str(OUTPUT_DIR)))
        safe_folder = sanitize_filename(rec.get("folder", "未分类"), max_len=60)
        safe_title = sanitize_filename(rec.get("title", ""), max_len=80)
        dir_name = f"{bvid} - {safe_title}"
        src_dir = rec_output_dir / safe_folder / dir_name
        if not src_dir.exists() and rec_output_dir.exists():
            found = None
            for d in rec_output_dir.rglob(bvid + "*"):
                if d.is_dir():
                    found = d
                    break
            src_dir = found if found else src_dir
        if not src_dir.exists():
            continue
        for f in src_dir.iterdir():
            if not f.is_file() or f.name.startswith("_"):
                continue
            match = False
            if file_type == "md" and f.name == "笔记.md":
                match = True
            elif file_type == "txt" and f.name == "原文.txt":
                match = True
            elif file_type == "json" and f.name == "完整.json":
                match = True
            elif file_type == "mindmap" and f.name == "思维导图.md":
                match = True
            if match:
                try:
                    new_name = f"{dir_name} - {f.name}"
                    shutil.copy2(str(f), str(dest / new_name))
                    copied += 1
                except Exception as e:
                    errors.append(f"{f.name}: {e}")
    return jsonify({"copied": copied, "errors": errors})


@app.route("/api/bilinotes-sync")
def bilinotes_sync():
    existing_ids = set(request.args.get("existing_ids", "").split(",")) if request.args.get("existing_ids") else set()
    records = load_checkpoint()
    tasks = []
    for bvid, rec in records.items():
        if rec.get("status") != "SUCCESS":
            continue
        task_id = rec.get("task_id", "")
        if task_id in existing_ids:
            continue
        try:
            resp = requests.get(
                f"{BILINOTE_BASE_URL}/api/task_status/{task_id}", timeout=5
            )
            body = resp.json()
            if body.get("code") != 0:
                continue
            inner = body.get("data", {})
            result = inner.get("result") or {}
        except Exception:
            result = {}

        audio_meta = result.get("audio_meta") or {}
        raw_info = audio_meta.get("raw_info") or {}
        if not isinstance(raw_info, dict):
            raw_info = {}
        title = rec.get("title", "") or raw_info.get("title", "") or raw_info.get("fulltitle", "")
        transcript = result.get("transcript") or {}
        if isinstance(transcript, dict):
            segments = transcript.get("segments", [])
            if not isinstance(segments, list):
                segments = []
            transcript_data = {
                "full_text": transcript.get("full_text", ""),
                "language": transcript.get("language", ""),
                "raw": None,
                "segments": segments,
            }
        else:
            transcript_data = {
                "full_text": "", "language": "", "raw": None, "segments": []
            }

        task = {
            "formData": {
                "video_url": f"https://www.bilibili.com/video/{bvid}/",
                "platform": "bilibili",
                "model_name": "",
                "provider_id": "",
                "quality": "medium",
                "style": "detailed",
            },
            "id": task_id,
            "status": "SUCCESS",
            "markdown": result.get("markdown", ""),
            "platform": "bilibili",
            "transcript": transcript_data,
            "createdAt": rec.get("time", ""),
            "audioMeta": {
                "cover_url": audio_meta.get("cover_url", "") or raw_info.get("thumbnail", ""),
                "duration": audio_meta.get("duration", 0) or raw_info.get("duration", 0),
                "file_path": audio_meta.get("file_path", ""),
                "platform": audio_meta.get("platform", "bilibili"),
                "raw_info": None,
                "title": title,
                "video_id": audio_meta.get("video_id", bvid),
            },
        }
        tasks.append(task)

    # ── 服务端生成注入脚本：数据直接嵌入，按原版可靠结构写入 IndexedDB ──
    tasks_json_str = json.dumps(tasks, ensure_ascii=False)

    injection_script = f"""
(async function() {{
    console.log('%c[BiliNote Sync] 开始同步...', 'color: #3b82f6; font-weight: bold; font-size: 14px;');
    const payload = {repr(tasks_json_str)};
    const incoming = JSON.parse(payload);
    if (!incoming || incoming.length === 0) {{
        console.warn('[BiliNote Sync] 无待同步数据');
        return;
    }}
    console.log('[BiliNote Sync] 待写入任务数:', incoming.length);

    const DB_NAME = 'keyval-store';
    const STORE_NAME = 'keyval';
    const STORAGE_KEY = 'task-storage';

    const req = indexedDB.open(DB_NAME);
    req.onerror = (e) => console.error('[BiliNote Sync] 无法打开 IndexedDB:', e);

    req.onsuccess = function(e) {{
        const db = e.target.result;
        let store;
        try {{ store = db.transaction([STORE_NAME], 'readonly').objectStore(STORE_NAME); }}
        catch (err) {{ console.error('[BiliNote Sync] store 不存在:', err); return; }}

        const getReq = store.get(STORAGE_KEY);
        getReq.onsuccess = function(ev) {{
            let raw = ev.target.result;
            let existing;
            if (typeof raw === 'string') {{
                try {{ existing = JSON.parse(raw); }} catch(x) {{ existing = null; }}
            }} else if (raw && typeof raw === 'object') {{
                existing = raw;
            }} else {{
                existing = null;
            }}
            if (!existing || !existing.state || !Array.isArray(existing.state.tasks)) {{
                existing = {{ state: {{ tasks: [], currentTaskId: null }}, version: 0 }};
            }}

            const existingIds = new Set(existing.state.tasks.map(function(t) {{ return t.id; }}));
            const toAdd = incoming.filter(function(t) {{ return !existingIds.has(t.id); }});
            console.log('[BiliNote Sync] 已有 ' + existing.state.tasks.length + ' 条, 新增 ' + toAdd.length + ' 条');

            if (toAdd.length === 0) {{
                console.log('%c[BiliNote Sync] 已是最新，无需同步', 'color: #10b981;');
                return;
            }}

            // 逐条写入，每条独立事务（避免大批量事务超时/锁冲突）
            let done = 0;
            function writeOne(index) {{
                if (index >= toAdd.length) {{
                    console.log('%c[BiliNote Sync] 同步完成！共写入 ' + done + ' 条', 'color: #10b981; font-weight: bold; font-size: 14px;');
                    console.log('%c[BiliNote Sync] 即将刷新页面...', 'color: #f59e0b;');
                    setTimeout(function() {{ window.location.reload(); }}, 600);
                    return;
                }}
                const task = toAdd[index];
                existing.state.tasks.unshift(task);

                const tx = db.transaction([STORE_NAME], 'readwrite');
                const st = tx.objectStore(STORE_NAME);
                const putReq = st.put(JSON.stringify(existing), STORAGE_KEY);

                putReq.onsuccess = function() {{
                    done++;
                    if (done % 10 === 0 || done === toAdd.length) {{
                        console.log('[BiliNote Sync] 进度: ' + done + '/' + toAdd.length);
                    }}
                }};

                tx.oncomplete = function() {{
                    setTimeout(function() {{ writeOne(index + 1); }}, 15);
                }};

                tx.onerror = function(err) {{
                    console.error('[BiliNote Sync] 写入失败 (#' + index + '):', err);
                    // 回滚 unshift，继续下一条
                    existing.state.tasks.shift();
                    setTimeout(function() {{ writeOne(index + 1); }}, 15);
                }};
            }}

            writeOne(0);
        }};

        getReq.onerror = function() {{
            console.error('[BiliNote Sync] 读取现有数据失败');
        }};
    }};
}})();
    """

    return jsonify({
        "script": injection_script.strip(),
        "count": len(tasks)
    })


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
