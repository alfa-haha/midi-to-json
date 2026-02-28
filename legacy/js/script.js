// 获取DOM元素
const dropArea = document.getElementById('drop-area');
const fileInput = document.getElementById('file-input');
const fileInfo = document.getElementById('file-info');
const proHintBanner = document.getElementById('pro-hint-banner');
const convertBtn = document.getElementById('convert-btn');
const downloadBtn = document.getElementById('download-btn');
const statusMessage = document.getElementById('status-message');
const progressBar = document.getElementById('progress-bar');
const fileInputLabel = document.querySelector('.file-input-label');
const batchStatus = document.getElementById('batch-status');
const fileList = document.getElementById('file-list');
const processedCount = document.getElementById('processed-count');
const totalCount = document.getElementById('total-count');

// 存储上传的文件和转换后的JSON
let uploadedFiles = [];
let processedFiles = [];
let jobs = [];
let currentProcessingIndex = -1;
let isProcessing = false;
// 存储midi-json-parser库是否已加载
let midiParserLoaded = false;

let reportData = null;

const LIMITS = {
    free: {
        maxFiles: 20,
        maxTotalBytes: 100 * 1024 * 1024 // 100MB
    },
    pro: {
        softMaxFiles: 200,
        softMaxTotalBytes: 1024 * 1024 * 1024, // 1GB
        concurrency: 3
    }
};

function isProActive() {
    return !!(window.proState && window.proState.isPro);
}

function t(key, fallback) {
    if (translations && Object.prototype.hasOwnProperty.call(translations, key)) {
        return translations[key];
    }
    return fallback;
}

function bytesToMb(bytes) {
    return (bytes / (1024 * 1024)).toFixed(2);
}

function formatBytes(bytes) {
    return formatFileSize(bytes);
}

function getFileIdentityKey(file) {
    const lastModified = typeof file.lastModified === 'number' ? file.lastModified : 0;
    return `${file.name}::${file.size}::${lastModified}`;
}

function filterValidMidiFiles(files) {
    const validFiles = [];
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const lowerName = file.name.toLowerCase();
        if (lowerName.endsWith('.mid') || lowerName.endsWith('.midi')) {
            validFiles.push(file);
        }
    }
    return validFiles;
}

function dedupeFiles(files, seedKeys) {
    const keys = seedKeys || new Set();
    const uniqueFiles = [];
    let duplicateCount = 0;

    files.forEach((file) => {
        const key = getFileIdentityKey(file);
        if (keys.has(key)) {
            duplicateCount += 1;
            return;
        }
        keys.add(key);
        uniqueFiles.push(file);
    });

    return { uniqueFiles, duplicateCount };
}

function sumFileBytes(files) {
    return files.reduce((sum, f) => sum + (f && typeof f.size === 'number' ? f.size : 0), 0);
}

function hasPendingFiles() {
    return processedFiles.some(item => item === null);
}

function hasProcessableFiles() {
    return uploadedFiles.some((_, index) => {
        const item = processedFiles[index];
        return item === null || (item && item.error);
    });
}

function updateConvertButtonState() {
    convertBtn.disabled = isProcessing || uploadedFiles.length === 0 || !hasProcessableFiles();
}

function updateFileInfoText() {
    if (uploadedFiles.length === 0) {
        if (translations && translations.noFileSelected) {
            fileInfo.textContent = translations.noFileSelected;
        } else {
            fileInfo.textContent = 'No files selected';
        }
        return;
    }

    const totalBytes = sumFileBytes(uploadedFiles);

    if (translations) {
        if (uploadedFiles.length === 1) {
            const single = uploadedFiles[0];
            fileInfo.textContent = t('fileSelected', 'Selected: ') + single.name + ' (' + formatFileSize(single.size) + ')';
        } else {
            const prefix = t('filesSelected', 'Selected: ');
            const suffix = t('fileCount', ' files');
            fileInfo.textContent = `${prefix}${uploadedFiles.length}${suffix} (${formatFileSize(totalBytes)} total)`;
        }
    } else if (uploadedFiles.length === 1) {
        const single = uploadedFiles[0];
        fileInfo.textContent = `Selected: ${single.name} (${formatFileSize(single.size)})`;
    } else {
        fileInfo.textContent = `Selected: ${uploadedFiles.length} files (${formatFileSize(totalBytes)} total)`;
    }
}

function scrollToProPanel() {
    try {
        window.location.hash = '#pro-panel';
    } catch (e) {
        // no-op
    }
}

function setStatusHtml(html, { color } = {}) {
    statusMessage.innerHTML = html || '';
    if (color) statusMessage.style.color = color;
}

function setStatusText(text, { color } = {}) {
    statusMessage.textContent = text || '';
    if (color) statusMessage.style.color = color;
}

function resetProgressUi() {
    progressBar.style.width = '0';
}

function revokeAndClearReport() {
    reportData = null;
    const reportBtn = document.getElementById('download-report-btn');
    if (reportBtn) reportBtn.disabled = true;
}

function updateActionButtons() {
    const hasAnySuccess = processedFiles.some(item => item && !item.error);
    const hasAnyProcessed = processedFiles.some(item => item !== null);
    const hasAnyFailed = processedFiles.some(item => item && item.error);
    const allProcessed = processedFiles.length > 0 && processedFiles.every(item => item !== null);

    downloadBtn.disabled = isProcessing || !hasAnySuccess || !allProcessed;

    const retryAllBtn = document.getElementById('retry-all-failed-btn');
    if (retryAllBtn) retryAllBtn.disabled = isProcessing || !hasAnyFailed;

    const clearBtn = document.getElementById('clear-results-btn');
    if (clearBtn) clearBtn.disabled = isProcessing || !hasAnyProcessed;

    const reportBtn = document.getElementById('download-report-btn');
    if (reportBtn) reportBtn.disabled = isProcessing || !reportData;

    updateConvertButtonState();
}

