/* ── BiliNote Batch Tool ──────────────────────────────── */

var $ = function (id) { return document.getElementById(id); };

var state = {
    videos: [],
    selectedFile: null,
    providers: [],
    models: [],
    running: false,
    stopRequested: false,
    stopImmediate: false,
    currentTaskId: "",
    processedBvids: new Set(),
    processedRecords: {},
    currentIndex: 0,
    stats: { total: 0, success: 0, failed: 0, skipped: 0 },
    outputDir: "./output",
    searchQuery: "",
    statusFilter: "all",
    viewMode: "table",
    currentPage: 1,
    pageSize: 30,
    bilinoteUrl: "http://localhost:3015",
    transcriberConfig: null,
    transcriberModels: null,
    currentModelName: "",
    videoPageSelections: {},
    folderFilter: "",
};

var fileInput, selectFileBtn, fileName;
var providerSelect, modelSelect, styleSelect, promptInput, qualitySelect;
var transcriberSelect, whisperModelSelect;
var fmtToc, fmtSummary, fmtScreenshot, fmtLink;
var optVideoUnderstanding, videoInterval, gridRows, gridCols;
var saveMd, saveTxt, saveJson, saveMindmap;
var optForceLocal;
var videoList, videoCount, videoToolbar;
var banner;
var startBtn, startSelectedBtn, stopBtn, bilinoteLinkBtn, progressBar, progressSection, logArea;
var totalSpan, successSpan, failedSpan, skippedSpan, currentSpan;
var outputDirInput, pickDirBtn;
var localPathInput, pickFolderBtn, pickFilesBtn, addLocalBtn, addProcessBtn;
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
    optForceLocal = $("opt-force-local");
    videoList = $("video-list"); videoCount = $("video-count"); videoToolbar = $("video-toolbar");
    banner = $("banner");
    startBtn = $("start-btn"); startSelectedBtn = $("start-selected-btn"); stopBtn = $("stop-btn");
    bilinoteLinkBtn = $("bilinote-link-btn"); progressBar = $("progress-bar");
    progressSection = $("progress-section"); logArea = $("log-area");
    totalSpan = $("stat-total"); successSpan = $("stat-success"); failedSpan = $("stat-failed");
    skippedSpan = $("stat-skipped"); currentSpan = $("stat-current");
    outputDirInput = $("output-dir"); pickDirBtn = $("pick-dir-btn");
    localPathInput = $("local-path"); pickFolderBtn = $("pick-folder-btn");
    pickFilesBtn = $("pick-files-btn"); addLocalBtn = $("add-local-btn");
    addProcessBtn = $("add-process-btn");
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
    optForceLocal.addEventListener("change", saveConfig);
    optVideoUnderstanding.addEventListener("change", saveConfig);
    videoInterval.addEventListener("input", saveConfig);
    gridRows.addEventListener("input", saveConfig);
    gridCols.addEventListener("input", saveConfig);
    $("export-dir").addEventListener("change", saveConfig);
    pickFolderBtn.addEventListener("click", pickLocalFolder);
    pickFilesBtn.addEventListener("click", pickLocalFiles);
    addLocalBtn.addEventListener("click", addLocalVideos);
    addProcessBtn.addEventListener("click", addAndProcessLocal);
    startBtn.addEventListener("click", function () { startBatch(false); });
    startSelectedBtn.addEventListener("click", function () { startBatch(true); });
    stopBtn.addEventListener("click", stopBatch);
    $("start-multip-all-btn").addEventListener("click", function () { startMultipBatch(false); });
    $("start-multip-selected-btn").addEventListener("click", function () { startMultipBatch(true); });
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
    $("help-modal-close").addEventListener("click", closeHelpModal);
    $("help-modal").querySelector(".modal-overlay").addEventListener("click", closeHelpModal);
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
            state.currentPage = 1;
            selectAllCb.checked = false;
            renderVideoList();
        });
    });

    // 动态添加多P筛选芯片
    var filterChips = document.querySelector(".filter-chips");
    if (filterChips) {
        var mpFilters = [
            { filter: "multi_unprocessed", label: "多P待处理" },
            { filter: "multi_partial", label: "多P部分处理" },
            { filter: "multi_full", label: "多P全处理" },
            { filter: "local_transcribe", label: "🎙️ 本地转写" },
        ];
        mpFilters.forEach(function (f) {
            var chip = document.createElement("button");
            chip.className = "filter-chip";
            chip.setAttribute("data-filter", f.filter);
            chip.innerHTML = f.label;
            chip.addEventListener("click", function () {
                document.querySelectorAll(".filter-chip").forEach(function (c) { c.classList.remove("active"); });
                chip.classList.add("active");
                state.statusFilter = f.filter;
                state.currentPage = 1;
                selectAllCb.checked = false;
                renderVideoList();
            });
            filterChips.appendChild(chip);
        });
    }

    // 文件夹筛选下拉 + 检测多P按钮 + 视图切换 包裹在同一容器
    var viewToggle = document.querySelector(".view-toggle");
    if (viewToggle) {
        var wrapper = document.createElement("div");
        wrapper.style.cssText = "display:flex;align-items:center;gap:6px;";
        // 检测多P按钮
        var detectBtn = document.createElement("button");
        detectBtn.id = "detect-multip-btn";
        detectBtn.className = "filter-chip";
        detectBtn.title = "通过B站API检测真实分P数";
        detectBtn.textContent = "🔍 检测多P";
        detectBtn.addEventListener("click", detectMultiPVideos);
        // 文件夹下拉
        var folderSel = document.createElement("select");
        folderSel.id = "folder-filter-select";
        folderSel.style.cssText = "padding:5px 10px;font-size:0.82rem;background:var(--bg-tertiary);color:var(--text-primary);border:1px solid var(--border);border-radius:8px;max-width:140px;cursor:pointer;";
        folderSel.addEventListener("change", function () {
            state.folderFilter = this.value;
            state.currentPage = 1;
            selectAllCb.checked = false;
            renderVideoList();
        });
        viewToggle.parentNode.insertBefore(wrapper, viewToggle);
        wrapper.appendChild(detectBtn);
        wrapper.appendChild(folderSel);
        wrapper.appendChild(viewToggle);
    }

    // 悬浮目录导航
    var tocHtml = '<div id="floating-toc" class="floating-toc">';
    tocHtml += '<button id="toc-toggle" class="toc-toggle-btn" title="页面导航">📑</button>';
    tocHtml += '<div id="toc-panel" class="toc-panel hidden">';
    tocHtml += '<a class="toc-item" data-target="config-grid">🤖 模型与转写配置</a>';
    tocHtml += '<a class="toc-item" data-target="batch-bar">🚀 执行控制台</a>';
    tocHtml += '<a class="toc-item" data-target="progress-section">📊 处理进度</a>';
    tocHtml += '<a class="toc-item" data-target="video-section">📋 视频列表</a>';
    tocHtml += '<a class="toc-item" data-target="export-section">📤 文件导出</a>';
    tocHtml += '<a class="toc-item toc-item-help" data-target="help-modal">📖 帮助文档</a>';
    tocHtml += '</div></div>';
    var tocContainer = document.createElement("div");
    tocContainer.innerHTML = tocHtml;
    document.body.appendChild(tocContainer.firstElementChild);

    $("toc-toggle").addEventListener("click", function () {
        var panel = $("toc-panel");
        panel.classList.toggle("hidden");
    });
    document.querySelectorAll(".toc-item").forEach(function (item) {
        item.addEventListener("click", function () {
            var targetName = this.getAttribute("data-target");
            if (targetName === "help-modal") {
                openHelpModal();
            } else {
                var target = document.querySelector("." + targetName);
                if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
            }
            $("toc-panel").classList.add("hidden");
        });
    });
    // 点击页面其他地方关闭TOC
    document.addEventListener("click", function (e) {
        if (!e.target.closest("#floating-toc")) {
            var panel = $("toc-panel");
            if (panel) panel.classList.add("hidden");
        }
    });

    window.addEventListener("message", onBilinoteMessage);

    initTheme();
    restoreConfig();
    loadLocalVideos().then(function () { loadCheckpoint().then(function () { return loadMultipCache(); }).then(function () { renderVideoList(); }); });
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
        force_local: optForceLocal.checked,
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
        if (cfg.force_local) optForceLocal.checked = true;
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

async function loadLocalVideos() {
    try {
        var res = await fetch("/api/local-videos"); var data = await res.json();
        var items = data.videos || [];
        var existingBvids = new Set(state.videos.map(function (v) { return v.bvid; }));
        for (var i = 0; i < items.length; i++) {
            if (!existingBvids.has(items[i].bvid)) state.videos.push(items[i]);
        }
    } catch (e) {}
}

async function persistLocalVideos(newVids) {
    try {
        await fetch("/api/local-videos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ videos: newVids }) });
    } catch (e) {}
}

async function pickLocalFolder() {
    try {
        var res = await fetch("/api/pick-local-folder"); var data = await res.json();
        if (data.path) localPathInput.value = data.path;
    } catch (e) {}
}

async function pickLocalFiles() {
    try {
        var res = await fetch("/api/pick-local-files"); var data = await res.json();
        if (data.files && data.files.length > 0) localPathInput.value = data.files.join("; ");
    } catch (e) {}
}

async function addLocalVideos() {
    var rawPath = localPathInput.value.trim();
    if (!rawPath) { showBanner("请输入本地视频路径", "warning"); return; }
    var paths = rawPath.split(";").map(function (p) { return p.trim(); }).filter(Boolean);
    try {
        var res = await fetch("/api/scan-local", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paths: paths }) });
        var data = await res.json();
        var items = data.videos || [];
        if (items.length === 0) { showBanner("未找到视频文件（支持: mp4/mkv/webm/avi/mov/flv/wmv/m4v/ts）", "warning"); return; }
        // 过滤掉已存在的本地视频
        var newVideos = [];
        var existingBvids = new Set(state.videos.map(function (v) { return v.bvid; }));
        for (var i = 0; i < items.length; i++) {
            if (!existingBvids.has(items[i].bvid)) newVideos.push(items[i]);
        }
        if (newVideos.length === 0) { showBanner("所选视频已全部在列表中", "warning"); return; }
        // 加入视频列表
        for (var j = 0; j < newVideos.length; j++) {
            state.videos.push(newVideos[j]);
        }
        persistLocalVideos(newVideos);
        state.statusFilter = "all"; state.currentPage = 1;
        renderVideoList(); updateButtons();
        localPathInput.value = "";
        showBanner("已添加 " + newVideos.length + " 个本地视频", "success");
    } catch (e) { showBanner("扫描本地视频失败: " + e.message, "error"); }
}

