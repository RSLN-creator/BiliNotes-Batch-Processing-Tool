/* ── BiliNote Batch Tool ──────────────────────────────── */
/* D-03: 事件驱动 + DOM 操作，原生 JS 无框架 */

var $ = function (id) { return document.getElementById(id); };

/* ── 状态 ──────────────────────────────────────────────── */
var state = {
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
    searchQuery: "",
    statusFilter: "all",
};

/* ── DOM 引用 ──────────────────────────────────────────── */
var fileInput, selectFileBtn, fileName;
var providerSelect, modelSelect, styleSelect, promptInput;
var optScreenshot, optLink, optVideoUnderstanding;
var saveMd, saveTxt, saveJson, saveMindmap;
var videoList, videoCount, videoToolbar;
var banner;
var startBtn, stopBtn, bilinoteLinkBtn, progressBar, progressSection, logArea;
var totalSpan, successSpan, failedSpan, skippedSpan, currentSpan;
var outputDirInput, pickDirBtn;
var selectAllCb, searchInput, statusFilterEl, selectedCountEl;

/* ── 初始化 ────────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", function () {
    fileInput = $("file-input");
    selectFileBtn = $("select-file-btn");
    fileName = $("file-name");
    providerSelect = $("provider-select");
    modelSelect = $("model-select");
    styleSelect = $("style-select");
    promptInput = $("prompt-input");
    optScreenshot = $("opt-screenshot");
    optLink = $("opt-link");
    optVideoUnderstanding = $("opt-video-understanding");
    saveMd = $("save-md");
    saveTxt = $("save-txt");
    saveJson = $("save-json");
    saveMindmap = $("save-mindmap");
    videoList = $("video-list");
    videoCount = $("video-count");
    videoToolbar = $("video-toolbar");
    banner = $("banner");
    startBtn = $("start-btn");
    stopBtn = $("stop-btn");
    bilinoteLinkBtn = $("bilinote-link-btn");
    progressBar = $("progress-bar");
    progressSection = $("progress-section");
    logArea = $("log-area");
    totalSpan = $("stat-total");
    successSpan = $("stat-success");
    failedSpan = $("stat-failed");
    skippedSpan = $("stat-skipped");
    currentSpan = $("stat-current");
    outputDirInput = $("output-dir");
    pickDirBtn = $("pick-dir-btn");
    selectAllCb = $("select-all");
    searchInput = $("search-input");
    statusFilterEl = $("status-filter");
    selectedCountEl = $("selected-count");

    selectFileBtn.addEventListener("click", function () { fileInput.click(); });
    fileInput.addEventListener("change", onFileSelected);
    providerSelect.addEventListener("change", onProviderChanged);
    startBtn.addEventListener("click", startBatch);
    stopBtn.addEventListener("click", stopBatch);
    pickDirBtn.addEventListener("click", pickOutputDir);
    bilinoteLinkBtn.addEventListener("click", function () { window.open("http://localhost:3015", "_blank"); });
    selectAllCb.addEventListener("change", onSelectAll);
    searchInput.addEventListener("input", onSearchFilter);
    statusFilterEl.addEventListener("change", onSearchFilter);
});

/* ── 输出目录选择 ──────────────────────────────────────── */
async function pickOutputDir() {
    try {
        var handle = await window.showDirectoryPicker();
        outputDirInput.value = handle.name;
    } catch (e) {
        try {
            var res = await fetch("/api/pick-directory");
            var data = await res.json();
            if (data.path) outputDirInput.value = data.path;
        } catch (e2) {}
    }
}

/* ── 文件选择 ──────────────────────────────────────────── */
async function onFileSelected(event) {
    var file = event.target.files[0];
    if (!file) return;
    state.selectedFile = file;
    fileName.textContent = file.name;
    await loadFile(file);
}

async function loadFile(file) {
    try {
        var text = await file.text();
        var fileType = file.name.toLowerCase().endsWith(".csv") ? "csv" : "json";

        var res = await fetch("/api/parse-file", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: text, filename: file.name, fileType: fileType }),
        });
        var data = await res.json();
        if (!res.ok) { showBanner("文件解析失败：" + (data.error || "未知错误"), "error"); return; }

        state.videos = data.videos;
        state.searchQuery = ""; state.statusFilter = "all";
        searchInput.value = ""; statusFilterEl.value = "all"; selectAllCb.checked = false;
        await loadCheckpoint();
        renderVideoList();
        hideBanner();
        if (!providerSelect.value || providerSelect.value === "") await loadProviders();
    } catch (err) { showBanner("文件读取失败：" + err.message, "error"); }
}

