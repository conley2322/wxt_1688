function stopLoading() {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => window.stop());
    } else {
        window.stop();
    }
    console.log('已停止页面加载，刷新按钮应停止转圈');
}
export default stopLoading