async function addAndProcessLocal() {
    var rawPath = localPathInput.value.trim();
    if (!rawPath) { showBanner("请输入本地视频路径", "warning"); return; }
    var paths = rawPath.split(";").map(function (p) { return p.trim(); }).filter(Boolean);
    try {
        var res = await fetch("/api/scan-local", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paths: paths }) });
        var data = await res.json();
        var items = data.videos || [];
        if (items.length === 0) { showBanner("未找到视频文件（支持: mp4/mkv/webm/avi/mov/flv/wmv/m4v/ts）", "warning"); return; }
        // 加入列表（去重）
        var newBvids = [];
        var existingBvids = new Set(state.videos.map(function (v) { return v.bvid; }));
        for (var i = 0; i < items.length; i++) {
            if (!existingBvids.has(items[i].bvid)) {
                state.videos.push(items[i]);
                newBvids.push(items[i].bvid);
            }
        }
        if (newBvids.length === 0) { showBanner("所选视频已全部在列表中", "warning"); return; }
        var addedVids = items.filter(function (v) { return newBvids.indexOf(v.bvid) >= 0; });
        persistLocalVideos(addedVids);
        state.statusFilter = "all"; state.currentPage = 1;
        renderVideoList(); updateButtons();
        localPathInput.value = "";
        // 勾选新增的本地视频
        var checkboxes = videoList.querySelectorAll(".video-cb");
        for (var k = 0; k < checkboxes.length; k++) {
            checkboxes[k].checked = (newBvids.indexOf(checkboxes[k].value) >= 0);
        }
        updateSelectedCount();
        showBanner("已添加 " + newBvids.length + " 个本地视频，开始处理选中...", "success");
        // 立即开始处理选中
        await sleep(300);
        startBatch(true);
    } catch (e) { showBanner("处理失败: " + e.message, "error"); }
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
        state.videoPageSelections = {};
        state.folderFilter = ""; state.searchQuery = ""; state.statusFilter = "all"; state.currentPage = 1;
        searchInput.value = ""; selectAllCb.checked = false;
        document.querySelectorAll(".filter-chip").forEach(function (c) { c.classList.remove("active"); });
        document.querySelector('.filter-chip[data-filter="all"]').classList.add("active");
        await loadCheckpoint();
        await loadMultipCache();
        renderVideoList();
        hideBanner();
    } catch (err) { showBanner("文件解析失败：" + err.message, "error"); }
}

