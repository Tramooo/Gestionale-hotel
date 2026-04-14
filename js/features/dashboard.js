(function initDashboardFeature(global) {
    let deps = null;

    function requireDeps() {
        if (!deps) throw new Error('GroupStayDashboard not initialized');
        return deps;
    }

    function parseDate(dateStr) {
        return new Date(`${dateStr}T00:00:00`);
    }

    function addDays(date, days) {
        const next = new Date(date);
        next.setDate(next.getDate() + days);
        return next;
    }

    function getStatusLabel(status, t) {
        if (status === 'checked-in') return t('dash.checkedIn');
        if (status === 'confirmed') return t('res.confirmed');
        if (status === 'pending') return t('res.pending');
        if (status === 'cancelled') return t('res.cancelled');
        return status;
    }

    function setText(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    }

    function renderTrendChart(days, totalRooms, t) {
        const trendEl = document.getElementById('occupancy-trend-chart');
        if (!trendEl) return;

        const hasData = totalRooms > 0 && days.some((day) => day.rooms > 0 || day.guests > 0);
        if (!days.length || !hasData) {
            trendEl.innerHTML = `<div class="empty-state small"><p>${t('dash.noTrendData')}</p></div>`;
            return;
        }

        trendEl.innerHTML = days.map((day) => {
            const height = totalRooms > 0 ? Math.max(8, Math.round((day.rooms / totalRooms) * 100)) : 8;
            return `
                <div class="trend-day">
                    <div class="trend-bar-stack">
                        <div class="trend-bar-track">
                            <div class="trend-bar-fill" style="height:${height}%"></div>
                        </div>
                    </div>
                    <div class="trend-day-meta">
                        <strong>${day.rooms}</strong>
                        <span>${day.guests} ${t('dash.guests')}</span>
                    </div>
                    <div class="trend-day-label">${day.label}</div>
                </div>
            `;
        }).join('');
    }

    function renderReservationMix(statusData, totalReservations, t) {
        const mixEl = document.getElementById('reservation-mix');
        if (!mixEl) return;

        if (totalReservations === 0) {
            mixEl.innerHTML = `<div class="empty-state small"><p>${t('dash.noReservationMix')}</p></div>`;
            return;
        }

        mixEl.innerHTML = statusData.map((item) => {
            const width = totalReservations > 0 ? Math.round((item.count / totalReservations) * 100) : 0;
            return `
                <div class="status-row">
                    <div class="status-row-head">
                        <div class="status-row-title">
                            <span class="status-dot ${item.status}"></span>
                            <span class="status-label">${item.label}</span>
                        </div>
                        <span class="status-count">${item.count} &middot; ${t('dash.percentOfTotal', { percent: width })}</span>
                    </div>
                    <div class="status-track">
                        <div class="status-fill ${item.status}" style="width:${width}%"></div>
                    </div>
                </div>
            `;
        }).join('');
    }

    function renderDashboard() {
        const {
            computeRoomStatuses,
            escapeHtml,
            formatDate,
            formatDateDisplay,
            getCurrentLang,
            getReservations,
            getRooms,
            nightsBetween,
            openReservationDetail,
            t
        } = requireDeps();

        computeRoomStatuses();

        const reservations = getReservations();
        const rooms = getRooms();
        const liveReservations = reservations.filter((reservation) => reservation.status !== 'cancelled');
        const todayStr = formatDate(new Date());
        const inHouseReservations = liveReservations.filter((reservation) => reservation.checkin <= todayStr && reservation.checkout > todayStr);
        const activeGroups = inHouseReservations;
        const todayGuests = inHouseReservations.reduce((sum, reservation) => sum + (reservation.guestCount || 0), 0);
        const occupiedRooms = rooms.filter((room) => room.status === 'occupied').length;
        const todayCheckins = liveReservations.filter((reservation) => reservation.checkin === todayStr);
        const todayCheckouts = liveReservations.filter((reservation) => reservation.checkout === todayStr);
        const pendingReservations = reservations.filter((reservation) => reservation.status === 'pending');

        setText('stat-active-groups', activeGroups.length);
        setText('stat-total-guests', todayGuests);
        setText('stat-rooms-occupied', `${occupiedRooms}/${rooms.length}`);
        setText('stat-arrivals-today', todayCheckins.length);
        setText('stat-departures-today', todayCheckouts.length);
        setText('stat-pending-reservations', pendingReservations.length);

        const totalRooms = rooms.length;
        const available = rooms.filter((room) => room.status === 'available').length;
        const maintenance = rooms.filter((room) => room.status === 'maintenance').length;
        const occupied = rooms.filter((room) => room.status === 'occupied').length;
        const percent = totalRooms > 0 ? Math.round((occupied / totalRooms) * 100) : 0;
        const circumference = 2 * Math.PI * 52;
        const offset = circumference - (percent / 100) * circumference;

        document.getElementById('occupancy-circle').setAttribute('stroke-dashoffset', offset);
        setText('occupancy-percent', percent + '%');
        setText('legend-occupied', occupied);
        setText('legend-available', available);
        setText('legend-maintenance', maintenance);

        const upcoming = liveReservations
            .filter((reservation) => (reservation.status === 'confirmed' || reservation.status === 'pending') && reservation.checkin >= todayStr)
            .sort((a, b) => new Date(a.checkin) - new Date(b.checkin))
            .slice(0, 5);

        const checkinEl = document.getElementById('upcoming-checkins');
        if (upcoming.length === 0) {
            checkinEl.innerHTML = `<div class="empty-state small"><p>${t('dash.noUpcoming')}</p></div>`;
        } else {
            checkinEl.innerHTML = upcoming.map((reservation) => `
                <div class="checkin-item" onclick="openReservationDetail('${reservation.id}')">
                    <div class="checkin-dot" style="background: ${reservation.status === 'confirmed' ? 'var(--green)' : 'var(--orange)'}"></div>
                    <div class="checkin-info">
                        <div class="checkin-name">${escapeHtml(reservation.groupName)}</div>
                        <div class="checkin-detail">${reservation.guestCount} ${t('dash.guests')} &middot; ${reservation.roomCount} ${t('res.rooms')}</div>
                    </div>
                    <div class="checkin-date">${formatDateDisplay(reservation.checkin)}</div>
                </div>
            `).join('');
        }

        const activityEl = document.getElementById('today-activity');
        const activities = [];

        todayCheckins.forEach((reservation) => {
            activities.push(`
                <div class="activity-item">
                    <div class="activity-icon checkin">&#8593;</div>
                    <div>
                        <div class="activity-text"><strong>${escapeHtml(reservation.groupName)}</strong> ${t('dash.checkingIn')}</div>
                        <div class="activity-time">${reservation.guestCount} ${t('dash.guests')}</div>
                    </div>
                </div>
            `);
        });

        todayCheckouts.forEach((reservation) => {
            activities.push(`
                <div class="activity-item">
                    <div class="activity-icon checkout">&#8595;</div>
                    <div>
                        <div class="activity-text"><strong>${escapeHtml(reservation.groupName)}</strong> ${t('dash.checkingOut')}</div>
                        <div class="activity-time">${reservation.guestCount} ${t('dash.guests')}</div>
                    </div>
                </div>
            `);
        });

        if (activities.length === 0) {
            activityEl.innerHTML = `<div class="empty-state small"><p>${t('dash.noActivity')}</p></div>`;
        } else {
            activityEl.innerHTML = activities.join('');
        }

        const lang = getCurrentLang ? getCurrentLang() : 'it';
        const locale = lang === 'en' ? 'en-GB' : 'it-IT';
        const next7Days = Array.from({ length: 7 }, (_, index) => {
            const date = addDays(parseDate(todayStr), index);
            const dayStr = formatDate(date);
            const dayReservations = liveReservations.filter((reservation) => reservation.checkin <= dayStr && reservation.checkout > dayStr);
            const roomsBooked = dayReservations.reduce((sum, reservation) => sum + (reservation.roomCount || 0), 0);
            const guestsBooked = dayReservations.reduce((sum, reservation) => sum + (reservation.guestCount || 0), 0);
            const dayMovements = liveReservations.filter((reservation) => reservation.checkin === dayStr || reservation.checkout === dayStr).length;

            return {
                date,
                label: date.toLocaleDateString(locale, { weekday: 'short', day: 'numeric' }),
                dayStr,
                guests: guestsBooked,
                movements: dayMovements,
                rooms: roomsBooked
            };
        });

        renderTrendChart(next7Days, totalRooms, t);

        const peakDay = next7Days.reduce((best, entry) => {
            if (!best) return entry;
            if (entry.rooms > best.rooms) return entry;
            if (entry.rooms === best.rooms && entry.movements > best.movements) return entry;
            return best;
        }, null);

        const peakOccupancy = peakDay && totalRooms > 0 ? Math.round((peakDay.rooms / totalRooms) * 100) : 0;
        const peakGuests = next7Days.reduce((max, entry) => Math.max(max, entry.guests), 0);
        setText('stat-peak-occupancy', `${peakOccupancy}%`);
        setText('stat-peak-guests', peakGuests);
        setText('stat-busiest-day', peakDay ? peakDay.label : '-');

        const statusOrder = ['checked-in', 'confirmed', 'pending', 'cancelled'];
        const statusData = statusOrder.map((status) => ({
            count: reservations.filter((reservation) => reservation.status === status).length,
            label: getStatusLabel(status, t),
            status
        }));
        renderReservationMix(statusData, reservations.length, t);

        const avgStay = liveReservations.length > 0
            ? (liveReservations.reduce((sum, reservation) => sum + nightsBetween(reservation.checkin, reservation.checkout), 0) / liveReservations.length)
            : 0;
        const arrivalsNextWeek = liveReservations.filter((reservation) => reservation.checkin >= todayStr && reservation.checkin <= next7Days[next7Days.length - 1].dayStr).length;
        const departuresNextWeek = liveReservations.filter((reservation) => reservation.checkout >= todayStr && reservation.checkout <= next7Days[next7Days.length - 1].dayStr).length;

        setText('stat-average-stay', t('dash.nightsShort', { count: avgStay > 0 ? avgStay.toFixed(1) : '0' }));
        setText('stat-arrivals-next-week', arrivalsNextWeek);
        setText('stat-departures-next-week', departuresNextWeek);
    }

    global.GroupStayDashboard = {
        init(nextDeps) {
            deps = nextDeps;
        },
        renderDashboard
    };
})(window);
