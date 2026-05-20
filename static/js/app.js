/* ── BiliNote Batch Tool — 前端交互 ──────────────────── */
/* D-03: 事件驱动 + DOM 操作，原生 JS 无框架 */

const $ = (id) => document.getElementById(id);

/* ── 状态 ──────────────────────────────────────────────── */
const state = {
    videos: [],
    selectedFile: null,
    providers: [],
};

/* ── DOM 引用 ──────────────────────────────────────────── */
let fileInput, selectFileBtn, fileName;
let providerSelect, modelSelect, styleSelect, promptInput;
let videoList, videoCount;
let banner;

/* ── 初始化 ────────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", () => {
    fileInput = $("file-input");
    selectFileBtn = $("select-file-btn");
    fileName = $("file-name");
    providerSelect = $("provider-select");
    modelSelect = $("model-select");
    styleSelect = $("style-select");
    promptInput = $("prompt-input");
    videoList = $("video-list");
    videoCount = $("video-count");
    banner = $("banner");

    selectFileBtn.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", onFileSelected);
});

/* ── 文件选择 ──────────────────────────────────────────── */
async function onFileSelected(event) {
    const file = event.target.files[0];
    if (!file) return;

    state.selectedFile = file;
    fileName.textContent = file.name;
    await loadFile(file);
}

async function loadFile(file) {
    try {
        const text = await file.text();
        const fileType = file.name.toLowerCase().endsWith(".csv") ? "csv" : "json";

        const res = await fetch("/api/parse-file", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                content: text,
                filename: file.name,
                fileType: fileType,
            }),
        });

        const data = await res.json();

        if (!res.ok) {
            showBanner("文件解析失败：" + (data.error || "未知错误"), "error");
            return;
        }

        state.videos = data.videos;
        renderVideoList(data.videos);
        hideBanner();
    } catch (err) {
        showBanner("文件读取失败：" + err.message, "error");
    }
}

/* ── 视频列表渲染 ──────────────────────────────────────── */
function renderVideoList(videos) {
    if (!videos || videos.length === 0) {
        videoList.innerHTML = '<div class="empty-state">文件中未找到视频数据</div>';
        videoCount.textContent = "共 0 个视频";
        return;
    }

    /* 按收藏夹分组 */
    const groups = {};
    for (const v of videos) {
        const folder = v.folder || "未分类";
        if (!groups[folder]) groups[folder] = [];
        groups[folder].push(v);
    }

    let html = "";
    for (const [folder, items] of Object.entries(groups)) {
        html += '<div class="folder-group">';
        html += '<h3 class="folder-title">' + escapeHtml(folder) + " (" + items.length + ")</h3>";
        html += '<table class="video-table">';
        html += "<thead><tr><th>BV号</th><th>标题</th><th>状态</th></tr></thead><tbody>";
        for (const v of items) {
            html += "<tr>";
            html += '<td class="bvid">' + escapeHtml(v.bvid) + "</td>";
            html += "<td>" + escapeHtml(v.title) + "</td>";
            html += '<td><span class="status-badge status-pending">待处理</span></td>';
            html += "</tr>";
        }
        html += "</tbody></table></div>";
    }

    videoList.innerHTML = html;
    videoCount.textContent = "共 " + videos.length + " 个视频";
}

/* ── 横幅 ──────────────────────────────────────────────── */
function showBanner(message, type) {
    banner.textContent = message;
    banner.className = "banner banner-" + (type || "warning");
}

function hideBanner() {
    banner.className = "banner hidden";
}

/* ── XSS 防护 ──────────────────────────────────────────── */
function escapeHtml(str) {
    const div = document.createElement("div");
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}
