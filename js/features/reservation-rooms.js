(function initReservationRoomsFeature(global) {
    let deps = null;

    function requireDeps() {
        if (!deps) throw new Error('GroupStayReservationRooms not initialized');
        return deps;
    }

    function getOccupiedRoomMap(excludeResId) {
        const { getGuests, getReservations } = requireDeps();
        const checkin = document.getElementById('resCheckin').value;
        const checkout = document.getElementById('resCheckout').value;
        const occupied = {};
        if (!checkin || !checkout) return occupied;

        getReservations().forEach((reservation) => {
            if (reservation.id === excludeResId) return;
            if (reservation.status === 'cancelled') return;
            if (reservation.checkin < checkout && reservation.checkout > checkin) {
                const roomIds = reservation.roomIds && reservation.roomIds.length > 0
                    ? reservation.roomIds
                    : getGuests()
                        .filter((guest) => guest.reservationId === reservation.id && guest.roomId)
                        .map((guest) => guest.roomId);
                roomIds.forEach((id) => { occupied[id] = reservation.groupName; });
            }
        });

        return occupied;
    }

    function populateRoomChecklist(selectedRoomIds, excludeResId) {
        const { escapeHtml, getRooms, t } = requireDeps();
        const checklist = document.getElementById('resRoomChecklist');
        if (!checklist) return;

        const sortedRooms = [...getRooms()].sort((a, b) => a.floor !== b.floor ? a.floor - b.floor : parseInt(a.number) - parseInt(b.number));
        const selected = new Set(selectedRoomIds || []);
        const occupiedMap = getOccupiedRoomMap(excludeResId);

        let html = '';
        let currentFloor = null;
        sortedRooms.forEach((room) => {
            if (room.floor !== currentFloor) {
                currentFloor = room.floor;
                const floorRooms = sortedRooms.filter((entry) => entry.floor === room.floor);
                const availableFloorRooms = floorRooms.filter((entry) => !occupiedMap[entry.id]);
                const allChecked = availableFloorRooms.length > 0 && availableFloorRooms.every((entry) => selected.has(entry.id));
                html += `<label class="room-check-floor-header"><input type="checkbox" data-floor="${room.floor}" ${allChecked ? 'checked' : ''} onchange="toggleFloorCheckboxes(this)"> ${t('rooms.floor')} ${room.floor}</label>`;
            }

            const isOccupied = !!occupiedMap[room.id];
            const checked = selected.has(room.id) && !isOccupied;

            if (isOccupied) {
                html += `
                    <label class="room-check-item occupied" title="${escapeHtml(occupiedMap[room.id])}">
                        <input type="checkbox" value="${room.id}" disabled>
                        <div class="room-check-info">
                            <span class="room-check-number">${room.number}</span>
                            <span class="room-check-type">${room.type} &middot; ${room.capacity} ${t('rooms.pax')}</span>
                        </div>
                        <span class="room-check-occupied">${escapeHtml(occupiedMap[room.id])}</span>
                    </label>`;
            } else {
                html += `
                    <label class="room-check-item${checked ? ' checked' : ''}">
                        <input type="checkbox" value="${room.id}" ${checked ? 'checked' : ''} onchange="onRoomCheckChange(this)">
                        <div class="room-check-info">
                            <span class="room-check-number">${room.number}</span>
                            <span class="room-check-type">${room.type} &middot; ${room.capacity} ${t('rooms.pax')}</span>
                        </div>
                    </label>`;
            }
        });

        if (sortedRooms.length === 0) {
            html = `<div style="padding:20px;text-align:center;color:var(--text-tertiary);font-size:13px">${t('res.noRoomsYet')}</div>`;
        }

        checklist.innerHTML = html;
        const availableChecks = [...checklist.querySelectorAll('.room-check-item:not(.occupied) input[type="checkbox"]')];
        document.getElementById('resRoomSelectAll').checked = availableChecks.length > 0 && availableChecks.every((entry) => entry.checked);
        updateRoomCount();
    }

    function toggleAllRoomCheckboxes(el) {
        const checklist = document.getElementById('resRoomChecklist');
        checklist.querySelectorAll('input[type="checkbox"]:not(:disabled)').forEach((checkbox) => {
            checkbox.checked = el.checked;
            const item = checkbox.closest('.room-check-item');
            if (item) item.classList.toggle('checked', el.checked);
        });
        updateRoomCount();
    }

    function onRoomCheckChange(el) {
        el.closest('.room-check-item').classList.toggle('checked', el.checked);
        updateFloorAndSelectAll();
        updateRoomCount();
    }

    function toggleFloorCheckboxes(el) {
        const { getRooms } = requireDeps();
        const floor = el.dataset.floor;
        const checklist = document.getElementById('resRoomChecklist');
        checklist.querySelectorAll('.room-check-item').forEach((item) => {
            const checkbox = item.querySelector('input[type="checkbox"]');
            if (checkbox.disabled) return;
            const room = getRooms().find((entry) => entry.id === checkbox.value);
            if (room && String(room.floor) === floor) {
                checkbox.checked = el.checked;
                item.classList.toggle('checked', el.checked);
            }
        });
        updateFloorAndSelectAll();
        updateRoomCount();
    }

    function updateFloorAndSelectAll() {
        const { getRooms } = requireDeps();
        const checklist = document.getElementById('resRoomChecklist');
        const roomChecks = checklist.querySelectorAll('.room-check-item input[type="checkbox"]');
        const floorChecks = checklist.querySelectorAll('.room-check-floor-header input[type="checkbox"]');

        floorChecks.forEach((floorCheck) => {
            const floor = floorCheck.dataset.floor;
            const floorRoomChecks = [...roomChecks].filter((checkbox) => {
                const room = getRooms().find((entry) => entry.id === checkbox.value);
                return room && String(room.floor) === floor;
            });
            floorCheck.checked = floorRoomChecks.length > 0 && floorRoomChecks.every((checkbox) => checkbox.checked);
        });

        const allChecked = roomChecks.length > 0 && [...roomChecks].every((checkbox) => checkbox.checked);
        document.getElementById('resRoomSelectAll').checked = allChecked;
    }

    function updateRoomCount() {
        const { t } = requireDeps();
        const count = document.querySelectorAll('#resRoomChecklist .room-check-item input[type="checkbox"]:checked').length;
        const el = document.getElementById('resRoomCount');
        if (el) el.textContent = `${count} ${count !== 1 ? t('res.roomsSelected') : t('res.roomSelected')}`;
    }

    function getSelectedRoomIds() {
        return [...document.querySelectorAll('#resRoomChecklist .room-check-item input[type="checkbox"]:checked')].map((checkbox) => checkbox.value);
    }

    function getAssignedRoomIds(resId) {
        const { getGuests } = requireDeps();
        return [...new Set(getGuests().filter((guest) => guest.reservationId === resId && guest.roomId).map((guest) => guest.roomId))];
    }

    global.GroupStayReservationRooms = {
        init(nextDeps) {
            deps = nextDeps;
        },
        getAssignedRoomIds,
        getOccupiedRoomMap,
        getSelectedRoomIds,
        onRoomCheckChange,
        populateRoomChecklist,
        toggleAllRoomCheckboxes,
        toggleFloorCheckboxes,
        updateFloorAndSelectAll,
        updateRoomCount
    };
})(window);
