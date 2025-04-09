# MIDI到JSON转换工具

这个网站可以将MIDI文件转换为Tone.js友好的JSON格式。

## 功能特点

- 简单易用的文件上传界面
- 将MIDI文件转换为Tone.js兼容的JSON格式
- 支持转换后的JSON文件下载
- 在浏览器中直接处理，无需后端服务器

## 如何使用

1. 访问网站
2. 点击"选择MIDI文件"按钮或将文件拖放到指定区域
3. 等待转换完成
4. 点击"下载JSON"按钮保存转换后的文件

## 技术栈

本项目使用：
- HTML5 和 CSS3 构建用户界面
- JavaScript 实现转换功能
- [midi-json-parser](https://github.com/chrisguttandin/midi-json-parser) 库进行MIDI解析
- GitHub Pages 托管网站
- Cloudflare 提供CDN和HTTPS支持

## 本地开发

如果你想在本地运行该项目：

1. 克隆仓库
2. 使用本地Web服务器运行项目
   - 可以使用Node.js的http-server: `npm install -g http-server && http-server`
   - 或Python的内置服务器: `python -m http.server`
   - 或Visual Studio Code的Live Server扩展
3. 在浏览器中访问对应的本地URL (如 http://localhost:8080)

> **注意**: 直接在文件系统中打开HTML文件（使用file://协议）可能会遇到CORS限制，导致无法加载外部库。建议使用本地Web服务器运行项目。

## 故障排除

### midi-json-parser库加载失败

如果你看到"midi-json-parser库未加载，请检查网络连接"的错误信息：

1. **检查网络连接**：确保你能访问unpkg.com或cdn.jsdelivr.net
2. **使用本地服务器**：如果遇到CORS错误（浏览器控制台显示"Access to fetch at ... has been blocked by CORS policy"），请使用本地Web服务器而不是直接打开HTML文件
3. **刷新页面**：有时候简单地刷新页面可以解决CDN加载问题
4. **清除浏览器缓存**：如果问题持续存在，尝试清除浏览器缓存后重试
5. **使用不同浏览器**：某些浏览器的安全设置可能会阻止脚本加载

最新版本的网站已添加备用CDN，当主要CDN加载失败时会自动尝试从备用CDN加载库。

### CORS错误解决方案

如果遇到类似以下的错误：
```
Access to fetch at 'https://unpkg.com/...' from origin 'null' has been blocked by CORS policy
```

这是因为当你直接打开HTML文件时（使用file://协议），浏览器的安全机制会阻止跨域请求。解决方法：

1. **使用本地Web服务器**运行项目（推荐）
2. **安装浏览器扩展**来禁用CORS（不推荐，仅用于开发）
3. **使用在线托管版本**，访问GitHub Pages上托管的版本

## 贡献

欢迎提交问题和改进建议！ 