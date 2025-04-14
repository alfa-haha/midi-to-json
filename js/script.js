// 获取DOM元素
const dropArea = document.getElementById('drop-area');
const fileInput = document.getElementById('file-input');
const fileInfo = document.getElementById('file-info');
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
let currentProcessingIndex = -1;
let isProcessing = false;
// 存储midi-json-parser库是否已加载
let midiParserLoaded = false;

// 初始化页面
function init() {
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
    // 清空之前的文件和状态
    uploadedFiles = [];
    processedFiles = [];
    fileList.innerHTML = '';
    
    // 过滤非MIDI文件
    let validFiles = [];
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.name.toLowerCase().endsWith('.mid') || file.name.toLowerCase().endsWith('.midi')) {
            validFiles.push(file);
        }
    }
    
    if (validFiles.length === 0) {
        updateStatusMessage('fileError');
        statusMessage.style.color = '#e74c3c';
        return;
    }
    
    // 更新UI
    uploadedFiles = validFiles;
    
    // 国际化文件信息显示
    if (translations) {
        if (validFiles.length === 1) {
            fileInfo.textContent = translations.fileSelected + validFiles[0].name + ' (' + formatFileSize(validFiles[0].size) + ')';
        } else {
            fileInfo.textContent = translations.filesSelected + validFiles.length + translations.fileCount;
        }
    } else {
        if (validFiles.length === 1) {
            fileInfo.textContent = `Selected: ${validFiles[0].name} (${formatFileSize(validFiles[0].size)})`;
        } else {
            fileInfo.textContent = `Selected: ${validFiles.length} files`;
        }
    }
    
    // 显示批量处理区域
    batchStatus.style.display = 'block';
    
    // 更新文件计数
    processedCount.textContent = '0';
    totalCount.textContent = validFiles.length.toString();
    
    // 创建文件列表项
    validFiles.forEach((file, index) => {
        const fileItem = createFileListItem(file, index);
        fileList.appendChild(fileItem);
    });
    
    // 启用转换按钮
    convertBtn.disabled = false;
    downloadBtn.disabled = true;
    statusMessage.textContent = '';
    progressBar.style.width = '0';
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
    statusText.textContent = translations ? translations.waitingToProcess : 'Waiting';
    
    const downloadButton = document.createElement('button');
    downloadButton.className = 'btn primary-btn download-btn';
    downloadButton.textContent = translations ? translations.downloadFileBtn : 'Download';
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
    
    // 移除所有状态类
    statusIcon.classList.remove('status-pending', 'status-processing', 'status-success', 'status-error');
    
    switch (status) {
        case 'pending':
            statusIcon.classList.add('status-pending');
            statusIcon.innerHTML = '<i class="fas fa-clock"></i>';
            statusText.textContent = translations ? translations.waitingToProcess : 'Waiting';
            break;
        case 'processing':
            statusIcon.classList.add('status-processing');
            statusIcon.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            statusText.textContent = translations ? translations.processing : 'Processing...';
            break;
        case 'success':
            statusIcon.classList.add('status-success');
            statusIcon.innerHTML = '<i class="fas fa-check-circle"></i>';
            statusText.textContent = translations ? translations.processingComplete : 'Processing complete';
            
            // 启用下载按钮
            downloadButton.classList.add('enabled');
            downloadButton.disabled = false;
            downloadButton.onclick = () => downloadSingleFile(index);
            break;
        case 'error':
            statusIcon.classList.add('status-error');
            statusIcon.innerHTML = '<i class="fas fa-exclamation-circle"></i>';
            statusText.textContent = (translations ? translations.processingFailed : 'Failed') + ': ' + result.error;
            
            // 添加重试按钮
            const retryButton = document.createElement('button');
            retryButton.className = 'retry-btn';
            retryButton.textContent = translations ? translations.retryBtn : 'Retry';
            retryButton.onclick = () => retryProcessing(index);
            
            // 先检查是否已经有重试按钮
            const existingRetryButton = fileItem.querySelector('.retry-btn');
            if (existingRetryButton) {
                existingRetryButton.parentNode.removeChild(existingRetryButton);
            }
            
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
    
    // 重置处理状态
    isProcessing = true;
    currentProcessingIndex = -1;
    processedFiles = new Array(uploadedFiles.length).fill(null);
    processedCount.textContent = '0';
    
    // 禁用按钮
    convertBtn.disabled = true;
    
    // 重置所有文件状态为待处理
    uploadedFiles.forEach((file, index) => {
        updateFileStatus(index, 'pending');
    });
    
    // 开始处理队列
    processNextFile();
}

