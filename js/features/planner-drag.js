(function initPlannerDragFeature(global) {
    let deps = null;
    let dragState = null; // { startDayIdx, currentDayIdx, overlay, rowTop, rowHeight }

    function requireDeps() {
        if (!deps) throw new Error('GroupStayPlannerDrag not initialized');
        return deps;
    }

    function isTouchEnvironment() {
        return window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
    }

    function initGridDrag() {
        const { getPlannerGridEl } = requireDeps();
        const plannerGridEl = getPlannerGridEl();
        if (!plannerGridEl) return;
        const gridInner = plannerGridEl.querySelector('.p-grid-inner');
        if (!gridInner) return;

        gridInner.removeEventListener('mousedown', onGridDragStart);
        gridInner.removeEventListener('touchstart', onGridDragStart);
        gridInner.addEventListener('mousedown', onGridDragStart);
        if (!isTouchEnvironment()) {
            gridInner.addEventListener('touchstart', onGridDragStart, { passive: false });
        }
    }

    function getDayIdxFromEvent(event) {
        const { getPlannerDayWidth, getPlannerGridEl } = requireDeps();
        const plannerGridEl = getPlannerGridEl();
        const clientX = event.touches ? event.touches[0].clientX : event.clientX;
        const rect = plannerGridEl.getBoundingClientRect();
        const x = clientX - rect.left + plannerGridEl.scrollLeft;
        return Math.floor(x / getPlannerDayWidth());
    }

    function onGridDragStart(event) {
        const { getPlannerGridEl, getPlannerTotalDays } = requireDeps();
        const plannerGridEl = getPlannerGridEl();

        if (event.target.closest('.planner-res-bar')) return;
        if (event.type === 'mousedown' && event.button !== 0) return;
        if (event.type === 'touchstart') event.preventDefault();

        const dayIdx = getDayIdxFromEvent(event);
        if (dayIdx < 0 || dayIdx >= getPlannerTotalDays()) return;

        const gridInner = plannerGridEl.querySelector('.p-grid-inner');
        const rowEl = (
            event.touches
                ? document.elementFromPoint(event.touches[0].clientX, event.touches[0].clientY)
                : event.target
        ).closest('.p-grid-room-row');

        let rowTop = 0;
        let rowHeight = gridInner.offsetHeight;
        if (rowEl) {
            rowTop = rowEl.offsetTop;
            rowHeight = rowEl.offsetHeight;
        }

        const overlay = document.createElement('div');
        overlay.className = 'grid-drag-overlay';
        gridInner.appendChild(overlay);

        dragState = {
            startDayIdx: dayIdx,
            currentDayIdx: dayIdx,
            overlay,
            rowTop,
            rowHeight
        };
        updateDragOverlay();

        document.addEventListener('mousemove', onGridDragMove);
        document.addEventListener('mouseup', onGridDragEnd);
        document.addEventListener('touchmove', onGridDragMove, { passive: false });
        document.addEventListener('touchend', onGridDragEnd);
    }

    function onGridDragMove(event) {
        const { getPlannerTotalDays } = requireDeps();
        if (!dragState) return;
        if (event.type === 'touchmove') event.preventDefault();

        const dayIdx = getDayIdxFromEvent(event);
        if (dayIdx < 0 || dayIdx >= getPlannerTotalDays()) return;

        dragState.currentDayIdx = dayIdx;
        updateDragOverlay();
    }

    function updateDragOverlay() {
        const { dayIndexToDate, getPlannerDayWidth } = requireDeps();
        if (!dragState || !dragState.overlay) return;

        const startIdx = Math.min(dragState.startDayIdx, dragState.currentDayIdx);
        const endIdx = Math.max(dragState.startDayIdx, dragState.currentDayIdx);
        const left = startIdx * getPlannerDayWidth();
        const width = (endIdx - startIdx + 1) * getPlannerDayWidth();

        const overlay = dragState.overlay;
        overlay.style.left = left + 'px';
        overlay.style.top = dragState.rowTop + 'px';
        overlay.style.width = width + 'px';
        overlay.style.height = dragState.rowHeight + 'px';

        const startDate = dayIndexToDate(startIdx);
        const endDate = dayIndexToDate(endIdx + 1);
        const nights = endIdx - startIdx + 1;
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const formatShortDate = (date) => `${date.getDate()} ${monthNames[date.getMonth()]}`;
        overlay.setAttribute('data-label', `${formatShortDate(startDate)} → ${formatShortDate(endDate)} (${nights}n)`);
    }

    function onGridDragEnd() {
        const { dayIndexToDate, formatDate, openBookingTypeChooser } = requireDeps();

        document.removeEventListener('mousemove', onGridDragMove);
        document.removeEventListener('mouseup', onGridDragEnd);
        document.removeEventListener('touchmove', onGridDragMove);
        document.removeEventListener('touchend', onGridDragEnd);

        if (!dragState) return;

        const startIdx = Math.min(dragState.startDayIdx, dragState.currentDayIdx);
        const endIdx = Math.max(dragState.startDayIdx, dragState.currentDayIdx);

        if (dragState.overlay && dragState.overlay.parentNode) {
            dragState.overlay.parentNode.removeChild(dragState.overlay);
        }
        dragState = null;

        const checkinDate = dayIndexToDate(startIdx);
        const checkoutDate = dayIndexToDate(endIdx + 1);
        openBookingTypeChooser(formatDate(checkinDate), formatDate(checkoutDate));
    }

    global.GroupStayPlannerDrag = {
        init(config) {
            deps = config;
        },
        getDayIdxFromEvent,
        initGridDrag,
        onGridDragEnd,
        onGridDragMove,
        onGridDragStart,
        updateDragOverlay
    };
})(window);