/* ── BiliNote 供应商/模型 ──────────────────────────────── */
async function onProviderChanged() {
    var pid = providerSelect.value;
    if (!pid) { modelSelect.disabled = true; modelSelect.innerHTML = '<option value="">-- 请先选择供应商 --</option>'; return; }
    modelSelect.innerHTML = '<option value="">加载中...</option>';
    await loadModels(pid);
}

async function loadProviders() {
    try {
        var res = await fetch("/api/providers"); var data = await res.json();
        if (!data.connected) { showBanner("无法连接 BiliNote，请确认服务已启动", "warning"); providerSelect.innerHTML = '<option value="">BiliNote 未连接</option>'; return; }
        var providers = data.providers || [];
        if (providers.length === 0) { showBanner("BiliNote 中未配置供应商，请先在 BiliNote 中添加", "warning"); providerSelect.innerHTML = '<option value="">暂无供应商</option>'; return; }
        hideBanner(); state.providers = providers;
        providerSelect.innerHTML = '<option value="">-- 选择供应商 --</option>' + providers.map(function (p) { return '<option value="' + p.id + '">' + escapeHtml(p.name) + "</option>"; }).join("");
    } catch (err) { showBanner("无法连接 BiliNote：" + err.message, "warning"); providerSelect.innerHTML = '<option value="">BiliNote 未连接</option>'; }
}

async function loadModels(providerId) {
    try {
        var res = await fetch("/api/providers/" + providerId + "/models"); var data = await res.json();
        if (!data.connected) { showBanner("无法连接 BiliNote", "warning"); modelSelect.disabled = true; modelSelect.innerHTML = '<option value="">-- 无法获取 --</option>'; return; }
        var models = data.models || [];
        if (models.length === 0) { showBanner("该供应商下无可用模型", "warning"); modelSelect.disabled = true; modelSelect.innerHTML = '<option value="">暂无模型</option>'; return; }
        hideBanner(); state.models = models; modelSelect.disabled = false;
        modelSelect.innerHTML = '<option value="">-- 选择模型 --</option>' + models.map(function (m) { return '<option value="' + m.model_name + '">' + escapeHtml(m.model_name) + "</option>"; }).join("");
    } catch (err) { showBanner("无法连接 BiliNote：" + err.message, "warning"); modelSelect.disabled = true; modelSelect.innerHTML = '<option value="">-- 无法获取 --</option>'; }
}

/* ── 搜索/筛选 ─────────────────────────────────────────── */
function getFilteredVideos() {
    var q = state.searchQuery.toLowerCase(), filter = state.statusFilter;
    return state.videos.filter(function (v) {
        if (filter === "pending" && state.processedBvids.has(v.bvid)) return false;
        if (filter === "done" && !state.processedBvids.has(v.bvid)) return false;
        if (q) return (v.bvid || "").toLowerCase().indexOf(q) !== -1 || (v.title || "").toLowerCase().indexOf(q) !== -1;
        return true;
    });
}

function getSelectedBvids() {
    var cbs = videoList.querySelectorAll(".video-cb:checked"), out = [];
    cbs.forEach(function (cb) { out.push(cb.value); });
    return out;
}

function updateSelectedCount() {
    var sel = getSelectedBvids().length, total = state.videos.length;
    selectedCountEl.textContent = sel > 0 ? "已选 " + sel + "/" + total : "";
}

function onSelectAll() {
    videoList.querySelectorAll(".video-cb").forEach(function (cb) { cb.checked = selectAllCb.checked; });
    updateSelectedCount();
}

function onSearchFilter() { state.searchQuery = searchInput.value; state.statusFilter = statusFilterEl.value; selectAllCb.checked = false; renderVideoList(); }

