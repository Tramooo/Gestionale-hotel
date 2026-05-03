(function initFloors(global) {
    const DEFAULT_RANGE = { start: 1, end: 5 };
    const MAX_RANGE_SIZE = 100;

    function toInteger(value, fallback) {
        const number = Number.parseInt(value, 10);
        return Number.isFinite(number) ? number : fallback;
    }

    function normalizeFloorRange(start, end, fallback = DEFAULT_RANGE) {
        const fallbackStart = toInteger(fallback.start, DEFAULT_RANGE.start);
        const fallbackEnd = toInteger(fallback.end, DEFAULT_RANGE.end);
        const rawStart = toInteger(start, fallbackStart);
        const rawEnd = toInteger(end, fallbackEnd);
        return {
            start: Math.min(rawStart, rawEnd),
            end: Math.max(rawStart, rawEnd)
        };
    }

    function getFloorOptions(range, selectedFloor) {
        const normalized = normalizeFloorRange(range?.start, range?.end);
        const options = [];
        const cappedEnd = Math.min(normalized.end, normalized.start + MAX_RANGE_SIZE - 1);

        for (let floor = normalized.start; floor <= cappedEnd; floor += 1) {
            options.push(floor);
        }

        const selected = Number.parseInt(selectedFloor, 10);
        if (Number.isFinite(selected) && !options.includes(selected)) {
            options.push(selected);
            options.sort((a, b) => a - b);
        }

        return options;
    }

    function parseFloorRange(rawValue, fallback = DEFAULT_RANGE) {
        if (!rawValue) return normalizeFloorRange(fallback.start, fallback.end);
        try {
            const parsed = typeof rawValue === 'string' ? JSON.parse(rawValue) : rawValue;
            return normalizeFloorRange(parsed?.start, parsed?.end, fallback);
        } catch (error) {
            return normalizeFloorRange(fallback.start, fallback.end);
        }
    }

    function inferFloorRange(rooms, fallback = DEFAULT_RANGE) {
        const floors = (rooms || [])
            .map((room) => Number.parseInt(room.floor, 10))
            .filter(Number.isFinite);

        if (!floors.length) return normalizeFloorRange(fallback.start, fallback.end);
        return normalizeFloorRange(Math.min(...floors), Math.max(...floors), fallback);
    }

    global.GroupStayFloors = {
        DEFAULT_RANGE,
        getFloorOptions,
        inferFloorRange,
        normalizeFloorRange,
        parseFloorRange
    };
})(window);
