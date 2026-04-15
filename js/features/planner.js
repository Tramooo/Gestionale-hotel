(function initPlannerFeature(global) {
    let deps = null;

    function requireDeps() {
        if (!deps) throw new Error('GroupStayPlanner not initialized');
        return deps;
    }

    function dateToDayIndex(date) {
        const { getPlannerStartDate } = requireDeps();
        return Math.round((date - getPlannerStartDate()) / 86400000);
    }

    function dayIndexToDate(index) {
        const { getPlannerStartDate } = requireDeps();
        const start = getPlannerStartDate();
        return new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
    }

    function getPlannerSortedRooms() {
        const { getRooms } = requireDeps();
        return [...getRooms()].sort((a, b) => a.floor !== b.floor ? a.floor - b.floor : parseInt(a.number) - parseInt(b.number));
    }

    function getPlannerFloors(sortedRooms) {
        const floors = {};
        sortedRooms.forEach((room) => { (floors[room.floor] = floors[room.floor] || []).push(room); });
        return floors;
    }

    function getPlannerRoomBookings(sortedRooms) {
        const { getGuests, getPlannerTotalDays, getReservations } = requireDeps();
        const rb = {};
        sortedRooms.forEach((room) => { rb[room.id] = []; });
        getReservations().forEach((reservation) => {
            if (reservation.status === 'cancelled') return;
            const startIdx = dateToDayIndex(new Date(reservation.checkin + 'T00:00:00'));
            const endIdx = dateToDayIndex(new Date(reservation.checkout + 'T00:00:00'));
            if (endIdx <= 0 || startIdx >= getPlannerTotalDays()) return;
            const booking = { res: reservation, startIdx: Math.max(0, startIdx), endIdx: Math.min(getPlannerTotalDays(), endIdx) };
            const assignedIds = reservation.roomIds && reservation.roomIds.length > 0
                ? reservation.roomIds
                : [...new Set(getGuests().filter((guest) => guest.reservationId === reservation.id && guest.roomId).map((guest) => guest.roomId))];
            if (assignedIds.length > 0) {
                assignedIds.forEach((roomId) => { if (rb[roomId]) rb[roomId].push(booking); });
            } else {
                for (let i = 0; i < sortedRooms.length; i++) {
                    const room = sortedRooms[i];
                    const conflict = rb[room.id].some((entry) => entry.startIdx < booking.endIdx && entry.endIdx > booking.startIdx);
                    if (!conflict) {
                        rb[room.id].push(booking);
                        break;
                    }
                }
            }
        });
        return rb;
    }

    function renderCalendar() {
        const {
            computeRoomStatuses,
            getCalendarDate,
            getPlannerInitialFuture,
            getPlannerInitialPast,
            initGridDrag,
            renderExpiringBanner,
            renderPlannerMonthBar,
            setPlannerGridEl,
            setPlannerHeaderEl,
            setPlannerIsExtending,
            setPlannerRoomsEl,
            setPlannerStartDate,
            setPlannerTotalDays
        } = requireDeps();
        computeRoomStatuses();
        const board = document.getElementById('plannerBoard');
        const calendarDate = getCalendarDate();
        const anchor = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), calendarDate.getDate());
        const plannerStartDate = new Date(anchor);
        plannerStartDate.setHours(0, 0, 0, 0);
        plannerStartDate.setDate(plannerStartDate.getDate() - getPlannerInitialPast());
        setPlannerStartDate(plannerStartDate);
        setPlannerTotalDays(getPlannerInitialPast() + getPlannerInitialFuture());
        board.innerHTML = buildBoardHTML();

        const plannerGridEl = board.querySelector('.p-grid-panel');
        const plannerHeaderEl = board.querySelector('.p-header-panel');
        const plannerRoomsEl = board.querySelector('.p-rooms-panel');
        setPlannerGridEl(plannerGridEl);
        setPlannerHeaderEl(plannerHeaderEl);
        setPlannerRoomsEl(plannerRoomsEl);
        setPlannerIsExtending(false);
        plannerGridEl.addEventListener('scroll', onPlannerScroll);

        const anchorIdx = dateToDayIndex(anchor);
        plannerGridEl.scrollLeft = Math.max(0, anchorIdx * requireDeps().getPlannerDayWidth() - plannerGridEl.clientWidth / 3);
        initGridDrag();
        renderPlannerMonthBar();
        renderExpiringBanner();
    }

    function refreshCalendar() {
        const {
            getPlannerGridEl,
            getPlannerHeaderEl,
            getPlannerRoomsEl,
            initGridDrag,
            renderCalendar,
            renderExpiringBanner,
            setPlannerGridEl,
            setPlannerHeaderEl,
            setPlannerRoomsEl
        } = requireDeps();
        const currentGrid = getPlannerGridEl();
        if (!currentGrid) {
            renderCalendar();
            return;
        }

        const slBefore = currentGrid.scrollLeft;
        const stBefore = currentGrid.scrollTop;
        const board = document.getElementById('plannerBoard');
        currentGrid.removeEventListener('scroll', onPlannerScroll);
        board.innerHTML = buildBoardHTML();

        const plannerGridEl = board.querySelector('.p-grid-panel');
        const plannerHeaderEl = board.querySelector('.p-header-panel');
        const plannerRoomsEl = board.querySelector('.p-rooms-panel');
        setPlannerGridEl(plannerGridEl);
        setPlannerHeaderEl(plannerHeaderEl);
        setPlannerRoomsEl(plannerRoomsEl);
        plannerGridEl.addEventListener('scroll', onPlannerScroll);
        initGridDrag();

        plannerGridEl.scrollLeft = slBefore;
        plannerGridEl.scrollTop = stBefore;
        const headerInner = plannerHeaderEl.querySelector('.p-header-inner');
        const roomsInner = plannerRoomsEl.querySelector('.p-rooms-inner');
        if (headerInner) headerInner.style.transform = `translateX(${-slBefore}px)`;
        if (roomsInner) roomsInner.style.transform = `translateY(${-stBefore}px)`;
        renderExpiringBanner();
    }

    function renderExpiringBanner() {
        const { escapeHtml, formatDate, formatDateDisplay, getReservations, openReservationDetail, t } = requireDeps();
        const banner = document.getElementById('expiringBanner');
        if (!banner) return;
        const today = formatDate(new Date());
        const expiring = getReservations().filter((reservation) => reservation.status === 'pending' && reservation.expiration === today);
        if (expiring.length === 0) {
            banner.style.display = 'none';
            return;
        }
        banner.style.display = 'block';
        banner.innerHTML = `
            <div class="expiring-banner">
                <div class="expiring-banner-title">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
                        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    ${t('cal.expiringToday')} (${expiring.length})
                </div>
                <div class="expiring-banner-list">
                    ${expiring.map((reservation) => `
                        <div class="expiring-banner-item" onclick="openReservationDetail('${reservation.id}')">
                            <span class="expiring-banner-name">${escapeHtml(reservation.groupName)}</span>
                            <span class="expiring-banner-dates">${formatDateDisplay(reservation.checkin)} → ${formatDateDisplay(reservation.checkout)}</span>
                            <span class="expiring-banner-info">${reservation.roomCount} ${reservation.roomCount !== 1 ? t('cal.roomPlural') : t('cal.roomSingular')} · ${reservation.guestCount} ${reservation.guestCount !== 1 ? t('cal.guestPlural') : t('cal.guestSingular')}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    function buildBoardHTML() {
        const {
            escapeHtml,
            formatDate,
            formatDateDisplay,
            getGuests,
            getPlannerDayWidth,
            getPlannerRowHeight,
            getPlannerTotalDays,
            hideBarTooltip,
            t
        } = requireDeps();
        const DW = getPlannerDayWidth();
        const totalDays = getPlannerTotalDays();
        const today = formatDate(new Date());
        const dayAbbr = t('days.short');
        const monthFull = t('months.full');

        const sortedRooms = getPlannerSortedRooms();
        const floors = getPlannerFloors(sortedRooms);
        const bookingsByRoom = getPlannerRoomBookings(sortedRooms);
        const floorKeys = Object.keys(floors).sort((a, b) => a - b);
        const totalRooms = sortedRooms.length;

        const monthSpans = [];
        let currentMonthKey = null;
        for (let i = 0; i < totalDays; i++) {
            const date = dayIndexToDate(i);
            const key = date.getFullYear() + '-' + date.getMonth();
            if (key !== currentMonthKey) {
                monthSpans.push({ label: monthFull[date.getMonth()] + ' ' + date.getFullYear(), count: 1 });
                currentMonthKey = key;
            } else {
                monthSpans[monthSpans.length - 1].count++;
            }
        }

        const dayOcc = new Uint16Array(totalDays);
        sortedRooms.forEach((room) => {
            bookingsByRoom[room.id].forEach((booking) => {
                for (let i = booking.startIdx; i < booking.endIdx; i++) dayOcc[i]++;
            });
        });

        let corner = '<div class="p-corner">';
        corner += '<div class="p-corner-cell months">&nbsp;</div>';
        corner += `<div class="p-corner-cell days">${t('cal.room')}</div>`;
        corner += `<div class="p-corner-cell stats">${t('cal.available')}</div>`;
        corner += `<div class="p-corner-cell stats">${t('cal.occupied')}</div>`;
        corner += '</div>';

        let header = '<div class="p-header-panel"><div class="p-header-inner">';
        header += '<div class="p-header-row months">';
        monthSpans.forEach((span) => {
            header += `<div class="p-month-label" style="width:${span.count * DW}px">${span.label}</div>`;
        });
        header += '</div>';

        header += '<div class="p-header-row days">';
        for (let i = 0; i < totalDays; i++) {
            const date = dayIndexToDate(i);
            const dow = date.getDay();
            let c = 'p-day-cell';
            if (formatDate(date) === today) c += ' today';
            else if (dow === 0 || dow === 6) c += ' weekend';
            header += `<div class="${c}" style="width:${DW}px"><span class="day-num">${date.getDate()}</span><span class="day-name">${dayAbbr[dow]}</span></div>`;
        }
        header += '</div>';

        header += '<div class="p-header-row stats">';
        for (let i = 0; i < totalDays; i++) header += `<div class="p-stats-cell" style="width:${DW}px">${totalRooms - dayOcc[i]}</div>`;
        header += '</div>';

        header += '<div class="p-header-row stats">';
        for (let i = 0; i < totalDays; i++) {
            const occ = dayOcc[i];
            header += `<div class="p-stats-cell${occ > 0 ? ' highlight' : ''}" style="width:${DW}px">${occ}</div>`;
        }
        header += '</div></div></div>';

        let roomsPanel = '<div class="p-rooms-panel"><div class="p-rooms-inner">';
        floorKeys.forEach((floor) => {
            const RH = getPlannerRowHeight();
            roomsPanel += `<div class="p-floor-left">${t('rooms.floor')} ${floor}</div>`;
            floors[floor].forEach((room) => {
                roomsPanel += `<div class="p-room-left" style="height:${RH}px" onclick="openEditRoom('${room.id}')">
                    <span class="planner-room-status ${room.status}"></span>
                    <span class="planner-room-label">${room.number}</span>
                    <span class="planner-room-type">${room.type.substring(0, 3)}</span>
                </div>`;
            });
        });
        roomsPanel += '</div></div>';

        let grid = '<div class="p-grid-panel"><div class="p-grid-inner">';
        const todayMidnight = new Date();
        todayMidnight.setHours(0, 0, 0, 0);
        const todayIdx = dateToDayIndex(todayMidnight);
        if (todayIdx >= 0 && todayIdx < totalDays) {
            grid += `<div class="planner-today-line" style="left:${todayIdx * DW + DW / 2}px"></div>`;
        }

        floorKeys.forEach((floor) => {
            grid += '<div class="p-grid-floor-row">';
            for (let i = 0; i < totalDays; i++) grid += `<div class="p-floor-cell" style="width:${DW}px"></div>`;
            grid += '</div>';

            floors[floor].forEach((room) => {
                grid += `<div class="p-grid-room-row" style="height:${getPlannerRowHeight()}px" data-room-id="${room.id}">`;
                for (let i = 0; i < totalDays; i++) {
                    const date = dayIndexToDate(i);
                    const dow = date.getDay();
                    let c = 'p-grid-cell';
                    if (formatDate(date) === today) c += ' today-col';
                    else if (dow === 0 || dow === 6) c += ' weekend';
                    grid += `<div class="${c}" style="width:${DW}px" data-day="${i}"></div>`;
                }
                const bookings = (bookingsByRoom[room.id] || []).slice().sort((a, b) => a.startIdx - b.startIdx);
                bookings.forEach((booking, idx) => {
                    const ARROW = 10;
                    const hasNext = idx < bookings.length - 1 && bookings[idx + 1].startIdx <= booking.endIdx;
                    const hasPrev = idx > 0 && bookings[idx - 1].endIdx >= booking.startIdx;
                    const left = booking.startIdx * DW;
                    const width = (booking.endIdx - booking.startIdx) * DW + (hasNext ? ARROW : 0);
                    const label = escapeHtml(booking.res.groupName);
                    const cls = `planner-res-bar ${booking.res.status}${hasPrev ? ' bar-has-prev' : ''}`;
                    const nights = Math.max(1, booking.endIdx - booking.startIdx);
                    const resGuests = getGuests().filter((guest) => guest.reservationId === booking.res.id).length;
                    const statusLabel = booking.res.status.charAt(0).toUpperCase() + booking.res.status.slice(1);
                    const expirationInfo = booking.res.status === 'pending' && booking.res.expiration ? ` · ${t('cal.expires')} ${formatDateDisplay(booking.res.expiration)}` : '';
                    const tipData = `${label}||${formatDateDisplay(booking.res.checkin)} → ${formatDateDisplay(booking.res.checkout)}||${nights} ${nights > 1 ? t('cal.nightsPlural') : t('cal.nights')} · ${booking.res.roomCount} ${booking.res.roomCount !== 1 ? t('cal.roomPlural') : t('cal.roomSingular')} · ${resGuests} ${resGuests !== 1 ? t('cal.guestPlural') : t('cal.guestSingular')}||${statusLabel}${expirationInfo}${booking.res.price ? ' · €' + Number(booking.res.price).toLocaleString() : ''}`;
                    grid += `<div class="${cls}" style="left:${left}px;width:${width}px;z-index:${2 + idx}" onclick="openReservationDetail('${booking.res.id}')" data-tip="${tipData}" onmouseenter="showBarTooltip(event)" onmouseleave="hideBarTooltip()"><span class="bar-label">${label}</span></div>`;
                });
                grid += '</div>';
            });
        });

        grid += '</div></div>';
        return corner + header + roomsPanel + grid;
    }

    function onPlannerScroll() {
        const {
            getPlannerExtendThreshold,
            getPlannerGridEl,
            getPlannerHeaderEl,
            getPlannerIsExtending,
            getPlannerRoomsEl,
            setPlannerIsExtending
        } = requireDeps();
        const plannerGridEl = getPlannerGridEl();
        const plannerHeaderEl = getPlannerHeaderEl();
        const plannerRoomsEl = getPlannerRoomsEl();
        const headerInner = plannerHeaderEl.querySelector('.p-header-inner');
        const roomsInner = plannerRoomsEl.querySelector('.p-rooms-inner');
        if (headerInner) headerInner.style.transform = `translateX(${-plannerGridEl.scrollLeft}px)`;
        if (roomsInner) roomsInner.style.transform = `translateY(${-plannerGridEl.scrollTop}px)`;
        if (getPlannerIsExtending()) return;

        const sl = plannerGridEl.scrollLeft;
        const maxScroll = plannerGridEl.scrollWidth - plannerGridEl.clientWidth;
        if (sl >= maxScroll - getPlannerExtendThreshold()) {
            setPlannerIsExtending(true);
            extendPlanner('right');
            setPlannerIsExtending(false);
        }
        if (sl <= getPlannerExtendThreshold()) {
            setPlannerIsExtending(true);
            extendPlanner('left');
            setPlannerIsExtending(false);
        }
        updateMonthBarFromScroll();
    }

    function extendPlanner(dir) {
        const {
            getPlannerDayWidth,
            getPlannerExtendChunk,
            getPlannerGridEl,
            getPlannerHeaderEl,
            getPlannerRoomsEl,
            getPlannerStartDate,
            getPlannerTotalDays,
            initGridDrag,
            setPlannerGridEl,
            setPlannerHeaderEl,
            setPlannerRoomsEl,
            setPlannerStartDate,
            setPlannerTotalDays
        } = requireDeps();
        const chunk = getPlannerExtendChunk();
        const currentGrid = getPlannerGridEl();
        const slBefore = currentGrid.scrollLeft;
        const stBefore = currentGrid.scrollTop;

        if (dir === 'left') {
            const start = new Date(getPlannerStartDate());
            start.setDate(start.getDate() - chunk);
            setPlannerStartDate(start);
        }
        setPlannerTotalDays(getPlannerTotalDays() + chunk);

        const board = document.getElementById('plannerBoard');
        currentGrid.removeEventListener('scroll', onPlannerScroll);
        board.innerHTML = buildBoardHTML();
        const plannerGridEl = board.querySelector('.p-grid-panel');
        const plannerHeaderEl = board.querySelector('.p-header-panel');
        const plannerRoomsEl = board.querySelector('.p-rooms-panel');
        setPlannerGridEl(plannerGridEl);
        setPlannerHeaderEl(plannerHeaderEl);
        setPlannerRoomsEl(plannerRoomsEl);
        plannerGridEl.addEventListener('scroll', onPlannerScroll);
        initGridDrag();

        plannerGridEl.scrollLeft = dir === 'left' ? slBefore + chunk * getPlannerDayWidth() : slBefore;
        plannerGridEl.scrollTop = stBefore;
        const headerInner = plannerHeaderEl.querySelector('.p-header-inner');
        const roomsInner = plannerRoomsEl.querySelector('.p-rooms-inner');
        if (headerInner) headerInner.style.transform = `translateX(${-plannerGridEl.scrollLeft}px)`;
        if (roomsInner) roomsInner.style.transform = `translateY(${-plannerGridEl.scrollTop}px)`;
    }

    function updateMonthBarFromScroll() {
        const { getPlannerDayWidth, getPlannerGridEl, getPlannerTotalDays } = requireDeps();
        const plannerGridEl = getPlannerGridEl();
        if (!plannerGridEl) return;
        const centerX = plannerGridEl.scrollLeft + plannerGridEl.clientWidth / 2;
        const centerIdx = Math.floor(centerX / getPlannerDayWidth());
        if (centerIdx < 0 || centerIdx >= getPlannerTotalDays()) return;
        const centerDate = dayIndexToDate(centerIdx);
        const year = centerDate.getFullYear();
        const month = centerDate.getMonth();
        document.querySelectorAll('.planner-month-btn').forEach((button) => {
            button.classList.toggle('active', button.dataset.year === String(year) && button.dataset.month === String(month));
        });
    }

    function renderPlannerMonthBar() {
        const { t } = requireDeps();
        const bar = document.getElementById('plannerMonthBar');
        const monthNames = t('months.short');
        const now = new Date();
        let html = '';
        for (let off = -12; off <= 12; off++) {
            const d = new Date(now.getFullYear(), now.getMonth() + off, 1);
            const year = d.getFullYear();
            const month = d.getMonth();
            html += `<button class="planner-month-btn" data-year="${year}" data-month="${month}" onclick="jumpToMonth(${year},${month})">${monthNames[month]} ${String(year).substring(2)}</button>`;
        }
        bar.innerHTML = html;
        updateMonthBarFromScroll();
    }

    function jumpToMonth(year, month) {
        const { getPlannerDayWidth, getPlannerGridEl, getPlannerTotalDays, renderCalendar, setCalendarDate } = requireDeps();
        const plannerGridEl = getPlannerGridEl();
        if (!plannerGridEl) return;
        const targetDate = new Date(year, month, 1);
        const idx = dateToDayIndex(targetDate);
        if (idx < 0 || idx >= getPlannerTotalDays()) {
            setCalendarDate(targetDate);
            renderCalendar();
            return;
        }
        plannerGridEl.scrollTo({ left: Math.max(0, idx * getPlannerDayWidth() - 100), behavior: 'smooth' });
    }

    function calendarPrev() {
        const { getPlannerDayWidth, getPlannerGridEl } = requireDeps();
        const plannerGridEl = getPlannerGridEl();
        if (!plannerGridEl) return;
        plannerGridEl.scrollBy({ left: -30 * getPlannerDayWidth(), behavior: 'smooth' });
    }

    function calendarNext() {
        const { getPlannerDayWidth, getPlannerGridEl } = requireDeps();
        const plannerGridEl = getPlannerGridEl();
        if (!plannerGridEl) return;
        plannerGridEl.scrollBy({ left: 30 * getPlannerDayWidth(), behavior: 'smooth' });
    }

    function calendarToday() {
        const { getPlannerDayWidth, getPlannerGridEl, getPlannerTotalDays, renderCalendar, setCalendarDate } = requireDeps();
        const plannerGridEl = getPlannerGridEl();
        if (!plannerGridEl) {
            setCalendarDate(new Date());
            renderCalendar();
            return;
        }
        const idx = dateToDayIndex(new Date());
        if (idx < 0 || idx >= getPlannerTotalDays()) {
            setCalendarDate(new Date());
            renderCalendar();
            return;
        }
        plannerGridEl.scrollTo({ left: Math.max(0, idx * getPlannerDayWidth() - plannerGridEl.clientWidth / 3), behavior: 'smooth' });
    }

    global.GroupStayPlanner = {
        buildBoardHTML,
        calendarNext,
        calendarPrev,
        calendarToday,
        dateToDayIndex,
        dayIndexToDate,
        extendPlanner,
        getPlannerFloors,
        getPlannerRoomBookings,
        getPlannerSortedRooms,
        init(nextDeps) {
            deps = nextDeps;
        },
        jumpToMonth,
        onPlannerScroll,
        refreshCalendar,
        renderCalendar,
        renderExpiringBanner,
        renderPlannerMonthBar,
        updateMonthBarFromScroll
    };
})(window);