function cleanFolderName(name) {
    return name || "未分类";
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
    // 构建 videoId → folderId 映射（兼容 folderItems 格式）
    var vidToFid = {};
    var folderItems = data.folderItems || [];
    for (var k = 0; k < folderItems.length; k++) {
        vidToFid[folderItems[k].videoId] = folderItems[k].folderId;
    }
    var videos = [];
    var items = data.videos || [];
    for (var j = 0; j < items.length; j++) {
        var v = items[j];
        var bvid = (v.bvid || "").trim();
        if (!bvid) continue;
        // 优先级：folderItems映射 > folderId字段 > 0=未分类
        var fid = vidToFid[v.id] || v.folderId || v.folder_id || 0;
        var cover = v.coverUrl || v.cover || v.pic || "";
        if (typeof cover === "string") cover = cover.trim();
        var ownerName = (v.uploader || "").trim();
        var ownerMid = "";
        var spaceUrl = v.uploaderSpaceUrl || "";
        var m = spaceUrl.match(/space\.bilibili\.com\/(\d+)/);
        if (m) ownerMid = m[1];
        var pageCount = parseInt(v.page) || 1;
        var description = (v.description || "").trim();
        if (!description) description = "";
        videos.push({
            bvid: bvid,
            title: (v.title || "").trim(),
            url: v.bvidUrl || ("https://www.bilibili.com/video/" + bvid + "/"),
            folder: (fid ? (folderMap[fid] || "未分类") : "未分类"),
            cover: cover,
            ownerName: ownerName,
            ownerMid: ownerMid,
            description: description,
            pageCount: pageCount,
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
    var isVision = name.indexOf("vision") !== -1 || name.indexOf("vl") !== -1 ||
        name.indexOf("4o") !== -1 || name.indexOf("4.1") !== -1 ||
        name.indexOf("gpt-4") !== -1 || name.indexOf("gpt-5") !== -1 ||
        name.indexOf("claude") !== -1 || name.indexOf("gemini") !== -1 ||
        name.indexOf("glm-4v") !== -1 || name.indexOf("qwen") !== -1 ||
        name.indexOf("pixtral") !== -1 || name.indexOf("llava") !== -1;

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
    // 复合键格式 bvid|pN，检查该 bvid 所有分P 的记录
    var prefix = bvid + "|";
    var hasSuccess = false, hasFailed = false;
    for (var key in state.processedRecords) {
        if (key === bvid || key.indexOf(prefix) === 0) {
            var rec = state.processedRecords[key];
            if (rec.status === "SUCCESS") hasSuccess = true;
            if (rec.status === "FAILED") hasFailed = true;
        }
    }
    if (hasSuccess) return "done";
    if (hasFailed) return "failed";
    return "pending";
}

function isAiSubtitle(bvid) {
    var prefix = bvid + "|";
    for (var key in state.processedRecords) {
        if (key === bvid || key.indexOf(prefix) === 0) {
            if (state.processedRecords[key].transcript_source === "ai_subtitle") return true;
        }
    }
    return false;
}

function isLocalTranscribe(bvid) {
    var prefix = bvid + "|";
    for (var key in state.processedRecords) {
        if (key === bvid || key.indexOf(prefix) === 0) {
            if (state.processedRecords[key].skip_subtitle) return true;
        }
    }
    return false;
}

function getUniqueFolders() {
    var folders = {};
    for (var i = 0; i < state.videos.length; i++) {
        var f = state.videos[i].folder || "未分类";
        folders[f] = (folders[f] || 0) + 1;
    }
    var result = Object.keys(folders).sort();
    return result.map(function (name) { return { name: name, count: folders[name] }; });
}

function renderFolderDropdown() {
    var sel = document.getElementById("folder-filter-select");
    if (!sel) return;
    var folders = getUniqueFolders();
    var currentVal = sel.value || state.folderFilter;
    sel.innerHTML = '<option value="">📁 全部分组</option>';
    for (var i = 0; i < folders.length; i++) {
        var f = folders[i];
        sel.innerHTML += '<option value="' + escapeHtml(f.name) + '">' + escapeHtml(f.name) + ' (' + f.count + ')</option>';
    }
    sel.value = currentVal;
}

function getFilteredVideos() {
    var q = state.searchQuery.toLowerCase(), filter = state.statusFilter, folder = state.folderFilter;
    return state.videos.filter(function (v) {
        var st = getVideoStatus(v.bvid);
        if (folder && (v.folder || "未分类") !== folder) return false;
        if (filter === "pending" && st !== "pending") return false;
        if (filter === "done" && st !== "done") return false;
        if (filter === "failed" && st !== "failed") return false;
        if (filter === "ai_subtitle" && !isAiSubtitle(v.bvid)) return false;
        if (filter === "multi_unprocessed" && getMultiPStatus(v.bvid) !== "unprocessed") return false;
        if (filter === "multi_partial" && getMultiPStatus(v.bvid) !== "partial") return false;
        if (filter === "multi_full" && getMultiPStatus(v.bvid) !== "full") return false;
        if (filter === "local_transcribe" && !isLocalTranscribe(v.bvid)) return false;
        if (q) return (v.bvid || "").toLowerCase().indexOf(q) !== -1 || (v.title || "").toLowerCase().indexOf(q) !== -1 || (v.ownerName || "").toLowerCase().indexOf(q) !== -1 || (v.ownerMid || "").indexOf(q) !== -1;
        return true;
    });
}

function getPagedVideos() {
    var filtered = getFilteredVideos();
    var start = (state.currentPage - 1) * state.pageSize;
    return {
        items: filtered.slice(start, start + state.pageSize),
        total: filtered.length,
        totalPages: Math.ceil(filtered.length / state.pageSize) || 1,
    };
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
    updateMultipButtons();
}

function onSelectAll() {
    videoList.querySelectorAll(".video-cb").forEach(function (cb) { cb.checked = selectAllCb.checked; });
    updateSelectedCount();
}

function onSearchFilter() { state.searchQuery = searchInput.value; state.currentPage = 1; selectAllCb.checked = false; renderVideoList(); }

function renderVideoList() {
    var paged = getPagedVideos();

    if (!state.videos || state.videos.length === 0) {
        videoToolbar.style.display = "none";
        videoList.innerHTML = '<div class="empty-state"><p class="empty-title">欢迎使用 BiliNote 批量收藏转写</p><ol class="empty-guide"><li>从 <strong>Bilishelf</strong> 浏览器插件导出收藏文件（JSON 或 CSV）</li><li>点击上方 <strong>"选择收藏文件"</strong> 加载数据</li><li>选择 <strong>供应商</strong>、<strong>模型</strong> 和 <strong>转写配置</strong></li><li>点击 <strong>"处理全部待处理"</strong> 或选中视频后 <strong>"处理选中"</strong></li></ol></div>';
        videoCount.textContent = "共 0 个视频";
        return;
    }

    videoToolbar.style.display = "flex";

    if (paged.total === 0) {
        videoList.innerHTML = '<div class="empty-state">无匹配视频</div>';
        videoCount.textContent = "共 " + state.videos.length + " 个视频（筛选后 0 个）";
        updateSelectedCount();
        return;
    }

    if (state.viewMode === "card") {
        renderCardView(paged.items);
    } else {
        renderTableView(paged.items);
    }

    // 分页控件
    var pagHtml = '';
    if (paged.totalPages > 1) {
        pagHtml = '<div class="pagination-bar">';
        pagHtml += '<span class="pag-info">共 ' + paged.total + ' 个，第 ' + state.currentPage + '/' + paged.totalPages + ' 页</span>';
        pagHtml += '<button class="btn btn-sm pag-btn" data-page="1" ' + (state.currentPage === 1 ? 'disabled' : '') + '>首页</button>';
        pagHtml += '<button class="btn btn-sm pag-btn" data-page="' + (state.currentPage - 1) + '" ' + (state.currentPage === 1 ? 'disabled' : '') + '>上一页</button>';
        for (var p = 1; p <= paged.totalPages; p++) {
            if (p === state.currentPage) {
                pagHtml += '<span class="pag-current">' + p + '</span>';
            } else if (Math.abs(p - state.currentPage) <= 2 || p === 1 || p === paged.totalPages) {
                pagHtml += '<button class="btn btn-sm pag-btn" data-page="' + p + '">' + p + '</button>';
            } else if (Math.abs(p - state.currentPage) === 3) {
                pagHtml += '<span class="pag-ellipsis">...</span>';
            }
        }
        pagHtml += '<button class="btn btn-sm pag-btn" data-page="' + (state.currentPage + 1) + '" ' + (state.currentPage === paged.totalPages ? 'disabled' : '') + '>下一页</button>';
        pagHtml += '<button class="btn btn-sm pag-btn" data-page="' + paged.totalPages + '" ' + (state.currentPage === paged.totalPages ? 'disabled' : '') + '>末页</button>';
        pagHtml += '</div>';
    }
    videoList.innerHTML = '<div id="video-list-inner"></div>' + pagHtml;

    var inner = document.getElementById("video-list-inner");
    if (state.viewMode === "card") {
        renderCardViewTo(inner, paged.items);
    } else {
        renderTableViewTo(inner, paged.items);
    }

    // 绑定分页按钮事件
    videoList.querySelectorAll(".pag-btn").forEach(function (btn) {
        btn.addEventListener("click", function () {
            state.currentPage = parseInt(btn.getAttribute("data-page"));
            selectAllCb.checked = false;
            renderVideoList();
            videoList.scrollIntoView({ behavior: "smooth" });
        });
    });

    selectAllCb.checked = false; updateSelectedCount();

    var doneCount = 0, failedCount = 0;
    state.videos.forEach(function (v) {
        var st = getVideoStatus(v.bvid);
        if (st === "done") doneCount++;
        if (st === "failed") failedCount++;
    });
    videoCount.textContent = "共 " + state.videos.length + " 个（✓ " + doneCount + " / ✗ " + failedCount + " / 待 " + (state.videos.length - doneCount - failedCount) + "）";
    renderFolderDropdown();
    updateMultipButtons();
}

function renderTableViewTo(container, filtered) {
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
        html += '<th class="bv-col">BV号</th><th>标题</th><th class="owner-col">UP主</th><th class="status-col">状态</th><th class="action-col">操作</th>';
        html += "</tr></thead><tbody>";
        for (var vi = 0; vi < items.length; vi++) {
            var v = items[vi], st = getVideoStatus(v.bvid);
            var isMultiP = (v.pageCount || 1) > 1;
            html += "<tr class='row-" + st + (isMultiP ? " row-multip" : "") + "'>";
            html += '<td class="cb-col"><input type="checkbox" class="video-cb" value="' + v.bvid + '"></td>';
            var isLocal = v.platform === "local";
            html += '<td class="bvid">' + (isLocal ? '📁 <span class="local-vid-hint">本地</span>' : renderMultiPBadge(v) + escapeHtml(v.bvid)) + "</td>";
            if (isLocal) {
                html += '<td><span class="video-link" title="' + escapeHtml(v.url) + '">' + escapeHtml(v.title) + "</span></td>";
            } else {
                html += '<td><a href="' + v.url + '" target="_blank" rel="noopener" class="video-link" title="在 B 站打开">' + escapeHtml(v.title) + "</a></td>";
            }
            html += '<td class="owner-cell">' + renderOwnerLink(v) + "</td>";
            html += '<td><span class="status-badge status-' + st + '">' + statusLabel(st) + "</span>" + (isLocalTranscribe(v.bvid) ? ' <span class="local-badge">🎙️ 本地</span>' : "") + (isAiSubtitle(v.bvid) ? ' <span class="ai-badge">⚠️ AI匹配</span>' : "") + "</td>";
            html += '<td class="action-col">' + renderActionButtons(v, st) + "</td>";
            html += "</tr>";
        }
        html += "</tbody></table></div>";
    }
    container.innerHTML = html;
    bindTableEvents();
}

function renderCardViewTo(container, filtered) {
    var html = '<div class="card-grid">';
    for (var i = 0; i < filtered.length; i++) {
        var v = filtered[i], st = getVideoStatus(v.bvid);
        var isMultiP = (v.pageCount || 1) > 1;
        var aiSub = isAiSubtitle(v.bvid);
        var badgeLabel = statusLabel(st);
        var badgeClass = st === "done" ? "status-done" : st === "failed" ? "status-failed" : "status-pending";
        html += '<div class="video-card status-card-' + st + (isMultiP ? " card-multip" : "") + '">';
        // 封面 + 叠加层
        if (v.cover) {
            html += '<div class="card-cover-wrap">';
            html += '<img class="card-cover" src="' + escapeHtml(v.cover) + '" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.display=\'none\'">';
            html += '<div class="card-cover-overlay">';
            html += '<input type="checkbox" class="video-cb" value="' + v.bvid + '">';
            html += '<div class="card-cover-right">';
            html += '<span class="card-cover-status ' + badgeClass + '">' + badgeLabel + '</span>';
            if (isMultiP) {
                var mpStat = getMultiPStatus(v.bvid);
                var mpCls = mpStat === "full" ? "status-done" : mpStat === "partial" ? "status-partial" : "status-pending";
                html += '<span class="status-badge ' + mpCls + ' card-mp' + '">' + renderMultiPStatusText(v) + '</span>';
            }
            html += '</div></div></div>';
        } else {
            html += '<div class="card-header">';
            html += '<input type="checkbox" class="video-cb" value="' + v.bvid + '">';
            html += '<span class="status-badge ' + badgeClass + '">' + badgeLabel + '</span>';
            if (isMultiP) {
                var mpStat2 = getMultiPStatus(v.bvid);
                var mpCls2 = mpStat2 === "full" ? "status-done" : mpStat2 === "partial" ? "status-partial" : "status-pending";
                html += '<span class="status-badge ' + mpCls2 + ' card-mp' + '">' + renderMultiPStatusText(v) + '</span>';
            }
            html += '</div>';
        }
        // 标题
        var isLocalCard = v.platform === "local";
        if (isLocalCard) {
            html += '<span class="card-title" title="' + escapeHtml(v.url) + '">📁 ' + escapeHtml(v.title) + "</span>";
        } else {
            html += '<a href="' + v.url + '" target="_blank" rel="noopener" class="card-title video-link" title="在 B 站打开">' + escapeHtml(v.title) + "</a>";
        }
        // 标签行: UP主 · BV号 · P标签 · AI字幕 · 文件夹
        html += '<div class="card-tags">';
        if (v.ownerName) {
            if (v.ownerMid) {
                html += '<a href="https://space.bilibili.com/' + v.ownerMid + '" target="_blank" rel="noopener" class="card-tag card-tag-owner" title="B站空间">' + escapeHtml(v.ownerName) + '</a>';
            } else {
                html += '<span class="card-tag card-tag-owner">' + escapeHtml(v.ownerName) + '</span>';
            }
        }
        html += '<span class="card-tag card-tag-bvid">' + (v.platform === "local" ? "📁 本地" : escapeHtml(v.bvid)) + '</span>';
        if (isMultiP) {
            var mpStatus = getMultiPStatus(v.bvid);
            var mpLabel, mpCls;
            if (mpStatus === "full") { mpLabel = v.pageCount + "P全处理"; mpCls = " multip-full"; }
            else if (mpStatus === "partial") { mpLabel = (multipCache._processed[v.bvid] || []).length + "/" + v.pageCount + "P已处理"; mpCls = " multip-partial"; }
            else { mpLabel = v.pageCount + "P未处理"; mpCls = " multip-unprocessed"; }
            html += '<span class="card-tag card-tag-multip multip-clickable' + mpCls + '" data-bvid="' + v.bvid + '" title="点击选择要处理的分P">' + mpLabel + '</span>';
        }
        if (aiSub) html += '<span class="card-tag card-tag-ai">⚠️ AI字幕</span>';
        if (isLocalTranscribe(v.bvid)) html += '<span class="card-tag card-tag-local">🎙️ 本地</span>';
        html += '<span class="card-tag card-tag-folder" data-folder="' + escapeHtml(v.folder || "未分类") + '" title="点击筛选此分组">' + escapeHtml(v.folder || "未分类") + '</span>';
        if (v.description) {
            html += '<span class="card-tag card-tag-desc" data-desc="' + escapeHtml(v.description) + '" title="点击查看简介">📝 简介</span>';
        }
        html += "</div>";
        // 操作
        html += '<div class="card-footer">';
        html += '<div class="card-actions">' + renderActionButtons(v, st) + "</div>";
        html += "</div>";
        html += "</div>";
    }
    html += "</div>";
    container.innerHTML = html;
    bindCardEvents();
}

function renderOwnerLink(v) {
    if (!v.ownerName) return "";
    var name = escapeHtml(v.ownerName);
    if (v.ownerMid) {
        return '<a href="https://space.bilibili.com/' + v.ownerMid + '" target="_blank" rel="noopener" class="owner-link" title="B站空间">' + name + '</a>';
    }
    return '<span class="owner-name">' + name + '</span>';
}

function renderMultiPStatusText(v) {
    var status = getMultiPStatus(v.bvid);
    var pc = v.pageCount || 1;
    if (status === "full") return pc + "P 全处理";
    if (status === "partial") return (multipCache._processed[v.bvid] || []).length + "/" + pc + "P 已处理";
    return pc + "P 未处理";
}

function renderMultiPBadge(v) {
    var pc = v.pageCount || 1;
    if (pc <= 1) return "";
    var status = getMultiPStatus(v.bvid);
    var label, cls;
    if (status === "full") { label = pc + "P全处理"; cls = " multip-full"; }
    else if (status === "partial") { var done = (multipCache._processed[v.bvid] || []).length; label = done + "/" + pc + "P已处理"; cls = " multip-partial"; }
    else { label = pc + "P未处理"; cls = " multip-unprocessed"; }
    return '<span class="multip-badge multip-clickable' + cls + '" data-bvid="' + v.bvid + '" title="点击选择要处理的分P">' + label + '</span> ';
}

function showMultipPanel(v) {
    var existing = document.getElementById("multip-panel");
    if (existing) existing.remove();
    var panel = document.createElement("div");
    panel.id = "multip-panel";
    var sel = state.videoPageSelections[v.bvid] || [1];
    var pc = v.pageCount || 1;
    var html = '<div style="padding:8px 12px;border-bottom:1px solid var(--border);font-weight:600;font-size:0.85rem;">' + escapeHtml(v.title).substring(0, 40) + '</div>';
    html += '<div style="padding:8px 12px;font-size:0.78rem;color:var(--text-muted);">共 ' + pc + 'P，勾选要处理的分P：</div>';
    html += '<div style="display:flex;gap:4px;padding:0 12px 8px;">';
    html += '<button class="btn btn-xs" onclick="multipSelectAll(\'' + v.bvid + '\',' + pc + ')">全选</button>';
    html += '<button class="btn btn-xs" onclick="multipSelectNone(\'' + v.bvid + '\')">全不选</button>';
    html += '<span style="font-size:0.78rem;color:var(--text-muted);margin-left:8px;">P</span><input type="number" id="mp-from" value="1" min="1" max="' + pc + '" style="width:50px;padding:2px 4px;font-size:0.78rem;">';
    html += '<span style="font-size:0.78rem;color:var(--text-muted);">至 P</span><input type="number" id="mp-to" value="' + pc + '" min="1" max="' + pc + '" style="width:50px;padding:2px 4px;font-size:0.78rem;">';
    html += '<button class="btn btn-xs" onclick="multipSelectRange(\'' + v.bvid + '\',' + pc + ')">选区</button></div>';
    html += '<div id="mp-checkboxes" style="max-height:200px;overflow-y:auto;padding:0 12px 8px;display:flex;flex-wrap:wrap;gap:4px;">';
    for (var pn = 1; pn <= pc; pn++) {
        var checked = sel.indexOf(pn) >= 0 ? ' checked' : '';
        html += '<label style="font-size:0.78rem;cursor:pointer;padding:2px 8px;border-radius:4px;background:var(--bg-tertiary);' + (checked ? 'border:2px solid var(--accent);' : 'border:1px solid var(--border);') + '"><input type="checkbox" class="mp-cb" value="' + pn + '"' + checked + ' onchange="multipToggle(\'' + v.bvid + '\',' + pn + ',this.checked)"> P' + pn + '</label>';
    }
    html += '</div>';
    html += '<div style="padding:8px 12px;border-top:1px solid var(--border);text-align:right;">';
    html += '<button class="btn btn-primary btn-sm" onclick="closeMultipPanel()">确认</button></div>';
    panel.innerHTML = html;
    panel.style.cssText = "position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:var(--bg-secondary);border:1px solid var(--border);border-radius:12px;z-index:9998;min-width:360px;max-width:500px;box-shadow:0 8px 32px rgba(0,0,0,0.5);";
    document.body.appendChild(panel);
    var overlay = document.createElement("div");
    overlay.id = "multip-overlay";
    overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9997;";
    overlay.addEventListener("click", closeMultipPanel);
    document.body.appendChild(overlay);
}

function closeMultipPanel() {
    // 检查并修正空选择
    for (var bvid in state.videoPageSelections) {
        var sel = state.videoPageSelections[bvid];
        if (Array.isArray(sel) && sel.length === 0) {
            state.videoPageSelections[bvid] = [1];
        }
    }
    var panel = document.getElementById("multip-panel");
    if (panel) panel.remove();
    var overlay = document.getElementById("multip-overlay");
    if (overlay) overlay.remove();
    updateMultipButtons();
}

function multipSelectAll(bvid, pc) {
    state.videoPageSelections[bvid] = [];
    for (var i = 1; i <= pc; i++) state.videoPageSelections[bvid].push(i);
    refreshMultipCheckboxes(bvid, pc);
}

function multipSelectNone(bvid) {
    state.videoPageSelections[bvid] = [];
    refreshMultipCheckboxes(bvid, state.videos.find(function(v){return v.bvid===bvid}).pageCount || 1);
}

function multipSelectRange(bvid, pc) {
    var from = parseInt(document.getElementById("mp-from").value) || 1;
    var to = parseInt(document.getElementById("mp-to").value) || pc;
    if (from < 1) from = 1; if (to > pc) to = pc;
    if (from > to) { var t = from; from = to; to = t; }
    state.videoPageSelections[bvid] = [];
    for (var i = from; i <= to; i++) state.videoPageSelections[bvid].push(i);
    refreshMultipCheckboxes(bvid, pc);
}

function multipToggle(bvid, pn, checked) {
    var sel = state.videoPageSelections[bvid] || [1];
    var idx = sel.indexOf(pn);
    if (checked && idx < 0) sel.push(pn);
    if (!checked && idx >= 0) sel.splice(idx, 1);
    if (sel.length === 0) sel.push(1);
    state.videoPageSelections[bvid] = sel;
}

function refreshMultipCheckboxes(bvid, pc) {
    var container = document.getElementById("mp-checkboxes");
    if (!container) return;
    var sel = state.videoPageSelections[bvid] || [1];
    container.innerHTML = "";
    for (var pn = 1; pn <= pc; pn++) {
        var checked = sel.indexOf(pn) >= 0;
        container.innerHTML += '<label style="font-size:0.78rem;cursor:pointer;padding:2px 8px;border-radius:4px;background:var(--bg-tertiary);' + (checked ? 'border:2px solid var(--accent);' : 'border:1px solid var(--border);') + '"><input type="checkbox" class="mp-cb" value="' + pn + '"' + (checked ? ' checked' : '') + ' onchange="multipToggle(\'' + bvid + '\',' + pn + ',this.checked)"> P' + pn + '</label>';
    }
}

function isMultiPVideo(bvid) {
    for (var i = 0; i < state.videos.length; i++) {
        if (state.videos[i].bvid === bvid) return (state.videos[i].pageCount || 1) > 1;
    }
    return false;
}

var multipCache = { _detected: {}, _processed: {} };

async function loadMultipCache() {
    try {
        var od = outputDirInput.value.trim() || "./output";
        var res = await fetch("/api/multip-cache?output_dir=" + encodeURIComponent(od));
        var data = await res.json() || {};
        multipCache = { _detected: data._detected || {}, _processed: data._processed || {} };
        // 恢复已缓存的分P数
        for (var bvid in multipCache._detected) {
            var pc = multipCache._detected[bvid];
            if (pc > 1) {
                var v = state.videos.find(function (x) { return x.bvid === bvid; });
                if (v) v.pageCount = pc;
            }
        }
        // 从 checkpoint 恢复已处理的P号
        for (var key in state.processedRecords) {
            var rec = state.processedRecords[key];
            var bvid2 = _bvidFromKey(key);
            if (rec.p && !(multipCache._processed[bvid2] || []).includes(rec.p)) {
                if (!multipCache._processed[bvid2]) multipCache._processed[bvid2] = [];
                if (multipCache._processed[bvid2].indexOf(rec.p) < 0) {
                    multipCache._processed[bvid2].push(rec.p);
                }
            }
        }
    } catch (e) { multipCache = { _detected: {}, _processed: {} }; }
}

async function markMultiPProcessed(bvid, pNum) {
    if (!multipCache._processed[bvid]) multipCache._processed[bvid] = [];
    if (multipCache._processed[bvid].indexOf(pNum) < 0) {
        multipCache._processed[bvid].push(pNum);
    }
    await saveMultipCache();
}

function getMultiPStatus(bvid) {
    var pc = multipCache._detected[bvid] || 0;
    if (pc <= 1) return null;
    var processed = multipCache._processed[bvid] || [];
    if (processed.length === 0) return "unprocessed";
    if (processed.length >= pc) return "full";
    return "partial";
}

async function saveMultipCache() {
    try {
        var od = outputDirInput.value.trim() || "./output";
        await fetch("/api/multip-cache?output_dir=" + encodeURIComponent(od), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(multipCache)
        });
    } catch (e) {}
}

async function detectMultiPVideos() {
    var btn = $("detect-multip-btn");
    if (btn.disabled) return;
    btn.disabled = true;
    btn.textContent = "⏳ 检测中...";
    // 先重新加载缓存确保最新
    await loadMultipCache();
    var total = state.videos.length;
    var allCached = state.videos.every(function (v) { return multipCache._detected.hasOwnProperty(v.bvid); });
    if (allCached && total > 0) {
        var mpCached = Object.values(multipCache._detected).filter(function(pc) { return pc > 1; }).length;
        showBanner("全部 " + total + " 个视频已检测过（其中 " + mpCached + " 个多P），无需重复检测", "success");
        btn.textContent = "🔍 检测多P";
        btn.disabled = false;
        return;
    }
    var checked = 0;
    var found = 0;
    for (var i = 0; i < total; i++) {
        var v = state.videos[i];
        // 跳过已缓存的分P数（_detected中有记录=已查过）
        if (multipCache._detected.hasOwnProperty(v.bvid)) { checked++; continue; }
        btn.textContent = "⏳ " + (i + 1) + "/" + total;
        try {
            var res = await fetch("/api/bilibili-video-info/" + v.bvid);
            var data = await res.json();
            var pc = data.pageCount || 1;
            multipCache._detected[v.bvid] = pc;
            if (pc > 1) {
                v.pageCount = pc;
                found++;
                await saveMultipCache();  // 发现多P立即保存（等待完成）
            }
            checked++;
        } catch (e) { checked++; }
        if (checked % 30 === 0) { renderVideoList(); await saveMultipCache(); }
        await sleep(250 + Math.random() * 250);
    }
    await saveMultipCache();
    btn.textContent = "🔍 检测多P";
    btn.disabled = false;
    showBanner("检测完成: " + checked + "/" + total + " 已查, 发现 " + found + " 个新增多P视频", found > 0 ? "success" : "warning");
    renderVideoList();
}

// 保留旧函数签名兼容（渲染到 #video-list 直接用）
function renderTableView(filtered) { renderTableViewTo(videoList, filtered); }
function renderCardView(filtered) { renderCardViewTo(videoList, filtered); }

function statusLabel(st) {
    if (st === "done") return "✓ 已处理";
    if (st === "failed") return "✗ 失败";
    return "待处理";
}

function renderActionButtons(v, st) {
    var html = "";
    if (st === "done") {
        html += '<button class="btn btn-xs btn-open-file" data-bvid="' + v.bvid + '" title="打开本地笔记文件">📂 打开笔记</button>';
        html += '<button class="btn btn-xs btn-open-folder" data-bvid="' + v.bvid + '" title="打开笔记所在文件夹">📁 文件夹</button>';
        html += '<button class="btn btn-xs btn-reprocess" data-bvid="' + v.bvid + '" title="仅清处理记录，不删缓存和本地文件。重跑结果相同（复用B站字幕）。要换模型或本地转写请用🗑强制删除">🔄</button>';
        html += '<button class="btn btn-xs btn-force-delete" data-bvid="' + v.bvid + '" title="彻底清除：删BiliNote缓存+本地笔记文件+处理记录。适合换模型、切本地转写、修复错误。与🔄不同：🔄仅清记录不删缓存，重跑结果相同">🗑 强制删除</button>';
    } else if (st === "failed") {
        html += '<button class="btn btn-xs btn-reprocess" data-bvid="' + v.bvid + '" title="仅清处理记录，不删缓存和本地文件。重跑结果相同（复用B站字幕）。要换模型或本地转写请用🗑强制删除">🔄 重试</button>';
        html += '<button class="btn btn-xs btn-force-delete" data-bvid="' + v.bvid + '" title="彻底清除：删BiliNote缓存+本地笔记文件+处理记录。适合换模型、切本地转写、修复错误。与🔄不同：🔄仅清记录不删缓存，重跑结果相同">🗑 强制删除</button>';
    } else if ((v.pageCount || 1) > 1) {
        // 多P视频未处理：显示P数选择器 + 强制删除
        var sel = state.videoPageSelections[v.bvid];
        var curP = (Array.isArray(sel) ? sel[0] : sel) || 1;
        html += '<span class="p-selector">P<select class="p-sel" data-bvid="' + v.bvid + '">';
        for (var pn = 1; pn <= v.pageCount; pn++) {
            html += '<option value="' + pn + '"' + (pn === curP ? ' selected' : '') + '>' + pn + '</option>';
        }
        html += '</select></span>';
        html += '<button class="btn btn-xs btn-force-delete" data-bvid="' + v.bvid + '" title="彻底清除：删BiliNote缓存+本地笔记文件+处理记录。适合换模型、切本地转写、修复错误。与🔄不同：🔄仅清记录不删缓存，重跑结果相同">🗑</button>';
    } else {
        // 单P待处理：也提供强制删除（可能有残留缓存）
        html += '<button class="btn btn-xs btn-force-delete" data-bvid="' + v.bvid + '" title="彻底清除：删BiliNote缓存+本地笔记文件+处理记录。适合换模型、切本地转写、修复错误。与🔄不同：🔄仅清记录不删缓存，重跑结果相同">🗑 强制删除</button>';
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
    videoList.querySelectorAll(".multip-clickable").forEach(function (badge) {
        badge.addEventListener("click", function (e) {
            e.stopPropagation();
            var bvid = this.getAttribute("data-bvid");
            var v = state.videos.find(function (x) { return x.bvid === bvid; });
            if (v) showMultipPanel(v);
        });
    });
    bindActionButtons();
}

function bindCardEvents() {
    videoList.querySelectorAll(".video-cb").forEach(function (cb) { cb.addEventListener("change", updateSelectedCount); });
    videoList.querySelectorAll(".multip-clickable").forEach(function (badge) {
        badge.addEventListener("click", function (e) {
            e.stopPropagation();
            var bvid = this.getAttribute("data-bvid");
            var v = state.videos.find(function (x) { return x.bvid === bvid; });
            if (v) showMultipPanel(v);
        });
    });
    videoList.querySelectorAll(".card-tag-folder").forEach(function (tag) {
        tag.addEventListener("click", function () {
            state.folderFilter = this.getAttribute("data-folder");
            state.currentPage = 1;
            selectAllCb.checked = false;
            renderVideoList();
            document.querySelector(".video-section").scrollIntoView({ behavior: "smooth" });
        });
    });
    videoList.querySelectorAll(".card-tag-desc").forEach(function (tag) {
        tag.addEventListener("click", function (e) {
            e.stopPropagation();
            showDescPopup(this.getAttribute("data-desc"), this);
        });
    });
    bindActionButtons();
}

var _descPopupCloseHandler = null;
function showDescPopup(text, anchor) {
    // 清理旧弹窗和事件
    var existing = document.getElementById("desc-popup");
    if (existing) existing.remove();
    if (_descPopupCloseHandler) {
        document.removeEventListener("click", _descPopupCloseHandler);
        _descPopupCloseHandler = null;
    }

    var popup = document.createElement("div");
    popup.id = "desc-popup";
    popup.textContent = text;
    popup.style.cssText = "position:fixed;max-width:380px;padding:14px 18px;background:var(--bg-secondary);color:var(--text-primary);border:1px solid var(--border);border-radius:10px;font-size:0.84rem;line-height:1.7;z-index:9999;box-shadow:0 6px 24px rgba(0,0,0,0.45);white-space:pre-wrap;word-break:break-word;";
    document.body.appendChild(popup);

    // 居中定位在锚点下方
    var rect = anchor.getBoundingClientRect();
    var pw = popup.offsetWidth;
    var left = rect.left + rect.width / 2 - pw / 2;
    var top = rect.bottom + 8;
    if (left < 8) left = 8;
    if (left + pw > window.innerWidth - 8) left = window.innerWidth - pw - 8;
    if (top + popup.offsetHeight > window.innerHeight) top = rect.top - popup.offsetHeight - 8;

    popup.style.left = Math.max(8, left) + "px";
    popup.style.top = Math.max(8, top) + "px";
    popup.style.animation = "fadeIn 0.15s ease";

    _descPopupCloseHandler = function (e) {
        if (!popup.contains(e.target) && e.target !== anchor) {
            popup.remove();
            document.removeEventListener("click", _descPopupCloseHandler);
            _descPopupCloseHandler = null;
        }
    };
    setTimeout(function () {
        document.addEventListener("click", _descPopupCloseHandler);
    }, 10);
}

function bindActionButtons() {
    videoList.querySelectorAll(".btn-open-file").forEach(function (btn) {
        btn.addEventListener("click", function () { openLocalFile(btn.getAttribute("data-bvid")); });
    });
    videoList.querySelectorAll(".btn-open-folder").forEach(function (btn) {
        btn.addEventListener("click", function () { openLocalFolder(btn.getAttribute("data-bvid")); });
    });
    videoList.querySelectorAll(".btn-reprocess").forEach(function (btn) {
        btn.addEventListener("click", function () { reprocessVideo(btn.getAttribute("data-bvid")); });
    });
    videoList.querySelectorAll(".btn-force-delete").forEach(function (btn) {
        btn.addEventListener("click", function () { forceDeleteCache(btn.getAttribute("data-bvid")); });
    });
    videoList.querySelectorAll(".p-sel").forEach(function (sel) {
        sel.addEventListener("change", function () {
            var bvid = sel.getAttribute("data-bvid");
            state.videoPageSelections[bvid] = [parseInt(sel.value)];
        });
        if (!state.videoPageSelections[sel.getAttribute("data-bvid")]) {
            state.videoPageSelections[sel.getAttribute("data-bvid")] = [1];
        }
    });
}

async function openLocalFolder(bvid, pNum) {
    try {
        if (!pNum) {
            var video = state.videos.find(function (v) { return v.bvid === bvid; });
            var pageCount = video ? (video.pageCount || 1) : 1;
            if (pageCount > 1) {
                var processed = _isMultiPProcessed(bvid);
                if (processed && processed.length >= 1) {
                    showOpenPSelector(bvid, processed, pageCount, "folder");
                    return;
                }
            }
            pNum = 1;
        }
        var res = await fetch("/api/get-output-files/" + bvid + "?p=" + pNum);
        var data = await res.json();
        if (!data.dir) { showBanner("未找到文件夹路径", "warning"); return; }
        var openRes = await fetch("/api/open-file?path=" + encodeURIComponent(data.dir));
        var openData = await openRes.json();
        if (!openRes.ok) { showBanner("打开文件夹失败：" + (openData.error || "未知错误"), "error"); }
    } catch (err) { showBanner("打开文件夹失败：" + err.message, "error"); }
}

function _isMultiPProcessed(bvid) {
    var processed = multipCache._processed[bvid] || [];
    return processed.length > 0 ? processed : null;
}

async function openLocalFile(bvid, pNum) {
    try {
        // 多P且未指定P：弹出选择器
        if (!pNum) {
            var video = state.videos.find(function (v) { return v.bvid === bvid; });
            var pageCount = video ? (video.pageCount || 1) : 1;
            if (pageCount > 1) {
                var processed = _isMultiPProcessed(bvid);
                if (processed && processed.length >= 1) {
                    showOpenPSelector(bvid, processed, pageCount, "file");
                    return;
                }
            }
            pNum = 1;
        }
        var res = await fetch("/api/get-output-files/" + bvid + "?p=" + pNum);
        var data = await res.json();
        var files = data.files || [];
        if (files.length === 0) {
            showBanner("未找到 P" + pNum + " 的本地文件，可能尚未保存", "warning");
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

function showOpenPSelector(bvid, processed, pageCount, mode) {
    closeOpenPSelector();
    var overlay = document.createElement("div");
    overlay.id = "openp-overlay";
    overlay.style.cssText = "position:fixed;inset:0;z-index:9998;background:rgba(0,0,0,0.3);";
    overlay.addEventListener("click", closeOpenPSelector);

    var panel = document.createElement("div");
    panel.id = "openp-panel";
    panel.style.cssText = "position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:9999;background:var(--bg-primary);border:1px solid var(--border);border-radius:8px;padding:16px;min-width:320px;max-width:90vw;box-shadow:0 8px 32px rgba(0,0,0,0.3);";

    var html = '<div style="font-weight:600;margin-bottom:4px;">选择要打开的分P</div>';
    html += '<div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:12px;">共 ' + pageCount + 'P，已处理 ' + processed.length + 'P</div>';
    html += '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;">';
    for (var i = 0; i < processed.length; i++) {
        var pn = processed[i];
        html += '<button class="btn btn-sm btn-primary openp-btn" data-p="' + pn + '">P' + pn + '</button>';
    }
    html += '</div>';
    html += '<button class="btn btn-sm" onclick="closeOpenPSelector()" style="width:100%;">取消</button>';
    panel.innerHTML = html;

    document.body.appendChild(overlay);
    document.body.appendChild(panel);

    panel.querySelectorAll(".openp-btn").forEach(function (btn) {
        btn.addEventListener("click", function () {
            var p = parseInt(btn.getAttribute("data-p"));
            closeOpenPSelector();
            if (mode === "file") { openLocalFile(bvid, p); }
            else { openLocalFolder(bvid, p); }
        });
    });
}

function closeOpenPSelector() {
    var overlay = document.getElementById("openp-overlay");
    var panel = document.getElementById("openp-panel");
    if (overlay) overlay.remove();
    if (panel) panel.remove();
}

async function reprocessVideo(bvid) {
    try {
        await fetch("/api/checkpoint/" + bvid, { method: "DELETE" });
        state.processedBvids.delete(bvid);
        var prefix = bvid + "|";
        for (var key in state.processedRecords) {
            if (key === bvid || key.indexOf(prefix) === 0) {
                delete state.processedRecords[key];
            }
        }
        renderVideoList();
    } catch (err) {
        showBanner("清除记录失败：" + err.message, "error");
    }
}

async function forceDeleteCache(bvid) {
    if (!confirm("将删除 BiliNote 容器内该视频的所有缓存文件，并清除本地处理记录。\n之后可重新提交处理。\n\n确定继续？")) {
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
            var prefix = bvid + "|";
            for (var key in state.processedRecords) {
                if (key === bvid || key.indexOf(prefix) === 0) {
                    delete state.processedRecords[key];
                }
            }
            // 同时清除 multipCache 中该视频的已处理记录
            if (multipCache._processed[bvid]) {
                delete multipCache._processed[bvid];
                saveMultipCache();
            }
            renderVideoList();
        } else {
            showBanner("操作失败：" + (data.error || "未知错误"), "error");
        }
    } catch (err) {
        showBanner("请求失败：" + err.message, "error");
    }
}

var _bannerTimer = null;
function showBanner(m, t) {
    banner.textContent = m; banner.className = "banner banner-" + (t || "warning");
    if (_bannerTimer) clearTimeout(_bannerTimer);
    _bannerTimer = setTimeout(hideBanner, 15000);
}
function hideBanner() { banner.className = "banner hidden"; if (_bannerTimer) { clearTimeout(_bannerTimer); _bannerTimer = null; } }
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

function _bvidFromKey(key) {
    var idx = key.lastIndexOf("|");
    return idx > 0 ? key.substring(0, idx) : key;
}

async function loadCheckpoint() {
    try {
        var res = await fetch("/api/checkpoint"); var data = await res.json();
        state.processedRecords = data.records || {};
        state.processedBvids = new Set();
        var needBackfill = false;
        for (var key in state.processedRecords) {
            var rec = state.processedRecords[key];
            if (rec.status === "SUCCESS") {
                state.processedBvids.add(_bvidFromKey(key));
            }
            if (rec.status === "SUCCESS" && !rec.transcript_source) {
                needBackfill = true;
            }
        }
        // 如果还没有导入文件，从 checkpoint 记录构建视频列表
        if (!state.videos || state.videos.length === 0) {
            var seenBvids = {};
            var checkpointVideos = [];
            for (var key in state.processedRecords) {
                var bvid = _bvidFromKey(key);
                if (seenBvids[bvid]) continue;
                seenBvids[bvid] = true;
                var rec = state.processedRecords[key];
                checkpointVideos.push({
                    bvid: bvid,
                    title: rec.title || "",
                    folder: rec.folder || "未分类",
                    url: "https://www.bilibili.com/video/" + bvid + "/",
                    cover: rec.cover || "",
                    ownerName: rec.ownerName || "",
                    ownerMid: rec.ownerMid || "",
                    pageCount: rec.pageCount || 1,
                    description: rec.description || "",
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

function updateButtons() {
    startBtn.disabled = state.running;
    startSelectedBtn.disabled = state.running || getSelectedBvids().length === 0;
    // 选中含多P时禁用单P按钮
    var selBvids = getSelectedBvids();
    if (selBvids.length > 0) {
        var hasMultiP = selBvids.some(function (bvid) {
            var v = state.videos.find(function (x) { return x.bvid === bvid; });
            return v && (v.pageCount || 1) > 1;
        });
        var hasSingleP = selBvids.some(function (bvid) {
            var v = state.videos.find(function (x) { return x.bvid === bvid; });
            return v && (v.pageCount || 1) <= 1;
        });
        startSelectedBtn.disabled = state.running || !hasSingleP;
    }
    stopBtn.disabled = !state.running;
    updateMultipButtons();
}

function updateMultipButtons() {
    var mpUnprocessed = 0;
    for (var i = 0; i < state.videos.length; i++) {
        if ((state.videos[i].pageCount || 1) > 1 && getMultiPStatus(state.videos[i].bvid) !== "full") mpUnprocessed++;
    }
    var btnAll = $("start-multip-all-btn");
    var btnSel = $("start-multip-selected-btn");
    if (btnAll) btnAll.disabled = state.running || mpUnprocessed === 0;
    if (btnSel) {
        var selBvids = getSelectedBvids();
        var selHasMultiP = selBvids.some(function (bvid) {
            var v = state.videos.find(function (x) { return x.bvid === bvid; });
            return v && (v.pageCount || 1) > 1;
        });
        btnSel.disabled = state.running || mpUnprocessed === 0 || !selHasMultiP;
    }
}

async function startMultipBatch(selectedOnly) {
    if (state.running) return;
    if (!providerSelect.value) { showBanner("请先选择供应商和模型", "warning"); return; }
    if (!modelSelect.value) { showBanner("请先选择模型", "warning"); return; }
    saveConfig();

    var batch;
    if (selectedOnly) {
        var selBvids = new Set(getSelectedBvids());
        batch = state.videos.filter(function (v) { return selBvids.has(v.bvid) && (v.pageCount || 1) > 1; });
    } else {
        batch = state.videos.filter(function (v) { return (v.pageCount || 1) > 1 && getMultiPStatus(v.bvid) !== "full"; });
    }
    if (batch.length === 0) { showBanner("没有多P视频需要处理", "warning"); return; }

    // 计算总任务数（剔除已处理的分P）
    var allTasks = [];
    var rawTotal = 0;
    for (var i = 0; i < batch.length; i++) {
        var sel = state.videoPageSelections[batch[i].bvid] || [1];
        rawTotal += sel.length;
        for (var j = 0; j < sel.length; j++) {
            var pn = sel[j];
            var done = multipCache._processed[batch[i].bvid] || [];
            if (done.indexOf(pn) < 0) {
                allTasks.push({ video: batch[i], pNum: pn });
            }
        }
    }
    var totalTasks = allTasks.length;
    if (totalTasks === 0) { showBanner("所选分P已全部处理完毕", "warning"); return; }
    var skippedCount = rawTotal - totalTasks;

    state.running = true; state.stopRequested = false; state.stopImmediate = false; state.currentTaskId = ""; state.currentIndex = 0;
    state.stats = { total: totalTasks, success: 0, failed: 0, skipped: 0 };
    state.outputDir = outputDirInput.value.trim() || "./output";

    progressSection.style.display = "block"; logArea.innerHTML = "";
    updateButtons(); updateProgress();
    if (skippedCount > 0) addLog("已跳过 " + skippedCount + " 个已处理分P", "skip");
    addLog("多P批量处理开始 — " + batch.length + " 个视频, " + totalTasks + " 个分P任务", "info");

    var processed = 0;
    for (var ti = 0; ti < allTasks.length; ti++) {
        state.currentIndex = processed;
        if (!state.running || state.stopRequested) break;
        var task = allTasks[ti];
        var video = task.video;
        var pNum = task.pNum;
        addLog("[" + (processed + 1) + "/" + totalTasks + "] " + video.title + " (P" + pNum + ")", "info");
        try {
            var taskId = await submitVideo(video, pNum); state.currentTaskId = taskId;
            var forceLocalHint2 = (video.platform === "local" && optForceLocal.checked) ? " (本地Whisper)" : "";
            addLog("  → 已提交, task_id: " + taskId.substring(0, 8) + "..." + forceLocalHint2, "info");
            var duration = await getVideoDuration(video);
            var result = await pollTaskStatus(taskId, calcTimeout(duration));
            if (result.status === "SUCCESS") {
                addLog("  ✓ P" + pNum + " 完成", "success");
                state.processedBvids.add(video.bvid);
                await markMultiPProcessed(video.bvid, pNum);
                state.processedRecords[video.bvid + "|" + pNum] = { status: "SUCCESS", task_id: taskId, time: new Date().toISOString(), transcript_source: result.transcript_source || "", p: pNum, skip_subtitle: optForceLocal.checked };
                state.stats.success++;
            } else {
                addLog("  ✗ P" + pNum + " 失败", "error");
                state.stats.failed++;
            }
        } catch (err) { addLog("  ✗ P" + pNum + " 错误: " + err.message, "error"); state.stats.failed++; }
        processed++;
        updateProgress(); renderVideoList();
        if (ti < allTasks.length - 1 && state.running && !state.stopRequested) await sleep(3000);
    }

    state.running = false; updateButtons(); renderVideoList();
    addLog("多P批量处理结束 — ✓ " + state.stats.success + " ✗ " + state.stats.failed, "info");
}

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

async function submitVideo(video, pNum) {
    pNum = pNum || 1;
    var fmt = getFormat();
    var platform = video.platform || "bilibili";
    var videoUrl;
    if (platform === "local") {
        videoUrl = video.url;  // 本地视频直接用文件路径
    } else {
        var baseUrl = normalizeVideoUrl(video.url, video.bvid);
        videoUrl = pNum > 1 ? baseUrl + "?p=" + pNum : baseUrl;
    }
    var transcriber = transcriberSelect.value;
    var skipSub = optForceLocal.checked;
    if (platform === "local" && optForceLocal.checked) {
        transcriber = "fast-whisper";  // 本地文件强制本地Whisper，不走云端
        skipSub = false;               // 本地文件无B站字幕可跳
    }
    var body = {
        bvid: video.bvid, title: video.title, folder: video.folder || "未分类", url: videoUrl,
        platform: platform,
        model_name: modelSelect.value, provider_id: providerSelect.value,
        quality: qualitySelect.value,
        transcriber_type: transcriber,
        whisper_model_size: whisperModelSelect.value || "",
        style: styleSelect.value, extras: promptInput.value,
        format: fmt,
        screenshot: fmt.indexOf("screenshot") !== -1,
        link: fmt.indexOf("link") !== -1,
        video_understanding: optVideoUnderstanding.checked,
        video_interval: parseInt(videoInterval.value) || 6,
        grid_size: [parseInt(gridRows.value) || 2, parseInt(gridCols.value) || 2],
        skip_subtitle: skipSub,
        save_options: getSaveOptions(),
        output_dir: outputDirInput.value.trim() || "./output",
        p: pNum,
        cover: video.cover || "",
        ownerName: video.ownerName || "",
        ownerMid: video.ownerMid || "",
        pageCount: video.pageCount || 1,
        description: video.description || "",
    };

    var res = await fetch("/api/process-video", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    var data = await res.json();
    if (!res.ok) throw new Error(data.error || "提交失败");
    return data.task_id;
}

async function getVideoDuration(video) {
    try {
        var params = [];
        if (video.platform === "local") {
            params.push("file_path=" + encodeURIComponent(video.url));
        } else {
            params.push("bvid=" + encodeURIComponent(video.bvid));
        }
        var res = await fetch("/api/video-duration?" + params.join("&"));
        var data = await res.json();
        if (data.duration_seconds > 0) return data.duration_seconds;
    } catch (e) {}
    return 0;  // 获取失败返回 0，调用方降级为默认超时
}

function calcTimeout(durationSeconds) {
    if (!durationSeconds || durationSeconds <= 0) return 900000;  // 降级：15分钟
    // 下载时间(时长/3) + 30分钟buffer，下限15分钟
    var minutes = Math.max(15, Math.ceil(durationSeconds / 3 / 60) + 30);
    return minutes * 60 * 1000;
}

function pollTaskStatus(taskId, timeoutMs) {
    timeoutMs = timeoutMs || 900000;
    return new Promise(function (resolve, reject) {
        var startTime = Date.now();
        var healthCheckCount = 0;
        var interval = setInterval(async function () {
            try {
                if (Date.now() - startTime > timeoutMs) { clearInterval(interval); reject(new Error("任务超时")); return; }
                if (state.stopImmediate) {
                    clearInterval(interval);
                    try { await fetch("/api/cancel-bilinote-task/" + taskId, { method: "DELETE" }); } catch (e) {}
                    reject(new Error("用户取消"));
                    return;
                }
                // 每10次轮询(30秒)检查 BiliNote 服务 + 任务是否还在运行
                healthCheckCount++;
                if (healthCheckCount % 10 === 0) {
                    try {
                        var hc = await fetch("/api/bilinote-health"); var hd = await hc.json();
                        if (!hd.alive) { clearInterval(interval); reject(new Error("BiliNote 服务崩溃，任务终止")); return; }
                    } catch (e) { clearInterval(interval); reject(new Error("BiliNote 服务不可达，任务终止")); return; }
                    try {
                        var ta = await fetch("/api/bilinote-task-alive/" + taskId); var tad = await ta.json();
                        if (!tad.alive) { clearInterval(interval); reject(new Error("BiliNote 任务异常（" + (tad.reason || "状态文件丢失") + "），任务终止")); return; }
                    } catch (e) { /* 任务存活检测失败不中断，继续轮询 */ }
                }
                var res = await fetch("/api/task-status/" + taskId); var data = await res.json();
                if (data.status === "SUCCESS" || data.status === "FAILED") { clearInterval(interval); resolve(data); }
            } catch (err) { clearInterval(interval); reject(err); }
        }, 3000);
    });
}

function stopBatch() {
    if (!state.running) return;
    var overlay = document.createElement("div");
    overlay.className = "stop-overlay";
    overlay.innerHTML = '<div class="stop-dialog"><p>确定要停止吗？</p><div class="stop-dialog-btns"><button id="stop-after-btn" class="btn btn-primary">完成当前任务后停止</button><button id="stop-now-btn" class="btn btn-danger">立即停止</button><button id="stop-cancel-btn" class="btn btn-ghost">取消</button></div></div>';
    document.body.appendChild(overlay);
    overlay.querySelector("#stop-after-btn").onclick = function () {
        overlay.remove();
        state.stopRequested = true;
        addLog("停止：完成当前任务后结束", "warning");
        stopBtn.disabled = true;
    };
    overlay.querySelector("#stop-now-btn").onclick = function () {
        overlay.remove();
        state.stopRequested = true;
        state.stopImmediate = true;
        if (state.currentTaskId) {
            fetch("/api/cancel-bilinote-task/" + state.currentTaskId, { method: "DELETE" }).catch(function(){});
        }
        addLog("立即停止：已中断任务并清理 BiliNote", "error");
        stopBtn.disabled = true;
    };
    overlay.querySelector("#stop-cancel-btn").onclick = function () { overlay.remove(); };
}

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
    if (willProcess === 0) { showBanner("所选视频已全部处理完毕", "warning"); return; }

    state.running = true; state.stopRequested = false; state.stopImmediate = false; state.currentTaskId = ""; state.currentIndex = 0;
    state.stats = { total: batch.length, success: 0, failed: 0, skipped: 0 };
    state.outputDir = outputDirInput.value.trim() || "./output";

    progressSection.style.display = "block"; logArea.innerHTML = "";
    updateButtons(); updateProgress();
    addLog("批量处理开始 — 共 " + batch.length + " 个（其中 " + willProcess + " 个待处理） — 输出: " + state.outputDir, "info");

    var processed = 0;
    for (var i = 0; i < batch.length; i++) {
        state.currentIndex = processed;
        if (!state.running || state.stopRequested) break;
        var video = batch[i];

        if (state.processedBvids.has(video.bvid)) {
            addLog("[" + (i + 1) + "/" + batch.length + "] 跳过已处理: " + video.title, "skip");
            state.stats.skipped++; processed++; updateProgress(); continue;
        }
        if ((video.pageCount || 1) > 1) {
            addLog("[" + (i + 1) + "/" + batch.length + "] 跳过多P视频: " + video.title, "skip");
            state.stats.skipped++; processed++; updateProgress(); continue;
        }

        addLog("[" + (i + 1) + "/" + batch.length + "] " + video.title + " (" + video.bvid + ")", "info");
        try {
            var sel = state.videoPageSelections[video.bvid];
            var pNum = (Array.isArray(sel) ? sel[0] : sel) || 1;
            var taskId = await submitVideo(video, pNum); state.currentTaskId = taskId;
            var forceLocalHint = (video.platform === "local" && optForceLocal.checked) ? " (本地Whisper)" : "";
            addLog("  → 已提交 BiliNote, task_id: " + taskId.substring(0, 8) + "..." + forceLocalHint, "info");
            var duration = await getVideoDuration(video);
            var result = await pollTaskStatus(taskId, calcTimeout(duration));
            if (result.status === "SUCCESS") {
                addLog("  ✓ 完成: " + video.title + " — BiliNote 可查看", "success");
                state.processedBvids.add(video.bvid);
                if ((video.pageCount || 1) > 1) await markMultiPProcessed(video.bvid, pNum);
                var ts = result.transcript_source || "";
                state.processedRecords[video.bvid + "|" + pNum] = { status: "SUCCESS", task_id: taskId, time: new Date().toISOString(), transcript_source: ts, p: pNum, skip_subtitle: optForceLocal.checked };
                state.stats.success++;
            } else {
                var errMsg = result.error || result.msg || "未知错误";
                addLog("  ✗ 失败: " + video.title + " — " + errMsg, "error");
                state.processedRecords[video.bvid + "|" + pNum] = { status: "FAILED", task_id: taskId, time: new Date().toISOString(), p: pNum, skip_subtitle: optForceLocal.checked };
                state.stats.failed++;
            }
        } catch (err) { addLog("  ✗ 错误: " + video.title + " - " + err.message, "error"); state.processedRecords[video.bvid + "|" + pNum] = { status: "FAILED", time: new Date().toISOString(), p: pNum, skip_subtitle: optForceLocal.checked }; state.stats.failed++; }
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
        if (!data.batches || data.batches.length === 0) {
            statusEl.textContent = "没有可同步的任务";
            btn.disabled = false;
            btn.textContent = "🔄 同步";
            return;
        }
        showScriptInModal(data.batches);
        statusEl.textContent = "共 " + data.total + " 条，分 " + data.batches.length + " 批，点击对应「复制」按钮逐批执行";
    } catch (err) {
        statusEl.textContent = "❌ 获取任务数据失败：" + err.message;
    }
    btn.disabled = false;
    btn.textContent = "🔄 同步";
}

function showScriptInModal(batches) {
    // 清理旧内容
    document.querySelectorAll("#sync-modal .sync-batch-row").forEach(function (el) { el.remove(); });
    var existingNote = document.getElementById("sync-reminder-note");
    if (existingNote) existingNote.remove();

    var container = document.createElement("div");
    container.id = "sync-batches-container";
    container.style.cssText = "margin-top:8px;max-height:50vh;overflow-y:auto;";

    for (var i = 0; i < batches.length; i++) {
        var b = batches[i];
        var row = document.createElement("div");
        row.className = "sync-batch-row";
        row.style.cssText = "margin-bottom:12px;border:1px solid var(--border);border-radius:6px;padding:10px;background:var(--bg-tertiary);";

        var header = document.createElement("div");
        header.style.cssText = "display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;";
        header.innerHTML = '<strong style="font-size:0.9rem;">' + b.label + '</strong>';

        var copyBtn = document.createElement("button");
        copyBtn.className = "btn btn-primary btn-sm";
        copyBtn.textContent = "📋 复制";
        copyBtn.setAttribute("data-batch", i);
        copyBtn.addEventListener("click", function () {
            var idx = parseInt(this.getAttribute("data-batch"));
            var ta = document.getElementById("sync-script-" + idx);
            if (ta) {
                ta.select();
                document.execCommand("copy");
                $("sync-status").textContent = "✅ 已复制 " + batches[idx].label + "！请到 BiliNotes 控制台 (F12→Console) 粘贴执行";
            }
        });
        header.appendChild(copyBtn);
        row.appendChild(header);

        var ta = document.createElement("textarea");
        ta.id = "sync-script-" + i;
        ta.value = b.script;
        ta.readOnly = true;
        ta.style.cssText = "width:100%;height:80px;padding:8px;border:1px solid var(--border);border-radius:4px;background:rgba(0,0,0,0.2);color:var(--text-primary);font-family:monospace;font-size:10px;resize:vertical;";
        ta.addEventListener("click", function () { this.select(); });
        row.appendChild(ta);

        container.appendChild(row);
    }

    var note = document.createElement("p");
    note.id = "sync-reminder-note";
    note.style.cssText = "color:#f59e0b;font-size:13px;margin-top:8px;margin-bottom:4px;";
    note.innerHTML = '<strong>⚠️ 提醒：</strong>按顺序逐批执行（每批独立粘贴到 BiliNotes 控制台）。<strong>最后一批执行完请手动刷新页面 (F5)</strong>。';

    var footer = document.querySelector("#sync-modal .sync-actions");
    if (footer) {
        footer.parentNode.insertBefore(container, footer);
        footer.parentNode.insertBefore(note, footer);
    }
}

function openSyncModal() {
    $("sync-modal").classList.remove("hidden");
    $("sync-status").textContent = "";
    document.querySelectorAll("#sync-modal .sync-batch-row").forEach(function (el) { el.remove(); });
    var existingContainer = document.getElementById("sync-batches-container");
    if (existingContainer) existingContainer.remove();
    var existingNote = document.getElementById("sync-reminder-note");
    if (existingNote) existingNote.remove();
}

function closeSyncModal() {
    $("sync-modal").classList.add("hidden");
}

async function openHelpModal() {
    $("help-modal").classList.remove("hidden");
    var content = $("help-content");
    if (content.getAttribute("data-loaded")) return;
    try {
        var res = await fetch("/api/readme");
        var md = await res.text();
        content.innerHTML = renderMarkdown(md);
        content.setAttribute("data-loaded", "1");
    } catch (e) {
        content.innerHTML = "<p>加载帮助文档失败</p>";
    }
}

function closeHelpModal() {
    $("help-modal").classList.add("hidden");
}

function renderMarkdown(md) {
    var lines = md.split('\n');
    var html = '';
    var inCodeBlock = false;
    var inTable = false;
    var tableRows = [];
    var tocItems = [];  // 收集标题用于目录

    function makeId(text) {
        return text.toLowerCase().replace(/[^\w一-鿿]+/g, '-').replace(/^-|-$/g, '');
    }

    for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        // 代码块
        if (line.startsWith('```')) {
            if (inCodeBlock) { html += '</code></pre>'; inCodeBlock = false; }
            else { html += '<pre><code>'; inCodeBlock = true; }
            continue;
        }
        if (inCodeBlock) { html += escapeHtml(line) + '\n'; continue; }
        // 表格
        if (line.indexOf('|') >= 0 && line.trim().startsWith('|')) {
            var cells = line.split('|').filter(function(c) { return c.trim(); });
            var isSep = cells.every(function(c) { return /^[-:]+$/.test(c.trim()); });
            if (!inTable) { inTable = true; tableRows = []; }
            if (isSep) continue;
            var tag = tableRows.length === 0 ? 'th' : 'td';
            tableRows.push('<tr>' + cells.map(function(c) { return '<' + tag + '>' + c.trim() + '</' + tag + '>'; }).join('') + '</tr>');
            if (i + 1 >= lines.length || lines[i + 1].indexOf('|') < 0) {
                html += '<table>' + tableRows.join('') + '</table>';
                inTable = false; tableRows = [];
            }
            continue;
        }
        // 标题（带锚点ID）
        if (line.startsWith('### ')) {
            var t3 = line.slice(4); var id3 = makeId(t3);
            tocItems.push({ level: 3, text: t3, id: id3 });
            html += '<h4 id="' + id3 + '"><a href="#' + id3 + '" class="md-anchor">#</a> ' + t3 + '</h4>'; continue;
        }
        if (line.startsWith('## ')) {
            var t2 = line.slice(3); var id2 = makeId(t2);
            tocItems.push({ level: 2, text: t2, id: id2 });
            html += '<h3 id="' + id2 + '"><a href="#' + id2 + '" class="md-anchor">#</a> ' + t2 + '</h3>'; continue;
        }
        if (line.startsWith('# ')) {
            var t1 = line.slice(2); var id1 = makeId(t1);
            tocItems.push({ level: 1, text: t1, id: id1 });
            html += '<h2 id="' + id1 + '"><a href="#' + id1 + '" class="md-anchor">#</a> ' + t1 + '</h2>'; continue;
        }
        // 空行
        if (!line.trim()) { html += '<br>'; continue; }
        // 列表
        if (/^[-*] /.test(line)) {
            html += '<li>' + inlineMarkdown(line.replace(/^[-*] /, '')) + '</li>';
            continue;
        }
        // 普通段落
        html += '<p>' + inlineMarkdown(line) + '</p>';
    }
    // 包裹未闭合的列表
    html = html.replace(/((?:<li>.*?<\/li>)+)/g, '<ul>$1</ul>');

    // 生成目录
    var tocHtml = '';
    if (tocItems.length > 0) {
        tocHtml = '<div class="md-toc"><h3>📑 目录</h3><ul>';
        for (var ti = 0; ti < tocItems.length; ti++) {
            var item = tocItems[ti];
            tocHtml += '<li class="toc-lv' + item.level + '"><a href="#' + item.id + '">' + item.text + '</a></li>';
        }
        tocHtml += '</ul></div>';
    }
    return tocHtml + html;
}
function inlineMarkdown(text) {
    return text
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
}

async function copySyncScript() {
    var statusEl = $("sync-status");
    statusEl.textContent = "正在生成注入脚本...";
    try {
        var res = await fetch("/api/bilinotes-sync");
        var data = await res.json();
        if (!data.batches || data.batches.length === 0) {
            statusEl.textContent = "没有可同步的任务";
            return;
        }
        showScriptInModal(data.batches);
        // 自动复制第一份
        var firstTa = document.getElementById("sync-script-0");
        if (firstTa) {
            firstTa.select();
            try {
                document.execCommand("copy");
                statusEl.textContent = "✅ 已复制第 1 份（共 " + data.batches.length + " 份，" + data.total + " 条）！请到 BiliNotes 控制台 (F12→Console) 粘贴执行";
            } catch (e) {
                statusEl.textContent = "⚠️ 复制失败，请点击对应批次的「复制」按钮";
            }
        }
    } catch (err) {
        statusEl.textContent = "❌ 获取任务数据失败：" + err.message;
    }
}
