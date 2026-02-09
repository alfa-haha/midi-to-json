/**
 * 统一的语言切换功能实现
 * 这个文件处理所有页面的语言切换逻辑
 */

// 在DOM加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    // 初始化顶部语言选择器
    initLanguageSwitcher('.language-selector .language-btn', '.language-selector .language-dropdown');
    
    // 初始化底部语言选择器
    initLanguageSwitcher('.footer-language-btn', '.footer-section .language-dropdown');
});

/**
 * 初始化语言选择器功能
 * @param {string} buttonSelector - 语言按钮选择器
 * @param {string} dropdownSelector - 下拉菜单选择器
 */
function initLanguageSwitcher(buttonSelector, dropdownSelector) {
    const languageBtn = document.querySelector(buttonSelector);
    const languageDropdown = document.querySelector(dropdownSelector);
    
    if (!languageBtn || !languageDropdown) return;
    
    // 为语言按钮添加点击事件
    languageBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        languageDropdown.classList.toggle('show');
        const expanded = languageDropdown.classList.contains('show');
        try {
            languageBtn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        } catch {}
    });
    
    // 为每个语言选项添加点击事件
    const languageOptions = languageDropdown.querySelectorAll('.language-option');
    
    languageOptions.forEach(option => {
        option.addEventListener('click', function(e) {
            e.stopPropagation();
            
            // 获取语言代码
            const lang = this.getAttribute('data-lang');
            const languageName = this.querySelector('.language-name').textContent;

            // If an explicit href exists (e.g. on Eleventy-generated pages), navigate directly.
            const href = this.getAttribute('href');
            if (href && href !== '#') {
                e.preventDefault();
                window.location.href = href;
                return;
            }

            // 更新当前语言显示
            const currentLanguageSpans = document.querySelectorAll('#current-language, #footer-current-language');
            currentLanguageSpans.forEach(span => {
                if (span) span.textContent = languageName;
            });
            
            // 更新所有语言选项的激活状态
            document.querySelectorAll('.language-option').forEach(opt => {
                if (opt.getAttribute('data-lang') === lang) {
                    opt.classList.add('active');
                } else {
                    opt.classList.remove('active');
                }
            });
            
            // 切换到新语言
            if (typeof setLanguage === 'function') {
                setLanguage(lang);
            } else {
                // 备用方案：直接重定向到新语言版本
                switchToLanguageUrl(lang);
            }
            
            // 隐藏下拉菜单
            languageDropdown.classList.remove('show');
            try {
                languageBtn.setAttribute('aria-expanded', 'false');
            } catch {}
        });
    });
    
    // 点击页面其他地方关闭下拉菜单
    document.addEventListener('click', function(e) {
        if (languageDropdown.classList.contains('show')) {
            if (!e.target.closest(buttonSelector) && !e.target.closest(dropdownSelector)) {
                languageDropdown.classList.remove('show');
                try {
                    languageBtn.setAttribute('aria-expanded', 'false');
                } catch {}
            }
        }
    });
}

/**
 * 切换到特定语言的URL（路径重构）
 * @param {string} lang - 语言代码
 */
function switchToLanguageUrl(lang) {
    // 获取当前URL
    let currentPath = window.location.pathname;
    
    // 检查当前是否在博客页面
    const isBlogPage = currentPath.includes('/blog/');
    
    // 获取基本路径（移除语言目录前缀，如果存在）
    let basePath = currentPath;
    const langPrefixRegex = /^\/(en|zh|ja|es|de)\//;
    if (langPrefixRegex.test(currentPath)) {
        basePath = currentPath.replace(langPrefixRegex, '/');
    }
    
    // 构建新URL
    let newUrl;
    if (lang === 'en') {
        // 英语是默认语言，不需要前缀
        newUrl = basePath;
    } else {
        // 如果在网站根目录的index.html需要特别处理
        if (basePath === '/' || basePath === '/index.html') {
            newUrl = `/${lang}/index.html`;
        } else {
            newUrl = `/${lang}${basePath}`;
        }
    }
    
    // 添加当前查询字符串和哈希
    const queryString = window.location.search;
    const hash = window.location.hash;
    newUrl = newUrl + queryString + hash;
    
    // 重定向到新URL
    window.location.href = newUrl;
} 
