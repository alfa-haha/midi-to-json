/**
 * 图片懒加载功能
 * 实现博客文章开篇图片的懒加载，提高页面加载速度
 */

document.addEventListener('DOMContentLoaded', function() {
    // 获取所有带有data-lazy属性的图片
    const lazyImages = document.querySelectorAll('img[data-lazy]');
    
    // 如果支持IntersectionObserver（现代浏览器），使用它来进行懒加载
    if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver(function(entries, observer) {
            entries.forEach(function(entry) {
                // 当图片进入视口时
                if (entry.isIntersecting) {
                    const image = entry.target;
                    // 将data-src的值设置到src
                    image.src = image.dataset.src;
                    // 加载完成后移除加载中的样式
                    image.onload = function() {
                        image.classList.remove('lazy-loading');
                        image.classList.add('lazy-loaded');
                    };
                    // 图片已处理，不再需要观察
                    imageObserver.unobserve(image);
                }
            });
        });
        
        // 观察所有懒加载图片
        lazyImages.forEach(function(image) {
            imageObserver.observe(image);
        });
    } else {
        // 兼容不支持IntersectionObserver的浏览器
        // 使用滚动事件实现懒加载
        let lazyImagePositions = [];
        lazyImages.forEach(function(image) {
            lazyImagePositions.push({
                element: image,
                top: image.getBoundingClientRect().top + window.pageYOffset
            });
        });
        
        // 滚动时检查图片是否需要加载
        function lazyLoad() {
            const scrollTop = window.pageYOffset;
            const windowHeight = window.innerHeight;
            
            lazyImagePositions.forEach(function(lazyImage, index) {
                // 如果图片已经在可视区域内
                if (scrollTop + windowHeight > lazyImage.top - 200) { // 提前200px加载
                    const image = lazyImage.element;
                    image.src = image.dataset.src;
                    
                    // 加载完成后移除加载中的样式
                    image.onload = function() {
                        image.classList.remove('lazy-loading');
                        image.classList.add('lazy-loaded');
                    };
                    
                    // 从数组中删除已处理的图片
                    lazyImagePositions.splice(index, 1);
                }
            });
            
            // 如果所有图片都已加载，移除滚动监听
            if (lazyImagePositions.length === 0) {
                document.removeEventListener('scroll', lazyLoad);
                window.removeEventListener('resize', lazyLoad);
                window.removeEventListener('orientationchange', lazyLoad);
            }
        }
        
        // 添加各种事件监听
        document.addEventListener('scroll', lazyLoad);
        window.addEventListener('resize', lazyLoad);
        window.addEventListener('orientationchange', lazyLoad);
        
        // 初始加载
        lazyLoad();
    }
}); 