function updateBatchMeta() {
    const metaEl = document.getElementById('batch-meta');
    if (!metaEl) return;
    const concurrency = isProActive() ? LIMITS.pro.concurrency : 1;
    const runningEl = document.getElementById('batch-running');
    const running = typeof window.__midieasyActiveWorkers === 'number' ? window.__midieasyActiveWorkers : 0;

    metaEl.textContent = t('concurrentWorkersLabel', 'Concurrent workers: ') + concurrency;
    if (runningEl) {
        runningEl.textContent = running ? ` (${t('workersRunningLabel', 'running')}: ${running}/${concurrency})` : '';
    }
}

function updateLimitInfoUi() {
    const el = document.querySelector('.file-limit-info');
    if (!el) return;
    if (isProActive()) {
        el.innerHTML = `<i class="fas fa-info-circle"></i> ${t('fileLimitInfoPro', 'Pro: higher limits (soft cap applies)')}`;
    } else {
        const text = t('fileLimitInfoFree', `Free limit: up to ${LIMITS.free.maxFiles} files (max ${bytesToMb(LIMITS.free.maxTotalBytes)}MB total)`);
        el.innerHTML = `<i class="fas fa-info-circle"></i> ${text}`;
    }
}

function updateProToolInfoUi() {
    const el = document.querySelector('[data-pro-tool-info]');
    if (!el) return;
    if (isProActive()) {
        el.textContent = t('proToolInfoActive', '✅ Pro unlocked — concurrency: 3, batch limit: unlocked (soft cap), report: enabled.');
        el.style.display = '';
    } else {
        el.textContent = t('proToolInfoInactive', `Free — concurrency: 1, limit: ${LIMITS.free.maxFiles} files / ${bytesToMb(LIMITS.free.maxTotalBytes)}MB total.`);
        el.style.display = '';
    }
}

function updateProHintBanner({ forceHide = false } = {}) {
    if (!proHintBanner) return;
    if (forceHide || isProActive()) {
        proHintBanner.style.display = 'none';
        return;
    }

    const count = uploadedFiles.length;
    const shouldShow = count >= 15 && count <= LIMITS.free.maxFiles;
    proHintBanner.style.display = shouldShow ? 'flex' : 'none';
}

function applyProUi() {
    updateLimitInfoUi();
    updateBatchMeta();
    updateProToolInfoUi();
    updateProHintBanner();
}

function ensureBatchControls() {
    const header = document.querySelector('.batch-header');
    if (!header) return;
    let right = header.querySelector('[data-batch-right]');
    if (!right) {
        right = document.createElement('div');
        right.className = 'batch-right';
        right.setAttribute('data-batch-right', '');

        const progress = header.querySelector('#batch-progress');
        if (progress) right.appendChild(progress);
        header.appendChild(right);
    }

    if (!document.getElementById('batch-meta')) {
        const meta = document.createElement('div');
        meta.id = 'batch-meta';
        meta.className = 'batch-meta';
        right.appendChild(meta);
    }

    if (!document.getElementById('batch-actions')) {
        const actions = document.createElement('div');
        actions.id = 'batch-actions';
        actions.className = 'batch-actions';

        const retryAllBtn = document.createElement('button');
        retryAllBtn.id = 'retry-all-failed-btn';
        retryAllBtn.className = 'btn secondary-btn btn-sm';
        retryAllBtn.type = 'button';
        retryAllBtn.textContent = t('retryAllFailedBtn', 'Retry all failed');
        retryAllBtn.disabled = true;
        retryAllBtn.addEventListener('click', retryAllFailed);

        const reportBtn = document.createElement('button');
        reportBtn.id = 'download-report-btn';
        reportBtn.className = 'btn secondary-btn btn-sm';
        reportBtn.type = 'button';
        reportBtn.textContent = t('downloadReportBtn', 'Download report.json');
        reportBtn.disabled = true;
        reportBtn.addEventListener('click', downloadReport);

        const clearBtn = document.createElement('button');
        clearBtn.id = 'clear-results-btn';
        clearBtn.className = 'btn secondary-btn btn-sm';
        clearBtn.type = 'button';
        clearBtn.textContent = t('clearResultsBtn', 'Clear results');
        clearBtn.disabled = true;
        clearBtn.addEventListener('click', () => clearResults({ keepSelection: true }));

        const runningSpan = document.createElement('span');
        runningSpan.id = 'batch-running';
        runningSpan.className = 'batch-running';

        actions.appendChild(retryAllBtn);
        actions.appendChild(reportBtn);
        actions.appendChild(clearBtn);
        actions.appendChild(runningSpan);
        right.appendChild(actions);
    }
}

// 初始化页面
function init() {
    ensureBatchControls();
    applyProUi();

    // 监听 Pro 状态变化（激活/校验/退出）
    document.addEventListener('midieasy:pro-changed', () => {
        applyProUi();
        updateActionButtons();
    });

    // 语言切换后重新应用 Pro UI（避免被 i18n 覆盖）
    if (typeof window.setLanguage === 'function' && !window.__midieasySetLanguageWrapped) {
        const original = window.setLanguage;
        window.setLanguage = function(lang) {
            original(lang);
            setTimeout(() => {
                ensureBatchControls();
                applyProUi();
                // 重新设置动态按钮文案
                const retryAllBtn = document.getElementById('retry-all-failed-btn');
                if (retryAllBtn) retryAllBtn.textContent = t('retryAllFailedBtn', 'Retry all failed');
                const reportBtn = document.getElementById('download-report-btn');
                if (reportBtn) reportBtn.textContent = t('downloadReportBtn', 'Download report.json');
                const clearBtn = document.getElementById('clear-results-btn');
                if (clearBtn) clearBtn.textContent = t('clearResultsBtn', 'Clear results');
            }, 0);
        };
        window.__midieasySetLanguageWrapped = true;
    }

    // 为拖放区域添加事件监听器
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
    });

    // 添加高亮效果
    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, highlight, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, unhighlight, false);
    });

    // 处理文件拖放
    dropArea.addEventListener('drop', handleDrop, false);
    
    // 处理文件选择
    fileInput.addEventListener('change', handleFileSelect, false);
    
    // 点击上传区域触发文件选择（但要避免点击文件选择按钮时的重复触发）
    dropArea.addEventListener('click', (e) => {
        // 如果点击的是文件选择按钮或其子元素，则不再触发fileInput.click()
        if (!e.target.closest('.file-input-label')) {
            fileInput.click();
        }
    });
    
    // 添加按钮事件
    convertBtn.addEventListener('click', startBatchProcessing);
    downloadBtn.addEventListener('click', downloadAllAsZip);
    
    // 预加载midi-json-parser库
    if (typeof loadMidiParser === 'function') {
        updateStatusMessage('loading');
        loadMidiParser()
            .then(() => {
                midiParserLoaded = true;
                updateStatusMessage('loadSuccess');
                statusMessage.style.color = '#27ae60';
                setTimeout(() => {
                    if (uploadedFiles.length === 0) {
                        statusMessage.textContent = '';
                    }
                }, 3000);
            })
            .catch(error => {
                console.error('Failed to load midi-json-parser library:', error);
                updateStatusMessage('loadError');
                statusMessage.style.color = '#e74c3c';
            });
    }
}

