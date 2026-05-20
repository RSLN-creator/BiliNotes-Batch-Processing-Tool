/* ── BiliNote Batch Tool — 前端交互 ──────────────────── */
/* D-03: 事件驱动 + DOM 操作，原生 JS 无框架 */

const $ = (id) => document.getElementById(id);

/* ── 状态 ──────────────────────────────────────────────── */
const state = {
    videos: [],
    selectedFile: null,
    providers: [],
    models: [],
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
    providerSelect.addEventListener("change", onProviderChanged);
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
        /* D-04: 文件加载成功后检测 BiliNote 连接 */
        await loadProviders();
    } catch (err) {
        showBanner("文件读取失败：" + err.message, "error");
    }
}

/* ── BiliNote 供应商/模型 ──────────────────────────────── */
async function onProviderChanged() {
    const providerId = providerSelect.value;
    if (!providerId) {
        modelSelect.disabled = true;
        modelSelect.innerHTML = '<option value="">-- 请先选择供应商 --</option>';
        return;
    }

    modelSelect.innerHTML = '<option value="">加载中...</option>';
    await loadModels(providerId);
}

async function loadProviders() {
    try {
        const res = await fetch("/api/providers");
        const data = await res.json();

        if (!data.connected) {
            showBanner("无法连接 BiliNote，请确认服务已启动", "warning");
            providerSelect.innerHTML = '<option value="">BiliNote 未连接</option>';
            return;
        }

        const providers = data.providers || [];
        if (providers.length === 0) {
            /* EDGE-02: 供应商未配置 */
            showBanner("BiliNote 中未配置供应商，请先在 BiliNote 中添加", "warning");
            providerSelect.innerHTML = '<option value="">暂无供应商</option>';
            return;
        }

        hideBanner();
        state.providers = providers;
        providerSelect.innerHTML =
            '<option value="">-- 选择供应商 --</option>' +
            providers
                .map(function (p) {
                    return (
                        '<option value="' +
                        p.id +
                        '">' +
                        escapeHtml(p.name) +
                        "</option>"
                    );
                })
                .join("");
    } catch (err) {
        showBanner("无法连接 BiliNote：" + err.message, "warning");
        providerSelect.innerHTML = '<option value="">BiliNote 未连接</option>';
    }
}

async function loadModels(providerId) {
    try {
        const res = await fetch("/api/providers/" + providerId + "/models");
        const data = await res.json();

        if (!data.connected) {
            showBanner("无法连接 BiliNote", "warning");
            modelSelect.disabled = true;
            modelSelect.innerHTML = '<option value="">-- 无法获取 --</option>';
            return;
        }

        const models = data.models || [];
        if (models.length === 0) {
            showBanner("该供应商下无可用模型", "warning");
            modelSelect.disabled = true;
            modelSelect.innerHTML = '<option value="">暂无模型</option>';
            return;
        }

        hideBanner();
        state.models = models;
        modelSelect.disabled = false;
        modelSelect.innerHTML =
            '<option value="">-- 选择模型 --</option>' +
            models
                .map(function (m) {
                    return (
                        '<option value="' +
                        m.id +
                        '">' +
                        escapeHtml(m.name) +
                        "</option>"
                    );
                })
                .join("");
    } catch (err) {
        showBanner("无法连接 BiliNote：" + err.message, "warning");
        modelSelect.disabled = true;
        modelSelect.innerHTML = '<option value="">-- 无法获取 --</option>';
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
