"""BiliNote 批量收藏转写工具 — Flask GUI 后端"""
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
GUI_PORT = int(os.getenv("GUI_PORT", "18765"))
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


@app.route("/api/readme")
def get_readme():
    readme_path = Path(__file__).parent / "README.md"
    if readme_path.exists():
        return readme_path.read_text(encoding="utf-8")
    return "# 暂无帮助文档"


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


@app.route("/api/bilibili-video-info/<bvid>")
def bilibili_video_info(bvid):
    """查询B站API获取视频真实分P数"""
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Referer": "https://www.bilibili.com/",
    }
    try:
        resp = requests.get(
            f"https://api.bilibili.com/x/web-interface/view?bvid={bvid}",
            headers=headers, timeout=8
        )
        body = resp.json()
        if body.get("code") != 0:
            return jsonify({"error": body.get("message", "B站API失败")}), 502
        v = body["data"]
        pages = v.get("pages", [])
        return jsonify({
            "bvid": bvid,
            "title": v.get("title", ""),
            "pageCount": len(pages),
            "pages": [{"page": p["page"], "part": p["part"]} for p in pages],
        })
    except requests.RequestException as e:
        return jsonify({"error": f"B站API请求失败: {e}"}), 502
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/multip-cache", methods=["GET", "POST"])
def multip_cache():
    """读取/写入 _已检测分P.json（跟随输出目录，含已处理分P追踪）"""
    output_dir = request.args.get("output_dir", str(OUTPUT_DIR))
    cache_path = Path(output_dir) / "_已检测分P.json"
    if request.method == "GET":
        if cache_path.exists():
            data = json.loads(cache_path.read_text(encoding="utf-8"))
        else:
            data = {}
        if "_processed" not in data:
            data["_processed"] = {}
        if "_detected" not in data:
            # 迁移旧格式：顶层key移动到_detected（保留全部，含pc=1用于跟踪已检测）
            detected = {k: v for k, v in data.items() if k not in ("_processed", "_detected") and isinstance(v, int)}
            data["_detected"] = detected
            for k in list(data.keys()):
                if k not in ("_detected", "_processed"):
                    del data[k]
        data.setdefault("_detected", {})
        return jsonify(data)
    elif request.method == "POST":
        data = request.get_json(silent=True) or {}
        cache_path.parent.mkdir(parents=True, exist_ok=True)
        tmp = cache_path.with_suffix(".tmp")
        tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        os.replace(str(tmp), str(cache_path))
        return jsonify({"ok": True})


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
    p_num = data.get("p", 1) or 1
    model_name = data.get("model_name", "").strip()
    provider_id = data.get("provider_id", "").strip()

    if not model_name or not provider_id:
        return jsonify({"error": "请先选择供应商和模型"}), 400

    params = {
        "video_url": url,
        "platform": "bilibili",
        "quality": data.get("quality", "medium"),
        "model_name": model_name,
        "provider_id": provider_id,
        "format": data.get("format", ["markdown"]),
        "style": data.get("style", "detailed"),
        "screenshot": data.get("screenshot", False),
        "link": data.get("link", False),
        "video_understanding": data.get("video_understanding", False),
    }
    if data.get("extras"):
        params["extras"] = data["extras"]
    if data.get("skip_subtitle"):
        params["skip_subtitle"] = True

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
            "p": p_num,
            "cover": data.get("cover", ""),
            "ownerName": data.get("ownerName", ""),
            "ownerMid": data.get("ownerMid", ""),
            "pageCount": data.get("pageCount", 1),
            "description": data.get("description", ""),
            "skip_subtitle": data.get("skip_subtitle", False),
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
            p_num = ctx.get("p", 1)
            files = save_video_output(
                ctx.get("folder", "未分类"),
                ctx.get("bvid", ""),
                ctx.get("title", ""),
                result,
                Path(ctx.get("output_dir", str(OUTPUT_DIR))),
                ctx.get("save_opts", ["markdown", "transcript", "json"]),
                p_num=p_num,
            )
            inner["files"] = files
            update_checkpoint(
                ctx.get("bvid", ""), "SUCCESS", task_id,
                Path(ctx.get("output_dir", str(OUTPUT_DIR))),
                folder=ctx.get("folder", "未分类"),
                title=ctx.get("title", ""),
                transcript_source=inner["transcript_source"],
                p_num=p_num,
                cover=ctx.get("cover", ""),
                ownerName=ctx.get("ownerName", ""),
                ownerMid=ctx.get("ownerMid", ""),
                pageCount=ctx.get("pageCount", 1),
                description=ctx.get("description", ""),
                skip_subtitle=ctx.get("skip_subtitle", False),
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
    # 找该 bvid 所有分P 的记录
    matching = [(k, r) for k, r in records.items() if k.startswith(f"{bvid}|")]
    if not matching:
        return jsonify({"error": "未找到该视频的处理记录"}), 404
    deleted = []
    for key, rec in matching:
        task_id = rec.get("task_id", "")
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
                    deleted.append(task_id)
                else:
                    app.logger.warning("删除BiliNotes缓存失败, returncode=%d, stderr=%s", proc.returncode, proc.stderr)
            except Exception as e:
                app.logger.warning("删除BiliNotes缓存失败: %s", e)
    # 删除 output 目录下对应分P的笔记文件
    import shutil
    deleted_dirs = []
    for key, rec in matching:
        rec_output_dir = Path(rec.get("output_dir", str(OUTPUT_DIR)))
        safe_title = sanitize_filename(rec.get("title", ""), max_len=80)
        safe_folder = sanitize_filename(rec.get("folder", "未分类"), max_len=60)
        p_num = int(rec.get("p", 1) or 1)
        p_suffix = f" - P{p_num}" if p_num > 1 else ""
        dir_name = f"{bvid} - {safe_title}{p_suffix}"
        target_dir = rec_output_dir / safe_folder / dir_name
        if target_dir.exists():
            try:
                shutil.rmtree(str(target_dir))
                deleted_dirs.append(str(target_dir))
            except Exception as e:
                app.logger.warning("删除输出目录失败 %s: %s", target_dir, e)
    # 删除 checkpoint 中该 bvid 的所有记录
    keys_to_delete = [k for k in records if k.startswith(f"{bvid}|")]
    for k in keys_to_delete:
        del records[k]
    _save_checkpoint_file(records)
    for rec2 in matching:
        tid = rec2[1].get("task_id", "")
        _completed_tasks.discard(tid)
        if tid in _task_map:
            del _task_map[tid]
    # 同时清除该 bvid 的多P缓存
    try:
        multip_cache_path = Path(OUTPUT_DIR) / "_已检测分P.json"
        if multip_cache_path.exists():
            mp = json.loads(multip_cache_path.read_text(encoding="utf-8"))
            if bvid in mp.get("_processed", {}):
                del mp["_processed"][bvid]
                tmp = multip_cache_path.with_suffix(".tmp")
                tmp.write_text(json.dumps(mp, ensure_ascii=False, indent=2), encoding="utf-8")
                os.replace(str(tmp), str(multip_cache_path))
    except Exception:
        pass
    return jsonify({"ok": True, "bvid": bvid, "deleted_cache": deleted, "deleted_dirs": len(deleted_dirs)})


@app.route("/api/backfill-transcript-source", methods=["POST"])
def backfill_transcript_source():
    records = load_checkpoint()
    updated = 0
    for key, rec in records.items():
        if rec.get("status") != "SUCCESS":
            continue
        if rec.get("transcript_source"):
            continue
        task_id = rec.get("task_id", "")
        source = ""
        bvid = _bvid_from_key(key)
        p_num = int(rec.get("p", 1) or 1)
        output_dir = Path(rec.get("output_dir", str(OUTPUT_DIR)))
        safe_folder = sanitize_filename(rec.get("folder", "未分类"), max_len=60)
        safe_title = sanitize_filename(rec.get("title", ""), max_len=80)
        p_suffix = f" - P{p_num}" if p_num > 1 else ""
        dir_name = f"{bvid} - {safe_title}{p_suffix}"
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
    return jsonify({"records": records, "processed": sorted([k for k, r in records.items() if r.get("status") == "SUCCESS"])})


@app.route("/api/checkpoint/<bvid>", methods=["DELETE"])
def delete_checkpoint(bvid):
    records = load_checkpoint()
    keys_to_delete = [k for k in records if k.startswith(f"{bvid}|")]
    for k in keys_to_delete:
        del records[k]
    if keys_to_delete:
        _save_checkpoint_file(records)
    _processed_bvids.discard(bvid)
    return jsonify({"ok": True, "deleted": len(keys_to_delete)})


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
    # 支持 ?p=N 指定分P；未指定则取该 bvid 下任意一条记录
    p_param = request.args.get("p", "")
    records = load_checkpoint()
    if p_param.isdigit():
        key = _ckey(bvid, int(p_param))
        rec = records.get(key)
    else:
        rec = None
        for k, r in records.items():
            if _bvid_from_key(k) == bvid:
                rec = r
                break
    if not rec:
        return jsonify({"files": [], "p": None})
    output_dir = Path(rec.get("output_dir", str(OUTPUT_DIR)))
    safe_folder = sanitize_filename(rec.get("folder", "未分类"), max_len=60)
    safe_title = sanitize_filename(rec.get("title", ""), max_len=80)
    p_num = int(rec.get("p", 1) or 1)
    p_suffix = f" - P{p_num}" if p_num > 1 else ""
    dir_name = f"{bvid} - {safe_title}{p_suffix}"
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
    return jsonify({"files": files, "dir": str(dest_dir.resolve()) if dest_dir.exists() else "", "p": p_num})


# ── 文件解析函数 ──────────────────────────────────────────

_COLUMN_MAP = {
    "bvid": ["bvid", "bvid", "BV号", "BV", "avid", "aid"],
    "title": ["title", "标题", "视频标题", "name"],
    "folder": ["folder", "folders", "收藏夹", "folder_title", "folder_name"],
    "url": ["url", "链接", "video_url", "page_url", "bvidUrl"],
    "cover": ["coverUrl", "cover", "cover_url", "pic", "封面", "thumbnail", "image", "图片"],
    "owner_name": ["uploader", "owner_name", "ownerName", "author", "UP主", "up主", "up_name", "uploader_name"],
    "owner_mid": ["owner_mid", "ownerMid", "mid", "UID", "uid", "author_id", "up_id", "uploader_mid", "uploader_id"],
    "page": ["page", "pages", "分P", "page_count", "pageCount", "视频数"],
}


def _find_col(row_keys, aliases):
    for alias in aliases:
        for key in row_keys:
            if key.strip() == alias:
                return key
    return None


def _clean_folder_name(name):
    """保留原始文件夹名（含数字前缀，如 0-竞赛！）"""
    return name or "未分类"


def parse_bilishelf_json(content):
    """解析 Bilishelf JSON — videos 在顶层，通过 folderId 或 folderItems 关联收藏夹"""
    data = json.loads(content)

    # 构建 folderId → 文件夹名 映射
    folder_map = {}
    for f in data.get("folders", []):
        name = _clean_folder_name(f.get("name", ""))
        folder_map[f["id"]] = name or "默认"

    # 构建 videoId → folderId 映射（兼容 folderItems 格式）
    vid_to_fid = {}
    for fi in data.get("folderItems", []):
        vid_to_fid[fi["videoId"]] = fi["folderId"]

    # videos 在顶层
    videos = []
    for v in data.get("videos", []):
        bvid = (v.get("bvid") or "").strip()
        if not bvid:
            continue
        fid = vid_to_fid.get(v.get("id")) or v.get("folderId") or v.get("folder_id") or 0
        cover = v.get("coverUrl") or v.get("cover") or v.get("pic") or ""
        if isinstance(cover, str):
            cover = cover.strip()
        owner_name = (v.get("uploader") or "").strip()
        owner_mid = ""
        space_url = v.get("uploaderSpaceUrl", "")
        m = re.search(r"space\.bilibili\.com/(\d+)", space_url)
        if m:
            owner_mid = m.group(1)
        page_count = int(v.get("page", 1) or 1)
        description = (v.get("description") or "").strip()
        if not description:
            description = ""
        videos.append({
            "bvid": bvid,
            "title": (v.get("title") or "").strip(),
            "url": v.get("bvidUrl", f"https://www.bilibili.com/video/{bvid}/"),
            "folder": folder_map.get(fid, "未分类") if fid else "未分类",
            "cover": cover,
            "ownerName": owner_name,
            "ownerMid": owner_mid,
            "pageCount": page_count,
            "description": description,
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
    col_cover = _find_col(header_fields, _COLUMN_MAP["cover"])
    col_owner_name = _find_col(header_fields, _COLUMN_MAP["owner_name"])
    col_owner_mid = _find_col(header_fields, _COLUMN_MAP["owner_mid"])
    col_uploader_space_url = _find_col(header_fields, ["uploaderSpaceUrl", "uploader_space_url", "space_url"])
    col_page = _find_col(header_fields, _COLUMN_MAP["page"])
    col_description = _find_col(header_fields, ["description", "desc", "简介", "intro", "summary"])
    if col_bvid is None:
        raise ValueError("CSV 中未找到 BV 号列（尝试匹配: bvid, BV号, BV 等）")
    bvid_idx = header_fields.index(col_bvid)
    title_idx = header_fields.index(col_title) if col_title else -1
    url_idx = header_fields.index(col_url) if col_url else -1
    folder_idx = header_fields.index(col_folder) if col_folder else -1
    cover_idx = header_fields.index(col_cover) if col_cover else -1
    owner_name_idx = header_fields.index(col_owner_name) if col_owner_name else -1
    owner_mid_idx = header_fields.index(col_owner_mid) if col_owner_mid else -1
    uploader_space_url_idx = header_fields.index(col_uploader_space_url) if col_uploader_space_url else -1
    page_idx = header_fields.index(col_page) if col_page else -1
    description_idx = header_fields.index(col_description) if col_description else -1
    bvid_pattern = re.compile(r'^BV[0-9A-Za-z]{6,}$')
    lines = content.split('\n')
    videos = []
    row_buffer = []
    in_quotes = False
    for line in lines[1:]:  # 跳过 header
        line = line.rstrip('\r')
        if not in_quotes:
            row_buffer = []
        row_buffer.append(line)
        quote_count = line.count('"')
        in_quotes = (in_quotes + (quote_count % 2)) % 2 == 1
        if in_quotes:
            continue
        combined = ' '.join(row_buffer)
        row = _split_csv_row(combined)
        bvid_val = (row[bvid_idx] if bvid_idx < len(row) else "").strip()
        if not bvid_val or not bvid_pattern.match(bvid_val):
            continue
        title_val = (row[title_idx].strip() if title_idx >= 0 and title_idx < len(row) else "")
        folder_val = (row[folder_idx].strip() if folder_idx >= 0 and folder_idx < len(row) else "")
        folder_val = _clean_folder_name(folder_val) or "未分类"
        url_val = (row[url_idx].strip() if url_idx >= 0 and url_idx < len(row) else "") or f"https://www.bilibili.com/video/{bvid_val}/"
        cover_val = (row[cover_idx].strip() if cover_idx >= 0 and cover_idx < len(row) else "")
        owner_name_val = (row[owner_name_idx].strip() if owner_name_idx >= 0 and owner_name_idx < len(row) else "")
        owner_mid_val = (row[owner_mid_idx].strip() if owner_mid_idx >= 0 and owner_mid_idx < len(row) else "")
        if not owner_mid_val and uploader_space_url_idx >= 0 and uploader_space_url_idx < len(row):
            space_url = row[uploader_space_url_idx].strip()
            m = re.search(r"space\.bilibili\.com/(\d+)", space_url)
            if m:
                owner_mid_val = m.group(1)
        page_val = int(row[page_idx].strip()) if page_idx >= 0 and page_idx < len(row) and row[page_idx].strip().isdigit() else 1
        description_val = (row[description_idx].strip() if description_idx >= 0 and description_idx < len(row) else "")
        videos.append({"bvid": bvid_val, "title": title_val, "folder": folder_val, "url": url_val, "cover": cover_val, "ownerName": owner_name_val, "ownerMid": owner_mid_val, "pageCount": page_val, "description": description_val})
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


def save_video_output(folder_name, bvid, title, result, output_dir, save_opts=None, p_num=1):
    """保存视频笔记 —— 每个视频独立子目录"""
    if save_opts is None:
        save_opts = ["markdown", "transcript", "json"]
    safe_folder = sanitize_filename(folder_name, max_len=60)
    safe_title = sanitize_filename(title, max_len=80)
    p_suffix = f" - P{p_num}" if int(p_num) > 1 else ""
    dir_name = f"{bvid} - {safe_title}{p_suffix}"
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
    # 思维导图 — 从 markdown 标题层级生成 SVG
    if "mindmap" in save_opts:
        md_content = result.get("markdown", "") or ""
        if md_content:
            mm_svg = _markdown_to_mindmap_svg(md_content, title or "笔记")
            mm_path = dest_dir / f"思维导图.svg"
            mm_path.write_text(mm_svg, encoding="utf-8")
            paths["mindmap"] = str(mm_path)

    return paths


def _markdown_to_mindmap_svg(md_text, root_title="笔记"):
    """解析 markdown 标题层级，生成水平树形 SVG 思维导图"""
    import re as _re
    # 提取 # ## ### #### 标题及其层级
    lines = md_text.split("\n")
    nodes = []  # [(level, text, line_idx)]
    for line in lines:
        m = _re.match(r"^(#{1,6})\s+(.+)", line.strip())
        if m:
            level = len(m.group(1))
            text = m.group(2).strip()
            # 跳过太长或太短的标题
            if 1 <= len(text) <= 80:
                nodes.append((level, text))

    if not nodes:
        return '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="50"><text x="10" y="30" font-size="14">无标题节点</text></svg>'

    # 限制节点数量避免 SVG 过大
    if len(nodes) > 80:
        nodes = nodes[:80]

    # 构建树结构: [{text, children:[...], depth, x, y}]
    root = {"text": root_title, "children": [], "depth": 0}
    stack = [(root, 0)]  # (parent_node, parent_level)

    for level, text in nodes:
        node = {"text": text, "children": [], "depth": level}
        # 找到合适的父节点
        while stack and stack[-1][1] >= level:
            stack.pop()
        if stack:
            parent = stack[-1][0]
        else:
            parent = root
        parent["children"].append(node)
        stack.append((node, level))

    # 计算布局
    CHAR_W = 14  # 每字符宽度（中文约14px at 14pt）
    NODE_H = 28
    LEVEL_W = 180
    V_GAP = 6

    def calc_layout(node, depth):
        """递归计算每个节点的 y 坐标，返回子树总高度"""
        node["depth"] = depth
        node["x"] = 20 + depth * LEVEL_W
        if not node["children"]:
            node["h"] = NODE_H
            node["y"] = 0
            return NODE_H + V_GAP
        total = 0
        for child in node["children"]:
            total += calc_layout(child, depth + 1)
        # 父节点居中
        first_child = node["children"][0]
        last_child = node["children"][-1]
        mid = (first_child["y"] + last_child["y"] + NODE_H) / 2 - NODE_H / 2
        node["y"] = mid
        node["h"] = NODE_H
        return total

    y_start = 20
    # First pass: calculate child heights
    total_h = 0
    for child in root["children"]:
        total_h += calc_layout(child, 1)

    # Position root
    root["x"] = 10
    if root["children"]:
        fc = root["children"][0]
        lc = root["children"][-1]
        root["y"] = (fc["y"] + lc["y"] + NODE_H) / 2 - NODE_H / 2
    else:
        root["y"] = 0
    root["h"] = NODE_H

    # 计算 SVG 尺寸
    all_nodes = []
    def collect(node):
        all_nodes.append(node)
        for child in node["children"]:
            collect(child)
    collect(root)

    max_x = max(n["x"] + len(n["text"]) * CHAR_W + 30 for n in all_nodes) if all_nodes else 300
    max_y = max(n["y"] + NODE_H for n in all_nodes) + 20 if all_nodes else 100

    # 生成 SVG
    svg_lines = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{max_x}" height="{max_y}" '
        f'style="background:#1a1a2e;font-family:sans-serif;">',
        '<defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="0%">'
        '<stop offset="0%" stop-color="#6366f1"/><stop offset="100%" stop-color="#a855f7"/></linearGradient></defs>',
    ]

    # 画连线
    def draw_lines(node):
        for child in node["children"]:
            x1 = node["x"] + len(node["text"]) * CHAR_W + 10
            y1 = node["y"] + NODE_H / 2
            x2 = child["x"]
            y2 = child["y"] + NODE_H / 2
            svg_lines.append(
                f'<path d="M{x1},{y1} C{x1+50},{y1} {x2-50},{y2} {x2},{y2}" '
                f'stroke="#4b5563" stroke-width="1.5" fill="none"/>')
            draw_lines(child)

    draw_lines(root)

    # 画节点
    def draw_nodes(node):
        is_root = node["depth"] == 0
        fill = "url(#g)" if is_root else "#2d2d4a"
        stroke = "#818cf8" if is_root else "#4b5563"
        rx = 8 if is_root else 4
        text_w = len(node["text"]) * CHAR_W + 20
        x = node["x"]
        y = node["y"]
        svg_lines.append(
            f'<rect x="{x}" y="{y}" width="{text_w}" height="{NODE_H}" rx="{rx}" '
            f'fill="{fill}" stroke="{stroke}" stroke-width="1"/>')
        tc = "#e0e7ff" if is_root else "#c4b5fd"
        fs = "15" if is_root else "13"
        svg_lines.append(
            f'<text x="{x+10}" y="{y+19}" font-size="{fs}" fill="{tc}" '
            f'font-weight="{("bold" if is_root else "normal")}">{_escape_svg(node["text"])}</text>')
        for child in node["children"]:
            draw_nodes(child)

    draw_nodes(root)
    svg_lines.append("</svg>")
    return "\n".join(svg_lines)


def _escape_svg(text):
    """转义 SVG 文本中的特殊字符"""
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")


def _ckey(bvid, p_num):
    """生成 checkpoint 复合键: bvid|pNum"""
    return f"{bvid}|{int(p_num) if p_num else 1}"


def _bvid_from_key(key):
    """从复合键提取 bvid"""
    return key.rsplit("|", 1)[0] if "|" in key else key


def load_checkpoint(output_dir=None):
    if output_dir is None:
        output_dir = OUTPUT_DIR
    path = Path(output_dir) / _CHECKPOINT_FILE
    if not path.exists():
        return {}
    try:
        records = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        app.logger.warning("Checkpoint 文件损坏，将从头开始")
        return {}
    need_save = False
    # 迁移旧格式：key 不含 | 的是旧记录，转为 bvid|pN
    new_records = {}
    for key, rec in list(records.items()):
        if "|" in key:
            new_records[key] = rec
        else:
            p = int(rec.get("p", 1) or 1)
            new_key = _ckey(key, p)
            new_records[new_key] = rec
            need_save = True
    # 补全缺失字段
    for key, rec in new_records.items():
        for fld, default in [("p", 1), ("cover", ""), ("ownerName", ""), ("ownerMid", ""), ("pageCount", 1), ("description", ""), ("skip_subtitle", False)]:
            if fld not in rec:
                rec[fld] = default
                need_save = True
    if need_save:
        _save_checkpoint_file(new_records)
    return new_records


def update_checkpoint(bvid, status, task_id, output_dir=None, folder="", title="", transcript_source="", p_num=1, cover="", ownerName="", ownerMid="", pageCount=1, description="", skip_subtitle=False):
    actual_output_dir = str(output_dir) if output_dir else str(OUTPUT_DIR)
    records = load_checkpoint()
    key = _ckey(bvid, p_num)
    records[key] = {
        "task_id": task_id,
        "status": status,
        "time": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "folder": folder,
        "title": title,
        "output_dir": actual_output_dir,
        "transcript_source": transcript_source,
        "p": int(p_num) if p_num else 1,
        "cover": cover or "",
        "ownerName": ownerName or "",
        "ownerMid": str(ownerMid or ""),
        "pageCount": int(pageCount or 1),
        "description": description or "",
        "skip_subtitle": skip_subtitle or False,
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
for _key, _rec in _checkpoint_data.items():
    if _rec.get("status") == "SUCCESS":
        _processed_bvids.add(_bvid_from_key(_key))
app.logger.info("从 checkpoint 加载了 %d 个已处理记录 (%d 个独立BV)", len(_checkpoint_data), len(_processed_bvids))


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
    # 按 bvid 分组，同视频多P 放到一个文件夹
    groups = {}
    for key, rec in records.items():
        if rec.get("status") != "SUCCESS":
            continue
        bvid = _bvid_from_key(key)
        groups.setdefault(bvid, []).append(rec)
    copied = 0
    errors = []
    for bvid, recs in groups.items():
        safe_title = sanitize_filename(recs[0].get("title", ""), max_len=80)
        video_dir_name = f"{bvid} - {safe_title}"
        video_dir = dest / video_dir_name
        video_dir.mkdir(parents=True, exist_ok=True)
        for rec in recs:
            rec_output_dir = Path(rec.get("output_dir", str(OUTPUT_DIR)))
            safe_folder = sanitize_filename(rec.get("folder", "未分类"), max_len=60)
            p_num = int(rec.get("p", 1) or 1)
            p_label = f"P{p_num}"
            p_suffix = f" - P{p_num}" if p_num > 1 else ""
            src_dir_name = f"{bvid} - {safe_title}{p_suffix}"
            src_dir = rec_output_dir / safe_folder / src_dir_name
            if not src_dir.exists() and rec_output_dir.exists():
                found = None
                for d in rec_output_dir.rglob(bvid + "*"):
                    if d.is_dir() and d.name.endswith(p_suffix):
                        found = d
                        break
                if not found:
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
                elif file_type == "mindmap" and (f.name == "思维导图.md" or f.name == "思维导图.svg"):
                    match = True
                if match:
                    try:
                        new_name = f"{f.stem} - {p_label}{f.suffix}"
                        shutil.copy2(str(f), str(video_dir / new_name))
                        copied += 1
                    except Exception as e:
                        errors.append(f"{bvid} {p_label} {f.name}: {e}")
    return jsonify({"copied": copied, "errors": errors})


@app.route("/api/bilinotes-sync")
def bilinotes_sync():
    existing_ids = set(request.args.get("existing_ids", "").split(",")) if request.args.get("existing_ids") else set()
    records = load_checkpoint()
    tasks = []
    for key, rec in records.items():
        if rec.get("status") != "SUCCESS":
            continue
        task_id = rec.get("task_id", "")
        if task_id in existing_ids:
            continue
        bvid = _bvid_from_key(key)
        p_num = int(rec.get("p", 1) or 1)
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

        if not result or not result.get("markdown"):
            continue

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
