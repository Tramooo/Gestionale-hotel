(function initIndividualReservationFeature(global) {
    let deps = null;

    function requireDeps() {
        if (!deps) throw new Error('GroupStayIndividualReservation not initialized');
        return deps;
    }

    function populateIndRoomSelect(excludeResId) {
        const {
            escapeHtml,
            getGuests,
            getReservations,
            getRooms,
            t
        } = requireDeps();

        const checkin = document.getElementById('indCheckin').value;
        const checkout = document.getElementById('indCheckout').value;
        const select = document.getElementById('indRoomId');
        const currentVal = select.value;

        const occupied = {};
        if (checkin && checkout) {
            getReservations().forEach((reservation) => {
                if (reservation.id === excludeResId) return;
                if (reservation.status === 'cancelled') return;
                if (reservation.checkin < checkout && reservation.checkout > checkin) {
                    const roomIds = reservation.roomIds && reservation.roomIds.length > 0
                        ? reservation.roomIds
                        : getGuests().filter((guest) => guest.reservationId === reservation.id && guest.roomId).map((guest) => guest.roomId);
                    roomIds.forEach((id) => { occupied[id] = reservation.groupName; });
                }
            });
        }

        const floors = {};
        getRooms().forEach((room) => {
            if (!floors[room.floor]) floors[room.floor] = [];
            floors[room.floor].push(room);
        });

        let html = '<option value="">— Seleziona camera —</option>';
        Object.keys(floors).sort((a, b) => a - b).forEach((floor) => {
            html += `<optgroup label="${t('rooms.floor')} ${floor}">`;
            floors[floor]
                .sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }))
                .forEach((room) => {
                    const typeKey = `roomType.${room.type}`;
                    const typeLabel = t(typeKey) !== typeKey ? t(typeKey) : room.type;
                    if (occupied[room.id]) {
                        html += `<option value="${room.id}" disabled>Camera ${escapeHtml(room.number)} – ${typeLabel} (occupata: ${escapeHtml(occupied[room.id])})</option>`;
                    } else {
                        html += `<option value="${room.id}">Camera ${escapeHtml(room.number)} – ${typeLabel} (${room.capacity} posti)</option>`;
                    }
                });
            html += '</optgroup>';
        });

        select.innerHTML = html;
        if (currentVal) select.value = currentVal;
    }

    function calcIndividualPrice() {
        const { nightsBetween } = requireDeps();
        const checkin = document.getElementById('indCheckin').value;
        const checkout = document.getElementById('indCheckout').value;
        const ppn = parseFloat(document.getElementById('indPricePerNight').value) || 0;
        const nights = (checkin && checkout) ? nightsBetween(checkin, checkout) : 0;
        const total = ppn * nights;
        document.getElementById('indTotalPrice').textContent = '€' + total.toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
        document.getElementById('indPrice').value = total;
    }

    function openNewIndividualModal() {
        const { addDays, formatDate, openModal, setDateFieldValue, t } = requireDeps();
        document.getElementById('indModalTitle').textContent = t('res.newIndividual') || 'Nuova Prenotazione Individuale';
        document.getElementById('indForm').reset();
        document.getElementById('indId').value = '';
        setDateFieldValue('indCheckin', formatDate(new Date()));
        setDateFieldValue('indCheckout', formatDate(addDays(new Date(), 1)));
        document.getElementById('indStatus').value = 'confirmed';
        document.getElementById('indTotalPrice').textContent = '€0';
        document.getElementById('indPrice').value = 0;
        populateIndRoomSelect(null);
        openModal('individualModal');
    }

    function openEditIndividualReservation(id) {
        const {
            closeModal,
            getReservations,
            openModal,
            setDateFieldValue,
            t
        } = requireDeps();

        const reservation = getReservations().find((entry) => entry.id === id);
        if (!reservation) return;

        document.getElementById('indModalTitle').textContent = t('res.editReservation') || 'Modifica Prenotazione';
        document.getElementById('indId').value = reservation.id;

        const nameParts = (reservation.groupName || '').trim().split(/\s+/);
        document.getElementById('indFirstName').value = nameParts[0] || '';
        document.getElementById('indLastName').value = nameParts.slice(1).join(' ') || '';
        document.getElementById('indPhone').value = reservation.phone || reservation.organizer || '';
        document.getElementById('indEmail').value = reservation.email || '';
        setDateFieldValue('indCheckin', reservation.checkin);
        setDateFieldValue('indCheckout', reservation.checkout);
        document.getElementById('indStatus').value = reservation.status;
        document.getElementById('indPricePerNight').value = reservation.pricePerPerson || '';
        document.getElementById('indNotes').value = reservation.notes || '';

        populateIndRoomSelect(reservation.id);
        if (reservation.roomIds && reservation.roomIds.length > 0) {
            document.getElementById('indRoomId').value = reservation.roomIds[0];
        }
        calcIndividualPrice();
        closeModal('reservationDetailModal');
        openModal('individualModal');
    }

    async function saveIndividualReservation(e) {
        e.preventDefault();

        const {
            API,
            apiPost,
            apiPut,
            closeModal,
            computeRoomStatuses,
            generateId,
            getReservations,
            refreshCalendar,
            renderDashboard,
            renderReservations,
            setReservations,
            showToast,
            t
        } = requireDeps();

        const id = document.getElementById('indId').value;
        const firstName = document.getElementById('indFirstName').value.trim();
        const lastName = document.getElementById('indLastName').value.trim();
        const roomId = document.getElementById('indRoomId').value;
        const checkin = document.getElementById('indCheckin').value;
        const checkout = document.getElementById('indCheckout').value;

        if (!roomId) {
            showToast(t('toast.selectRoom'), 'error');
            return;
        }
        if (new Date(checkout) <= new Date(checkin)) {
            showToast(t('toast.checkoutAfterCheckin'), 'error');
            return;
        }

        const data = {
            groupName: `${firstName} ${lastName}`.trim(),
            organizer: document.getElementById('indPhone').value.trim(),
            phone: document.getElementById('indPhone').value.trim(),
            email: document.getElementById('indEmail').value.trim(),
            checkin,
            checkout,
            guestCount: 1,
            roomCount: 1,
            roomIds: [roomId],
            status: document.getElementById('indStatus').value,
            expiration: '',
            pricePerPerson: parseFloat(document.getElementById('indPricePerNight').value) || 0,
            gratuity: 0,
            price: parseFloat(document.getElementById('indPrice').value) || 0,
            notes: document.getElementById('indNotes').value.trim(),
            resType: 'individual'
        };

        try {
            if (id) {
                const nextReservations = getReservations().map((reservation) => reservation.id === id ? { ...reservation, ...data } : reservation);
                setReservations(nextReservations);
                await apiPut(API.reservations, { ...data, id });
                showToast(t('toast.resUpdated'));
            } else {
                const newReservation = { id: generateId(), ...data, createdAt: new Date().toISOString() };
                setReservations([...getReservations(), newReservation]);
                await apiPost(API.reservations, newReservation);
                showToast(t('toast.resCreated'));
            }
        } catch (err) {
            console.error(err);
            showToast(t('toast.resSaveFail'), 'error');
            return;
        }

        closeModal('individualModal');
        renderDashboard();
        renderReservations();
        refreshCalendar();
        computeRoomStatuses();
    }

    global.GroupStayIndividualReservation = {
        init(nextDeps) {
            deps = nextDeps;
        },
        calcIndividualPrice,
        openEditIndividualReservation,
        openNewIndividualModal,
        populateIndRoomSelect,
        saveIndividualReservation
    };
})(window);
