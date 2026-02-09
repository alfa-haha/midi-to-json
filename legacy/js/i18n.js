/**
 * Internationalization (i18n) handler
 */

// 定义支持的语言列表
const supportedLanguages = ['en', 'zh', 'ja', 'es', 'de'];

// 存储当前语言和翻译对象
let currentLanguage = 'en';
let translations = {};

/**
 * 初始化i18n
 */
function initI18n() {
    // 从localStorage获取保存的语言偏好
    const savedLanguage = localStorage.getItem('preferredLanguage');
    
    // 如果有保存的语言偏好且是支持的语言，则使用它
    if (savedLanguage && supportedLanguages.includes(savedLanguage)) {
        currentLanguage = savedLanguage;
    } else {
        // 否则使用默认英语
        currentLanguage = 'en';
    }
    
    // 初始设置translations对象
    // 由于我们在HTML中已经加载了en.js，所以可以使用它
    if (typeof en !== 'undefined') {
        translations = en;
    }
    
    // 如果当前语言不是英语，则加载对应的语言文件
    if (currentLanguage !== 'en') {
        loadLanguageFile(currentLanguage);
    } else {
        // 应用翻译
        applyTranslations();
    }
}

/**
 * 加载语言文件
 * @param {string} lang - 语言代码
 */
function loadLanguageFile(lang) {
    // 如果语言文件已经加载，则直接应用翻译
    if (window[lang]) {
        translations = window[lang];
        applyTranslations();
        return;
    }
    
    // 否则加载语言文件
    const script = document.createElement('script');
    script.src = `js/i18n/${lang}.js`;
    script.onload = () => {
        // 语言文件加载完成后，确保全局变量存在并赋值给translations
        if (window[lang]) {
            translations = window[lang];
            applyTranslations();
        } else {
            console.error(`Language file ${lang}.js was loaded but the global variable ${lang} is not defined`);
            // 回退到英语
            currentLanguage = 'en';
            translations = en || {};
            applyTranslations();
        }
    };
    script.onerror = () => {
        console.error(`Failed to load language file: ${lang}.js`);
        // 出错时使用默认的英语翻译
        currentLanguage = 'en';
        translations = en || {};
        applyTranslations();
    };
    document.head.appendChild(script);
}

/**
 * 应用翻译到页面
 */
function applyTranslations() {
    if (!translations) {
        console.error('Translations object is undefined');
        return;
    }
    
    // 更新所有带有data-i18n属性的元素
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        
        if (translations[key]) {
            // 如果是包含HTML的字符串，使用innerHTML
            if (translations[key].includes('<')) {
                element.innerHTML = translations[key];
            } else {
                element.textContent = translations[key];
            }
        } else {
            console.warn(`Translation key "${key}" not found in ${currentLanguage} language file`);
        }
    });
    
    // 更新当前语言显示
    const languageDisplay = document.getElementById('current-language');
    if (languageDisplay) {
        // 显示语言名称
        const languageNames = {
            'en': 'English',
            'zh': '中文',
            'ja': '日本語',
            'es': 'Español',
            'de': 'Deutsch'
        };
        languageDisplay.textContent = languageNames[currentLanguage] || 'English';
    }
    
    // 更新footer的语言显示
    const footerLanguageDisplay = document.getElementById('footer-current-language');
    if (footerLanguageDisplay) {
        const languageNames = {
            'en': 'English',
            'zh': '中文',
            'ja': '日本語',
            'es': 'Español',
            'de': 'Deutsch'
        };
        footerLanguageDisplay.textContent = languageNames[currentLanguage] || 'English';
    }
    
    // 更新语言选择器的active状态
    document.querySelectorAll('.language-option').forEach(option => {
        if (option.getAttribute('data-lang') === currentLanguage) {
            option.classList.add('active');
        } else {
            option.classList.remove('active');
        }
    });
    
    // 更新HTML的lang属性
    document.documentElement.lang = currentLanguage;
}

/**
 * 切换到新语言
 * @param {string} lang - 语言代码
 */
function changeLanguage(lang) {
    if (!supportedLanguages.includes(lang) || lang === currentLanguage) {
        return;
    }
    
    // 更新当前语言
    currentLanguage = lang;
    
    // 保存语言偏好到localStorage
    localStorage.setItem('preferredLanguage', lang);
    
    // 加载新语言文件
    loadLanguageFile(lang);
}

// 暴露全局方法供其他JS文件调用
window.setLanguage = changeLanguage;

// 页面加载完成后初始化i18n
document.addEventListener('DOMContentLoaded', initI18n); 