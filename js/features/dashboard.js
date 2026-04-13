(function initDashboardFeature(global) {
    let deps = null;

    function requireDeps() {
        if (!deps) throw new Error('GroupStayDashboard not initialized');
        return deps;
    }

    function renderDashboard() {
        const {
            computeRoomStatuses,
            escapeHtml,
            formatDate,
            formatDateDisplay,
            getReservations,
            getRooms,
            openReservationDetail,
            t
        } = requireDeps();

        computeRoomStatuses();

        const reservations = getReservations();
        const rooms = getRooms();
        const activeGroups = reservations.filter((reservation) => reservation.status === 'confirmed' || reservation.status === 'checked-in');
        const todayStr = formatDate(new Date());
        const todayGuests = activeGroups
            .filter((reservation) => reservation.checkin <= todayStr && reservation.checkout > todayStr)
            .reduce((sum, reservation) => sum + (reservation.guestCount || 0), 0);
        const occupiedRooms = rooms.filter((room) => room.status === 'occupied').length;

        document.getElementById('stat-active-groups').textContent = activeGroups.length;
        document.getElementById('stat-total-guests').textContent = todayGuests;
        document.getElementById('stat-rooms-occupied').textContent = occupiedRooms + '/' + rooms.length;

        const totalRooms = rooms.length;
        const available = rooms.filter((room) => room.status === 'available').length;
        const maintenance = rooms.filter((room) => room.status === 'maintenance').length;
        const occupied = rooms.filter((room) => room.status === 'occupied').length;
        const percent = totalRooms > 0 ? Math.round((occupied / totalRooms) * 100) : 0;
        const circumference = 2 * Math.PI * 52;
        const offset = circumference - (percent / 100) * circumference;

        document.getElementById('occupancy-circle').setAttribute('stroke-dashoffset', offset);
        document.getElementById('occupancy-percent').textContent = percent + '%';
        document.getElementById('legend-occupied').textContent = occupied;
        document.getElementById('legend-available').textContent = available;
        document.getElementById('legend-maintenance').textContent = maintenance;

        const upcoming = reservations
            .filter((reservation) => reservation.status === 'confirmed' || reservation.status === 'pending')
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

        const today = formatDate(new Date());
        const todayCheckins = reservations.filter((reservation) => reservation.checkin === today);
        const todayCheckouts = reservations.filter((reservation) => reservation.checkout === today);
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
    }

    global.GroupStayDashboard = {
        init(nextDeps) {
            deps = nextDeps;
        },
        renderDashboard
    };
})(window);
