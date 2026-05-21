/* ── BiliNote Batch Tool ──────────────────────────────── */

var $ = function (id) { return document.getElementById(id); };

var state = {
    videos: [],
    selectedFile: null,
    providers: [],
    models: [],
    running: false,
    stopRequested: false,
    processedBvids: new Set(),
    processedRecords: {},
    currentIndex: 0,
    stats: { total: 0, success: 0, failed: 0, skipped: 0 },
    outputDir: "./output",
    searchQuery: "",
    statusFilter: "all",
    viewMode: "table",
    bilinoteUrl: "http://localhost:3015",
    transcriberConfig: null,
    transcriberModels: null,
    currentModelName: "",
};

var fileInput, selectFileBtn, fileName;
var providerSelect, modelSelect, styleSelect, promptInput, qualitySelect;
var transcriberSelect, whisperModelSelect;
var fmtToc, fmtSummary, fmtScreenshot, fmtLink;
var optVideoUnderstanding, videoInterval, gridRows, gridCols;
var saveMd, saveTxt, saveJson, saveMindmap;
var videoList, videoCount, videoToolbar;
var banner;
var startBtn, startSelectedBtn, stopBtn, bilinoteLinkBtn, progressBar, progressSection, logArea;
var totalSpan, successSpan, failedSpan, skippedSpan, currentSpan;
var outputDirInput, pickDirBtn;
var selectAllCb, searchInput, selectedCountEl, selectedCountBtn;
var viewTableBtn, viewCardBtn;
var themeToggle, screenshotHint, vuHint, screenshotLabel, vuLabel;

document.addEventListener("DOMContentLoaded", function () {
    fileInput = $("file-input"); selectFileBtn = $("select-file-btn"); fileName = $("file-name");
    providerSelect = $("provider-select"); modelSelect = $("model-select");
    styleSelect = $("style-select"); promptInput = $("prompt-input"); qualitySelect = $("quality-select");
    transcriberSelect = $("transcriber-select"); whisperModelSelect = $("whisper-model-select");
    fmtToc = $("fmt-toc"); fmtSummary = $("fmt-summary"); fmtScreenshot = $("fmt-screenshot"); fmtLink = $("fmt-link");
    optVideoUnderstanding = $("opt-video-understanding");
    videoInterval = $("video-interval"); gridRows = $("grid-rows"); gridCols = $("grid-cols");
    saveMd = $("save-md"); saveTxt = $("save-txt"); saveJson = $("save-json"); saveMindmap = $("save-mindmap");
    videoList = $("video-list"); videoCount = $("video-count"); videoToolbar = $("video-toolbar");
    banner = $("banner");
    startBtn = $("start-btn"); startSelectedBtn = $("start-selected-btn"); stopBtn = $("stop-btn");
    bilinoteLinkBtn = $("bilinote-link-btn"); progressBar = $("progress-bar");
    progressSection = $("progress-section"); logArea = $("log-area");
    totalSpan = $("stat-total"); successSpan = $("stat-success"); failedSpan = $("stat-failed");
    skippedSpan = $("stat-skipped"); currentSpan = $("stat-current");
    outputDirInput = $("output-dir"); pickDirBtn = $("pick-dir-btn");
    selectAllCb = $("select-all"); searchInput = $("search-input");
    selectedCountEl = $("selected-count"); selectedCountBtn = $("selected-count-btn");
    viewTableBtn = $("view-table"); viewCardBtn = $("view-card");
    themeToggle = $("theme-toggle");
    screenshotHint = $("screenshot-hint"); vuHint = $("vu-hint");
    screenshotLabel = $("screenshot-label"); vuLabel = $("vu-label");

    selectFileBtn.addEventListener("click", function () { fileInput.click(); });
    fileInput.addEventListener("change", onFileSelected);
    providerSelect.addEventListener("change", function () { onProviderChanged(); saveConfig(); });
    modelSelect.addEventListener("change", function () { onModelChanged(); saveConfig(); });
    transcriberSelect.addEventListener("change", function () { onTranscriberChanged(); saveConfig(); });
    styleSelect.addEventListener("change", saveConfig);
    qualitySelect.addEventListener("change", saveConfig);
    promptInput.addEventListener("input", saveConfig);
    outputDirInput.addEventListener("change", saveConfig);
    fmtToc.addEventListener("change", saveConfig);
    fmtSummary.addEventListener("change", saveConfig);
    fmtScreenshot.addEventListener("change", saveConfig);
    fmtLink.addEventListener("change", saveConfig);
    saveMd.addEventListener("change", saveConfig);
    saveTxt.addEventListener("change", saveConfig);
    saveJson.addEventListener("change", saveConfig);
    saveMindmap.addEventListener("change", saveConfig);
    optVideoUnderstanding.addEventListener("change", saveConfig);
    videoInterval.addEventListener("input", saveConfig);
    gridRows.addEventListener("input", saveConfig);
    gridCols.addEventListener("input", saveConfig);
    $("export-dir").addEventListener("change", saveConfig);
    startBtn.addEventListener("click", function () { startBatch(false); });
    startSelectedBtn.addEventListener("click", function () { startBatch(true); });
    stopBtn.addEventListener("click", stopBatch);
    pickDirBtn.addEventListener("click", pickOutputDir);
    bilinoteLinkBtn.addEventListener("click", function () { window.open(state.bilinoteUrl, "_blank"); });
    $("pick-export-dir-btn").addEventListener("click", pickExportDir);
    $("copy-md-btn").addEventListener("click", function () { copyFiles("md"); });
    $("copy-txt-btn").addEventListener("click", function () { copyFiles("txt"); });
    $("copy-json-btn").addEventListener("click", function () { copyFiles("json"); });
    $("copy-mindmap-btn").addEventListener("click", function () { copyFiles("mindmap"); });
    $("sync-bilinotes-btn").addEventListener("click", syncToBilinotesDB);
    $("sync-modal-close").addEventListener("click", closeSyncModal);
    $("sync-copy-btn").addEventListener("click", copySyncScript);
    $("sync-modal").querySelector(".modal-overlay").addEventListener("click", closeSyncModal);
    selectAllCb.addEventListener("change", onSelectAll);
    searchInput.addEventListener("input", onSearchFilter);
    viewTableBtn.addEventListener("click", function () { switchView("table"); });
    viewCardBtn.addEventListener("click", function () { switchView("card"); });
    themeToggle.addEventListener("click", toggleTheme);

    document.querySelectorAll(".filter-chip").forEach(function (chip) {
        chip.addEventListener("click", function () {
            document.querySelectorAll(".filter-chip").forEach(function (c) { c.classList.remove("active"); });
            chip.classList.add("active");
            state.statusFilter = chip.getAttribute("data-filter");
            selectAllCb.checked = false;
            renderVideoList();
        });
    });

    window.addEventListener("message", onBilinoteMessage);

    initTheme();
    restoreConfig();
    loadCheckpoint();
    loadTranscriberConfig();
    loadProviders();
    checkModelCapabilities();
});

