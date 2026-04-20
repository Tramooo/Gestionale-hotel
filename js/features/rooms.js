(function initRoomsFeature(global) {
    let deps = null;

    function requireDeps() {
        if (!deps) throw new Error('GroupStayRooms not initialized');
        return deps;
    }

    function sortRoomsByNumber(a, b) {
        return (a.floor ?? 0) - (b.floor ?? 0) || String(a.number).localeCompare(String(b.number), undefined, { numeric: true });
    }

    function setRoomStatusFieldValue(status) {
        const statusField = document.getElementById('roomStatus');
        if (!statusField) return;
        statusField.value = status === 'maintenance' ? 'maintenance' : 'available';
    }

    function setRoomMaintenanceNoteValue(value) {
        const noteField = document.getElementById('roomMaintenanceNote');
        if (!noteField) return;
        noteField.value = value || '';
    }

    function syncRoomMaintenanceNoteVisibility() {
        const statusField = document.getElementById('roomStatus');
        const noteGroup = document.getElementById('roomMaintenanceNoteGroup');
        if (!statusField || !noteGroup) return;
        noteGroup.hidden = statusField.value !== 'maintenance';
    }

    function bindRoomStatusControl() {
        const statusField = document.getElementById('roomStatus');
        if (!statusField) return;
        statusField.onchange = () => {
            syncRoomMaintenanceNoteVisibility();
            if (statusField.value !== 'maintenance') setRoomMaintenanceNoteValue('');
        };
        syncRoomMaintenanceNoteVisibility();
    }

    function renderRooms() {
        const {
            computeRoomStatuses,
            getCurrentRoomFilter,
            getRooms,
            openEditRoom,
            t
        } = requireDeps();

        computeRoomStatuses();
        const search = (document.getElementById('searchRooms')?.value || '').toLowerCase();
        let filtered = getRooms();

        if (getCurrentRoomFilter() !== 'all') {
            filtered = filtered.filter((room) => room.status === getCurrentRoomFilter());
        }

        if (search) {
            filtered = filtered.filter((room) =>
                room.number.toLowerCase().includes(search) ||
                room.type.toLowerCase().includes(search)
            );
        }

        filtered.sort(sortRoomsByNumber);

        const grid = document.getElementById('roomsGrid');
        if (!grid) return;

        if (filtered.length === 0) {
            grid.innerHTML = `<div class="empty-state"><p>${t('rooms.noRooms')}</p></div>`;
            return;
        }

        grid.innerHTML = filtered.map((room) => `
            <div class="room-card ${room.status}" onclick="openEditRoom('${room.id}')">
                <div class="room-number">${room.number}</div>
                <div class="room-type">
                    <span class="room-status-dot ${room.status}"></span>${room.type}
                </div>
                <div class="room-details">
                    <span class="room-capacity">${room.capacity} ${t('rooms.pax')} &middot; ${t('rooms.floor')} ${room.floor}</span>
                </div>
            </div>
        `).join('');
    }

    function setRoomFilter(filter, el) {
        const { setCurrentRoomFilter } = requireDeps();
        setCurrentRoomFilter(filter);
        document.querySelectorAll('#page-rooms .chip').forEach((chip) => chip.classList.remove('active'));
        el.classList.add('active');
        renderRooms();
    }

    function filterRooms() {
        renderRooms();
    }

    function openNewRoomModal() {
        const { openModal, t } = requireDeps();
        document.getElementById('roomModalTitle').textContent = t('rooms.addRoom');
        document.getElementById('roomForm').reset();
        document.getElementById('roomId').value = '';
        setRoomStatusFieldValue('available');
        setRoomMaintenanceNoteValue('');
        bindRoomStatusControl();
        document.getElementById('deleteRoomBtn').style.display = 'none';
        openModal('roomModal');
    }

    function openEditRoom(id) {
        const { getRooms, openModal, t } = requireDeps();
        const room = getRooms().find((entry) => entry.id === id);
        if (!room) return;

        document.getElementById('roomModalTitle').textContent = `${t('common.edit')} ${t('rooms.room')}`;
        document.getElementById('roomId').value = room.id;
        document.getElementById('roomNumber').value = room.number;
        document.getElementById('roomFloor').value = room.floor;
        document.getElementById('roomType').value = room.type;
        document.getElementById('roomCapacity').value = room.capacity;
        setRoomStatusFieldValue(room.status);
        setRoomMaintenanceNoteValue(room.maintenanceNote);
        bindRoomStatusControl();
        document.getElementById('deleteRoomBtn').style.display = '';
        openModal('roomModal');
    }

    function openMaintenanceRoomModal() {
        const {
            computeRoomStatuses,
            getRooms,
            openModal,
            showToast,
            t
        } = requireDeps();

        computeRoomStatuses();
        const select = document.getElementById('maintenanceRoomId');
        if (!select) return;

        const availableRooms = getRooms()
            .filter((room) => room.status === 'available')
            .slice()
            .sort(sortRoomsByNumber);

        if (!availableRooms.length) {
            showToast(t('toast.noRoomsForMaintenance'), 'error');
            return;
        }

        select.innerHTML = `
            <option value="" disabled selected>${t('rooms.selectRoom')}</option>
            ${availableRooms.map((room) => `
                <option value="${room.id}">${room.number} · ${t('rooms.floor')} ${room.floor}</option>
            `).join('')}
        `;

        document.getElementById('maintenanceForm')?.reset();
        const descriptionField = document.getElementById('maintenanceDescription');
        if (descriptionField) descriptionField.value = '';
        openModal('maintenanceModal');
    }

    async function saveRoom(e) {
        e.preventDefault();

        const {
            API,
            apiPost,
            apiPut,
            closeModal,
            generateId,
            getRooms,
            onRoomsChanged,
            renderDashboard,
            refreshCalendar,
            setRooms,
            showToast,
            t
        } = requireDeps();

        const id = document.getElementById('roomId').value;
        const selectedStatus = document.getElementById('roomStatus').value || 'available';
        const maintenanceNote = (document.getElementById('roomMaintenanceNote').value || '').trim();
        const data = {
            number: document.getElementById('roomNumber').value.trim(),
            floor: parseInt(document.getElementById('roomFloor').value) || 1,
            type: document.getElementById('roomType').value,
            capacity: parseInt(document.getElementById('roomCapacity').value) || 1,
            status: selectedStatus,
            maintenanceNote: selectedStatus === 'maintenance' ? maintenanceNote : ''
        };

        try {
            if (id) {
                const updatedRooms = getRooms().map((room) => room.id === id ? { ...room, ...data } : room);
                setRooms(updatedRooms);
                await apiPut(API.rooms, { ...data, id });
                showToast(t('toast.roomUpdated'));
            } else {
                if (getRooms().some((room) => room.number === data.number)) {
                    showToast(t('toast.roomExists'), 'error');
                    return;
                }
                const newRoom = { id: generateId(), ...data };
                setRooms([...getRooms(), newRoom]);
                await apiPost(API.rooms, newRoom);
                showToast(t('toast.roomAdded'));
            }
        } catch (err) {
            console.error(err);
            showToast(t('toast.roomSaveFail'), 'error');
            return;
        }

        closeModal('roomModal');
        onRoomsChanged();
        renderDashboard();
        refreshCalendar();
    }

    async function saveRoomMaintenance(e) {
        e.preventDefault();

        const {
            API,
            apiPut,
            closeModal,
            computeRoomStatuses,
            getRooms,
            onRoomsChanged,
            refreshCalendar,
            renderDashboard,
            setRooms,
            showToast,
            t
        } = requireDeps();

        computeRoomStatuses();
        const roomId = document.getElementById('maintenanceRoomId').value;
        const maintenanceNote = (document.getElementById('maintenanceDescription').value || '').trim();
        const room = getRooms().find((entry) => entry.id === roomId);
        if (!room || room.status !== 'available') {
            showToast(t('toast.noRoomsForMaintenance'), 'error');
            return;
        }

        const previousRooms = getRooms();
        const updatedRoom = {
            ...room,
            status: 'maintenance',
            maintenanceNote
        };

        try {
            setRooms(previousRooms.map((entry) => entry.id === roomId ? updatedRoom : entry));
            await apiPut(API.rooms, updatedRoom);
        } catch (err) {
            console.error(err);
            setRooms(previousRooms);
            showToast(t('toast.roomSaveFail'), 'error');
            return;
        }

        closeModal('maintenanceModal');
        showToast(t('toast.roomMaintenanceUpdated'));
        onRoomsChanged();
        renderDashboard();
        refreshCalendar();
    }

    async function deleteRoom() {
        const {
            API,
            apiDelete,
            closeModal,
            getGuests,
            getRooms,
            onRoomsChanged,
            refreshCalendar,
            renderDashboard,
            setGuests,
            setRooms,
            showToast,
            t
        } = requireDeps();

        const id = document.getElementById('roomId').value;
        if (!id) return;
        if (!confirm(t('confirm.deleteRoom'))) return;

        setRooms(getRooms().filter((room) => room.id !== id));
        setGuests(getGuests().filter((guest) => guest.roomId !== id));

        try {
            await apiDelete(API.rooms, id);
        } catch (err) {
            console.error(err);
            showToast(t('toast.roomDeleteFail'), 'error');
            return;
        }

        closeModal('roomModal');
        showToast(t('toast.roomDeleted'));
        onRoomsChanged();
        renderDashboard();
        refreshCalendar();
    }

    global.GroupStayRooms = {
        init(nextDeps) {
            deps = nextDeps;
        },
        renderRooms,
        setRoomFilter,
        filterRooms,
        openNewRoomModal,
        openEditRoom,
        openMaintenanceRoomModal,
        saveRoom,
        saveRoomMaintenance,
        deleteRoom
    };
})(window);