// 阻止默认行为
function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

// 拖放区域高亮
function highlight() {
    dropArea.classList.add('dragover');
}

// 取消高亮
function unhighlight() {
    dropArea.classList.remove('dragover');
}

// 处理文件拖放
function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    
    if (files.length > 0) {
        handleFiles(files);
    }
}

// 处理文件选择
function handleFileSelect(e) {
    const files = e.target.files;
    
    if (files.length > 0) {
        handleFiles(files);
    }
}

// 处理文件
function handleFiles(files) {
    if (isProcessing) {
        setStatusText(t('uploadBlockedWhileProcessing', 'Conversion in progress. Please wait for completion.'), { color: '#e67e22' });
        return;
    }

    const incomingValidFiles = filterValidMidiFiles(files);
    if (incomingValidFiles.length === 0) {
        updateStatusMessage('fileError');
        statusMessage.style.color = '#e74c3c';
        return;
    }

    const hasExistingSelection = uploadedFiles.length > 0;
    const mode = hasExistingSelection && hasPendingFiles() ? 'append' : 'overwrite';
    const seedKeys = mode === 'append' ? new Set(uploadedFiles.map(getFileIdentityKey)) : new Set();
    const { uniqueFiles, duplicateCount } = dedupeFiles(incomingValidFiles, seedKeys);

    if (uniqueFiles.length === 0) {
        setStatusText(t('allDuplicatesSkipped', 'All selected files are already in the list.'), { color: '#e67e22' });
        return;
    }

    const targetFiles = mode === 'append' ? uploadedFiles.concat(uniqueFiles) : uniqueFiles;
    const totalBytes = sumFileBytes(targetFiles);
    const pro = isProActive();

    // Free：硬限制（强制拦截）
    if (!pro) {
        if (targetFiles.length > LIMITS.free.maxFiles || totalBytes > LIMITS.free.maxTotalBytes) {
            updateProHintBanner({ forceHide: true });
            const msg = t(
                'freeLimitExceeded',
                `Free limit exceeded: up to ${LIMITS.free.maxFiles} files / ${bytesToMb(LIMITS.free.maxTotalBytes)}MB total.`
            );
            const upgradeLabel = t('upgradeToProBtn', 'Upgrade to Pro');
            setStatusHtml(
                `${msg} <button id="upgrade-to-pro-btn" class="btn primary-btn btn-sm" type="button">${upgradeLabel}</button>`,
                { color: '#e74c3c' }
            );
            const btn = document.getElementById('upgrade-to-pro-btn');
            if (btn) btn.addEventListener('click', scrollToProPanel);
            return;
        }
    } else {
        // Pro：软上限（保护浏览器体验，不阻断但提示）
        if (targetFiles.length > LIMITS.pro.softMaxFiles || totalBytes > LIMITS.pro.softMaxTotalBytes) {
            const warning = t(
                'proSoftLimitWarning',
                'Large batch detected. For best performance, process in smaller batches. Continue anyway?'
            );
            const detail = `\n\n${targetFiles.length} files, ${formatBytes(totalBytes)} total.`;
            const ok = window.confirm(warning + detail);
            if (!ok) {
                return;
            }
        }
    }

    if (mode === 'overwrite') {
        clearResults({ keepSelection: false, silent: true });
    }

    const startIndex = uploadedFiles.length;
    uploadedFiles.push(...uniqueFiles);
    processedFiles.push(...new Array(uniqueFiles.length).fill(null));

    const now = Date.now();
    const newJobs = uniqueFiles.map((file, offset) => ({
        id: `${now}-${startIndex + offset}`,
        file,
        fileName: file.name,
        size: file.size,
        status: 'waiting',
        startedAt: 0,
        endedAt: 0,
        durationMs: 0,
        errorCode: '',
        errorMessage: ''
    }));
    jobs.push(...newJobs);

    uniqueFiles.forEach((file, offset) => {
        const fileItem = createFileListItem(file, startIndex + offset);
        fileList.appendChild(fileItem);
    });
    
    // 显示批量处理区域
    batchStatus.style.display = 'block';

    updateFileInfoText();
    
    // 更新文件计数
    const processedSoFar = processedFiles.filter(item => item !== null).length;
    processedCount.textContent = processedSoFar.toString();
    totalCount.textContent = uploadedFiles.length.toString();

    const actionText = mode === 'append'
        ? t('appendFilesSummary', `Added ${uniqueFiles.length} files to current batch.`)
        : t('newBatchSummary', `Started a new batch with ${uniqueFiles.length} files.`);
    const duplicateText = duplicateCount > 0
        ? ` ${t('duplicatesSkippedSuffix', `Skipped ${duplicateCount} duplicates.`)}`
        : '';
    setStatusText(`${actionText}${duplicateText}`, { color: '#666' });

    revokeAndClearReport();
    ensureBatchControls();
    applyProUi();
    updateOverallProgress();
}