function onBilinoteMessage(event) {
    if (event.origin !== state.bilinoteUrl) return;
    if (event.data && event.data.type === "BILINOTE_READY") {
        var pendingTaskId = sessionStorage.getItem("bilinote_pending_task");
        if (pendingTaskId) {
            sessionStorage.removeItem("bilinote_pending_task");
            event.source.postMessage({ type: "SELECT_TASK", taskId: pendingTaskId }, state.bilinoteUrl);
        }
    }
}

function openBilinoteTask(taskId) {
    var w = window.open(state.bilinoteUrl, "bilinote_window");
    sessionStorage.setItem("bilinote_pending_task", taskId);
    setTimeout(function () {
        try {
            w.postMessage({ type: "SELECT_TASK", taskId: taskId }, state.bilinoteUrl);
        } catch (e) {}
    }, 2000);
}

function initTheme() {
    var saved = localStorage.getItem("bilinote-batch-theme") || "dark";
    document.documentElement.setAttribute("data-theme", saved);
    themeToggle.textContent = saved === "dark" ? "☀️" : "🌙";
}

function toggleTheme() {
    var current = document.documentElement.getAttribute("data-theme");
    var next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("bilinote-batch-theme", next);
    themeToggle.textContent = next === "dark" ? "☀️" : "🌙";
}

function saveConfig() {
    var cfg = {
        provider_id: providerSelect.value,
        model_name: modelSelect.value,
        style: styleSelect.value,
        quality: qualitySelect.value,
        transcriber_type: transcriberSelect.value,
        whisper_model_size: whisperModelSelect.value,
        extras: promptInput.value,
        output_dir: outputDirInput.value,
        fmt_toc: fmtToc.checked,
        fmt_summary: fmtSummary.checked,
        fmt_screenshot: fmtScreenshot.checked,
        fmt_link: fmtLink.checked,
        save_md: saveMd.checked,
        save_txt: saveTxt.checked,
        save_json: saveJson.checked,
        save_mindmap: saveMindmap.checked,
        video_understanding: optVideoUnderstanding.checked,
        video_interval: videoInterval.value,
        grid_rows: gridRows.value,
        grid_cols: gridCols.value,
        export_dir: $("export-dir").value,
    };
    localStorage.setItem("bilinote-batch-config", JSON.stringify(cfg));
}

function restoreConfig() {
    try {
        var raw = localStorage.getItem("bilinote-batch-config");
        if (!raw) return;
        var cfg = JSON.parse(raw);
        if (cfg.output_dir) outputDirInput.value = cfg.output_dir;
        if (cfg.export_dir) $("export-dir").value = cfg.export_dir;
        if (cfg.style) styleSelect.value = cfg.style;
        if (cfg.quality) qualitySelect.value = cfg.quality;
        if (cfg.extras) promptInput.value = cfg.extras;
        if (cfg.transcriber_type) transcriberSelect.value = cfg.transcriber_type;
        if (cfg.whisper_model_size) whisperModelSelect.value = cfg.whisper_model_size;
        if (cfg.fmt_toc) fmtToc.checked = true;
        if (cfg.fmt_summary) fmtSummary.checked = true;
        if (cfg.fmt_screenshot) fmtScreenshot.checked = true;
        if (cfg.fmt_link) fmtLink.checked = true;
        if (cfg.save_md !== undefined) saveMd.checked = cfg.save_md;
        if (cfg.save_txt !== undefined) saveTxt.checked = cfg.save_txt;
        if (cfg.save_json !== undefined) saveJson.checked = cfg.save_json;
        if (cfg.save_mindmap !== undefined) saveMindmap.checked = cfg.save_mindmap;
        if (cfg.video_understanding) optVideoUnderstanding.checked = true;
        if (cfg.video_interval) videoInterval.value = cfg.video_interval;
        if (cfg.grid_rows) gridRows.value = cfg.grid_rows;
        if (cfg.grid_cols) gridCols.value = cfg.grid_cols;
        if (cfg.provider_id) {
            providerSelect.value = cfg.provider_id;
            loadProviders().then(function () {
                providerSelect.value = cfg.provider_id;
                if (cfg.provider_id && cfg.model_name) {
                    loadModels(cfg.provider_id).then(function () {
                        modelSelect.value = cfg.model_name;
                        state.currentModelName = cfg.model_name;
                        checkModelCapabilities();
                    });
                }
            });
        }
    } catch (e) {}
}

