# MIDI到JSON转换工具

这个网站可以将MIDI文件转换为Tone.js友好的JSON格式。

## 功能特点

- 简单易用的文件上传界面
- 将MIDI文件转换为Tone.js兼容的JSON格式
- 支持转换后的JSON文件下载
- **支持批量处理多个MIDI文件**
- **批量转换完成后可打包下载为ZIP**
- 在浏览器中直接处理，无需后端服务器
- 支持多语言界面（英文、中文、日语、西班牙语、德语）

## 如何使用

### 单个文件转换

1. 访问网站
2. 点击"选择MIDI文件"按钮或将文件拖放到指定区域
3. 等待转换完成
4. 点击"下载JSON"按钮保存转换后的文件

### 批量文件转换

1. 访问网站
2. 选择多个MIDI文件（按住Ctrl键选择多个文件）或拖放多个文件到指定区域
3. 点击"转换所有MIDI文件"按钮
4. 等待批量处理完成
   - 可以看到每个文件的处理进度和状态
   - 如果某个文件处理失败，可以点击"重试"按钮重新处理
5. 处理完成后，可以：
   - 点击每个文件旁的"下载"按钮单独下载某个文件
   - 点击"打包下载所有文件"按钮下载包含所有转换结果的ZIP文件

### 切换语言

网站默认使用英语界面，您可以通过以下步骤切换到其他语言：

1. 点击页面右上角的语言选择按钮
2. 从下拉菜单中选择您想要的语言
3. 界面将自动切换为所选语言

当前支持的语言：
- 英语 (English)
- 中文
- 日语 (日本語)
- 西班牙语 (Español)
- 德语 (Deutsch)

## 技术栈

本项目使用：
- HTML5 和 CSS3 构建用户界面
- JavaScript 实现转换功能
- [midi-json-parser](https://github.com/chrisguttandin/midi-json-parser) 库进行MIDI解析
- [JSZip](https://stuk.github.io/jszip/) 库实现多文件打包下载
- [FileSaver.js](https://github.com/eligrey/FileSaver.js/) 库实现文件保存
- 基于localStorage的语言偏好保存
- 模块化多语言支持系统
- GitHub Pages 托管网站
- Cloudflare 提供CDN和HTTPS支持

## 隐式链接功能

网站现在支持隐式链接导航，提供更流畅的浏览体验：

### 什么是隐式链接？

- **显式链接**：传统的网页链接，点击后浏览器会完全重新加载新页面
- **隐式链接**：点击后使用AJAX技术加载新页面内容，不刷新整个页面

### 用户体验优势

- **更快的页面切换**：无需重新加载整个页面，只更新变化的内容
- **平滑的过渡效果**：页面切换时不会出现闪烁
- **保持状态**：页面切换时不会丢失表单填写内容或滚动位置
- **减少服务器负载**：只加载必要的内容，减少带宽消耗

### 技术实现

- 使用Fetch API异步加载页面内容
- DOM解析和动态内容替换
- 浏览器历史API管理（支持前进/后退按钮）
- 加载指示器提供视觉反馈
- 自动处理内部和外部链接区分

### 注意事项

- 如果JavaScript被禁用，会自动回退到传统导航方式
- 外部链接和特殊链接（如邮件链接）保持原有行为
- 支持浏览器的前进/后退按钮操作

## 本地开发

如果你想在本地运行该项目：

1. 克隆仓库
2. 使用本地Web服务器运行项目
   - 可以使用Node.js的http-server: `npm install -g http-server && http-server`
   - 或Python的内置服务器: `python -m http.server`
   - 或Visual Studio Code的Live Server扩展
3. 在浏览器中访问对应的本地URL (如 http://localhost:8080)

> **注意**: 直接在文件系统中打开HTML文件（使用file://协议）可能会遇到CORS限制，导致无法加载外部库。建议使用本地Web服务器运行项目。

## 批量处理技术实现

批量处理功能实现采用以下方案：

### 文件处理队列
- 将上传的多个文件放入队列中
- 采用单线程方案，按顺序逐个处理文件
- 每个文件处理完成后自动进入下一个文件

### 进度显示
- 显示总体进度（已处理/总数）
- 显示每个文件的处理状态（等待处理、处理中、处理完成、处理失败）
- 使用不同颜色和图标直观表示处理状态

### 错误处理
- 单个文件处理失败不会影响整个处理流程
- 记录并显示失败原因
- 提供重试按钮，可单独重新处理失败的文件

### 打包下载
- 基于JSZip库实现多文件打包
- 支持单个文件下载和批量ZIP打包下载
- ZIP文件名包含时间戳，便于管理

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

### 语言切换问题

如果语言切换不起作用：

1. **检查浏览器LocalStorage**：确保没有禁用LocalStorage
2. **清除浏览器缓存和Cookie**：这可能会解决某些保存的设置问题
3. **检查控制台错误**：查看浏览器开发者工具中的控制台，可能会显示相关错误信息

### 批量处理问题

如果批量处理出现问题：

1. **检查文件格式**：确保所有上传的文件都是有效的MIDI文件（.mid或.midi扩展名）
2. **文件大小**：转换大型MIDI文件时，浏览器可能需要更多时间处理
3. **重试单个文件**：如果特定文件转换失败，可以使用"重试"按钮单独处理该文件
4. **刷新页面**：如果多次转换后出现内存问题，可以刷新页面重新开始

## 贡献

欢迎提交问题和改进建议！

## Blog Section

The website now includes a blog section with a blog aggregation page that showcases articles about MIDI to JSON conversion. The blog page lists three articles:

1. **MIDI to JSON Conversion Guide** - A comprehensive guide on converting MIDI files to JSON format
2. **Web Music Application Development** - Learn how to build web music applications using JSON-converted MIDI files
3. **Innovative Application Cases** - Explore creative ways developers are using MIDI to JSON conversion

The blog aggregation page can be accessed from the main navigation in the header and also from the footer's Quick Links section.

## SEO Optimization for Multilingual Support

To improve search engine optimization and ensure proper indexing of our multilingual content, we've implemented the following best practices:

### URL Structure
- Each language has its own dedicated URL path, following Google's recommended pattern:
  - English: `/en/page-name`
  - Chinese: `/zh/page-name`
  - Japanese: `/ja/page-name` 
  - Spanish: `/es/page-name`
  - German: `/de/page-name`

### Hreflang Implementation
- All pages include proper `hreflang` tags in the `<head>` section, helping search engines understand relationships between translated pages
- We use `x-default` hreflang tags to indicate the default language version (English)

### Canonical URLs
- Every page has a canonical URL tag to prevent duplicate content issues
- This ensures search engines know which URL is the primary version for indexing

### Redirects
- 301 redirects handle old URL patterns, ensuring users and search engines are directed to the correct language-specific URL
- The `.htaccess` file contains rules for automatically redirecting users based on URL structure

### Language Switching
- The language switcher updates both the UI language and redirects to the appropriate language URL
- The `i18n.js` file handles detection of language from URL and localStorage preferences

### XML Sitemap
- A comprehensive XML sitemap (`sitemap.xml`) includes all language versions of each page
- Each URL entry includes hreflang annotations matching the on-page implementation

This implementation ensures our website follows Google's guidelines for multilingual SEO, improving our visibility in search results across different languages and regions. 