// 创建文件列表项
function createFileListItem(file, index) {
    const fileItem = document.createElement('div');
    fileItem.className = 'file-item';
    fileItem.dataset.index = index;
    
    const fileName = document.createElement('div');
    fileName.className = 'file-name';
    fileName.textContent = file.name;
    
    const fileStatus = document.createElement('div');
    fileStatus.className = 'file-status';
    
    const statusIcon = document.createElement('div');
    statusIcon.className = 'status-icon status-pending';
    statusIcon.innerHTML = '<i class="fas fa-clock"></i>';
    
    const statusText = document.createElement('span');
    statusText.className = 'status-text';
    statusText.textContent = t('waitingToProcess', 'Waiting');
    
    const downloadButton = document.createElement('button');
    downloadButton.className = 'btn primary-btn download-btn';
    downloadButton.textContent = t('downloadFileBtn', 'Download');
    downloadButton.disabled = true;
    
    fileStatus.appendChild(statusIcon);
    fileStatus.appendChild(statusText);
    fileStatus.appendChild(downloadButton);
    
    fileItem.appendChild(fileName);
    fileItem.appendChild(fileStatus);
    
    return fileItem;
}

// 更新文件状态
function updateFileStatus(index, status, result) {
    const fileItem = document.querySelector(`.file-item[data-index="${index}"]`);
    if (!fileItem) return;
    
    const statusIcon = fileItem.querySelector('.status-icon');
    const statusText = fileItem.querySelector('.status-text');
    const downloadButton = fileItem.querySelector('.download-btn');
    const existingRetryButton = fileItem.querySelector('.retry-btn');
    if (existingRetryButton && status !== 'error') {
        existingRetryButton.parentNode.removeChild(existingRetryButton);
    }

    // 默认禁用下载按钮（只有成功时启用）
    if (downloadButton) {
        downloadButton.classList.remove('enabled');
        downloadButton.disabled = true;
        downloadButton.onclick = null;
    }
    
    // 移除所有状态类
    statusIcon.classList.remove('status-pending', 'status-processing', 'status-success', 'status-error');
    
    switch (status) {
        case 'pending':
            statusIcon.classList.add('status-pending');
            statusIcon.innerHTML = '<i class="fas fa-clock"></i>';
            statusText.textContent = t('waitingToProcess', 'Waiting');
            break;
        case 'processing':
            statusIcon.classList.add('status-processing');
            statusIcon.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            statusText.textContent = t('processing', 'Processing...');
            break;
        case 'success':
            statusIcon.classList.add('status-success');
            statusIcon.innerHTML = '<i class="fas fa-check-circle"></i>';
            statusText.textContent = t('processingComplete', 'Processing complete');
            
            // 启用下载按钮
            downloadButton.classList.add('enabled');
            downloadButton.disabled = false;
            downloadButton.onclick = () => downloadSingleFile(index);
            break;
        case 'error':
            statusIcon.classList.add('status-error');
            statusIcon.innerHTML = '<i class="fas fa-exclamation-circle"></i>';
            statusText.textContent = `${t('processingFailed', 'Processing failed')}: ${result && result.error ? result.error : ''}`;
            
            // 添加重试按钮
            const retryButton = document.createElement('button');
            retryButton.className = 'retry-btn';
            retryButton.textContent = t('retryBtn', 'Retry');
            retryButton.onclick = () => retryProcessing(index);
            
            // 先检查是否已经有重试按钮
            const existingRetryButton2 = fileItem.querySelector('.retry-btn');
            if (existingRetryButton2) existingRetryButton2.parentNode.removeChild(existingRetryButton2);
            
            fileItem.querySelector('.file-status').appendChild(retryButton);
            break;
    }
}

// 更新状态消息
function updateStatusMessage(key, param) {
    if (translations && translations[key]) {
        let message = translations[key];
        if (param) {
            message += param;
        }
        statusMessage.textContent = message;
    }
}

// 格式化文件大小
function formatFileSize(bytes) {
    if (bytes < 1024) {
        return bytes + ' B';
    } else if (bytes < 1024 * 1024) {
        return (bytes / 1024).toFixed(2) + ' KB';
    } else {
        return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    }
}

// 开始批量处理
function startBatchProcessing() {
    if (uploadedFiles.length === 0 || isProcessing) return;

    const indicesToProcess = [];
    uploadedFiles.forEach((_, index) => {
        const item = processedFiles[index];
        if (item === null) {
            indicesToProcess.push(index);
            return;
        }
        if (item && item.error) {
            processedFiles[index] = null;
            indicesToProcess.push(index);
        }
    });

    if (indicesToProcess.length === 0) {
        setStatusText(t('allFilesAlreadyConverted', 'All files are already converted.'), { color: '#666' });
        updateOverallProgress();
        return;
    }

    currentProcessingIndex = -1;
    revokeAndClearReport();

    // 禁用按钮
    convertBtn.disabled = true;
    downloadBtn.disabled = true;
    updateActionButtons();

    // 重置待处理项状态
    indicesToProcess.forEach((index) => {
        if (jobs[index]) {
            jobs[index].status = 'waiting';
            jobs[index].startedAt = 0;
            jobs[index].endedAt = 0;
            jobs[index].durationMs = 0;
            jobs[index].errorCode = '';
            jobs[index].errorMessage = '';
        }
        updateFileStatus(index, 'pending');
    });
    updateOverallProgress();

    setStatusText(t('batchStarting', 'Starting conversion…'), { color: '#666' });

    // 开始处理队列（Free=串行 / Pro=并发）
    runQueue(indicesToProcess);
}

let queueState = {
    pending: [],
    active: 0,
    total: 0
};

function getConcurrency() {
    return isProActive() ? LIMITS.pro.concurrency : 1;
}

function classifyError(err) {
    const message = (err && err.message) ? String(err.message) : String(err || 'Unknown error');
    const lower = message.toLowerCase();

    if (lower.includes('read') && lower.includes('fail')) return { code: 'FILE_READ_FAILED', message };
    if (lower.includes('not loaded')) return { code: 'LIB_NOT_LOADED', message };
    if (lower.includes('invalid') || message.includes('无效')) return { code: 'INVALID_MIDI', message };

    return { code: 'PARSE_ERROR', message };
}

