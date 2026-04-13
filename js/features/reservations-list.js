(function initReservationsListFeature(global) {
    let deps = null;

    function requireDeps() {
        if (!deps) throw new Error('GroupStayReservationsList not initialized');
        return deps;
    }

    function renderReservations() {
        const {
            escapeHtml,
            formatDateDisplay,
            getCurrentFilter,
            getReservations,
            nightsBetween,
            t
        } = requireDeps();

        const search = (document.getElementById('searchReservations')?.value || '').toLowerCase();
        let filtered = getReservations();

        if (getCurrentFilter() !== 'all') {
            filtered = filtered.filter((reservation) => reservation.status === getCurrentFilter());
        }

        if (search) {
            filtered = filtered.filter((reservation) =>
                (reservation.groupName || '').toLowerCase().includes(search) ||
                (reservation.organizer || '').toLowerCase().includes(search) ||
                (reservation.phone || '').toLowerCase().includes(search) ||
                (reservation.email || '').toLowerCase().includes(search)
            );
        }

        filtered.sort((a, b) => new Date(a.checkin) - new Date(b.checkin));

        const list = document.getElementById('reservationsList');
        if (!list) return;

        if (filtered.length === 0) {
            list.innerHTML = `
                <div class="empty-state">
                    <p>${t('res.noReservations')}</p>
                </div>
            `;
            return;
        }

        list.innerHTML = filtered.map((reservation) => {
            const nights = nightsBetween(reservation.checkin, reservation.checkout);
            const statusLabel = reservation.status.replace('-', ' ');
            const isIndividual = reservation.resType === 'individual';
            const subtitle = isIndividual
                ? (reservation.organizer || reservation.phone || reservation.email || '')
                : (reservation.organizer || '');
            const typeBadge = isIndividual
                ? `<span class="res-type-badge individual">${t('res.typeIndividual')}</span>`
                : `<span class="res-type-badge group">${t('res.typeGroup')}</span>`;

            return `
                <div class="reservation-card" onclick="openReservationDetail('${reservation.id}')">
                    <div class="res-color-bar ${reservation.status}"></div>
                    <div class="res-info">
                        <div class="res-group-name">${escapeHtml(reservation.groupName)}${typeBadge}</div>
                        <div class="res-organizer">${escapeHtml(subtitle)}</div>
                    </div>
                    <div class="res-meta">
                        <div class="res-meta-item">
                            <span class="res-meta-value">${reservation.guestCount}</span>
                            <span class="res-meta-label">${t('res.guests')}</span>
                        </div>
                        <div class="res-meta-item">
                            <span class="res-meta-value">${reservation.roomCount}</span>
                            <span class="res-meta-label">${t('res.rooms')}</span>
                        </div>
                        <div class="res-meta-item">
                            <span class="res-meta-value">${nights}</span>
                            <span class="res-meta-label">${t('res.nights')}</span>
                        </div>
                    </div>
                    <div class="res-dates">${formatDateDisplay(reservation.checkin)} &rarr; ${formatDateDisplay(reservation.checkout)}</div>
                    <span class="status-badge ${reservation.status}">${statusLabel}</span>
                </div>
            `;
        }).join('');
    }

    function setReservationFilter(filter, el) {
        const { setCurrentFilter } = requireDeps();
        setCurrentFilter(filter);
        document.querySelectorAll('#page-reservations .chip').forEach((chip) => chip.classList.remove('active'));
        el.classList.add('active');
        renderReservations();
    }

    function filterReservations() {
        renderReservations();
    }

    global.GroupStayReservationsList = {
        init(nextDeps) {
            deps = nextDeps;
        },
        renderReservations,
        setReservationFilter,
        filterReservations
    };
})(window);
