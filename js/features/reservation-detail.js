(function initReservationDetailFeature(global) {
    let deps = null;

    function requireDeps() {
        if (!deps) throw new Error('GroupStayReservationDetail not initialized');
        return deps;
    }

    function openReservationDetail(id) {
        const {
            calcReservationRevenue,
            escapeHtml,
            formatDateDisplay,
            getReservations,
            getRooms,
            loadReservationFiles,
            loadReservationMenus,
            nightsBetween,
            openModal,
            t
        } = requireDeps();

        const reservation = getReservations().find((entry) => entry.id === id);
        if (!reservation) return;

        document.getElementById('detailGroupName').textContent = reservation.groupName;
        const statusLabel = reservation.status.replace('-', ' ');
        const badge = document.getElementById('detailStatusBadge');
        badge.textContent = statusLabel;
        badge.className = `status-badge ${reservation.status}`;

        const nights = nightsBetween(reservation.checkin, reservation.checkout);
        const body = document.getElementById('reservationDetailBody');

        body.innerHTML = `
            <div class="detail-toolbar">
                <button class="btn btn-secondary btn-sm" onclick="${reservation.resType === 'individual' ? `openEditIndividualReservation('${reservation.id}')` : `openEditReservation('${reservation.id}')`}">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    ${t('detail.edit')}
                </button>
                ${reservation.resType !== 'individual' ? `
                <button class="btn btn-secondary btn-sm" onclick="openRoomAssignment('${reservation.id}')">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
                    ${t('detail.roomPlanner')}
                </button>` : ''}
                <button class="btn btn-secondary btn-sm" onclick="openGuestsList('${reservation.id}')">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                    ${t('detail.manageGuests')}
                </button>
                <button class="btn btn-ghost btn-sm detail-delete-btn" onclick="deleteReservation('${reservation.id}')">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    ${t('detail.delete')}
                </button>
            </div>

            <div class="detail-info-card">
                <div class="detail-info-grid">
                    ${reservation.resType === 'individual' && (reservation.phone || reservation.organizer) ? `
                    <div class="detail-info-item">
                        <span class="detail-info-label">${t('ind.phone')}</span>
                        <span class="detail-info-value">${escapeHtml(reservation.phone || reservation.organizer)}</span>
                    </div>` : ''}
                    ${reservation.resType === 'individual' && reservation.email ? `
                    <div class="detail-info-item">
                        <span class="detail-info-label">${t('ind.email')}</span>
                        <span class="detail-info-value">${escapeHtml(reservation.email)}</span>
                    </div>` : ''}
                    <div class="detail-info-item">
                        <span class="detail-info-label">${t('res.checkin')}</span>
                        <span class="detail-info-value">${formatDateDisplay(reservation.checkin)}</span>
                    </div>
                    <div class="detail-info-item">
                        <span class="detail-info-label">${t('res.checkout')}</span>
                        <span class="detail-info-value">${formatDateDisplay(reservation.checkout)}</span>
                    </div>
                    ${reservation.resType === 'individual' && reservation.roomIds && reservation.roomIds.length > 0 ? (() => {
                        const room = getRooms().find((entry) => entry.id === reservation.roomIds[0]);
                        return room ? `<div class="detail-info-item">
                            <span class="detail-info-label">${t('ind.room')}</span>
                            <span class="detail-info-value">Camera ${escapeHtml(room.number)}</span>
                        </div>` : '';
                    })() : `<div class="detail-info-item">
                        <span class="detail-info-label">${t('res.rooms')}</span>
                        <span class="detail-info-value">${reservation.roomCount}</span>
                    </div>`}
                    <div class="detail-info-item">
                        <span class="detail-info-label">${t('res.nights')}</span>
                        <span class="detail-info-value">${nights}</span>
                    </div>
                    ${reservation.resType !== 'individual' ? `
                    <div class="detail-info-item">
                        <span class="detail-info-label">${t('res.guests')}</span>
                        <span class="detail-info-value">${reservation.guestCount || 0}</span>
                    </div>` : ''}
                    <div class="detail-info-item">
                        <span class="detail-info-label">${reservation.resType === 'individual' ? t('ind.pricePerNight') : t('res.pricePerPerson')}</span>
                        <span class="detail-info-value">&euro;${(reservation.pricePerPerson || 0).toLocaleString()}</span>
                    </div>
                    ${reservation.resType !== 'individual' && reservation.gratuity ? `<div class="detail-info-item">
                        <span class="detail-info-label">${t('res.gratuity')}</span>
                        <span class="detail-info-value">${reservation.gratuity} (${reservation.gratuity > 0 ? Math.floor(reservation.guestCount / reservation.gratuity) : 0} ${t('res.freeGuests')})</span>
                    </div>` : ''}
                    ${reservation.resType !== 'individual' ? `<div class="detail-info-item">
                        <span class="detail-info-label">Piano Pasti</span>
                        <span class="detail-info-value"><span class="meal-plan-badge meal-plan-${reservation.mealPlan || 'BB'}">${reservation.mealPlan || 'BB'}</span></span>
                    </div>` : ''}
                    ${reservation.resType !== 'individual' ? `<div class="detail-info-item">
                        <span class="detail-info-label">Presenze</span>
                        <span class="detail-info-value">${(() => { const gc = reservation.guestCount || 0; const fg = reservation.gratuity > 0 ? Math.floor(gc / reservation.gratuity) : 0; return Math.max(0, gc - fg) * nights; })()}</span>
                    </div>` : ''}
                    <div class="detail-info-item detail-info-price">
                        <span class="detail-info-label">${t('res.totalPrice')}</span>
                        <span class="detail-info-value">&euro;${calcReservationRevenue(reservation).toLocaleString()}</span>
                    </div>
                    ${reservation.status === 'pending' && reservation.expiration ? `<div class="detail-info-item">
                        <span class="detail-info-label">${t('detail.expires')}</span>
                        <span class="detail-info-value">${formatDateDisplay(reservation.expiration)}</span>
                    </div>` : ''}
                </div>
            </div>

            <div class="detail-notes-section">
                <span class="detail-info-label">${t('res.notes')}</span>
                <textarea id="detailNotesField" class="form-control" rows="4" placeholder="${t('detail.addNotes')}">${escapeHtml(reservation.notes || '')}</textarea>
                <button class="btn btn-sm btn-primary" onclick="saveDetailNotes('${reservation.id}')">${t('detail.saveNotes')}</button>
            </div>

            ${reservation.resType !== 'individual' ? `
            <div class="detail-menu-section">
                <div class="detail-menu-header">
                    <div class="detail-menu-title-row">
                        <div class="menu-title-meta">
                            <span class="detail-info-label">Menu condiviso</span>
                            <span class="meal-plan-badge meal-plan-${reservation.mealPlan || 'BB'}">${reservation.mealPlan || 'BB'}</span>
                        </div>
                        <div class="menu-title-actions">
                            <span id="menuSaveStatus" class="menu-save-status" data-state="idle">Salvataggio automatico attivo</span>
                            <button class="btn btn-sm btn-primary" onclick="saveAllMenus('${reservation.id}')">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                                Salva menu
                            </button>
                            <button class="btn btn-sm btn-secondary" onclick="printMenu('${reservation.id}')">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                                Stampa Menu
                            </button>
                        </div>
                    </div>
                </div>
                <div id="menuContainer" class="menu-container">
                    <div class="menu-loading">Caricamento menu...</div>
                </div>
            </div>` : ''}

            <div class="detail-files-section">
                <div class="detail-files-header">
                    <span class="detail-info-label">${t('detail.files')}</span>
                    <button class="btn btn-sm btn-secondary" onclick="uploadReservationFile('${reservation.id}')">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                        ${t('detail.uploadFile')}
                    </button>
                </div>
                <div id="reservationFilesContainer" class="files-container">
                    <div class="files-empty">${t('detail.noFiles')}</div>
                </div>
                <span class="files-hint">${t('detail.fileMaxSize')}</span>
            </div>
        `;

        openModal('reservationDetailModal');
        loadReservationFiles(reservation.id);
        if (reservation.resType !== 'individual') loadReservationMenus(reservation);
    }

    async function saveDetailNotes(id) {
        const { API, apiPut, getReservations, showToast, t } = requireDeps();
        const reservation = getReservations().find((entry) => entry.id === id);
        if (!reservation) return;
        reservation.notes = document.getElementById('detailNotesField').value.trim();
        try {
            await apiPut(API.reservations, { ...reservation });
            showToast(t('toast.notesSaved'));
        } catch (err) {
            console.error(err);
            showToast(t('toast.notesSaveFail'), 'error');
        }
    }

    global.GroupStayReservationDetail = {
        init(nextDeps) {
            deps = nextDeps;
        },
        openReservationDetail,
        saveDetailNotes
    };
})(window);
