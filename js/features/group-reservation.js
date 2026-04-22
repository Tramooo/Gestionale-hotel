(function initGroupReservationFeature(global) {
    let deps = null;

    function requireDeps() {
        if (!deps) throw new Error('GroupStayGroupReservation not initialized');
        return deps;
    }

    function toggleExpirationField() {
        const status = document.getElementById('resStatus').value;
        document.getElementById('resExpirationGroup').style.display = status === 'pending' ? '' : 'none';
    }

    function openNewReservationModal() {
        const {
            addDays,
            formatDate,
            openModal,
            populateRoomChecklist,
            setDateFieldValue,
            t
        } = requireDeps();

        document.getElementById('reservationModalTitle').textContent = t('res.newGroupReservation');
        document.getElementById('reservationForm').reset();
        document.getElementById('resId').value = '';
        setDateFieldValue('resCheckin', formatDate(new Date()));
        setDateFieldValue('resCheckout', formatDate(addDays(new Date(), 3)));
        setDateFieldValue('resExpiration', formatDate(addDays(new Date(), 7)));
        document.getElementById('resGuestCount').value = '';
        document.getElementById('resPricePerPerson').value = '';
        document.getElementById('resGratuity').value = '';
        document.getElementById('resTotalPrice').textContent = '\u20AC0';
        document.getElementById('resPrice').value = 0;
        populateRoomChecklist([], null);
        toggleExpirationField();
        openModal('reservationModal');
    }

    function openEditReservation(id) {
        const {
            calcReservationPrice,
            closeModal,
            getAssignedRoomIds,
            getReservations,
            openModal,
            populateRoomChecklist,
            setDateFieldValue,
            t
        } = requireDeps();

        const reservation = getReservations().find((entry) => entry.id === id);
        if (!reservation) return;

        document.getElementById('reservationModalTitle').textContent = t('res.editReservation');
        document.getElementById('resId').value = reservation.id;
        document.getElementById('resGroupName').value = reservation.groupName;
        setDateFieldValue('resCheckin', reservation.checkin);
        setDateFieldValue('resCheckout', reservation.checkout);
        document.getElementById('resStatus').value = reservation.status;
        setDateFieldValue('resExpiration', reservation.expiration || '');
        document.getElementById('resGuestCount').value = reservation.guestCount || '';
        document.getElementById('resPricePerPerson').value = reservation.pricePerPerson || '';
        document.getElementById('resGratuity').value = reservation.gratuity || '';
        document.getElementById('resNotes').value = reservation.notes || '';
        document.getElementById('resMealPlan').value = reservation.mealPlan || 'BB';
        document.getElementById('resVeggieBuffet').checked = reservation.veggieBuffet || false;
        calcReservationPrice();
        toggleExpirationField();

        const assignedIds = reservation.roomIds || getAssignedRoomIds(reservation.id);
        populateRoomChecklist(assignedIds, reservation.id);

        closeModal('reservationDetailModal');
        openModal('reservationModal');
    }

    async function saveReservation(e) {
        e.preventDefault();

        const {
            API,
            apiPost,
            apiPut,
            closeModal,
            generateId,
            getSelectedRoomIds,
            getReservations,
            refreshCalendar,
            renderDashboard,
            setReservations,
            showToast,
            t
        } = requireDeps();

        const id = document.getElementById('resId').value;
        const selectedRooms = getSelectedRoomIds();
        const data = {
            groupName: document.getElementById('resGroupName').value.trim(),
            checkin: document.getElementById('resCheckin').value,
            checkout: document.getElementById('resCheckout').value,
            guestCount: parseInt(document.getElementById('resGuestCount').value) || 0,
            roomCount: selectedRooms.length,
            roomIds: selectedRooms,
            status: document.getElementById('resStatus').value,
            expiration: document.getElementById('resStatus').value === 'pending' ? document.getElementById('resExpiration').value : '',
            pricePerPerson: parseFloat(document.getElementById('resPricePerPerson').value) || 0,
            gratuity: parseInt(document.getElementById('resGratuity').value) || 0,
            price: parseFloat(document.getElementById('resPrice').value) || 0,
            notes: document.getElementById('resNotes').value.trim(),
            mealPlan: document.getElementById('resMealPlan').value,
            veggieBuffet: document.getElementById('resVeggieBuffet').checked
        };

        if (new Date(data.checkout) <= new Date(data.checkin)) {
            showToast(t('toast.checkoutAfterCheckin'), 'error');
            return;
        }

        if (selectedRooms.length === 0) {
            showToast(t('toast.selectRoom'), 'error');
            return;
        }

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

        closeModal('reservationModal');
        renderDashboard();
        refreshCalendar();
    }

    async function deleteReservation(id) {
        const {
            API,
            apiDelete,
            closeModal,
            getGuests,
            getReservations,
            refreshCalendar,
            renderDashboard,
            setGuests,
            setReservations,
            showConfirmDialog,
            showToast,
            t
        } = requireDeps();

        if (!await showConfirmDialog(t('confirm.deleteReservation'), {
            title: t('common.confirmation'),
            confirmLabel: t('common.delete'),
            cancelLabel: t('common.cancel'),
            intent: 'danger'
        })) return;

        setReservations(getReservations().filter((reservation) => reservation.id !== id));
        setGuests(getGuests().filter((guest) => guest.reservationId !== id));

        try {
            await apiDelete(API.reservations, id);
        } catch (err) {
            console.error(err);
            showToast(t('toast.resDeleteFail'), 'error');
            return;
        }

        closeModal('reservationDetailModal');
        showToast(t('toast.resDeleted'));
        renderDashboard();
        refreshCalendar();
    }

    global.GroupStayGroupReservation = {
        init(nextDeps) {
            deps = nextDeps;
        },
        deleteReservation,
        openEditReservation,
        openNewReservationModal,
        saveReservation,
        toggleExpirationField
    };
})(window);
