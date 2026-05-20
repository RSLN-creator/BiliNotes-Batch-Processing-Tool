/* ── BiliNote Batch Tool — 前端交互 ──────────────────── */
/* D-03: 事件驱动 + DOM 操作，原生 JS 无框架 */

const $ = (id) => document.getElementById(id);

/* ── 状态 ──────────────────────────────────────────────── */
const state = {
    videos: [],
    selectedFile: null,
    providers: [],
    models: [],
    running: false,
    stopRequested: false,
    processedBvids: new Set(),
    currentIndex: 0,
    stats: { total: 0, success: 0, failed: 0, skipped: 0 },
    outputDir: "./output",
};

/* ── DOM 引用 ──────────────────────────────────────────── */
let fileInput, selectFileBtn, fileName;
let providerSelect, modelSelect, styleSelect, promptInput;
let videoList, videoCount;
let banner;
let startBtn, stopBtn, progressBar, progressSection, logArea;
let totalSpan, successSpan, failedSpan, skippedSpan, currentSpan;
let outputDirInput;

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
    startBtn = $("start-btn");
    stopBtn = $("stop-btn");
    progressBar = $("progress-bar");
    progressSection = $("progress-section");
    logArea = $("log-area");
    totalSpan = $("stat-total");
    successSpan = $("stat-success");
    failedSpan = $("stat-failed");
    skippedSpan = $("stat-skipped");
    currentSpan = $("stat-current");
    outputDirInput = $("output-dir");

    selectFileBtn.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", onFileSelected);
    providerSelect.addEventListener("change", onProviderChanged);
    startBtn.addEventListener("click", startBatch);
    stopBtn.addEventListener("click", stopBatch);
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
        await loadCheckpoint();
        renderVideoList(data.videos);
        hideBanner();
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
                        '<option value="' + p.id + '">' +
                        escapeHtml(p.name) + "</option>"
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
                        '<option value="' + m.id + '">' +
                        escapeHtml(m.name) + "</option>"
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
            if (state.processedBvids.has(v.bvid)) {
                html += '<td><span class="status-badge status-success">已处理</span></td>';
            } else {
                html += '<td><span class="status-badge status-pending">待处理</span></td>';
            }
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

/* ── Phase 2: 批处理 ───────────────────────────────────── */

function sleep(ms) {
    return new Promise(function (resolve) {
        setTimeout(resolve, ms);
    });
}

async function loadCheckpoint() {
    try {
        const res = await fetch("/api/checkpoint");
        const data = await res.json();
        state.processedBvids = new Set(data.processed || []);
    } catch (err) {
        state.processedBvids = new Set();
    }
}

function updateButtons() {
    startBtn.disabled = state.running;
    stopBtn.disabled = !state.running;
}

function updateProgress() {
    var done = state.stats.success + state.stats.failed + state.stats.skipped;
    var pct = state.videos.length > 0 ? (done / state.videos.length * 100) : 0;
    progressBar.style.width = pct + "%";
    totalSpan.textContent = state.videos.length;
    successSpan.textContent = state.stats.success;
    failedSpan.textContent = state.stats.failed;
    skippedSpan.textContent = state.stats.skipped;
    currentSpan.textContent = state.running ? (state.currentIndex + 1) : "---";
}

function addLog(message, level) {
    var time = new Date().toLocaleTimeString("zh-CN", { hour12: false });
    var entry = document.createElement("div");
    entry.className = "log-entry log-" + (level || "info");
    entry.textContent = "[" + time + "] " + message;
    logArea.appendChild(entry);
    logArea.scrollTop = logArea.scrollHeight;
}

async function submitVideo(video) {
    var body = {
        bvid: video.bvid,
        title: video.title,
        folder: video.folder || "未分类",
        url: video.url,
        model_name: modelSelect.value,
        provider_id: providerSelect.value,
        style: styleSelect.value,
        extras: promptInput.value,
    };

    var res = await fetch("/api/process-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });

    var data = await res.json();

    if (!res.ok) {
        throw new Error(data.error || "提交失败");
    }

    return data.task_id;
}

function pollTaskStatus(taskId, timeoutMs) {
    timeoutMs = timeoutMs || 900000;
    return new Promise(function (resolve, reject) {
        var startTime = Date.now();
        var interval = setInterval(async function () {
            try {
                if (Date.now() - startTime > timeoutMs) {
                    clearInterval(interval);
                    reject(new Error("任务超时"));
                    return;
                }

                var res = await fetch("/api/task-status/" + taskId);
                var data = await res.json();

                if (data.status === "SUCCESS" || data.status === "FAILED") {
                    clearInterval(interval);
                    resolve(data);
                }
            } catch (err) {
                clearInterval(interval);
                reject(err);
            }
        }, 3000);
    });
}

function stopBatch() {
    state.stopRequested = true;
    addLog("用户请求停止，完成当前任务后结束...", "warning");
    stopBtn.disabled = true;
}

async function startBatch() {
    if (state.running) return;

    state.running = true;
    state.stopRequested = false;
    state.currentIndex = 0;

    var videos = state.videos;
    state.stats = { total: videos.length, success: 0, failed: 0, skipped: 0 };
    state.outputDir = outputDirInput.value.trim() || "./output";

    progressSection.style.display = "block";
    logArea.innerHTML = "";
    updateButtons();
    updateProgress();
    addLog("批量处理开始 — 输出目录: " + state.outputDir, "info");

    for (var i = 0; i < videos.length; i++) {
        state.currentIndex = i;

        if (!state.running || state.stopRequested) break;

        updateProgress();
        var video = videos[i];

        if (state.processedBvids.has(video.bvid)) {
            addLog("[" + (i + 1) + "/" + videos.length + "] 跳过已处理: " + escapeHtml(video.title || video.bvid), "skip");
            state.stats.skipped++;
            continue;
        }

        addLog("[" + (i + 1) + "/" + videos.length + "] " + escapeHtml(video.title || video.bvid), "info");

        try {
            var taskId = await submitVideo(video);
            var result = await pollTaskStatus(taskId, 900000);

            if (result.status === "SUCCESS") {
                addLog("完成: " + escapeHtml(video.title || video.bvid), "success");
                state.processedBvids.add(video.bvid);
                state.stats.success++;
            } else {
                addLog("失败: " + escapeHtml(video.title || video.bvid), "error");
                state.stats.failed++;
            }
        } catch (err) {
            addLog("错误: " + escapeHtml(video.title || video.bvid) + " - " + err.message, "error");
            state.stats.failed++;
        }

        updateProgress();

        if (i < videos.length - 1 && state.running && !state.stopRequested) {
            await sleep(3000);
        }
    }

    state.running = false;
    updateButtons();
    addLog("批量处理结束", "info");
}
