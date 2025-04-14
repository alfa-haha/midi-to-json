/**
 * 隐式链接处理脚本
 * 该脚本将网站中的显式链接转换为隐式链接，提升用户体验和SEO
 */

document.addEventListener('DOMContentLoaded', function() {
    // 将所有带href属性的a标签转换为隐式链接
    convertExplicitToImplicitLinks();
});

/**
 * 将显式链接转换为隐式链接
 * 显式链接：用户点击后直接跳转到新页面
 * 隐式链接：用户点击后通过AJAX加载内容，不刷新页面
 */
function convertExplicitToImplicitLinks() {
    // 获取所有链接
    const links = document.querySelectorAll('a[href]:not([href^="#"]):not([href^="mailto:"]):not([href^="tel:"]):not([target="_blank"])');
    
    // 为每个链接添加点击事件处理
    links.forEach(link => {
        // 保存原始href属性
        const originalHref = link.getAttribute('href');
        
        // 仅处理网站内部链接（相对路径或同域名）
        if (isInternalLink(originalHref)) {
            link.addEventListener('click', function(e) {
                e.preventDefault(); // 阻止默认跳转行为
                
                // 显示加载动画
                showLoadingIndicator();
                
                // 使用fetch API异步加载页面内容
                fetch(originalHref)
                    .then(response => {
                        if (!response.ok) {
                            throw new Error('Network response was not ok');
                        }
                        return response.text();
                    })
                    .then(html => {
                        // 解析HTML
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(html, 'text/html');
                        
                        // 提取需要更新的主要内容
                        updatePageContent(doc);
                        
                        // 更新浏览器历史记录
                        window.history.pushState({url: originalHref}, doc.title, originalHref);
                        
                        // 更新页面标题
                        document.title = doc.title;
                        
                        // 隐藏加载动画
                        hideLoadingIndicator();
                    })
                    .catch(error => {
                        console.error('Error loading page:', error);
                        
                        // 发生错误时回退到传统导航
                        window.location.href = originalHref;
                    });
            });
        }
    });
    
    // 监听浏览器前进/后退按钮
    window.addEventListener('popstate', function(event) {
        if (event.state && event.state.url) {
            loadPageContent(event.state.url);
        }
    });
}

/**
 * 判断链接是否为内部链接
 * @param {string} href - 链接地址
 * @return {boolean} - 是否为内部链接
 */
function isInternalLink(href) {
    // 如果是相对路径，则一定是内部链接
    if (href.startsWith('/') || !href.startsWith('http')) {
        return true;
    }
    
    // 如果是绝对路径，检查是否为同域名
    const currentDomain = window.location.hostname;
    try {
        const url = new URL(href);
        return url.hostname === currentDomain;
    } catch (e) {
        return false;
    }
}

/**
 * 显示页面加载指示器
 */
function showLoadingIndicator() {
    // 检查是否已有loading元素
    let loader = document.getElementById('page-loader');
    
    if (!loader) {
        // 创建加载指示器
        loader = document.createElement('div');
        loader.id = 'page-loader';
        loader.innerHTML = '<div class="loader-spinner"></div>';
        
        // 设置样式
        loader.style.position = 'fixed';
        loader.style.top = '0';
        loader.style.left = '0';
        loader.style.width = '100%';
        loader.style.height = '100%';
        loader.style.backgroundColor = 'rgba(255, 255, 255, 0.7)';
        loader.style.display = 'flex';
        loader.style.justifyContent = 'center';
        loader.style.alignItems = 'center';
        loader.style.zIndex = '9999';
        
        // 设置spinner样式
        const spinner = loader.querySelector('.loader-spinner');
        spinner.style.width = '50px';
        spinner.style.height = '50px';
        spinner.style.border = '5px solid #f3f3f3';
        spinner.style.borderTop = '5px solid #2575fc';
        spinner.style.borderRadius = '50%';
        spinner.style.animation = 'spin 1s linear infinite';
        
        // 添加动画
        const style = document.createElement('style');
        style.innerHTML = '@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }';
        document.head.appendChild(style);
        
        // 添加到body
        document.body.appendChild(loader);
    } else {
        loader.style.display = 'flex';
    }
}

/**
 * 隐藏页面加载指示器
 */
function hideLoadingIndicator() {
    const loader = document.getElementById('page-loader');
    if (loader) {
        loader.style.display = 'none';
    }
}

/**
 * 根据URL加载页面内容
 * @param {string} url - 页面URL
 */
function loadPageContent(url) {
    showLoadingIndicator();
    
    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.text();
        })
        .then(html => {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            
            updatePageContent(doc);
            document.title = doc.title;
            
            hideLoadingIndicator();
        })
        .catch(error => {
            console.error('Error loading page:', error);
            window.location.href = url;
        });
}

/**
 * 更新页面内容
 * @param {Document} doc - 解析后的HTML文档
 */
function updatePageContent(doc) {
    // 更新主要内容区域
    // 根据网站结构确定需要更新的区域
    updateElement('main', doc);
    
    // 更新页眉内容（如果需要）
    // updateElement('header', doc);
    
    // 更新页脚内容（如果需要）
    // updateElement('footer', doc);
    
    // 重新初始化页面脚本
    reinitPageScripts();
}

/**
 * 更新指定元素的内容
 * @param {string} selector - 元素选择器
 * @param {Document} doc - 解析后的HTML文档
 */
function updateElement(selector, doc) {
    const currentElement = document.querySelector(selector);
    const newElement = doc.querySelector(selector);
    
    if (currentElement && newElement) {
        currentElement.innerHTML = newElement.innerHTML;
    }
}

/**
 * 重新初始化页面中的脚本
 */
function reinitPageScripts() {
    // 重新绑定平滑滚动事件
    document.querySelectorAll('.nav-link').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const targetId = this.getAttribute('href');
            if (targetId.startsWith('#')) {
                e.preventDefault();
                const targetElement = document.querySelector(targetId);
                
                if (targetElement) {
                    window.scrollTo({
                        top: targetElement.offsetTop,
                        behavior: 'smooth'
                    });
                    
                    history.pushState(null, null, targetId);
                }
            }
        });
    });
    
    // 重新初始化语言切换功能
    if (typeof initLanguageSwitcher === 'function') {
        initLanguageSwitcher();
    }
    
    // 重新初始化转换功能
    if (typeof init === 'function') {
        init();
    }
    
    // 转换新加载内容中的链接为隐式链接
    convertExplicitToImplicitLinks();
} 