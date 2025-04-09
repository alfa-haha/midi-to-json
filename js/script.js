// 获取DOM元素
const dropArea = document.getElementById('drop-area');
const fileInput = document.getElementById('file-input');
const fileInfo = document.getElementById('file-info');
const convertBtn = document.getElementById('convert-btn');
const downloadBtn = document.getElementById('download-btn');
const statusMessage = document.getElementById('status-message');
const progressBar = document.getElementById('progress-bar');
const fileInputLabel = document.querySelector('.file-input-label');
const languageBtn = document.querySelector('.language-btn');
const languageDropdown = document.querySelector('.language-dropdown');

// 存储上传的文件和转换后的JSON
let uploadedFile = null;
let convertedJson = null;
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
    convertBtn.addEventListener('click', convertMidi);
    downloadBtn.addEventListener('click', downloadJson);
    
    // 语言选择器交互处理
    languageBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        languageDropdown.classList.toggle('show');
    });
    
    // 点击语言选项
    document.querySelectorAll('.language-option').forEach(option => {
        option.addEventListener('click', function(e) {
            e.stopPropagation();
            if (typeof setLanguage === 'function') {
                setLanguage(this.getAttribute('data-lang'));
            }
            languageDropdown.classList.remove('show');
        });
    });
    
    // 点击页面其他地方关闭下拉菜单
    document.addEventListener('click', function(e) {
        if (!languageBtn.contains(e.target) && !languageDropdown.contains(e.target)) {
            languageDropdown.classList.remove('show');
        }
    });
    
    // 预加载midi-json-parser库
    if (typeof loadMidiParser === 'function') {
        updateStatusMessage('loading');
        loadMidiParser()
            .then(() => {
                midiParserLoaded = true;
                updateStatusMessage('loadSuccess');
                statusMessage.style.color = '#27ae60';
                setTimeout(() => {
                    if (!uploadedFile) {
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
    const file = files[0];
    
    // 检查文件类型
    if (!file.name.toLowerCase().endsWith('.mid') && !file.name.toLowerCase().endsWith('.midi')) {
        updateStatusMessage('fileError');
        statusMessage.style.color = '#e74c3c';
        return;
    }
    
    // 更新UI
    uploadedFile = file;
    
    // 国际化文件信息显示
    if (translations && translations.fileSelected) {
        fileInfo.textContent = translations.fileSelected + file.name + ' (' + formatFileSize(file.size) + ')';
    } else {
        fileInfo.textContent = `Selected: ${file.name} (${formatFileSize(file.size)})`;
    }
    
    convertBtn.disabled = false;
    downloadBtn.disabled = true;
    statusMessage.textContent = '';
    progressBar.style.width = '0';
    
    // 清除之前的JSON数据
    convertedJson = null;
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

// 转换MIDI文件
async function convertMidi() {
    if (!uploadedFile) {
        return;
    }
    
    try {
        // 更新状态
        updateStatusMessage('converting');
        statusMessage.style.color = '#666';
        progressBar.style.width = '30%';
        
        // 禁用按钮
        convertBtn.disabled = true;
        
        // 读取文件为ArrayBuffer
        const arrayBuffer = await readFileAsArrayBuffer(uploadedFile);
        
        // 使用midi-json-parser进行转换
        progressBar.style.width = '60%';
        
        // 确保midi-json-parser可用
        if (!midiParserLoaded && typeof loadMidiParser === 'function') {
            updateStatusMessage('loading');
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
        convertedJson = toneJson;
        
        // 更新UI
        progressBar.style.width = '100%';
        updateStatusMessage('convertSuccess');
        statusMessage.style.color = '#27ae60';
        downloadBtn.disabled = false;
        
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

// 下载JSON文件
function downloadJson() {
    if (!convertedJson) {
        return;
    }
    
    // 将JSON对象转换为字符串
    const jsonString = JSON.stringify(convertedJson, null, 2);
    
    // 创建Blob
    const blob = new Blob([jsonString], { type: 'application/json' });
    
    // 创建下载链接
    const url = URL.createObjectURL(blob);
    const filename = uploadedFile.name.replace(/\.(mid|midi)$/i, '.json');
    
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

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', init); 