/* ── 视频列表渲染 ──────────────────────────────────────── */
function renderVideoList() {
    var filtered = getFilteredVideos();

    if (!state.videos || state.videos.length === 0) {
        videoToolbar.style.display = "none";
        videoList.innerHTML = '<div class="empty-state"><p class="empty-title">欢迎使用 BiliNote 批量收藏转写</p><ol class="empty-guide"><li>从 <strong>Bilishelf</strong> 浏览器插件导出收藏文件（JSON 或 CSV）</li><li>点击上方 <strong>"选择收藏文件"</strong> 加载数据</li><li>选择 <strong>供应商</strong> 和 <strong>模型</strong></li><li>点击 <strong>"开始批量处理"</strong> 一键生成笔记</li></ol></div>';
        videoCount.textContent = "共 0 个视频";
        return;
    }

    videoToolbar.style.display = "flex";

    if (filtered.length === 0) {
        videoList.innerHTML = '<div class="empty-state">无匹配视频</div>';
        videoCount.textContent = "共 " + state.videos.length + " 个视频（筛选后 0 个）";
        updateSelectedCount();
        return;
    }

    var groups = {};
    for (var i = 0; i < filtered.length; i++) {
        var v = filtered[i], folder = v.folder || "未分类";
        if (!groups[folder]) groups[folder] = [];
        groups[folder].push(v);
    }

    var html = "", keys = Object.keys(groups);
    for (var gi = 0; gi < keys.length; gi++) {
        var folder = keys[gi], items = groups[folder];
        html += '<div class="folder-group"><h3 class="folder-title">' + escapeHtml(folder) + " (" + items.length + ")</h3>";
        html += '<table class="video-table"><thead><tr>';
        html += '<th class="cb-col"><input type="checkbox" class="folder-cb"></th>';
        html += '<th class="bv-col">BV号</th><th>标题</th><th class="status-col">状态</th>';
        html += "</tr></thead><tbody>";
        for (var vi = 0; vi < items.length; vi++) {
            var v = items[vi], isDone = state.processedBvids.has(v.bvid);
            html += "<tr>";
            html += '<td class="cb-col"><input type="checkbox" class="video-cb" value="' + v.bvid + '"></td>';
            html += '<td class="bvid">' + escapeHtml(v.bvid) + "</td>";
            html += '<td><a href="' + v.url + '" target="_blank" rel="noopener" class="video-link" title="在 B 站打开">' + escapeHtml(v.title) + "</a></td>";
            html += '<td><span class="status-badge ' + (isDone ? "status-success" : "status-pending") + '">' + (isDone ? "已处理" : "待处理") + "</span></td>";
            html += "</tr>";
        }
        html += "</tbody></table></div>";
    }
    videoList.innerHTML = html;
    selectAllCb.checked = false; updateSelectedCount();

    videoList.querySelectorAll(".folder-cb").forEach(function (cb) {
        cb.addEventListener("change", function () {
            var cbs = cb.closest("table").querySelectorAll(".video-cb");
            cbs.forEach(function (vc) { vc.checked = cb.checked; });
            updateSelectedCount();
        });
    });
    videoList.querySelectorAll(".video-cb").forEach(function (cb) { cb.addEventListener("change", updateSelectedCount); });

    var doneCount = 0;
    state.videos.forEach(function (v) { if (state.processedBvids.has(v.bvid)) doneCount++; });
    videoCount.textContent = "共 " + state.videos.length + " 个视频（已处理 " + doneCount + "）";
}

/* ── 横幅 ──────────────────────────────────────────────── */
function showBanner(m, t) { banner.textContent = m; banner.className = "banner banner-" + (t || "warning"); }
function hideBanner() { banner.className = "banner hidden"; }
function escapeHtml(s) { var d = document.createElement("div"); d.appendChild(document.createTextNode(s)); return d.innerHTML; }

/* ── 批处理 ────────────────────────────────────────────── */
function sleep(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }

async function loadCheckpoint() {
    try { var res = await fetch("/api/checkpoint"); var data = await res.json(); state.processedBvids = new Set(data.processed || []); }
    catch (err) { state.processedBvids = new Set(); }
}

function updateButtons() { startBtn.disabled = state.running; stopBtn.disabled = !state.running; }

function updateProgress() {
    var done = state.stats.success + state.stats.failed + state.stats.skipped;
    var pct = state.stats.total > 0 ? (done / state.stats.total * 100) : 0;
    progressBar.style.width = pct + "%";
    totalSpan.textContent = state.stats.total;
    successSpan.textContent = state.stats.success;
    failedSpan.textContent = state.stats.failed;
    skippedSpan.textContent = state.stats.skipped;
    currentSpan.textContent = state.running ? (state.currentIndex + 1) : "---";
}

function addLog(message, level) {
    var t = new Date().toLocaleTimeString("zh-CN", { hour12: false });
    var e = document.createElement("div"); e.className = "log-entry log-" + (level || "info");
    e.textContent = "[" + t + "] " + message; logArea.appendChild(e); logArea.scrollTop = logArea.scrollHeight;
}

