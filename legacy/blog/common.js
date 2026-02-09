/**
 * 公共JavaScript函数库
 * 包含网站通用功能，如邮件链接处理等
 */

// 处理邮件链接，确保正确打开邮件客户端
document.addEventListener('DOMContentLoaded', function() {
    // 处理所有带有email-link类的邮件链接
    document.querySelectorAll('.email-link').forEach(link => {
        link.addEventListener('click', function(e) {
            e.stopPropagation(); // 阻止事件冒泡
            
            // 提取邮件地址
            const href = this.getAttribute('href');
            
            // 使用setTimeout延迟执行，避免可能的冲突
            setTimeout(() => {
                window.location.href = href;
            }, 50);
            
            // 阻止默认行为，我们将用自己的方式打开链接
            e.preventDefault();
        });
    });
}); 