function switchView(mode) {
    state.viewMode = mode;
    viewTableBtn.classList.toggle("active", mode === "table");
    viewCardBtn.classList.toggle("active", mode === "card");
    renderVideoList();
}

async function pickOutputDir() {
    try {
        var handle = await window.showDirectoryPicker();
        outputDirInput.value = handle.name;
    } catch (e) {
        try {
            var res = await fetch("/api/pick-directory"); var data = await res.json();
            if (data.path) outputDirInput.value = data.path;
        } catch (e2) {}
    }
}

async function onFileSelected(event) {
    var file = event.target.files[0];
    if (!file) return;
    state.selectedFile = file;
    fileName.textContent = file.name;
    await loadFile(file);
}

async function loadFile(file) {
    try {
        var fileType = file.name.toLowerCase().endsWith(".csv") ? "csv" : "json";
        var videos;
        if (fileType === "csv") {
            var csvText = await file.text();
            var res = await fetch("/api/parse-file", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content: csvText, filename: file.name, fileType: "csv" }),
            });
            var data = await res.json();
            if (!res.ok || !data.videos || data.videos.length === 0) {
                showBanner(data.error || "CSV 解析失败", "error"); return;
            }
            videos = data.videos;
        } else {
            var text = await file.text();
            videos = parseJsonFrontend(text);
        }
        if (!videos || videos.length === 0) {
            showBanner("文件中未找到有效视频数据", "error"); return;
        }
        state.videos = videos;
        state.searchQuery = ""; state.statusFilter = "all";
        searchInput.value = ""; selectAllCb.checked = false;
        document.querySelectorAll(".filter-chip").forEach(function (c) { c.classList.remove("active"); });
        document.querySelector('.filter-chip[data-filter="all"]').classList.add("active");
        await loadCheckpoint();
        renderVideoList();
        hideBanner();
    } catch (err) { showBanner("文件解析失败：" + err.message, "error"); }
}

function cleanFolderName(name) {
    if (name && name[0] >= "0" && name[0] <= "9") {
        var idx = name.indexOf("-");
        return idx >= 0 ? name.substring(idx + 1) : name;
    }
    return name;
}

function parseJsonFrontend(text) {
    var data = JSON.parse(text);
    var folderMap = {};
    var folders = data.folders || [];
    for (var i = 0; i < folders.length; i++) {
        var f = folders[i];
        var name = cleanFolderName(f.name || "");
        folderMap[f.id] = name || "默认";
    }
    var videos = [];
    var items = data.videos || [];
    for (var j = 0; j < items.length; j++) {
        var v = items[j];
        var bvid = (v.bvid || "").trim();
        if (!bvid) continue;
        var fid = v.folderId || v.folder_id || 1;
        videos.push({
            bvid: bvid,
            title: (v.title || "").trim(),
            url: v.bvidUrl || ("https://www.bilibili.com/video/" + bvid + "/"),
            folder: folderMap[fid] || "默认",
        });
    }
    return videos;
}

function parseCsvFrontend(text) {
    var lines = text.split(/\r?\n/);
    if (lines.length < 2) return [];
    var headers = lines[0].split(",").map(function (h) { return h.trim().replace(/^"|"$/g, ""); });
    var colBvid = -1, colTitle = -1, colFolder = -1, colUrl = -1;
    var bvidAliases = ["bvid", "bvid", "BV号", "BV", "avid", "aid"];
    var titleAliases = ["title", "标题", "视频标题", "name"];
    var folderAliases = ["folder", "folders", "收藏夹", "folder_title", "folder_name"];
    var urlAliases = ["url", "链接", "video_url", "page_url", "bvidUrl"];
    for (var i = 0; i < headers.length; i++) {
        var h = headers[i];
        if (colBvid < 0 && bvidAliases.indexOf(h) >= 0) colBvid = i;
        if (colTitle < 0 && titleAliases.indexOf(h) >= 0) colTitle = i;
        if (colFolder < 0 && folderAliases.indexOf(h) >= 0) colFolder = i;
        if (colUrl < 0 && urlAliases.indexOf(h) >= 0) colUrl = i;
    }
    if (colBvid < 0) throw new Error("CSV 中未找到 BV 号列");
    var videos = [];
    for (var k = 1; k < lines.length; k++) {
        var line = lines[k].trim();
        if (!line) continue;
        var cols = line.split(",").map(function (c) { return c.trim().replace(/^"|"$/g, ""); });
        var bvid = (cols[colBvid] || "").trim();
        if (!bvid) continue;
        var folder = colFolder >= 0 ? cleanFolderName((cols[colFolder] || "").trim()) : "";
        videos.push({
            bvid: bvid,
            title: colTitle >= 0 ? (cols[colTitle] || "").trim() : "",
            url: colUrl >= 0 ? (cols[colUrl] || "").trim() : ("https://www.bilibili.com/video/" + bvid + "/"),
            folder: folder || "未分类",
        });
    }
    return videos;
}