function updateOverallProgress() {
    const processedFileCount = processedFiles.filter(item => item !== null).length;
    processedCount.textContent = processedFileCount.toString();

    const total = uploadedFiles.length || 1;
    const progress = Math.min(100, (processedFileCount / total) * 100);
    progressBar.style.width = `${progress}%`;
    updateActionButtons();
}

function buildReportData() {
    const totalBytes = jobs.reduce((sum, j) => sum + (j && typeof j.size === 'number' ? j.size : 0), 0);
    const total = uploadedFiles.length;
    const successCount = processedFiles.filter(item => item && !item.error).length;
    const errorCount = processedFiles.filter(item => item && item.error).length;

    return {
        generatedAt: new Date().toISOString(),
        pro: isProActive(),
        concurrency: getConcurrency(),
        limits: isProActive()
            ? { softMaxFiles: LIMITS.pro.softMaxFiles, softMaxTotalBytes: LIMITS.pro.softMaxTotalBytes }
            : { maxFiles: LIMITS.free.maxFiles, maxTotalBytes: LIMITS.free.maxTotalBytes },
        totals: { files: total, totalBytesSelected: totalBytes, successCount, errorCount },
        files: jobs.map((job, index) => {
            const res = processedFiles[index];
            const ok = !!(res && !res.error);
            return {
                fileName: job.fileName,
                size: job.size,
                durationMs: job.durationMs || 0,
                ok,
                errorCode: ok ? "" : (res && res.errorCode ? res.errorCode : (job.errorCode || "")),
                errorMessage: ok ? "" : (res && res.error ? res.error : (job.errorMessage || ""))
            };
        })
    };
}

function finishRun() {
    isProcessing = false;
    queueState = { pending: [], active: 0, total: 0 };
    window.__midieasyActiveWorkers = 0;
    updateBatchMeta();

    // 生成 report.json
    reportData = buildReportData();

    const reportBtn = document.getElementById('download-report-btn');
    if (reportBtn) reportBtn.disabled = false;

    const total = uploadedFiles.length;
    const successCount = processedFiles.filter(item => item && !item.error).length;
    const errorCount = processedFiles.filter(item => item && item.error).length;

    if (total > 0) {
        const summary = t('batchDoneSummary', 'Done: {success} succeeded, {failed} failed.')
            .replace('{success}', String(successCount))
            .replace('{failed}', String(errorCount));
        setStatusText(summary, { color: errorCount ? '#e67e22' : '#27ae60' });
    }

    convertBtn.disabled = false;
    updateOverallProgress();
    updateActionButtons();

    try {
        document.dispatchEvent(new CustomEvent('midieasy:conversion-complete', {
            detail: { total, successCount, errorCount }
        }));
    } catch (e) {
        // no-op
    }
}

function pumpQueue() {
    const concurrency = getConcurrency();
    while (queueState.active < concurrency && queueState.pending.length > 0) {
        const index = queueState.pending.shift();
        void processJob(index);
    }

    if (queueState.active === 0 && queueState.pending.length === 0) {
        finishRun();
    }
}

async function processJob(index) {
    queueState.active += 1;
    window.__midieasyActiveWorkers = queueState.active;
    updateBatchMeta();

    currentProcessingIndex = index;
    updateFileStatus(index, 'processing');

    const startedAt = Date.now();
    if (jobs[index]) {
        jobs[index].status = 'processing';
        jobs[index].startedAt = startedAt;
        jobs[index].errorCode = '';
        jobs[index].errorMessage = '';
        jobs[index].durationMs = 0;
    }

    try {
        const result = await convertMidiFile(uploadedFiles[index], index);
        const endedAt = Date.now();

        if (jobs[index]) {
            jobs[index].status = 'done';
            jobs[index].endedAt = endedAt;
            jobs[index].durationMs = endedAt - startedAt;
        }

        processedFiles[index] = result;
        updateFileStatus(index, 'success', result);
    } catch (err) {
        console.error('Error processing file:', err);
        const endedAt = Date.now();
        const classified = classifyError(err);

        if (jobs[index]) {
            jobs[index].status = 'failed';
            jobs[index].endedAt = endedAt;
            jobs[index].durationMs = endedAt - startedAt;
            jobs[index].errorCode = classified.code;
            jobs[index].errorMessage = classified.message;
        }

        processedFiles[index] = {
            error: classified.message,
            errorCode: classified.code
        };
        updateFileStatus(index, 'error', processedFiles[index]);
    } finally {
        queueState.active -= 1;
        window.__midieasyActiveWorkers = queueState.active;
        updateBatchMeta();
        updateOverallProgress();
        pumpQueue();
    }
}

function runQueue(indices) {
    if (!indices || indices.length === 0) {
        finishRun();
        return;
    }
    isProcessing = true;
    queueState = { pending: [...indices], active: 0, total: indices.length };
    window.__midieasyActiveWorkers = 0;
    updateBatchMeta();
    updateOverallProgress();
    pumpQueue();
}

// 重试处理文件
function retryProcessing(index) {
    if (isProcessing) return;
    if (!uploadedFiles[index]) return;

    // 更新文件状态
    updateFileStatus(index, 'processing');
    processedFiles[index] = null;
    updateOverallProgress();

    isProcessing = true;
    convertBtn.disabled = true;
    downloadBtn.disabled = true;
    updateActionButtons();

    const startedAt = Date.now();
    if (jobs[index]) {
        jobs[index].status = 'processing';
        jobs[index].startedAt = startedAt;
        jobs[index].errorCode = '';
        jobs[index].errorMessage = '';
        jobs[index].durationMs = 0;
    }

    convertMidiFile(uploadedFiles[index], index)
        .then(result => {
            const endedAt = Date.now();
            processedFiles[index] = result;
            updateFileStatus(index, 'success', result);
            if (jobs[index]) {
                jobs[index].status = 'done';
                jobs[index].endedAt = endedAt;
                jobs[index].durationMs = endedAt - startedAt;
            }
        })
        .catch(err => {
            console.error('Error processing file:', err);
            const endedAt = Date.now();
            const classified = classifyError(err);
            processedFiles[index] = { error: classified.message, errorCode: classified.code };
            updateFileStatus(index, 'error', processedFiles[index]);
            if (jobs[index]) {
                jobs[index].status = 'failed';
                jobs[index].endedAt = endedAt;
                jobs[index].durationMs = endedAt - startedAt;
                jobs[index].errorCode = classified.code;
                jobs[index].errorMessage = classified.message;
            }
        })
        .finally(() => {
            isProcessing = false;
            convertBtn.disabled = false;
            updateOverallProgress();
            updateActionButtons();
        });
}