function getSaveOptions() {
    var opts = [];
    if (saveMd.checked) opts.push("markdown");
    if (saveTxt.checked) opts.push("transcript");
    if (saveJson.checked) opts.push("json");
    if (saveMindmap.checked) opts.push("mindmap");
    return opts;
}

function getFormat() {
    var fmt = ["markdown"];
    if (saveMindmap.checked && fmt.indexOf("mindmap") === -1) fmt.push("mindmap");
    return fmt;
}

async function submitVideo(video) {
    var body = {
        bvid: video.bvid, title: video.title, folder: video.folder || "未分类", url: video.url,
        model_name: modelSelect.value, provider_id: providerSelect.value,
        style: styleSelect.value, extras: promptInput.value,
        format: getFormat(),
        screenshot: optScreenshot.checked, link: optLink.checked,
        video_understanding: optVideoUnderstanding.checked,
        save_options: getSaveOptions(),
        output_dir: outputDirInput.value.trim() || "./output",
    };

    var res = await fetch("/api/process-video", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    var data = await res.json();
    if (!res.ok) throw new Error(data.error || "提交失败");
    return data.task_id;
}

function pollTaskStatus(taskId, timeoutMs) {
    timeoutMs = timeoutMs || 900000;
    return new Promise(function (resolve, reject) {
        var startTime = Date.now();
        var interval = setInterval(async function () {
            try {
                if (Date.now() - startTime > timeoutMs) { clearInterval(interval); reject(new Error("任务超时")); return; }
                var res = await fetch("/api/task-status/" + taskId); var data = await res.json();
                if (data.status === "SUCCESS" || data.status === "FAILED") { clearInterval(interval); resolve(data); }
            } catch (err) { clearInterval(interval); reject(err); }
        }, 3000);
    });
}

function stopBatch() { state.stopRequested = true; addLog("用户请求停止，完成当前任务后结束...", "warning"); stopBtn.disabled = true; }

async function startBatch() {
    if (state.running) return;
    if (!providerSelect.value) { showBanner("请先选择供应商和模型", "warning"); return; }
    if (!modelSelect.value) { showBanner("请先选择模型", "warning"); return; }

    var selBvids = getSelectedBvids();
    var batch = selBvids.length > 0
        ? (function () { var s = new Set(selBvids); return state.videos.filter(function (v) { return s.has(v.bvid); }); })()
        : state.videos;

    var skipCount = 0;
    for (var i = 0; i < batch.length; i++) { if (state.processedBvids.has(batch[i].bvid)) skipCount++; }
    var willProcess = batch.length - skipCount;
    if (willProcess === 0) { showBanner("所选视频已全部处理完毕", "warning"); return; }

    state.running = true; state.stopRequested = false; state.currentIndex = 0;
    state.stats = { total: willProcess, success: 0, failed: 0, skipped: 0 };
    state.outputDir = outputDirInput.value.trim() || "./output";

    progressSection.style.display = "block"; logArea.innerHTML = "";
    updateButtons(); updateProgress();
    addLog("批量处理开始 — " + willProcess + " 个/选中 " + batch.length + " — 输出: " + state.outputDir, "info");

    var processed = 0;
    for (var i = 0; i < batch.length; i++) {
        state.currentIndex = processed;
        if (!state.running || state.stopRequested) break;
        var video = batch[i];

        if (state.processedBvids.has(video.bvid)) {
            addLog("[" + (i + 1) + "/" + batch.length + "] 跳过已处理: " + video.title, "skip");
            state.stats.skipped++; processed++; continue;
        }

        addLog("[" + (i + 1) + "/" + batch.length + "] " + video.title, "info");
        try {
            var taskId = await submitVideo(video);
            var result = await pollTaskStatus(taskId, 900000);
            if (result.status === "SUCCESS") {
                addLog("完成: " + video.title + " — BiliNote: http://localhost:3015", "success");
                state.processedBvids.add(video.bvid); state.stats.success++;
            } else { addLog("失败: " + video.title, "error"); state.stats.failed++; }
        } catch (err) { addLog("错误: " + video.title + " - " + err.message, "error"); state.stats.failed++; }
        processed++; updateProgress();
        if (i < batch.length - 1 && state.running && !state.stopRequested) await sleep(3000);
    }

    state.running = false; updateButtons(); renderVideoList();
    addLog("批量处理结束 — 成功 " + state.stats.success + " 失败 " + state.stats.failed + " 跳过 " + state.stats.skipped, "info");
}