async function loadTranscriberConfig() {
    try {
        var res = await fetch("/api/transcriber-config"); var data = await res.json();
        if (!data.connected) return;
        state.transcriberConfig = data.data;
        var types = data.data.available_types || [];
        transcriberSelect.innerHTML = types.map(function (t) {
            return '<option value="' + t.value + '">' + escapeHtml(t.label) + "</option>";
        }).join("");
        if (data.data.transcriber_type) transcriberSelect.value = data.data.transcriber_type;
        await loadTranscriberModels();
    } catch (err) {}
}

async function loadTranscriberModels() {
    try {
        var res = await fetch("/api/transcriber-models-status"); var data = await res.json();
        if (!data.connected) return;
        state.transcriberModels = data.data;
        var models = data.data.whisper || [];
        whisperModelSelect.innerHTML = models.map(function (m) {
            var suffix = m.downloaded ? " ✓" : " (未下载)";
            var disabled = m.downloaded ? "" : " disabled";
            return '<option value="' + m.model_size + '"' + disabled + '>' + m.model_size + suffix + "</option>";
        }).join("");
        if (state.transcriberConfig && state.transcriberConfig.whisper_model_size) {
            whisperModelSelect.value = state.transcriberConfig.whisper_model_size;
        }
    } catch (err) {}
}

function onTranscriberChanged() {
    var val = transcriberSelect.value;
    var isLocal = val === "fast-whisper" || val === "mlx-whisper";
    var isOnline = val === "bijian" || val === "kuaishou" || val === "groq";
    whisperModelSelect.disabled = !isLocal;
    if (!isLocal) {
        whisperModelSelect.innerHTML = '<option value="">在线引擎无需选择</option>';
    } else {
        loadTranscriberModels();
    }
}

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
        if (!data.connected) { modelSelect.disabled = true; modelSelect.innerHTML = '<option value="">-- 无法获取 --</option>'; return; }
        var models = data.models || [];
        if (models.length === 0) { modelSelect.disabled = true; modelSelect.innerHTML = '<option value="">暂无模型</option>'; return; }
        hideBanner(); state.models = models; modelSelect.disabled = false;
        modelSelect.innerHTML = '<option value="">-- 选择模型 --</option>' + models.map(function (m) { return '<option value="' + m.model_name + '">' + escapeHtml(m.model_name) + "</option>"; }).join("");
    } catch (err) { modelSelect.disabled = true; modelSelect.innerHTML = '<option value="">-- 无法获取 --</option>'; }
}

function onModelChanged() {
    state.currentModelName = modelSelect.value;
    checkModelCapabilities();
}

function checkModelCapabilities() {
    var name = (state.currentModelName || "").toLowerCase();
    if (!name) {
        fmtScreenshot.disabled = false;
        optVideoUnderstanding.disabled = false;
        screenshotHint.textContent = "(选择模型后自动判断)";
        vuHint.textContent = "(选择模型后自动判断)";
        screenshotLabel.classList.remove("disabled-hint");
        vuLabel.classList.remove("disabled-hint");
        return;
    }
    var isVision = name.indexOf("vision") !== -1 || name.indexOf("4o") !== -1 ||
        name.indexOf("gpt-4") !== -1 || name.indexOf("claude-3") !== -1 ||
        name.indexOf("gemini") !== -1 || name.indexOf("qwen-vl") !== -1 ||
        name.indexOf("glm-4v") !== -1;

    if (isVision) {
        fmtScreenshot.disabled = false;
        optVideoUnderstanding.disabled = false;
        screenshotHint.textContent = "";
        vuHint.textContent = "";
        screenshotLabel.classList.remove("disabled-hint");
        vuLabel.classList.remove("disabled-hint");
    } else {
        fmtScreenshot.checked = false;
        fmtScreenshot.disabled = true;
        optVideoUnderstanding.checked = false;
        optVideoUnderstanding.disabled = true;
        screenshotHint.textContent = "(需多模态模型)";
        vuHint.textContent = "(需多模态模型)";
        screenshotLabel.classList.add("disabled-hint");
        vuLabel.classList.add("disabled-hint");
    }
}

function getVideoStatus(bvid) {
    var rec = state.processedRecords[bvid];
    if (!rec) return "pending";
    if (rec.status === "SUCCESS") return "done";
    if (rec.status === "FAILED") return "failed";
    return "pending";
}

function isAiSubtitle(bvid) {
    var rec = state.processedRecords[bvid];
    return rec && rec.transcript_source === "ai_subtitle";
}

