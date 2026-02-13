
window.addEventListener('error', function (event) {
    // Ignore benign errors that don't affect functionality
    if (event.message && (
        event.message.includes('ResizeObserver loop completed with undelivered notifications') ||
        event.message.includes('ResizeObserver loop limit exceeded')
    )) {
        return;
    }

    // Handle QuotaExceededError gracefully — clear old caches instead of crashing
    if (event.error && (event.error.name === 'QuotaExceededError' || event.error.code === 22)) {
        console.warn('[Storage] QuotaExceededError caught globally, clearing caches...');
        try {
            localStorage.removeItem('forzeo_audit_results_v3');
            localStorage.removeItem('forzeo_prompts_v3');
            localStorage.removeItem('forzeo_clients_v3');
        } catch (e) { /* ignore */ }
        event.preventDefault(); // Prevent default error handling
        return;
    }

    // Ignore chunk loading errors (network flakes)
    if (event.message && event.message.includes('ChunkLoadError')) {
        return;
    }

    console.error('GLOBAL ERROR CAUGHT:', event.error);

    // Show a small non-blocking toast instead of a full-page red overlay
    var existing = document.getElementById('global-error-toast');
    if (existing) existing.remove();
    var div = document.createElement('div');
    div.id = 'global-error-toast';
    div.style.cssText = 'position:fixed;bottom:20px;right:20px;max-width:400px;background:#1a1a2e;color:#e94560;z-index:99999;padding:12px 16px;border-radius:8px;font-size:13px;box-shadow:0 4px 20px rgba(0,0,0,0.3);border:1px solid #e94560;cursor:pointer;';
    div.innerHTML = '<strong>⚠ Error:</strong> ' + (event.error ? event.error.message : event.message).substring(0, 150);
    div.onclick = function () { div.remove(); };
    document.body.appendChild(div);
    // Auto-dismiss after 10 seconds
    setTimeout(function () { if (div.parentNode) div.remove(); }, 10000);
});

window.addEventListener('unhandledrejection', function (event) {
    // Handle storage quota errors in promises too
    if (event.reason && (event.reason.name === 'QuotaExceededError' || event.reason.code === 22)) {
        console.warn('[Storage] QuotaExceededError in promise, clearing caches...');
        try {
            localStorage.removeItem('forzeo_audit_results_v3');
            localStorage.removeItem('forzeo_prompts_v3');
        } catch (e) { /* ignore */ }
        event.preventDefault();
        return;
    }
    console.error('UNHANDLED REJECTION:', event.reason);
});
