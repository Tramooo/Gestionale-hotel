(function initPreferences(global) {
  const STORAGE_KEY = 'gs_preferences_v1';
  const DEFAULTS = Object.freeze({
    language: 'it',
    plannerDimensions: Object.freeze({ dayWidth: 38, rowHeight: 34 }),
    plannerFloorRange: null,
    sidebarCollapsed: false
  });

  const clampInt = (value, min, max, fallback) => {
    const number = Number.parseInt(value, 10);
    return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
  };

  function sanitize(key, value) {
    if (key === 'language') return value === 'en' ? 'en' : 'it';
    if (key === 'sidebarCollapsed') return value === true;
    if (key === 'plannerDimensions') {
      return {
        dayWidth: clampInt(value?.dayWidth, 24, 80, 38),
        rowHeight: clampInt(value?.rowHeight, 28, 64, 34)
      };
    }
    if (key === 'plannerFloorRange') {
      if (!value || typeof value !== 'object') return null;
      const first = clampInt(value.start, -20, 200, 0);
      const second = clampInt(value.end, -20, 200, first);
      return { start: Math.min(first, second), end: Math.max(first, second) };
    }
    throw new TypeError(`Unknown preference: ${key}`);
  }

  function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  let storage = null;
  try {
    storage = global.localStorage;
  } catch {
    storage = null;
  }

  function purgeDisallowedStorage() {
    if (!storage) return;
    const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index)).filter(Boolean);
    for (const key of keys) {
      if (key.startsWith('gs_') && key !== STORAGE_KEY) storage.removeItem(key);
    }
  }

  function read() {
    let candidate = {};
    try {
      candidate = JSON.parse(storage?.getItem(STORAGE_KEY) || '{}');
    } catch {
      candidate = {};
    }
    return {
      language: sanitize('language', candidate.language),
      plannerDimensions: sanitize('plannerDimensions', candidate.plannerDimensions),
      plannerFloorRange: sanitize('plannerFloorRange', candidate.plannerFloorRange),
      sidebarCollapsed: sanitize('sidebarCollapsed', candidate.sidebarCollapsed)
    };
  }

  purgeDisallowedStorage();
  let state = read();

  function persist() {
    storage?.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function get(key, fallback) {
    return Object.prototype.hasOwnProperty.call(DEFAULTS, key) ? clone(state[key]) : fallback;
  }

  function set(key, value) {
    if (!Object.prototype.hasOwnProperty.call(DEFAULTS, key)) {
      throw new TypeError(`Unknown preference: ${key}`);
    }
    state = { ...state, [key]: sanitize(key, value) };
    persist();
    return get(key);
  }

  function snapshot() {
    return clone(state);
  }

  global.GroupStayPreferences = { get, set, snapshot };
})(window);