function retryAllFailed() {
    if (isProcessing) return;
    const failed = [];
    processedFiles.forEach((item, index) => {
        if (item && item.error) failed.push(index);
    });
    if (failed.length === 0) return;

    // 重置失败项
    failed.forEach((index) => {
        processedFiles[index] = null;
        if (jobs[index]) {
            jobs[index].status = 'waiting';
            jobs[index].errorCode = '';
            jobs[index].errorMessage = '';
            jobs[index].durationMs = 0;
        }
        updateFileStatus(index, 'pending');
    });

    revokeAndClearReport();
    convertBtn.disabled = true;
    downloadBtn.disabled = true;
    updateActionButtons();
    setStatusText(t('retryAllStarted', 'Retrying failed files…'), { color: '#666' });

    runQueue(failed);
}

function downloadReport() {
    if (!reportData) return;
    try {
        const jsonString = JSON.stringify(reportData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
        const filename = `midi-to-json-report-${timestamp}.json`;

        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
    } catch (e) {
        console.error('Error downloading report:', e);
    }
}

function clearResults({ keepSelection, silent } = { keepSelection: false, silent: false }) {
    revokeAndClearReport();
    resetProgressUi();
    window.__midieasyActiveWorkers = 0;
    updateBatchMeta();

    if (keepSelection) {
        processedFiles = new Array(uploadedFiles.length).fill(null);
        processedCount.textContent = '0';
        totalCount.textContent = uploadedFiles.length.toString();

        uploadedFiles.forEach((file, index) => {
            updateFileStatus(index, 'pending');
        });

        convertBtn.disabled = uploadedFiles.length === 0;
        downloadBtn.disabled = true;
        if (!silent) setStatusText('');
        updateProHintBanner();
        updateActionButtons();
        return;
    }

    // 全量清空（包括选择与列表）
    uploadedFiles = [];
    processedFiles = [];
    jobs = [];
    fileList.innerHTML = '';
    batchStatus.style.display = 'none';
    processedCount.textContent = '0';
    totalCount.textContent = '0';
    convertBtn.disabled = true;
    downloadBtn.disabled = true;
    if (!silent) setStatusText('');

    if (translations && translations.noFileSelected) {
        fileInfo.textContent = translations.noFileSelected;
    } else {
        fileInfo.textContent = 'No files selected';
    }
    updateProHintBanner();
    updateActionButtons();
}

// 尝试解析MIDI ArrayBuffer
function parseMidiBuffer(arrayBuffer) {
    // 检查不同的可能API格式
    if (typeof midiJsonParser !== 'undefined') {
        // 原始CDN中的API格式
        if (typeof midiJsonParser.parseArrayBuffer === 'function') {
            console.log("使用midiJsonParser.parseArrayBuffer");
            return midiJsonParser.parseArrayBuffer(arrayBuffer);
        }
        
        // 检查其他可能的API格式
        if (typeof midiJsonParser.parse === 'function') {
            console.log("使用midiJsonParser.parse");
            return midiJsonParser.parse(arrayBuffer);
        }
    }
    
    // 检查全局midi-json-parser可能的名称
    const possibleNames = ['midiJsonParser', 'MidiJsonParser', 'midiJsonParserModule', 'MidiParser'];
    
    for (const name of possibleNames) {
        if (typeof window[name] !== 'undefined') {
            console.log(`检测到全局对象: ${name}`);
            
            // 检查各种可能的方法名
            const possibleMethods = ['parseArrayBuffer', 'parse', 'parseMidi', 'decodeMidi'];
            
            for (const method of possibleMethods) {
                if (typeof window[name][method] === 'function') {
                    console.log(`使用 ${name}.${method}`);
                    return window[name][method](arrayBuffer);
                }
            }
        }
    }
    
    // 如果加载了MIDI, 尝试直接加载完整库
    const scriptEl = document.createElement('script');
    // 直接嵌入简单的MIDI解析器作为备用方案
    scriptEl.textContent = `
    // 简单的MIDI解析器作为备用方案
    window.midiJsonParser = {
        parseArrayBuffer: function(buffer) {
            return new Promise((resolve, reject) => {
                try {
                    // 创建DataView以读取二进制数据
                    const view = new DataView(buffer);
                    
                    // 解析MIDI头部
                    const header = {
                        format: view.getUint16(8),
                        numTracks: view.getUint16(10),
                        ticksPerBeat: view.getUint16(12)
                    };
                    
                    // 创建MIDI JSON对象
                    const midiJson = {
                        header: header,
                        tracks: []
                    };
                    
                    console.log("使用备用MIDI解析器，简化的结果将被返回");
                    
                    // 解析每个轨道（简化处理）
                    let offset = 14; // 开始于头部之后
                    
                    for (let i = 0; i < header.numTracks; i++) {
                        // 检查轨道头
                        if (view.getUint32(offset) !== 0x4D54726B) { // "MTrk"
                            throw new Error("无效的MIDI文件格式");
                        }
                        
                        const trackLength = view.getUint32(offset + 4);
                        offset += 8; // 跳过轨道头
                        
                        // 提取一些基本事件（非常简化）
                        const trackEnd = offset + trackLength;
                        const track = [];
                        
                        while (offset < trackEnd) {
                            // 简单解析事件（注意:这是非常简化的）
                            let deltaTime = 0;
                            let byte = view.getUint8(offset++);
                            
                            // 解析可变长度的deltaTime
                            while (byte & 0x80) {
                                deltaTime = (deltaTime << 7) | (byte & 0x7F);
                                byte = view.getUint8(offset++);
                            }
                            deltaTime = (deltaTime << 7) | byte;
                            
                            // 读取事件类型
                            const eventType = view.getUint8(offset++);
                            
                            // 解析事件（仅处理基本音符事件，非常简化）
                            if ((eventType & 0xF0) === 0x90) { // Note On
                                const channel = eventType & 0x0F;
                                const noteNumber = view.getUint8(offset++);
                                const velocity = view.getUint8(offset++);
                                
                                track.push({
                                    deltaTime: deltaTime,
                                    type: 'noteOn',
                                    channel: channel,
                                    noteNumber: noteNumber,
                                    velocity: velocity
                                });
                            } 
                            else if ((eventType & 0xF0) === 0x80) { // Note Off
                                const channel = eventType & 0x0F;
                                const noteNumber = view.getUint8(offset++);
                                const velocity = view.getUint8(offset++);
                                
                                track.push({
                                    deltaTime: deltaTime,
                                    type: 'noteOff',
                                    channel: channel,
                                    noteNumber: noteNumber,
                                    velocity: velocity
                                });
                            }
                            else if (eventType === 0xFF) { // Meta Event
                                const metaType = view.getUint8(offset++);
                                const length = view.getUint8(offset++);
                                
                                // 处理一些基本的meta事件
                                if (metaType === 0x51) { // Tempo
                                    const microsecondsPerQuarter = (view.getUint8(offset) << 16) | 
                                                                  (view.getUint8(offset + 1) << 8) | 
                                                                  view.getUint8(offset + 2);
                                    track.push({
                                        deltaTime: deltaTime,
                                        type: 'setTempo',
                                        microsecondsPerQuarter: microsecondsPerQuarter
                                    });
                                }
                                else if (metaType === 0x58) { // Time Signature
                                    track.push({
                                        deltaTime: deltaTime,
                                        type: 'timeSignature',
                                        numerator: view.getUint8(offset),
                                        denominator: Math.pow(2, view.getUint8(offset + 1)),
                                        metronome: view.getUint8(offset + 2),
                                        thirtyseconds: view.getUint8(offset + 3)
                                    });
                                }
                                
                                offset += length; // 跳过数据
                            }
                            else {
                                // 跳过其他事件（非常简化）
                                if ((eventType & 0x80) === 0) {
                                    // 运行状态 - 使用前一个命令
                                    offset += 1;
                                }
                                else if ((eventType & 0xF0) >= 0xC0 && (eventType & 0xF0) <= 0xDF) {
                                    // 1字节参数的事件
                                    offset += 1;
                                }
                                else {
                                    // 2字节参数的事件
                                    offset += 2;
                                }
                            }
                        }
                        
                        midiJson.tracks.push(track);
                    }
                    
                    resolve(midiJson);
                }
                catch (error) {
                    console.error("MIDI解析错误:", error);
                    reject(error);
                }
            });
        }
    };
    `;
    document.head.appendChild(scriptEl);
    
    console.log("使用内置简易MIDI解析器");
    return window.midiJsonParser.parseArrayBuffer(arrayBuffer);
}

// 转换单个MIDI文件
async function convertMidiFile(file, index) {
    try {
        // 读取文件为ArrayBuffer
        const arrayBuffer = await readFileAsArrayBuffer(file);
        
        // 确保midi-json-parser可用
        if (!midiParserLoaded && typeof loadMidiParser === 'function') {
            await loadMidiParser();
            midiParserLoaded = true;
        }
        
        if (typeof midiJsonParser === 'undefined' && 
            typeof window.MidiJsonParser === 'undefined' && 
            typeof window.MidiParser === 'undefined') {
            throw new Error('midi-json-parser library not loaded or interface does not match');
        }
        
        // 转换MIDI为JSON - 使用自适应方法
        const midiJson = await parseMidiBuffer(arrayBuffer);
        
        // 转换为Tone.js友好的格式
        const toneJson = convertToToneFormat(midiJson);
        
        const jsonString = JSON.stringify(toneJson, null, 2);
        const jsonBlob = new Blob([jsonString], { type: 'application/json' });

        // 返回处理结果（尽量只保留下载所需载体，避免长期持有大型对象）
        return {
            fileName: file.name,
            size: file.size,
            jsonBlob
        };
        
    } catch (error) {
        console.error('Conversion error:', error);
        throw error;
    }
}

// 转换MIDI文件（兼容旧版接口）
async function convertMidi() {
    if (uploadedFiles.length === 0) {
        return;
    }
    
    // 如果只有一个文件，使用单文件处理逻辑
    if (uploadedFiles.length === 1) {
        try {
            // 更新状态
            updateStatusMessage('converting');
            statusMessage.style.color = '#666';
            progressBar.style.width = '30%';
            
            // 禁用按钮
            convertBtn.disabled = true;
            
            // 处理单个文件
            const result = await convertMidiFile(uploadedFiles[0], 0);
            
            // 更新UI
            progressBar.style.width = '100%';
            updateStatusMessage('convertSuccess');
            statusMessage.style.color = '#27ae60';
            downloadBtn.disabled = false;
            
            // 保存结果
            processedFiles[0] = result;
            
            setTimeout(() => {
                progressBar.style.width = '0';
            }, 1000);
            
        } catch (error) {
            console.error('Conversion error:', error);
            updateStatusMessage('convertError', error.message);
            statusMessage.style.color = '#e74c3c';
            progressBar.style.width = '0';
            convertBtn.disabled = false;
        }
    } else {
        // 使用批量处理逻辑
        startBatchProcessing();
    }
}

// 将文件读取为ArrayBuffer
function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            resolve(e.target.result);
        };
        
        reader.onerror = (e) => {
            reject(new Error('文件读取失败'));
        };
        
        reader.readAsArrayBuffer(file);
    });
}