// 处理下一个文件
function processNextFile() {
    // 更新已处理文件计数
    const processedFileCount = processedFiles.filter(item => item !== null).length;
    processedCount.textContent = processedFileCount.toString();
    
    // 检查是否所有文件都已处理
    if (processedFileCount === uploadedFiles.length) {
        isProcessing = false;
        convertBtn.disabled = false;
        downloadBtn.disabled = false;
        
        // 更新总进度条
        progressBar.style.width = '100%';
        updateStatusMessage('zipReady');
        statusMessage.style.color = '#27ae60';
        
        setTimeout(() => {
            progressBar.style.width = '0';
        }, 1000);
        
        return;
    }
    
    // 查找下一个待处理的文件
    let nextIndex = -1;
    for (let i = 0; i < uploadedFiles.length; i++) {
        if (processedFiles[i] === null) {
            nextIndex = i;
            break;
        }
    }
    
    if (nextIndex === -1) {
        // 所有文件已处理
        isProcessing = false;
        convertBtn.disabled = false;
        return;
    }
    
    // 开始处理文件
    currentProcessingIndex = nextIndex;
    updateFileStatus(nextIndex, 'processing');
    
    // 更新总进度
    const progress = (processedFileCount / uploadedFiles.length) * 100;
    progressBar.style.width = `${progress}%`;
    
    // 转换当前文件
    convertMidiFile(uploadedFiles[nextIndex], nextIndex)
        .then(result => {
            // 保存处理结果
            processedFiles[nextIndex] = result;
            updateFileStatus(nextIndex, 'success', result);
            
            // 处理下一个文件
            processNextFile();
        })
        .catch(error => {
            console.error('Error processing file:', error);
            
            // 记录错误
            processedFiles[nextIndex] = {
                error: error.message || 'Unknown error'
            };
            updateFileStatus(nextIndex, 'error', processedFiles[nextIndex]);
            
            // 继续处理下一个文件
            processNextFile();
        });
}

// 重试处理文件
function retryProcessing(index) {
    if (isProcessing) return;
    
    // 更新文件状态
    updateFileStatus(index, 'processing');
    
    // 重新转换文件
    convertMidiFile(uploadedFiles[index], index)
        .then(result => {
            // 保存处理结果
            processedFiles[index] = result;
            updateFileStatus(index, 'success', result);
            
            // 更新已处理文件计数
            const processedFileCount = processedFiles.filter(item => item !== null).length;
            processedCount.textContent = processedFileCount.toString();
            
            // 检查是否所有文件都已处理成功
            const allSuccess = processedFiles.every(item => item && !item.error);
            downloadBtn.disabled = !allSuccess;
        })
        .catch(error => {
            console.error('Error processing file:', error);
            
            // 记录错误
            processedFiles[index] = {
                error: error.message || 'Unknown error'
            };
            updateFileStatus(index, 'error', processedFiles[index]);
        });
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
        
        // 返回处理结果
        return {
            fileName: file.name,
            originalFile: file,
            jsonData: toneJson,
            jsonString: JSON.stringify(toneJson, null, 2)
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
    if (!fileData || !fileData.jsonString) return;
    
    // 创建Blob
    const blob = new Blob([fileData.jsonString], { type: 'application/json' });
    
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
                zip.file(filename, fileData.jsonString);
            }
        });
        
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