function getFilteredVideos() {
    var q = state.searchQuery.toLowerCase(), filter = state.statusFilter;
    return state.videos.filter(function (v) {
        var st = getVideoStatus(v.bvid);
        if (filter === "pending" && st !== "pending") return false;
        if (filter === "done" && st !== "done") return false;
        if (filter === "failed" && st !== "failed") return false;
        if (filter === "ai_subtitle" && !isAiSubtitle(v.bvid)) return false;
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
    selectedCountBtn.textContent = sel;
    startSelectedBtn.disabled = sel === 0;
}

function onSelectAll() {
    videoList.querySelectorAll(".video-cb").forEach(function (cb) { cb.checked = selectAllCb.checked; });
    updateSelectedCount();
}

function onSearchFilter() { state.searchQuery = searchInput.value; selectAllCb.checked = false; renderVideoList(); }

function renderVideoList() {
    var filtered = getFilteredVideos();

    if (!state.videos || state.videos.length === 0) {
        videoToolbar.style.display = "none";
        videoList.innerHTML = '<div class="empty-state"><p class="empty-title">欢迎使用 BiliNote 批量收藏转写</p><ol class="empty-guide"><li>从 <strong>Bilishelf</strong> 浏览器插件导出收藏文件（JSON 或 CSV）</li><li>点击上方 <strong>"选择收藏文件"</strong> 加载数据</li><li>选择 <strong>供应商</strong>、<strong>模型</strong> 和 <strong>转写配置</strong></li><li>点击 <strong>"处理全部待处理"</strong> 或选中视频后 <strong>"处理选中"</strong></li></ol></div>';
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

    if (state.viewMode === "card") {
        renderCardView(filtered);
    } else {
        renderTableView(filtered);
    }

    selectAllCb.checked = false; updateSelectedCount();

    var doneCount = 0, failedCount = 0;
    state.videos.forEach(function (v) {
        var st = getVideoStatus(v.bvid);
        if (st === "done") doneCount++;
        if (st === "failed") failedCount++;
    });
    videoCount.textContent = "共 " + state.videos.length + " 个（✓ " + doneCount + " / ✗ " + failedCount + " / 待 " + (state.videos.length - doneCount - failedCount) + "）";
}

function renderTableView(filtered) {
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
        html += '<th class="bv-col">BV号</th><th>标题</th><th class="status-col">状态</th><th class="action-col">操作</th>';
        html += "</tr></thead><tbody>";
        for (var vi = 0; vi < items.length; vi++) {
            var v = items[vi], st = getVideoStatus(v.bvid);
            html += "<tr class='row-" + st + "'>";
            html += '<td class="cb-col"><input type="checkbox" class="video-cb" value="' + v.bvid + '"></td>';
            html += '<td class="bvid">' + escapeHtml(v.bvid) + "</td>";
            html += '<td><a href="' + v.url + '" target="_blank" rel="noopener" class="video-link" title="在 B 站打开">' + escapeHtml(v.title) + "</a></td>";
            html += '<td><span class="status-badge status-' + st + '">' + statusLabel(st) + "</span>" + (isAiSubtitle(v.bvid) ? ' <span class="ai-badge">⚠️ AI匹配</span>' : "") + "</td>";
            html += '<td class="action-col">' + renderActionButtons(v, st) + "</td>";
            html += "</tr>";
        }
        html += "</tbody></table></div>";
    }
    videoList.innerHTML = html;
    bindTableEvents();
}

function renderCardView(filtered) {
    var html = '<div class="card-grid">';
    for (var i = 0; i < filtered.length; i++) {
        var v = filtered[i], st = getVideoStatus(v.bvid);
        html += '<div class="video-card status-card-' + st + '">';
        html += '<div class="card-header">';
        html += '<input type="checkbox" class="video-cb" value="' + v.bvid + '">';
        html += '<span class="status-badge status-' + st + '">' + statusLabel(st) + "</span>" + (isAiSubtitle(v.bvid) ? ' <span class="ai-badge">⚠️ AI匹配</span>' : "");
        html += "</div>";
        html += '<a href="' + v.url + '" target="_blank" rel="noopener" class="card-title video-link" title="在 B 站打开">' + escapeHtml(v.title) + "</a>";
        html += '<div class="card-meta">';
        html += '<span class="bvid">' + escapeHtml(v.bvid) + "</span>";
        html += '<span class="card-folder">' + escapeHtml(v.folder || "未分类") + "</span>";
        html += "</div>";
        html += '<div class="card-actions">' + renderActionButtons(v, st) + "</div>";
        html += "</div>";
    }
    html += "</div>";
    videoList.innerHTML = html;
    bindCardEvents();
}

function statusLabel(st) {
    if (st === "done") return "✓ 已处理";
    if (st === "failed") return "✗ 失败";
    return "待处理";
}

function renderActionButtons(v, st) {
    var html = "";
    if (st === "done") {
        html += '<button class="btn btn-xs btn-open-file" data-bvid="' + v.bvid + '" title="打开本地笔记文件">📂 打开文件</button>';
        html += '<button class="btn btn-xs btn-bilinote" data-bvid="' + v.bvid + '" data-task="' + (state.processedRecords[v.bvid] ? state.processedRecords[v.bvid].task_id : "") + '" title="在 BiliNote 中查看笔记">🔗 BiliNote</button>';
        html += '<button class="btn btn-xs btn-reprocess" data-bvid="' + v.bvid + '" title="重新处理">🔄</button>';
        if (isAiSubtitle(v.bvid)) {
            html += '<button class="btn btn-xs btn-force-retranscribe" data-bvid="' + v.bvid + '" title="原视频无字幕，BiliNotes用了AI匹配字幕。点击删除缓存，强制用本地模型重新转写">🔧 强制重转</button>';
        }
    } else if (st === "failed") {
        html += '<button class="btn btn-xs btn-reprocess" data-bvid="' + v.bvid + '" title="重新处理">🔄 重试</button>';
    }
    return html;
}

function bindTableEvents() {
    videoList.querySelectorAll(".folder-cb").forEach(function (cb) {
        cb.addEventListener("change", function () {
            cb.closest("table").querySelectorAll(".video-cb").forEach(function (vc) { vc.checked = cb.checked; });
            updateSelectedCount();
        });
    });
    videoList.querySelectorAll(".video-cb").forEach(function (cb) { cb.addEventListener("change", updateSelectedCount); });
    bindActionButtons();
}

function bindCardEvents() {
    videoList.querySelectorAll(".video-cb").forEach(function (cb) { cb.addEventListener("change", updateSelectedCount); });
    bindActionButtons();
}

function bindActionButtons() {
    videoList.querySelectorAll(".btn-bilinote").forEach(function (btn) {
        btn.addEventListener("click", function () {
            var taskId = btn.getAttribute("data-task");
            if (taskId) {
                openBilinoteTask(taskId);
            } else {
                window.open(state.bilinoteUrl, "_blank");
            }
        });
    });
    videoList.querySelectorAll(".btn-open-file").forEach(function (btn) {
        btn.addEventListener("click", function () { openLocalFile(btn.getAttribute("data-bvid")); });
    });
    videoList.querySelectorAll(".btn-reprocess").forEach(function (btn) {
        btn.addEventListener("click", function () { reprocessVideo(btn.getAttribute("data-bvid")); });
    });
    videoList.querySelectorAll(".btn-force-retranscribe").forEach(function (btn) {
        btn.addEventListener("click", function () { forceRetranscribe(btn.getAttribute("data-bvid")); });
    });
}

async function openLocalFile(bvid) {
    try {
        var res = await fetch("/api/get-output-files/" + bvid);
        var data = await res.json();
        var files = data.files || [];
        if (files.length === 0) {
            showBanner("未找到本地文件，可能尚未保存", "warning");
            return;
        }
        var mdFile = null;
        for (var i = 0; i < files.length; i++) {
            if (files[i].name === "笔记.md") { mdFile = files[i]; break; }
        }
        var target = mdFile || files[0];
        var openRes = await fetch("/api/open-file?path=" + encodeURIComponent(target.path));
        var openData = await openRes.json();
        if (!openRes.ok) { showBanner("打开文件失败：" + (openData.error || "未知错误"), "error"); }
    } catch (err) {
        showBanner("获取文件信息失败：" + err.message, "error");
    }
}

async function reprocessVideo(bvid) {
    try {
        await fetch("/api/checkpoint/" + bvid, { method: "DELETE" });
        state.processedBvids.delete(bvid);
        delete state.processedRecords[bvid];
        renderVideoList();
    } catch (err) {
        showBanner("清除记录失败：" + err.message, "error");
    }
}

async function forceRetranscribe(bvid) {
    if (!confirm("该视频原本无字幕，BiliNotes使用了B站AI匹配字幕（可能不准确）。\n\n强制重新转写将：\n1. 删除BiliNotes容器内该视频的缓存文件\n2. 清除本地处理记录\n3. 之后可使用本地模型重新转写\n\n确定继续？")) {
        return;
    }
    try {
        var res = await fetch("/api/force-retranscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ bvid: bvid })
        });
        var data = await res.json();
        if (res.ok && data.ok) {
            var cacheInfo = data.deleted_cache && data.deleted_cache.length > 0
                ? "（已删除 " + data.deleted_cache.length + " 个缓存文件）"
                : "";
            showBanner("✅ 已删除缓存" + cacheInfo + "，视频已回到待处理状态，可重新处理", "success");
            state.processedBvids.delete(bvid);
            delete state.processedRecords[bvid];
            renderVideoList();
        } else {
            showBanner("操作失败：" + (data.error || "未知错误"), "error");
        }
    } catch (err) {
        showBanner("请求失败：" + err.message, "error");
    }
}

function showBanner(m, t) { banner.textContent = m; banner.className = "banner banner-" + (t || "warning"); }
function hideBanner() { banner.className = "banner hidden"; }
function escapeHtml(s) { var d = document.createElement("div"); d.appendChild(document.createTextNode(s)); return d.innerHTML; }

function sleep(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }

async function backfillTranscriptSource() {
    try {
        var res = await fetch("/api/backfill-transcript-source", { method: "POST" });
        var data = await res.json();
        if (data.ok && data.updated > 0) {
            var reloadRes = await fetch("/api/checkpoint");
            var reloadData = await reloadRes.json();
            state.processedRecords = reloadData.records || {};
            state.processedBvids = new Set();
            for (var bvid in state.processedRecords) {
                if (state.processedRecords[bvid].status === "SUCCESS") {
                    state.processedBvids.add(bvid);
                }
            }
            renderVideoList();
        }
    } catch (err) {}
}

async function loadCheckpoint() {
    try {
        var res = await fetch("/api/checkpoint"); var data = await res.json();
        state.processedRecords = data.records || {};
        state.processedBvids = new Set();
        var needBackfill = false;
        for (var bvid in state.processedRecords) {
            if (state.processedRecords[bvid].status === "SUCCESS") {
                state.processedBvids.add(bvid);
            }
            if (state.processedRecords[bvid].status === "SUCCESS" && !state.processedRecords[bvid].transcript_source) {
                needBackfill = true;
            }
        }
        // 如果还没有导入文件，从 checkpoint 记录构建视频列表
        if (!state.videos || state.videos.length === 0) {
            var checkpointVideos = [];
            for (var bvid in state.processedRecords) {
                var rec = state.processedRecords[bvid];
                checkpointVideos.push({
                    bvid: bvid,
                    title: rec.title || "",
                    folder: rec.folder || "未分类",
                    url: "https://www.bilibili.com/video/" + bvid + "/",
                });
            }
            if (checkpointVideos.length > 0) {
                state.videos = checkpointVideos;
                renderVideoList();
            }
        }
        if (needBackfill) {
            backfillTranscriptSource();
        }
    } catch (err) {
        state.processedBvids = new Set();
        state.processedRecords = {};
    }
}

function updateButtons() { startBtn.disabled = state.running; startSelectedBtn.disabled = state.running || getSelectedBvids().length === 0; stopBtn.disabled = !state.running; }

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
    var fmt = [];
    if (fmtToc.checked) fmt.push("toc");
    if (fmtSummary.checked) fmt.push("summary");
    if (fmtScreenshot.checked) fmt.push("screenshot");
    if (fmtLink.checked) fmt.push("link");
    return fmt;
}