// 将MIDI JSON转换为Tone.js友好的格式
function convertToToneFormat(midiJson) {
    // 创建Tone.js格式的对象
    const toneJson = {};
    
    // 提取时间签名
    const timeSignatureEvents = findEvents(midiJson, 'timeSignature');
    if (timeSignatureEvents.length > 0) {
        const ts = timeSignatureEvents[0];
        toneJson.timeSignature = [ts.numerator, ts.denominator];
    }
    
    // 提取速度（BPM）
    const tempoEvents = findEvents(midiJson, 'setTempo');
    if (tempoEvents.length > 0) {
        // 将微秒/四分音符转换为BPM
        const tempo = Math.round(60000000 / tempoEvents[0].microsecondsPerQuarter);
        toneJson.bpm = tempo;
    }
    
    // 提取音符
    toneJson.notes = [];
    
    // 处理每个轨道
    midiJson.tracks.forEach((track, trackIndex) => {
        let currentTicks = 0;
        let currentTime = 0;
        
        // 计算MIDI ticks到秒的转换因子
        const ticksPerBeat = midiJson.header.ticksPerBeat;
        const beatsPerSecond = (toneJson.bpm || 120) / 60;
        const secondsPerTick = 1 / (ticksPerBeat * beatsPerSecond);
        
        // 跟踪当前活动的音符
        const activeNotes = {};
        
        // 处理轨道上的每个事件
        track.forEach(event => {
            // 更新当前tick和时间
            currentTicks += event.deltaTime;
            currentTime = currentTicks * secondsPerTick;
            
            if (event.type === 'noteOn') {
                // 存储音符开始信息
                const noteKey = `${event.noteNumber}-${event.channel}`;
                activeNotes[noteKey] = {
                    time: currentTime,
                    note: midiNoteToToneNote(event.noteNumber),
                    velocity: event.velocity / 127 // 将0-127的力度标准化为0-1
                };
            } 
            else if (event.type === 'noteOff') {
                // 查找对应的音符开始事件
                const noteKey = `${event.noteNumber}-${event.channel}`;
                const startEvent = activeNotes[noteKey];
                
                if (startEvent) {
                    // 计算持续时间并添加到音符列表
                    const duration = currentTime - startEvent.time;
                    
                    toneJson.notes.push({
                        time: startEvent.time,
                        note: startEvent.note,
                        velocity: startEvent.velocity,
                        duration: duration
                    });
                    
                    // 从活动音符中移除
                    delete activeNotes[noteKey];
                }
            }
        });
    });
    
    // 按时间排序音符
    toneJson.notes.sort((a, b) => a.time - b.time);
    
    return toneJson;
}

