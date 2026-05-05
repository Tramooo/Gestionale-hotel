(function initBootstrap(global) {
    const INIT_CACHE_PREFIX = 'gs_init_cache';
    const DEFAULT_SCHEMA_VERSION = '2026-05-05-startup-performance';

    function getInitCacheKey(userId) {
        return `${INIT_CACHE_PREFIX}:${userId || 'anonymous'}`;
    }

    function shouldRunInit({ storage, userId, version = DEFAULT_SCHEMA_VERSION } = {}) {
        if (!storage || !userId) return true;
        return storage.getItem(getInitCacheKey(userId)) !== version;
    }

    function markInitComplete({ storage, userId, version = DEFAULT_SCHEMA_VERSION } = {}) {
        if (!storage || !userId) return;
        storage.setItem(getInitCacheKey(userId), version);
    }

    global.GroupStayBootstrap = {
        DEFAULT_SCHEMA_VERSION,
        getInitCacheKey,
        markInitComplete,
        shouldRunInit
    };
})(window);
