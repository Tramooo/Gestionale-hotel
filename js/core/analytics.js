// =============================================
// Vercel Web Analytics Integration
// =============================================

// Initialize Vercel Web Analytics
// This uses the generic inject method for vanilla JavaScript projects
(function() {
    // Initialize the queue for analytics events
    if (!window.va) {
        window.va = function va() {
            (window.vaq = window.vaq || []).push(arguments);
        };
    }

    // Detect environment (development vs production)
    const isDev = window.location.hostname === 'localhost' || 
                  window.location.hostname === '127.0.0.1' ||
                  window.location.hostname.includes('192.168.') ||
                  window.location.hostname.includes('10.0.');

    // Set mode based on environment
    window.vam = isDev ? 'development' : 'production';

    // Create and inject the analytics script
    const script = document.createElement('script');
    script.defer = true;
    script.src = '/_vercel/insights/script.js';
    
    // Add error handling
    script.onerror = function() {
        if (isDev) {
            console.log('[Vercel Analytics] Script failed to load. This is expected in local development.');
        }
    };

    // Inject the script into the page
    document.head.appendChild(script);

    if (isDev) {
        console.log('[Vercel Analytics] Initialized in development mode');
    }
})();
