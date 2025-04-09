// 获取DOM元素
const dropArea = document.getElementById('drop-area');
const fileInput = document.getElementById('file-input');
const fileInfo = document.getElementById('file-info');
const convertBtn = document.getElementById('convert-btn');
const downloadBtn = document.getElementById('download-btn');
const statusMessage = document.getElementById('status-message');
const progressBar = document.getElementById('progress-bar');

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
    
    // 点击上传区域触发文件选择
    dropArea.addEventListener('click', () => {
        fileInput.click();
    });
    
    // 添加按钮事件
    convertBtn.addEventListener('click', convertMidi);
    downloadBtn.addEventListener('click', downloadJson);
    
    // 预加载midi-json-parser库
    if (typeof loadMidiParser === 'function') {
        statusMessage.textContent = '正在加载midi-json-parser库...';
        loadMidiParser()
            .then(() => {
                midiParserLoaded = true;
                statusMessage.textContent = 'midi-json-parser库加载成功，可以开始转换MIDI文件';
                statusMessage.style.color = '#27ae60';
                setTimeout(() => {
                    if (!uploadedFile) {
                        statusMessage.textContent = '';
                    }
                }, 3000);
            })
            .catch(error => {
                console.error('加载midi-json-parser库失败:', error);
                statusMessage.textContent = '加载midi-json-parser库失败，请刷新页面重试';
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
        statusMessage.textContent = '错误：请选择MIDI文件（.mid或.midi）';
        statusMessage.style.color = '#e74c3c';
        return;
    }
    
    // 更新UI
    uploadedFile = file;
    fileInfo.textContent = `已选择：${file.name} (${formatFileSize(file.size)})`;
    convertBtn.disabled = false;
    downloadBtn.disabled = true;
    statusMessage.textContent = '';
    progressBar.style.width = '0';
    
    // 清除之前的JSON数据
    convertedJson = null;
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

// 转换MIDI文件
async function convertMidi() {
    if (!uploadedFile) {
        return;
    }
    
    try {
        // 更新状态
        statusMessage.textContent = '正在转换MIDI文件...';
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
            statusMessage.textContent = '正在加载midi-json-parser库...';
            await loadMidiParser();
            midiParserLoaded = true;
        }
        
        if (typeof midiJsonParser === 'undefined') {
            throw new Error('midi-json-parser库未加载，请检查网络连接或刷新页面重试');
        }
        
        // 转换MIDI为JSON
        const midiJson = await midiJsonParser.parseArrayBuffer(arrayBuffer);
        
        // 转换为Tone.js友好的格式
        const toneJson = convertToToneFormat(midiJson);
        convertedJson = toneJson;
        
        // 更新UI
        progressBar.style.width = '100%';
        statusMessage.textContent = '转换成功！可以下载JSON文件了。';
        statusMessage.style.color = '#27ae60';
        downloadBtn.disabled = false;
        
        setTimeout(() => {
            progressBar.style.width = '0';
        }, 1000);
        
    } catch (error) {
        console.error('转换错误:', error);
        statusMessage.textContent = `错误：${error.message}`;
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