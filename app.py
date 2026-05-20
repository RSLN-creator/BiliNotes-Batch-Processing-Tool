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


# ── 启动入口 ──────────────────────────────────────────────
if __name__ == "__main__":
    Timer(1, lambda: webbrowser.open(f"http://localhost:{GUI_PORT}")).start()
    print(f"[*] BiliNote Batch Tool 启动中...")
    print(f"[*] 访问 http://localhost:{GUI_PORT}")
    print(f"[*] BiliNote: {BILINOTE_BASE_URL}")
    app.run(host="127.0.0.1", port=GUI_PORT, debug=False)