function normalizeVideoUrl(url, bvid) {
    if (url && url.indexOf("bilibili.com") !== -1) return url;
    return "https://www.bilibili.com/video/" + bvid + "/";
}

async function submitVideo(video) {
    var fmt = getFormat();
    var videoUrl = normalizeVideoUrl(video.url, video.bvid);
    var body = {
        bvid: video.bvid, title: video.title, folder: video.folder || "未分类", url: videoUrl,
        model_name: modelSelect.value, provider_id: providerSelect.value,
        quality: qualitySelect.value,
        transcriber_type: transcriberSelect.value,
        whisper_model_size: whisperModelSelect.value || "",
        style: styleSelect.value, extras: promptInput.value,
        format: fmt,
        screenshot: fmt.indexOf("screenshot") !== -1,
        link: fmt.indexOf("link") !== -1,
        video_understanding: optVideoUnderstanding.checked,
        video_interval: parseInt(videoInterval.value) || 6,
        grid_size: [parseInt(gridRows.value) || 2, parseInt(gridCols.value) || 2],
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

async function startBatch(selectedOnly) {
    if (state.running) return;
    if (!providerSelect.value) { showBanner("请先选择供应商和模型", "warning"); return; }
    if (!modelSelect.value) { showBanner("请先选择模型", "warning"); return; }
    saveConfig();

    var batch;
    if (selectedOnly) {
        var selBvids = getSelectedBvids();
        if (selBvids.length === 0) { showBanner("请先勾选要处理的视频", "warning"); return; }
        var selSet = new Set(selBvids);
        batch = state.videos.filter(function (v) { return selSet.has(v.bvid); });
    } else {
        batch = state.videos.slice();
    }

    var skipCount = 0;
    for (var i = 0; i < batch.length; i++) { if (state.processedBvids.has(batch[i].bvid)) skipCount++; }
    var willProcess = batch.length - skipCount;
    if (willProcess === 0 && !selectedOnly) { showBanner("所有视频已全部处理完毕", "warning"); return; }

    state.running = true; state.stopRequested = false; state.currentIndex = 0;
    state.stats = { total: selectedOnly ? batch.length : willProcess, success: 0, failed: 0, skipped: 0 };
    state.outputDir = outputDirInput.value.trim() || "./output";

    progressSection.style.display = "block"; logArea.innerHTML = "";
    updateButtons(); updateProgress();
    addLog("批量处理开始 — " + (selectedOnly ? "选中 " + batch.length : "全部待处理 " + willProcess) + " — 输出: " + state.outputDir, "info");

    var processed = 0;
    for (var i = 0; i < batch.length; i++) {
        state.currentIndex = processed;
        if (!state.running || state.stopRequested) break;
        var video = batch[i];

        if (!selectedOnly && state.processedBvids.has(video.bvid)) {
            addLog("[" + (i + 1) + "/" + batch.length + "] 跳过已处理: " + video.title, "skip");
            state.stats.skipped++; processed++; continue;
        }

        addLog("[" + (i + 1) + "/" + batch.length + "] " + video.title + " (" + video.bvid + ")", "info");
        try {
            var taskId = await submitVideo(video);
            addLog("  → 已提交 BiliNote, task_id: " + taskId.substring(0, 8) + "...", "info");
            var result = await pollTaskStatus(taskId, 900000);
            if (result.status === "SUCCESS") {
                addLog("  ✓ 完成: " + video.title + " — BiliNote 可查看", "success");
                state.processedBvids.add(video.bvid);
                var ts = result.transcript_source || "";
                state.processedRecords[video.bvid] = { status: "SUCCESS", task_id: taskId, time: new Date().toISOString(), transcript_source: ts };
                state.stats.success++;
            } else {
                var errMsg = result.error || result.msg || "未知错误";
                addLog("  ✗ 失败: " + video.title + " — " + errMsg, "error");
                state.processedRecords[video.bvid] = { status: "FAILED", task_id: taskId, time: new Date().toISOString() };
                state.stats.failed++;
            }
        } catch (err) { addLog("  ✗ 错误: " + video.title + " - " + err.message, "error"); state.processedRecords[video.bvid] = { status: "FAILED", time: new Date().toISOString() }; state.stats.failed++; }
        processed++; updateProgress(); renderVideoList();
        if (i < batch.length - 1 && state.running && !state.stopRequested) await sleep(3000);
    }

    state.running = false; updateButtons(); renderVideoList();
    addLog("批量处理结束 — ✓ " + state.stats.success + " ✗ " + state.stats.failed + " 跳 " + state.stats.skipped, "info");
}

async function pickExportDir() {
    try {
        var handle = await window.showDirectoryPicker();
        $("export-dir").value = handle.name;
    } catch (e) {
        try {
            var res = await fetch("/api/pick-directory"); var data = await res.json();
            if (data.path) $("export-dir").value = data.path;
        } catch (e2) {}
    }
}

async function copyFiles(fileType) {
    var destDir = $("export-dir").value.trim();
    if (!destDir) {
        showBanner("请先选择或输入导出目标目录", "warning");
        return;
    }
    var typeNames = { md: "笔记", txt: "字幕", json: "JSON", mindmap: "思维导图" };
    try {
        var res = await fetch("/api/copy-files", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ dest_dir: destDir, file_type: fileType }),
        });
        var data = await res.json();
        if (!res.ok) { showBanner("复制失败：" + (data.error || "未知错误"), "error"); return; }
        if (data.copied > 0) {
            showBanner("已复制 " + data.copied + " 个" + typeNames[fileType] + "文件到 " + destDir, "warning");
            setTimeout(hideBanner, 3000);
        } else {
            showBanner("没有找到可复制的" + typeNames[fileType] + "文件", "warning");
        }
        if (data.errors && data.errors.length > 0) {
            addLog("复制部分文件出错: " + data.errors.join("; "), "error");
        }
    } catch (err) {
        showBanner("复制请求失败：" + err.message, "error");
    }
}

