/**
 * Chinese language file
 */
window.zh = {
    // Header
    "title": "MIDI转JSON转换工具",
    "subtitle": "简单易用的MIDI到Tone.js JSON格式转换器",
    
    // Features section
    "whyChooseTitle": "为什么选择MidiEasy",
    "featureBatchTitle": "强大的批量处理能力",
    "featureBatchDescription": "使用我们强大的批处理引擎同时转换多个MIDI文件。一次上传您的整个音乐集合，让MidiEasy处理从小型项目到大型库的所有内容，节省数小时的繁琐工作。",
    "featureSpeedTitle": "闪电般的转换速度",
    "featureSpeedDescription": "体验行业领先的转换速度，无需等待。我们优化的算法能够即时处理您的MIDI文件，在几秒钟内而不是几分钟内提供高质量的JSON输出——非常适合注重效率的开发者。",
    "featurePrivacyTitle": "100%隐私保障",
    "featurePrivacyDescription": "您的音乐创作仅属于您自己。MidiEasy直接在您的浏览器中处理所有转换——我们从不上传、存储或访问服务器上的MIDI文件。您可以安心工作，知道您的知识产权完全安全。",
    
    // How It Works section
    "howItWorksTitle": "使用方法：三步将MIDI转换为JSON",
    "howItWorksSubtitle": "使用我们的三步流程，将MIDI转换为JSON简单直接。",
    "stepUploadTitle": "上传",
    "stepUploadDescription": "将MIDI文件拖放到我们的转换器中或使用文件选择器。MidiEasy支持批量上传，可一次处理多个文件。",
    "stepConvertTitle": "转换",
    "stepConvertDescription": "点击\"转换MIDI\"，我们的解析器会立即将您的MIDI数据转换为结构化的JSON格式，完美保留所有音乐信息。",
    "stepDownloadTitle": "下载",
    "stepDownloadDescription": "获取与Tone.js兼容的JSON文件，可以单独下载或将所有文件打包成ZIP压缩包。随时可用于您的Web音频项目。",
    "noRegistrationNote": "无需注册，无需安装——只需简单、快速、私密地将MIDI转换为JSON，满足您所有的音乐需求。",
    
    // Perfect For section
    "perfectForTitle": "完美适用于",
    "perfectForSubtitle": "MIDItoJSON帮助各个层次的创作者将MIDI文件转换为可用于无缝Tone.js集成的网页就绪JSON。",
    "webDevelopersTitle": "Web开发者",
    "webDevelopersDescription": "轻松地将音乐元素集成到您的Web应用中，无需处理音频处理或格式转换的复杂性。",
    "gameCreatorsTitle": "游戏创作者",
    "gameCreatorsDescription": "通过简单的实现方式，在基于浏览器的环境中为您的游戏配乐和交互式音频元素注入生命力。",
    "musicProducersTitle": "音乐制作人",
    "musicProducersDescription": "将您的作品从DAW带到网络，使用保留节奏、音符和表达方式的格式进行在线播放。",
    "interactiveArtistsTitle": "交互艺术家",
    "interactiveArtistsDescription": "创建响应式音频装置和网络体验，通过专业品质的音乐播放对用户输入做出反应。",
    
    // FAQ section
    "faqTitle": "常见问题",
    "faqSubtitle": "查找有关我们的MIDI到Tone.js友好JSON转换服务的常见问题解答。",
    "faqQuestion1": "上传MIDI文件到网站有大小限制吗？",
    "faqAnswer1": "是的，我们建议将总上传大小保持在100MB以下，单个MIDI文件不超过10MB，每批处理不超过20个文件。这些限制有助于确保最佳的转换性能和用户体验。",
    "faqQuestion2": "我可以一次转换多个MIDI文件吗？",
    "faqAnswer2": "是的，我们支持批量转换。您可以一次拖放或上传最多20个MIDI文件。处理后，您可以选择单独下载文件或作为单个ZIP包下载。",
    "faqQuestion3": "转换后的JSON文件会在您的服务器上存储多久？",
    "faqAnswer3": "转换后的JSON文件不会存储在任何服务器上。所有转换都直接在您的浏览器中进行。整个转换过程在您的计算机上进行，确保用户数据的隐私和安全。转换结果仅存在于您的浏览器会话中，关闭页面后即消失。",
    "faqQuestion4": "如果在转换过程中遇到错误，我应该怎么办？",
    "faqAnswer4": "如果在转换过程中遇到错误，网站将显示特定的错误消息。对于批处理过程中的单个文件错误，您可以点击\"重试\"按钮尝试再次转换该文件。如果仍然失败，您可以刷新页面并重试，或检查您的MIDI文件是否有效。",
    "faqQuestion5": "网站支持哪些MIDI格式版本的转换？",
    "faqAnswer5": "我们支持标准MIDI文件格式（.mid和.midi扩展名），包括MIDI 1.0格式。我们可以解析Format 0和Format 1 MIDI文件，保留所有MIDI数据，包括音符事件、控制变化、乐器设置、节奏和速度信息。转换后的JSON格式专为与Tone.js和Web Audio API集成而设计，确保在Web应用中实现高质量的音乐播放和交互。",
    
    // Upload area
    "dropZoneTitle": "拖放MIDI文件到这里",
    "dropZoneOr": "或者",
    "selectFiles": "选择MIDI文件",
    "fileLimitInfo": "为获得最佳性能，建议限制在20个文件以内（总大小不超过100MB）",
    "noFileSelected": "未选择文件",
    
    // Buttons
    "convertBtn": "转换MIDI",
    "downloadAllBtn": "下载所有（ZIP包）",
    
    // Status messages
    "loading": "正在加载midi-json-parser库...",
    "loadingBackup": "正在尝试加载备用midi-json-parser库...",
    "loadSuccess": "midi-json-parser库加载成功，可以开始转换MIDI文件",
    "loadError": "加载midi-json-parser库失败，请刷新页面重试",
    "converting": "正在转换",
    "completed": "已完成",
    "failed": "失败",
    "downloadSingle": "下载",
    "processingFile": "正在处理文件",
    "of": "共",
    "allDone": "所有文件处理完成！",
    "readyToDownload": "可以下载了。",
    "processingFailed": "处理失败：",
    "downloadingZip": "正在创建ZIP文件...",
    "retryFile": "重试",
    
    // Footer
    "footerText": "基于 <a href=\"https://github.com/chrisguttandin/midi-json-parser\" target=\"_blank\">midi-json-parser</a> 开源库构建"
}; 