// 在MIDI JSON中查找特定类型的事件
function findEvents(midiJson, type) {
    const events = [];
    
    midiJson.tracks.forEach(track => {
        track.forEach(event => {
            if (event.type === type) {
                events.push(event);
            }
        });
    });
    
    return events;
}

// 将MIDI音符编号转换为Tone.js音符名称
function midiNoteToToneNote(midiNote) {
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const noteName = noteNames[midiNote % 12];
    const octave = Math.floor(midiNote / 12) - 1;
    
    return `${noteName}${octave}`;
}

// 下载单个JSON文件
function downloadSingleFile(index) {
    const fileData = processedFiles[index];
    if (!fileData || fileData.error) return;
    const blob = fileData.jsonBlob instanceof Blob ? fileData.jsonBlob : null;
    if (!blob) return;
    
    // 创建下载链接
    const url = URL.createObjectURL(blob);
    const filename = fileData.fileName.replace(/\.(mid|midi)$/i, '.json');
    
    // 创建临时a元素并触发下载
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename;
    
    document.body.appendChild(a);
    a.click();
    
    // 清理
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 100);
}

// 下载所有文件为ZIP
async function downloadAllAsZip() {
    // 检查是否已处理完所有文件
    const allProcessed = processedFiles.every(file => file !== null);
    if (!allProcessed || processedFiles.length === 0) return;
    
    try {
        // 更新状态
        updateStatusMessage('preparingZip');
        statusMessage.style.color = '#666';
        
        // 创建新的JSZip实例
        const zip = new JSZip();
        
        // 添加每个处理后的文件到ZIP
        processedFiles.forEach(fileData => {
            if (fileData && !fileData.error) {
                const filename = fileData.fileName.replace(/\.(mid|midi)$/i, '.json');
                if (fileData.jsonBlob instanceof Blob) {
                    zip.file(filename, fileData.jsonBlob);
                }
            }
        });

        // 附带 report.json（如可用）
        if (reportData) {
            try {
                zip.file('report.json', JSON.stringify(reportData, null, 2));
            } catch (e) {
                // no-op
            }
        }
        
        // 生成ZIP文件
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        
        // 下载ZIP文件
        const url = URL.createObjectURL(zipBlob);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
        const zipFilename = `midi-to-json-${timestamp}.zip`;
        
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = zipFilename;
        
        document.body.appendChild(a);
        a.click();
        
        // 清理
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            updateStatusMessage('zipReady');
            statusMessage.style.color = '#27ae60';
        }, 100);
        
    } catch (error) {
        console.error('Error creating ZIP file:', error);
        updateStatusMessage('convertError', error.message);
        statusMessage.style.color = '#e74c3c';
    }
}

// 下载JSON文件（兼容旧版接口）
function downloadJson() {
    // 如果只有单个文件，使用单文件下载逻辑
    if (processedFiles.length === 1 && processedFiles[0]) {
        downloadSingleFile(0);
    } else {
        // 否则使用批量下载
        downloadAllAsZip();
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', init);

// 添加手风琴功能
document.addEventListener('DOMContentLoaded', function() {
    // 获取所有手风琴项
    const accordionItems = document.querySelectorAll('.accordion-item');
    
    // 为每个手风琴项添加点击事件
    accordionItems.forEach(item => {
        const header = item.querySelector('.accordion-header');
        
        header.addEventListener('click', () => {
            // 切换当前项的active状态
            item.classList.toggle('active');
            
            // 如果您希望一次只打开一个项目（可选）
            // 取消其他项目的active状态
            accordionItems.forEach(otherItem => {
                if (otherItem !== item && otherItem.classList.contains('active')) {
                    otherItem.classList.remove('active');
                }
            });
        });
    });
}); 
