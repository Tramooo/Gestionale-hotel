(function initGuestsFeature(global) {
    let deps = null;

    function requireDeps() {
        if (!deps) throw new Error('GroupStayGuests not initialized');
        return deps;
    }

    function getGuestMissingFields(guest) {
        const { t } = requireDeps();
        const missing = [];
        if (!guest.firstName) missing.push(t('field.firstName'));
        if (!guest.lastName) missing.push(t('field.lastName'));
        if (!guest.sex) missing.push(t('field.sex'));
        if (!guest.birthDate) missing.push(t('field.birthDate'));
        const isForeignBorn = guest.birthCountry && guest.birthCountry !== '100000100' &&
            !['italia', 'italy'].includes((guest.birthCountry || '').toLowerCase());
        if (!isForeignBorn && !guest.birthComune) missing.push(t('field.birthComune'));
        if (!guest.citizenship) missing.push(t('field.citizenship'));
        if (requiresDocumentFields(guest.guestType) && !guest.residenceComune) missing.push(t('field.residenceComune'));
        if (requiresDocumentFields(guest.guestType) && !guest.docNumber) missing.push(t('field.docNumber'));
        if (requiresDocumentFields(guest.guestType) && !guest.docType) missing.push(t('field.docType'));
        if (requiresDocumentFields(guest.guestType) && !guest.docIssuedPlace) missing.push(t('field.docIssuedPlace'));
        return missing;
    }

    function openGuestsList(reservationId) {
        const {
            escapeHtml,
            getGuests,
            getInitials,
            getReservations,
            getRooms,
            openModal,
            t
        } = requireDeps();
        const reservation = getReservations().find((entry) => entry.id === reservationId);
        if (!reservation) return;

        const reservationGuests = getGuests().filter((guest) => guest.reservationId === reservationId);
        const hasGroupTypes = reservationGuests.some((guest) => guest.guestType === '17' || guest.guestType === '18');
        const isGroup = hasGroupTypes || reservationGuests.length > 1;

        let totalErrors = 0;
        reservationGuests.forEach((guest) => { totalErrors += getGuestMissingFields(guest).length; });

        document.getElementById('guestsListTitle').textContent = `${t('detail.manageGuests')} — ${reservation.groupName}`;
        const body = document.getElementById('guestsListBody');

        let guestListHtml = '';
        if (reservationGuests.length === 0) {
            guestListHtml = `<div class="empty-state small"><p>${t('guestList.noGuests')}</p></div>`;
        } else {
            for (const guest of reservationGuests) {
                try {
                    const room = guest.roomId ? getRooms().find((entry) => entry.id === guest.roomId) : null;
                    const missing = getGuestMissingFields(guest);
                    const isLeader = guest.guestType === '17' || guest.guestType === '18';
                    const guestTypeLabel = guest.guestType === '17' ? 'Capofamiglia' : guest.guestType === '18' ? 'Capogruppo' : guest.guestType === '19' ? 'Familiare' : guest.guestType === '20' ? 'Membro' : '';
                    guestListHtml += `
                        <div class="detail-guest-item ${missing.length > 0 ? 'guest-has-errors' : ''}">
                            <div class="guest-avatar">${getInitials((guest.firstName || '') + ' ' + (guest.lastName || ''))}</div>
                            <div class="guest-info" style="flex:1;min-width:0">
                                <div style="display:flex;align-items:center;gap:6px">
                                    <strong>${escapeHtml((guest.firstName || '') + ' ' + (guest.lastName || ''))}</strong>
                                    ${guestTypeLabel ? `<span class="guest-type-badge ${isLeader ? 'leader' : 'member'}">${guestTypeLabel}</span>` : ''}
                                </div>
                                <span>${room ? t('rooms.room') + ' ' + room.number : t('guestList.noRoomAssigned')}${guest.docNumber ? ' &middot; ' + escapeHtml(guest.docType || '') + ': ' + escapeHtml(guest.docNumber) : ''}</span>
                                ${missing.length > 0 ? `<div class="guest-missing-fields">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                                    ${t('guest.missingFields')}: ${missing.join(', ')}
                                </div>` : ''}
                            </div>
                            <div style="display:flex;gap:4px;align-items:center;flex-shrink:0">
                                ${isGroup && !isLeader ? `<button class="btn btn-ghost btn-sm" onclick="setGuestAsLeader('${guest.id}', '${reservationId}')" title="${t('guest.setLeader')}">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                                </button>` : ''}
                                <button class="btn btn-ghost btn-sm" onclick="openEditGuestModal('${guest.id}')">${t('guestList.edit')}</button>
                                <button class="btn btn-ghost btn-sm" onclick="deleteGuest('${guest.id}', '${reservationId}')">${t('guestList.remove')}</button>
                            </div>
                        </div>
                    `;
                } catch (error) {
                    console.error('Error rendering guest', guest.id, error);
                    guestListHtml += `<div class="detail-guest-item" style="color:red">Error rendering guest ${escapeHtml((guest.firstName || '') + ' ' + (guest.lastName || ''))}: ${escapeHtml(error.message)}</div>`;
                }
            }
        }

        body.innerHTML = `
            <div class="schedine-header">
                <div class="schedine-header-left">
                    <h3 style="margin:0">${t('detail.schedine')}</h3>
                    ${totalErrors > 0 ? `
                        <span class="schedine-error-badge" title="${totalErrors} ${t('guest.schedineErrors')}">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                            ${totalErrors} ${t('guest.schedineErrors')}
                        </span>
                    ` : `
                        <span class="schedine-ok-badge">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                            ${t('guest.noErrors')}
                        </span>
                    `}
                </div>
                <div style="display:flex;gap:8px;align-items:center">
                    <button class="btn btn-sm btn-secondary" onclick="alloggiatiTest('${reservationId}')" ${reservationGuests.length === 0 ? 'disabled' : ''}>${t('detail.test')}</button>
                    <button class="btn btn-sm btn-primary" onclick="alloggiatiSend('${reservationId}')" ${totalErrors > 0 || reservationGuests.length === 0 ? 'disabled' : ''}>${t('detail.sendToPolice')}</button>
                </div>
            </div>
            <div id="alloggiatiResults"></div>

            <div class="guest-reg-type" style="margin:16px 0 12px">
                <span style="font-size:12px;font-weight:600;color:var(--text-secondary);margin-right:10px">${t('guest.regType')}:</span>
                <button class="btn btn-sm ${!isGroup ? 'btn-primary' : 'btn-secondary'}" onclick="setAllGuestsType('${reservationId}', 'single')">${t('guest.regSingle')}</button>
                <button class="btn btn-sm ${isGroup ? 'btn-primary' : 'btn-secondary'}" onclick="setAllGuestsType('${reservationId}', 'group')">${t('guest.regGroup')}</button>
            </div>

            <div style="margin-bottom:12px">
                <div class="guest-search-wrap">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input type="text" id="guestSearchInput" placeholder="${t('guestList.search')}" oninput="filterGuestsList()">
                </div>
                <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap">
                    <span style="color:var(--text-secondary)">${reservationGuests.length} ${reservationGuests.length !== 1 ? t('cal.guestPlural') : t('cal.guestSingular')}</span>
                    <div style="display:flex;gap:8px">
                        ${reservationGuests.length > 0 ? `<button class="btn btn-sm btn-ghost detail-delete-btn" onclick="removeAllGuests('${reservationId}')">${t('guestList.removeAll')}</button>` : ''}
                        <button class="btn btn-sm btn-secondary" onclick="openFileImportModal('${reservationId}')">${t('guestList.importFromFile')}</button>
                        <button class="btn btn-sm btn-primary" onclick="openAddGuestModal('${reservationId}')">${t('guestList.addGuest')}</button>
                    </div>
                </div>
            </div>
            <div class="detail-guests-list">
                ${guestListHtml}
            </div>
        `;

        openModal('guestsListModal');
    }

    function filterGuestsList() {
        const query = (document.getElementById('guestSearchInput')?.value || '').toLowerCase();
        document.querySelectorAll('.detail-guests-list .detail-guest-item').forEach((element) => {
            const name = element.querySelector('strong')?.textContent.toLowerCase() || '';
            element.style.display = name.includes(query) ? '' : 'none';
        });
    }

    async function setAllGuestsType(reservationId, mode) {
        const { API, apiPut, getGuests } = requireDeps();
        const reservationGuests = getGuests().filter((guest) => guest.reservationId === reservationId);
        if (reservationGuests.length === 0) return;

        if (mode === 'single') {
            for (const guest of reservationGuests) guest.guestType = '16';
        } else {
            const leaders = reservationGuests.filter((guest) => guest.guestType === '18');
            const leaderId = leaders.length === 1 ? leaders[0].id : reservationGuests[0].id;
            for (const guest of reservationGuests) {
                guest.guestType = guest.id === leaderId ? '18' : '20';
            }
        }

        try {
            await Promise.all(reservationGuests.map((guest) => apiPut(API.guests, guest)));
        } catch (error) {
            console.error(error);
        }

        openGuestsList(reservationId);
    }

    async function setGuestAsLeader(guestId, reservationId) {
        const { API, apiPut, getGuests } = requireDeps();
        const reservationGuests = getGuests().filter((guest) => guest.reservationId === reservationId);
        for (const guest of reservationGuests) {
            guest.guestType = guest.id === guestId ? '18' : '20';
        }
        try {
            await Promise.all(reservationGuests.map((guest) => apiPut(API.guests, guest)));
        } catch (error) {
            console.error(error);
        }

        openGuestsList(reservationId);
    }

    function renderGuests() {
        const {
            escapeHtml,
            formatDateDisplay,
            getGuests,
            getInitials,
            getReservations,
            getRooms,
            t
        } = requireDeps();
        const search = (document.getElementById('searchGuests')?.value || '').toLowerCase();
        let allGuests = getGuests().map((guest) => {
            const reservation = getReservations().find((entry) => entry.id === guest.reservationId);
            const room = guest.roomId ? getRooms().find((entry) => entry.id === guest.roomId) : null;
            return { ...guest, reservation, room };
        });

        if (search) {
            allGuests = allGuests.filter((guest) =>
                (guest.firstName + ' ' + guest.lastName).toLowerCase().includes(search) ||
                (guest.reservation?.groupName || '').toLowerCase().includes(search) ||
                (guest.room?.number || '').toLowerCase().includes(search)
            );
        }

        const tbody = document.getElementById('guestsTableBody');
        if (allGuests.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="empty-state small">${t('guests.noGuests')}</td></tr>`;
            return;
        }

        tbody.innerHTML = allGuests.map((guest) => {
            const statusLabel = guest.reservation ? guest.reservation.status.replace('-', ' ') : t('guests.unknown');
            return `
                <tr>
                    <td>
                        <div class="guest-name-cell">
                            <div class="guest-avatar">${getInitials(guest.firstName + ' ' + guest.lastName)}</div>
                            ${escapeHtml(guest.firstName + ' ' + guest.lastName)}
                        </div>
                    </td>
                    <td>${escapeHtml(guest.reservation?.groupName || '—')}</td>
                    <td>${guest.room ? guest.room.number : '—'}</td>
                    <td>${guest.reservation ? formatDateDisplay(guest.reservation.checkin) : '—'}</td>
                    <td>${guest.reservation ? formatDateDisplay(guest.reservation.checkout) : '—'}</td>
                    <td><span class="status-badge ${guest.reservation?.status || ''}">${statusLabel}</span></td>
                    <td>
                        <button class="btn btn-ghost btn-sm" onclick="deleteGuest('${guest.id}', '${guest.reservationId}')">${t('guestList.remove')}</button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    function filterGuests() {
        renderGuests();
    }

    function buildRoomOptions(selectedRoomId) {
        const { getRooms, t } = requireDeps();
        return [
            `<option value="">${t('guest.unassigned')}</option>`,
            ...getRooms()
                .filter((room) => room.status === 'available' || room.status === 'occupied')
                .map((room) => `<option value="${room.id}" ${room.id === selectedRoomId ? 'selected' : ''}>${t('rooms.room')} ${room.number} (${room.type})</option>`)
        ].join('');
    }

    function clearGuestSearchFields() {
        [
            'guestCitizenshipSearch',
            'guestBirthCountrySearch',
            'guestBirthComuneSearch',
            'guestResidenceComuneSearch',
            'guestDocIssuedPlaceSearch',
            'guestCitizenship',
            'guestBirthCountry',
            'guestBirthComune',
            'guestResidenceComune',
            'guestDocIssuedPlace'
        ].forEach((id) => {
            const element = document.getElementById(id);
            if (element) element.value = '';
        });
    }

    function requiresDocumentFields(guestType) {
        return guestType === '16' || guestType === '17' || guestType === '18';
    }

    function updateGuestTypeUI(guestType) {
        const normalizedType = guestType || '20';
        const leaderFields = document.getElementById('guestLeaderFields');
        const typeDisplay = document.getElementById('guestTypeDisplay');
        const needsDocs = requiresDocumentFields(normalizedType);
        const labels = {
            '16': 'Ospite Singolo (16)',
            '17': 'Capofamiglia (17)',
            '18': 'Capogruppo (18)',
            '19': 'Familiare (19)',
            '20': 'Membro Gruppo (20)'
        };

        if (typeDisplay) typeDisplay.textContent = labels[normalizedType] || labels['20'];
        if (leaderFields) leaderFields.style.display = needsDocs ? '' : 'none';

        [
            'guestResidenceComuneSearch',
            'guestDocType',
            'guestDocNumber',
            'guestDocIssuedPlaceSearch'
        ].forEach((id) => {
            const field = document.getElementById(id);
            if (field) field.required = needsDocs;
        });
    }

    function syncResidenceToDocIssuedPlace() {
        const residenceSearch = document.getElementById('guestResidenceComuneSearch');
        const residenceCode = document.getElementById('guestResidenceComune');
        const docPlaceSearch = document.getElementById('guestDocIssuedPlaceSearch');
        const docPlaceCode = document.getElementById('guestDocIssuedPlace');
        const guestType = document.getElementById('guestType')?.value || '20';
        if (!residenceSearch || !residenceCode || !docPlaceSearch || !docPlaceCode) return;
        if (!requiresDocumentFields(guestType)) return;
        if (!residenceCode.value) return;

        docPlaceCode.value = residenceCode.value;
        docPlaceSearch.value = residenceSearch.value;
    }

    function openAddGuestModal(reservationId) {
        const { closeModal, getGuests, getReservations, loadAlloggiatiTables, openModal } = requireDeps();
        document.getElementById('guestForm').reset();
        document.getElementById('guestId').value = '';
        document.getElementById('guestReservationId').value = reservationId;
        clearGuestSearchFields();
        const reservation = getReservations().find((entry) => entry.id === reservationId);
        const reservationGuests = getGuests().filter((guest) => guest.reservationId === reservationId);
        const defaultType = reservationGuests.length > 0
            ? '20'
            : (reservation?.resType === 'group' || Number(reservation?.guestCount || 0) > 1 ? '18' : '16');
        document.getElementById('guestType').value = defaultType;
        updateGuestTypeUI(defaultType);
        closeModal('guestsListModal');
        openModal('guestModal');
        loadAlloggiatiTables();
    }

    function openEditGuestModal(guestId) {
        const {
            closeModal,
            findLabelFromCode,
            getGuests,
            getAlloggiatiLuoghi,
            getAlloggiatiStati,
            loadAlloggiatiTables,
            openModal
        } = requireDeps();
        const guest = getGuests().find((entry) => entry.id === guestId);
        if (!guest) return;

        document.getElementById('guestForm').reset();
        document.getElementById('guestId').value = guest.id;
        document.getElementById('guestReservationId').value = guest.reservationId;
        document.getElementById('guestFirstName').value = guest.firstName || '';
        document.getElementById('guestLastName').value = guest.lastName || '';
        document.getElementById('guestDocType').value = guest.docType || '';
        document.getElementById('guestDocNumber').value = guest.docNumber || '';
        document.getElementById('guestSex').value = guest.sex || '';
        document.getElementById('guestBirthDate').value = guest.birthDate || '';
        document.getElementById('guestBirthComune').value = guest.birthComune || '';
        document.getElementById('guestBirthProvince').value = guest.birthProvince || '';
        document.getElementById('guestBirthCountry').value = guest.birthCountry || '';
        document.getElementById('guestCitizenship').value = guest.citizenship || '';
        document.getElementById('guestResidenceComune').value = guest.residenceComune || '';
        document.getElementById('guestDocIssuedPlace').value = guest.docIssuedPlace || '';
        document.getElementById('guestType').value = guest.guestType || '16';
        updateGuestTypeUI(guest.guestType || '16');

        const setSearch = (searchId, code, list) => {
            const element = document.getElementById(searchId);
            if (!element) return;
            const name = findLabelFromCode(list, code);
            element.value = name || code || '';
        };

        loadAlloggiatiTables().then(() => {
            setSearch('guestCitizenshipSearch', guest.citizenship, getAlloggiatiStati());
            setSearch('guestBirthCountrySearch', guest.birthCountry, getAlloggiatiStati());
            setSearch('guestBirthComuneSearch', guest.birthComune, getAlloggiatiLuoghi());
            setSearch('guestResidenceComuneSearch', guest.residenceComune, getAlloggiatiLuoghi());
            setSearch('guestDocIssuedPlaceSearch', guest.docIssuedPlace, getAlloggiatiLuoghi());

            const provinceElement = document.getElementById('guestBirthProvince');
            if (provinceElement && !provinceElement.value) {
                const entry = getAlloggiatiLuoghi()?.find((luogo) => luogo.code === guest.birthComune);
                if (entry && entry.prov) provinceElement.value = entry.prov;
            }
        }).catch(() => {
            document.getElementById('guestCitizenshipSearch').value = guest.citizenship || '';
            document.getElementById('guestBirthCountrySearch').value = guest.birthCountry || '';
            document.getElementById('guestBirthComuneSearch').value = guest.birthComune || '';
            document.getElementById('guestResidenceComuneSearch').value = guest.residenceComune || '';
            document.getElementById('guestDocIssuedPlaceSearch').value = guest.docIssuedPlace || '';
        });

        closeModal('guestsListModal');
        openModal('guestModal');
    }

    async function saveGuest(event) {
        const {
            API,
            apiPost,
            apiPut,
            generateId,
            getGuests,
            openReservationDetail,
            setGuests,
            showToast,
            t
        } = requireDeps();
        event.preventDefault();
        const originalGuests = getGuests();

        const id = document.getElementById('guestId').value;
        const guestType = document.getElementById('guestType').value || '20';
        const existingGuest = id ? originalGuests.find((guest) => guest.id === id) : null;
        syncResidenceToDocIssuedPlace();
        const data = {
            reservationId: document.getElementById('guestReservationId').value,
            firstName: document.getElementById('guestFirstName').value.trim(),
            lastName: document.getElementById('guestLastName').value.trim(),
            email: existingGuest?.email || '',
            phone: existingGuest?.phone || '',
            docType: document.getElementById('guestDocType').value,
            docNumber: document.getElementById('guestDocNumber').value.trim(),
            roomId: existingGuest?.roomId || '',
            notes: existingGuest?.notes || '',
            sex: document.getElementById('guestSex').value,
            birthDate: document.getElementById('guestBirthDate').value,
            birthComune: document.getElementById('guestBirthComune').value.trim(),
            birthProvince: document.getElementById('guestBirthProvince').value.trim().toUpperCase(),
            birthCountry: document.getElementById('guestBirthCountry').value.trim(),
            citizenship: document.getElementById('guestCitizenship').value.trim(),
            residenceComune: document.getElementById('guestResidenceComune').value.trim(),
            docIssuedPlace: document.getElementById('guestDocIssuedPlace').value.trim(),
            guestType
        };

        const nextGuests = [...originalGuests];
        try {
            if (id) {
                const idx = nextGuests.findIndex((guest) => guest.id === id);
                if (idx !== -1) nextGuests[idx] = { ...nextGuests[idx], ...data };
                setGuests(nextGuests);
                await apiPut(API.guests, { ...data, id });
                showToast(t('toast.guestUpdated'));
            } else {
                const newGuest = { id: generateId(), ...data };
                nextGuests.push(newGuest);
                setGuests(nextGuests);
                await apiPost(API.guests, newGuest);
                showToast(t('toast.guestAdded'));
            }
        } catch (error) {
            console.error('Save guest error:', error);
            setGuests(originalGuests);
            showToast(t('toast.guestSaveFail') + ': ' + error.message, 'error');
            return;
        }

        requireDeps().closeModal('guestModal');
        openGuestsList(data.reservationId);
        openReservationDetail(data.reservationId);
        renderGuests();
    }

    async function removeAllGuests(reservationId) {
        const {
            API,
            apiDelete,
            getGuests,
            setGuests,
            showToast,
            t
        } = requireDeps();
        if (!confirm(t('confirm.removeAllGuests'))) return;
        const reservationGuests = getGuests().filter((guest) => guest.reservationId === reservationId);
        try {
            await Promise.all(reservationGuests.map((guest) => apiDelete(API.guests, guest.id)));
        } catch (error) {
            console.error(error);
            showToast(t('toast.guestRemoveFail'), 'error');
            return;
        }
        setGuests(getGuests().filter((guest) => guest.reservationId !== reservationId));
        showToast(t('toast.allGuestsRemoved'));
        openGuestsList(reservationId);
    }

    async function deleteGuest(guestId, reservationId) {
        const {
            API,
            apiDelete,
            getGuests,
            openReservationDetail,
            setGuests,
            showToast,
            t
        } = requireDeps();
        if (!confirm(t('confirm.removeGuest'))) return;
        setGuests(getGuests().filter((guest) => guest.id !== guestId));
        try {
            await apiDelete(API.guests, guestId);
        } catch (error) {
            console.error(error);
            showToast(t('toast.guestRemoveFail'), 'error');
            return;
        }
        showToast(t('toast.guestRemoved'));
        openGuestsList(reservationId);
        openReservationDetail(reservationId);
        renderGuests();
    }

    global.GroupStayGuests = {
        init(nextDeps) {
            deps = nextDeps;
        },
        deleteGuest,
        filterGuests,
        filterGuestsList,
        getGuestMissingFields,
        openAddGuestModal,
        openEditGuestModal,
        openGuestsList,
        removeAllGuests,
        renderGuests,
        saveGuest,
        setAllGuestsType,
        setGuestAsLeader
    };
})(window);