async function syncToBilinotesDB() {
    openSyncModal();
    var btn = $("sync-bilinotes-btn");
    var statusEl = $("sync-status");
    btn.disabled = true;
    btn.textContent = "⏳ 准备中...";
    statusEl.textContent = "正在生成注入脚本...";
    try {
        var res = await fetch("/api/bilinotes-sync");
        var data = await res.json();
        if (!data.script) {
            statusEl.textContent = "没有可同步的任务";
            btn.disabled = false;
            btn.textContent = "🔄 同步";
            return;
        }
        showScriptInModal(data.script);
        statusEl.textContent = "脚本已生成（" + data.count + " 条），点击下方按钮复制或直接选中文本 Ctrl+C";
    } catch (err) {
        statusEl.textContent = "❌ 获取任务数据失败：" + err.message;
    }
    btn.disabled = false;
    btn.textContent = "🔄 同步";
}

function showScriptInModal(script) {
    var existing = document.getElementById("sync-script-textarea");
    if (existing) existing.remove();
    var existingNote = document.getElementById("sync-reminder-note");
    if (existingNote) existingNote.remove();

    var ta = document.createElement("textarea");
    ta.id = "sync-script-textarea";
    ta.value = script;
    ta.readOnly = true;
    ta.style.cssText = "width:100%;height:160px;padding:10px;border:1px solid var(--border-color, #333);border-radius:6px;background:rgba(0,0,0,0.2);color:var(--text-main, #fff);font-family:monospace;font-size:11px;resize:vertical;margin-top:8px;";
    ta.addEventListener("click", function () { this.select(); });

    var note = document.createElement("p");
    note.id = "sync-reminder-note";
    note.style.cssText = "color:#f59e0b;font-size:13px;margin-top:8px;";
    note.innerHTML = '<strong>⚠️ 提醒：</strong>在 BiliNotes 控制台粘贴执行后，请 <strong>手动刷新页面 (F5)</strong> 即可在历史列表中看到同步的任务。';

    var footer = document.querySelector("#sync-modal .sync-actions");
    if (footer) {
        footer.parentNode.insertBefore(ta, footer);
        footer.parentNode.insertBefore(note, footer);
    }
}

function openSyncModal() {
    $("sync-modal").classList.remove("hidden");
    $("sync-status").textContent = "";
    var existing = document.getElementById("sync-script-textarea");
    if (existing) existing.remove();
    var existingNote = document.getElementById("sync-reminder-note");
    if (existingNote) existingNote.remove();
}

function closeSyncModal() {
    $("sync-modal").classList.add("hidden");
}

async function copySyncScript() {
    var statusEl = $("sync-status");
    var existingTa = document.getElementById("sync-script-textarea");
    // 如果文本框已有脚本内容，直接复制
    if (existingTa && existingTa.value) {
        existingTa.select();
        try {
            document.execCommand("copy");
            statusEl.textContent = "✅ 已复制！请到 BiliNotes 控制台 (F12→Console) 粘贴执行";
        } catch (e) {
            statusEl.textContent = "⚠️ 复制失败，请手动 Ctrl+C 复制上方文本";
        }
        return;
    }
    // 否则先获取脚本
    statusEl.textContent = "正在生成注入脚本...";
    try {
        var res = await fetch("/api/bilinotes-sync");
        var data = await res.json();
        if (!data.script) {
            statusEl.textContent = "没有可同步的任务";
            return;
        }
        showScriptInModal(data.script);
        // 重新获取刚插入的 textarea 并选中复制
        var ta = document.getElementById("sync-script-textarea");
        if (ta) {
            ta.select();
            try {
                document.execCommand("copy");
                statusEl.textContent = "✅ 已复制 " + data.count + " 条！请到 BiliNotes 控制台 (F12→Console) 粘贴执行";
            } catch (e) {
                statusEl.textContent = "⚠️ 复制失败，请手动 Ctrl+C 复制上方文本";
            }
        }
    } catch (err) {
        statusEl.textContent = "❌ 获取任务数据失败：" + err.message;
    }
}
