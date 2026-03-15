// =============================================
// GroupStay — Hotel Group Reservation Manager
// =============================================

// ---- DATA STORE (localStorage-backed) ----

const STORAGE_KEYS = {
    reservations: 'gs_reservations',
    rooms: 'gs_rooms',
    guests: 'gs_guests'
};

function loadData(key) {
    try {
        return JSON.parse(localStorage.getItem(key)) || [];
    } catch { return []; }
}

function saveData(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
}

// ---- STATE ----

let reservations = loadData(STORAGE_KEYS.reservations);
let rooms = loadData(STORAGE_KEYS.rooms);
let guests = loadData(STORAGE_KEYS.guests);
let currentFilter = 'all';
let currentRoomFilter = 'all';
let calendarDate = new Date();

// ---- SEED DATA (if empty) ----

function seedDataIfEmpty() {
    if (rooms.length === 0) {
        const types = ['single', 'double', 'twin', 'triple', 'suite', 'family', 'double', 'double', 'twin', 'single'];
        const capacities = { single: 1, double: 2, twin: 2, triple: 3, suite: 4, family: 5, quad: 4 };
        const prices = { single: 69, double: 99, twin: 95, triple: 129, suite: 249, family: 179, quad: 149 };

        for (let floor = 1; floor <= 3; floor++) {
            for (let r = 1; r <= 6; r++) {
                const num = floor * 100 + r;
                const type = types[(floor * 6 + r) % types.length];
                rooms.push({
                    id: generateId(),
                    number: String(num),
                    floor: floor,
                    type: type,
                    capacity: capacities[type],
                    price: prices[type],
                    status: 'available'
                });
            }
        }
        saveData(STORAGE_KEYS.rooms, rooms);
    }

    if (reservations.length === 0) {
        const today = new Date();
        const sampleGroups = [
            {
                groupName: 'Rossi Wedding Party',
                organizer: 'Marco Rossi',
                email: 'marco.rossi@email.com',
                phone: '+39 333 1234567',
                checkin: formatDate(addDays(today, 2)),
                checkout: formatDate(addDays(today, 5)),
                guestCount: 18,
                roomCount: 8,
                status: 'confirmed',
                price: 4200,
                notes: 'Late night reception on day 2. Need conference room for ceremony.'
            },
            {
                groupName: 'TechCorp Annual Summit',
                organizer: 'Laura Bianchi',
                email: 'l.bianchi@techcorp.com',
                phone: '+39 338 7654321',
                checkin: formatDate(addDays(today, -1)),
                checkout: formatDate(addDays(today, 3)),
                guestCount: 25,
                roomCount: 12,
                status: 'confirmed',
                price: 8500,
                notes: 'Need projector and whiteboard. Breakfast included.'
            },
            {
                groupName: 'University Sports Team',
                organizer: 'Prof. Giuseppe Verdi',
                email: 'g.verdi@unimi.it',
                phone: '+39 340 9876543',
                checkin: formatDate(addDays(today, 7)),
                checkout: formatDate(addDays(today, 10)),
                guestCount: 15,
                roomCount: 7,
                status: 'pending',
                expiration: formatDate(addDays(today, 5)),
                price: 3150,
                notes: 'Require early breakfast at 6:30 AM. Group discount applied.'
            },
            {
                groupName: 'Horizon Tour Group',
                organizer: 'Anna Colombo',
                email: 'anna@horizontours.it',
                phone: '+39 345 1122334',
                checkin: formatDate(addDays(today, -7)),
                checkout: formatDate(addDays(today, -4)),
                guestCount: 30,
                roomCount: 15,
                status: 'confirmed',
                price: 9800,
                notes: 'Tour group from Japan. Translators needed.'
            }
        ];

        sampleGroups.forEach(g => {
            const res = { id: generateId(), ...g, createdAt: new Date().toISOString() };
            reservations.push(res);

            // Create sample guests for each group
            const firstNames = ['Maria', 'Francesco', 'Alessandro', 'Giulia', 'Andrea', 'Sara', 'Luca', 'Elena', 'Matteo', 'Chiara'];
            const lastNames = ['Esposito', 'Russo', 'Ferrari', 'Romano', 'Colombo', 'Ricci', 'Marino', 'Greco', 'Bruno', 'Gallo'];

            const numGuests = Math.min(g.guestCount, 5);
            for (let i = 0; i < numGuests; i++) {
                guests.push({
                    id: generateId(),
                    reservationId: res.id,
                    firstName: firstNames[i % firstNames.length],
                    lastName: lastNames[(i + 3) % lastNames.length],
                    email: '',
                    phone: '',
                    docType: i === 0 ? 'id-card' : '',
                    docNumber: i === 0 ? 'AX' + Math.floor(Math.random() * 9000000 + 1000000) : '',
                    roomId: rooms[i] ? rooms[i].id : '',
                    notes: ''
                });
            }
        });

        // Mark some rooms as occupied for the checked-in group
        for (let i = 0; i < 6; i++) {
            rooms[i].status = 'occupied';
        }
        rooms[rooms.length - 1].status = 'maintenance';

        saveData(STORAGE_KEYS.reservations, reservations);
        saveData(STORAGE_KEYS.guests, guests);
        saveData(STORAGE_KEYS.rooms, rooms);
    }
}

// ---- HELPERS ----

function formatDate(date) {
    return date.toISOString().split('T')[0];
}

function formatDateDisplay(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
}

function nightsBetween(checkin, checkout) {
    const d1 = new Date(checkin);
    const d2 = new Date(checkout);
    return Math.max(1, Math.round((d2 - d1) / (1000 * 60 * 60 * 24)));
}

function getInitials(name) {
    return name.split(' ').map(w => w[0]).join('').toUpperCase().substring(0, 2);
}

// ---- NAVIGATION ----

function navigateTo(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item, .tab-item').forEach(n => n.classList.remove('active'));

    const pageEl = document.getElementById('page-' + page);
    if (pageEl) {
        pageEl.classList.remove('active');
        // Force reflow for animation
        void pageEl.offsetWidth;
        pageEl.classList.add('active');
    }

    document.querySelectorAll(`[data-page="${page}"]`).forEach(n => n.classList.add('active'));

    // Refresh page content
    switch (page) {
        case 'dashboard': renderDashboard(); break;
        case 'reservations': renderReservations(); break;
        case 'calendar': renderCalendar(); break;
        case 'rooms': renderRooms(); break;
        case 'guests': renderGuests(); break;
    }
}

// Setup nav listeners
document.querySelectorAll('.nav-item, .tab-item').forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        navigateTo(item.dataset.page);
    });
});

// ---- MODAL HELPERS ----

function openModal(id) {
    document.getElementById(id).classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeModal(id) {
    document.getElementById(id).classList.remove('open');
    document.body.style.overflow = '';
}

// Close modal on overlay click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.classList.remove('open');
            document.body.style.overflow = '';
        }
    });
});

// Close on escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeAllDatePickers();
        document.querySelectorAll('.modal-overlay.open').forEach(m => {
            m.classList.remove('open');
            document.body.style.overflow = '';
        });
    }
});

// Close date pickers when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.mini-cal-wrapper')) {
        closeAllDatePickers();
    }
});

// ---- TOAST ----

function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'toastOut 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// =============================================
// DASHBOARD
// =============================================

function renderDashboard() {
    // Stats
    const activeGroups = reservations.filter(r => r.status === 'confirmed' || r.status === 'checked-in');
    const totalGuests = activeGroups.reduce((sum, r) => sum + (r.guestCount || 0), 0);
    const occupiedRooms = rooms.filter(r => r.status === 'occupied').length;
    const monthRevenue = reservations
        .filter(r => {
            const d = new Date(r.checkin);
            const now = new Date();
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        })
        .reduce((sum, r) => sum + (r.price || 0), 0);

    document.getElementById('stat-active-groups').textContent = activeGroups.length;
    document.getElementById('stat-total-guests').textContent = totalGuests;
    document.getElementById('stat-rooms-occupied').textContent = occupiedRooms + '/' + rooms.length;
    document.getElementById('stat-revenue').textContent = '\u20AC' + monthRevenue.toLocaleString();

    // Occupancy ring
    const totalRooms = rooms.length;
    const available = rooms.filter(r => r.status === 'available').length;
    const maintenance = rooms.filter(r => r.status === 'maintenance').length;
    const occupied = rooms.filter(r => r.status === 'occupied').length;
    const percent = totalRooms > 0 ? Math.round((occupied / totalRooms) * 100) : 0;
    const circumference = 2 * Math.PI * 52;
    const offset = circumference - (percent / 100) * circumference;

    document.getElementById('occupancy-circle').setAttribute('stroke-dashoffset', offset);
    document.getElementById('occupancy-percent').textContent = percent + '%';
    document.getElementById('legend-occupied').textContent = occupied;
    document.getElementById('legend-available').textContent = available;
    document.getElementById('legend-maintenance').textContent = maintenance;

    // Upcoming check-ins
    const upcoming = reservations
        .filter(r => r.status === 'confirmed' || r.status === 'pending')
        .sort((a, b) => new Date(a.checkin) - new Date(b.checkin))
        .slice(0, 5);

    const checkinEl = document.getElementById('upcoming-checkins');
    if (upcoming.length === 0) {
        checkinEl.innerHTML = '<div class="empty-state small"><p>No upcoming check-ins</p></div>';
    } else {
        checkinEl.innerHTML = upcoming.map(r => `
            <div class="checkin-item" onclick="openReservationDetail('${r.id}')">
                <div class="checkin-dot" style="background: ${r.status === 'confirmed' ? 'var(--green)' : 'var(--orange)'}"></div>
                <div class="checkin-info">
                    <div class="checkin-name">${escapeHtml(r.groupName)}</div>
                    <div class="checkin-detail">${r.guestCount} guests &middot; ${r.roomCount} rooms</div>
                </div>
                <div class="checkin-date">${formatDateDisplay(r.checkin)}</div>
            </div>
        `).join('');
    }

    // Today's activity
    const today = formatDate(new Date());
    const todayCheckins = reservations.filter(r => r.checkin === today);
    const todayCheckouts = reservations.filter(r => r.checkout === today);

    const activityEl = document.getElementById('today-activity');
    const activities = [];

    todayCheckins.forEach(r => {
        activities.push(`
            <div class="activity-item">
                <div class="activity-icon checkin">&#8593;</div>
                <div>
                    <div class="activity-text"><strong>${escapeHtml(r.groupName)}</strong> checking in</div>
                    <div class="activity-time">${r.guestCount} guests</div>
                </div>
            </div>
        `);
    });

    todayCheckouts.forEach(r => {
        activities.push(`
            <div class="activity-item">
                <div class="activity-icon checkout">&#8595;</div>
                <div>
                    <div class="activity-text"><strong>${escapeHtml(r.groupName)}</strong> checking out</div>
                    <div class="activity-time">${r.guestCount} guests</div>
                </div>
            </div>
        `);
    });

    if (activities.length === 0) {
        activityEl.innerHTML = '<div class="empty-state small"><p>No activity today</p></div>';
    } else {
        activityEl.innerHTML = activities.join('');
    }
}

// =============================================
// RESERVATIONS
// =============================================

function renderReservations() {
    const search = (document.getElementById('searchReservations')?.value || '').toLowerCase();
    let filtered = reservations;

    if (currentFilter !== 'all') {
        filtered = filtered.filter(r => r.status === currentFilter);
    }

    if (search) {
        filtered = filtered.filter(r =>
            r.groupName.toLowerCase().includes(search) ||
            r.organizer.toLowerCase().includes(search) ||
            (r.email || '').toLowerCase().includes(search)
        );
    }

    filtered.sort((a, b) => new Date(a.checkin) - new Date(b.checkin));

    const list = document.getElementById('reservationsList');

    if (filtered.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <p>No reservations found</p>
            </div>
        `;
        return;
    }

    list.innerHTML = filtered.map(r => {
        const nights = nightsBetween(r.checkin, r.checkout);
        const statusLabel = r.status.replace('-', ' ');
        return `
            <div class="reservation-card" onclick="openReservationDetail('${r.id}')">
                <div class="res-color-bar ${r.status}"></div>
                <div class="res-info">
                    <div class="res-group-name">${escapeHtml(r.groupName)}</div>
                    <div class="res-organizer">${escapeHtml(r.organizer)}</div>
                </div>
                <div class="res-meta">
                    <div class="res-meta-item">
                        <span class="res-meta-value">${r.guestCount}</span>
                        <span class="res-meta-label">Guests</span>
                    </div>
                    <div class="res-meta-item">
                        <span class="res-meta-value">${r.roomCount}</span>
                        <span class="res-meta-label">Rooms</span>
                    </div>
                    <div class="res-meta-item">
                        <span class="res-meta-value">${nights}</span>
                        <span class="res-meta-label">Nights</span>
                    </div>
                </div>
                <div class="res-dates">${formatDateDisplay(r.checkin)} &rarr; ${formatDateDisplay(r.checkout)}</div>
                <span class="status-badge ${r.status}">${statusLabel}</span>
            </div>
        `;
    }).join('');
}

function setReservationFilter(filter, el) {
    currentFilter = filter;
    document.querySelectorAll('#page-reservations .chip').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
    renderReservations();
}

function filterReservations() {
    renderReservations();
}

// ---- New / Edit Reservation ----

function populateRoomChecklist(selectedRoomIds) {
    const checklist = document.getElementById('resRoomChecklist');
    const sortedRooms = [...rooms].sort((a, b) => a.floor !== b.floor ? a.floor - b.floor : parseInt(a.number) - parseInt(b.number));
    const selected = new Set(selectedRoomIds || []);

    checklist.innerHTML = sortedRooms.map(r => `
        <label class="room-check-item">
            <input type="checkbox" value="${r.id}" ${selected.has(r.id) ? 'checked' : ''} onchange="updateRoomSelectAll()">
            <span>${r.number}</span>
            <span class="room-check-type">${r.type}</span>
        </label>
    `).join('');

    document.getElementById('resRoomSelectAll').checked = selected.size === rooms.length;
}

function toggleAllRoomCheckboxes(el) {
    const checks = document.querySelectorAll('#resRoomChecklist input[type="checkbox"]');
    checks.forEach(c => { c.checked = el.checked; });
}

function updateRoomSelectAll() {
    const checks = document.querySelectorAll('#resRoomChecklist input[type="checkbox"]');
    const all = checks.length > 0 && [...checks].every(c => c.checked);
    document.getElementById('resRoomSelectAll').checked = all;
}

function getSelectedRoomIds() {
    return [...document.querySelectorAll('#resRoomChecklist input[type="checkbox"]:checked')].map(c => c.value);
}

function getAssignedRoomIds(resId) {
    return [...new Set(guests.filter(g => g.reservationId === resId && g.roomId).map(g => g.roomId))];
}

function toggleExpirationField() {
    const status = document.getElementById('resStatus').value;
    document.getElementById('resExpirationGroup').style.display = status === 'pending' ? '' : 'none';
}

// ---- Reusable Date Picker ----

function getWrapper(el) {
    return el.closest('.mini-cal-wrapper');
}

function toggleDatePicker(inputEl) {
    const wrapper = getWrapper(inputEl);
    const dd = wrapper.querySelector('.mini-cal-dropdown');
    // Close all other open pickers first
    document.querySelectorAll('.mini-cal-dropdown.open').forEach(d => {
        if (d !== dd) d.classList.remove('open');
    });
    if (dd.classList.contains('open')) { dd.classList.remove('open'); return; }
    const targetId = wrapper.dataset.target;
    const val = document.getElementById(targetId).value;
    wrapper._viewDate = val ? new Date(val + 'T00:00:00') : new Date();
    renderDatePicker(wrapper);
    dd.classList.add('open');
}

function closeAllDatePickers() {
    document.querySelectorAll('.mini-cal-dropdown.open').forEach(d => d.classList.remove('open'));
}

function datePickerNav(btn, dir) {
    const wrapper = getWrapper(btn);
    wrapper._viewDate.setMonth(wrapper._viewDate.getMonth() + dir);
    renderDatePicker(wrapper);
}

function renderDatePicker(wrapper) {
    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const vd = wrapper._viewDate;
    const y = vd.getFullYear();
    const m = vd.getMonth();
    wrapper.querySelector('.mini-cal-month-label').textContent = monthNames[m] + ' ' + y;

    const targetId = wrapper.dataset.target;
    const selected = document.getElementById(targetId).value;
    const todayStr = formatDate(new Date());

    let startDow = new Date(y, m, 1).getDay();
    if (startDow === 0) startDow = 7;
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const prevDays = new Date(y, m, 0).getDate();

    let html = '';
    for (let i = startDow - 1; i > 0; i--) {
        html += `<button type="button" class="mini-cal-day other-month" disabled>${prevDays - i + 1}</button>`;
    }
    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        let cls = 'mini-cal-day';
        if (dateStr === todayStr) cls += ' today';
        if (dateStr === selected) cls += ' selected';
        html += `<button type="button" class="${cls}" onclick="selectDatePickerDay(this,'${dateStr}')">${d}</button>`;
    }
    const totalCells = startDow - 1 + daysInMonth;
    const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
    for (let i = 1; i <= remaining; i++) {
        html += `<button type="button" class="mini-cal-day other-month" disabled>${i}</button>`;
    }
    wrapper.querySelector('.mini-cal-grid').innerHTML = html;
}

function selectDatePickerDay(btn, dateStr) {
    const wrapper = getWrapper(btn);
    const targetId = wrapper.dataset.target;
    document.getElementById(targetId).value = dateStr;
    setDatePickerDisplay(wrapper, dateStr);
    wrapper.querySelector('.mini-cal-dropdown').classList.remove('open');
}

function setDatePickerDisplay(wrapper, dateStr) {
    const display = wrapper.querySelector('.mini-cal-display');
    if (!dateStr) { display.textContent = 'Select date...'; return; }
    const d = new Date(dateStr + 'T00:00:00');
    const mn = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    display.textContent = `${d.getDate()} ${mn[d.getMonth()]} ${d.getFullYear()}`;
}

function setDateFieldValue(targetId, dateStr) {
    document.getElementById(targetId).value = dateStr;
    const wrapper = document.querySelector(`.mini-cal-wrapper[data-target="${targetId}"]`);
    if (wrapper) setDatePickerDisplay(wrapper, dateStr);
}

function openNewReservationModal() {
    document.getElementById('reservationModalTitle').textContent = 'New Group Reservation';
    document.getElementById('reservationForm').reset();
    document.getElementById('resId').value = '';
    setDateFieldValue('resCheckin', formatDate(new Date()));
    setDateFieldValue('resCheckout', formatDate(addDays(new Date(), 3)));
    setDateFieldValue('resExpiration', formatDate(addDays(new Date(), 7)));
    populateRoomChecklist([]);
    toggleExpirationField();
    openModal('reservationModal');
}

function openEditReservation(id) {
    const r = reservations.find(x => x.id === id);
    if (!r) return;

    document.getElementById('reservationModalTitle').textContent = 'Edit Reservation';
    document.getElementById('resId').value = r.id;
    document.getElementById('resGroupName').value = r.groupName;
    setDateFieldValue('resCheckin', r.checkin);
    setDateFieldValue('resCheckout', r.checkout);
    document.getElementById('resStatus').value = r.status;
    setDateFieldValue('resExpiration', r.expiration || '');
    document.getElementById('resPrice').value = r.price || '';
    document.getElementById('resNotes').value = r.notes || '';
    toggleExpirationField();

    // Get rooms assigned to this reservation
    const assignedIds = r.roomIds || getAssignedRoomIds(r.id);
    populateRoomChecklist(assignedIds);

    closeModal('reservationDetailModal');
    openModal('reservationModal');
}

function saveReservation(e) {
    e.preventDefault();

    const id = document.getElementById('resId').value;
    const selectedRooms = getSelectedRoomIds();
    const data = {
        groupName: document.getElementById('resGroupName').value.trim(),
        checkin: document.getElementById('resCheckin').value,
        checkout: document.getElementById('resCheckout').value,
        roomCount: selectedRooms.length,
        roomIds: selectedRooms,
        status: document.getElementById('resStatus').value,
        expiration: document.getElementById('resStatus').value === 'pending' ? document.getElementById('resExpiration').value : '',
        price: parseFloat(document.getElementById('resPrice').value) || 0,
        notes: document.getElementById('resNotes').value.trim()
    };

    if (new Date(data.checkout) <= new Date(data.checkin)) {
        showToast('Check-out must be after check-in', 'error');
        return;
    }

    if (selectedRooms.length === 0) {
        showToast('Please select at least one room', 'error');
        return;
    }

    if (id) {
        const idx = reservations.findIndex(r => r.id === id);
        if (idx !== -1) {
            reservations[idx] = { ...reservations[idx], ...data };
        }
        showToast('Reservation updated');
    } else {
        reservations.push({ id: generateId(), ...data, createdAt: new Date().toISOString() });
        showToast('Group reservation created');
    }

    saveData(STORAGE_KEYS.reservations, reservations);
    closeModal('reservationModal');
    renderDashboard();
    refreshCalendar();
}

function deleteReservation(id) {
    if (!confirm('Delete this group reservation and all associated guests?')) return;
    reservations = reservations.filter(r => r.id !== id);
    guests = guests.filter(g => g.reservationId !== id);
    saveData(STORAGE_KEYS.reservations, reservations);
    saveData(STORAGE_KEYS.guests, guests);
    closeModal('reservationDetailModal');
    showToast('Reservation deleted');
    renderDashboard();
    refreshCalendar();
}

// ---- Reservation Detail ----

function openReservationDetail(id) {
    const r = reservations.find(x => x.id === id);
    if (!r) return;

    document.getElementById('detailGroupName').textContent = r.groupName;

    const resGuests = guests.filter(g => g.reservationId === id);
    const nights = nightsBetween(r.checkin, r.checkout);
    const statusLabel = r.status.replace('-', ' ');

    const body = document.getElementById('reservationDetailBody');
    body.innerHTML = `
        <div class="detail-header">
            <span class="status-badge ${r.status}">${statusLabel}</span>
            <div class="detail-actions">
                <button class="btn btn-secondary btn-sm" onclick="openEditReservation('${r.id}')">Edit</button>
                <button class="btn btn-secondary btn-sm" onclick="openAssignRooms('${r.id}')">Assign Rooms</button>
                <button class="btn btn-danger btn-sm" onclick="deleteReservation('${r.id}')">Delete</button>
            </div>
        </div>

        <div class="detail-grid">
            <div class="detail-item">
                <span class="label">Check-in</span>
                <span class="value">${formatDateDisplay(r.checkin)}</span>
            </div>
            <div class="detail-item">
                <span class="label">Check-out</span>
                <span class="value">${formatDateDisplay(r.checkout)}</span>
            </div>
            <div class="detail-item">
                <span class="label">Rooms / Nights</span>
                <span class="value">${r.roomCount} rooms &middot; ${nights} nights</span>
            </div>
            <div class="detail-item">
                <span class="label">Total Price</span>
                <span class="value">&euro;${(r.price || 0).toLocaleString()}</span>
            </div>
            ${r.status === 'pending' && r.expiration ? `<div class="detail-item">
                <span class="label">Expires</span>
                <span class="value">${formatDateDisplay(r.expiration)}</span>
            </div>` : ''}
        </div>

        ${r.notes ? `<div class="detail-item" style="margin-bottom:16px"><span class="label">Notes</span><span class="value">${escapeHtml(r.notes)}</span></div>` : ''}

        <div class="detail-section">
            <h3>
                Guests (${resGuests.length})
                <button class="btn btn-sm btn-primary" onclick="openAddGuestModal('${r.id}')">Add Guest</button>
            </h3>
            <div class="detail-guests-list">
                ${resGuests.length === 0 ? '<div class="empty-state small"><p>No guests added yet</p></div>' :
                resGuests.map(g => {
                    const room = g.roomId ? rooms.find(rm => rm.id === g.roomId) : null;
                    return `
                        <div class="detail-guest-item">
                            <div class="guest-avatar">${getInitials(g.firstName + ' ' + g.lastName)}</div>
                            <div class="guest-info">
                                <strong>${escapeHtml(g.firstName + ' ' + g.lastName)}</strong><br>
                                <span>${room ? 'Room ' + room.number : 'No room assigned'}${g.docNumber ? ' &middot; ' + g.docType + ': ' + g.docNumber : ''}</span>
                            </div>
                            <button class="btn btn-ghost btn-sm" onclick="deleteGuest('${g.id}', '${r.id}')">Remove</button>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;

    openModal('reservationDetailModal');
}

// ---- Assign Rooms ----

function openAssignRooms(reservationId) {
    const r = reservations.find(x => x.id === reservationId);
    if (!r) return;

    const resGuests = guests.filter(g => g.reservationId === reservationId);
    const assignedRoomIds = resGuests.map(g => g.roomId).filter(Boolean);

    const availableRooms = rooms.filter(rm => rm.status === 'available' || assignedRoomIds.includes(rm.id));

    const body = document.getElementById('assignRoomsBody');
    body.innerHTML = `
        <p style="margin-bottom:16px;color:var(--text-secondary);font-size:14px">
            Select rooms for <strong>${escapeHtml(r.groupName)}</strong> (${r.roomCount} needed)
        </p>
        <div id="assignRoomsList">
            ${availableRooms.map(rm => {
                const isSelected = assignedRoomIds.includes(rm.id);
                return `
                    <div class="assign-room-item">
                        <div class="assign-room-info">
                            <span class="assign-room-number">Room ${rm.number}</span>
                            <span class="assign-room-type">${rm.type} &middot; ${rm.capacity} pax &middot; &euro;${rm.price}/night</span>
                        </div>
                        <button class="assign-room-check ${isSelected ? 'selected' : ''}"
                                onclick="toggleRoomAssignment(this, '${rm.id}', '${reservationId}')"
                                data-room-id="${rm.id}">
                            ${isSelected ? '&#10003;' : ''}
                        </button>
                    </div>
                `;
            }).join('')}
        </div>
        <div class="modal-actions">
            <button class="btn btn-ghost" onclick="closeModal('assignRoomsModal')">Done</button>
        </div>
    `;

    closeModal('reservationDetailModal');
    openModal('assignRoomsModal');
}

function toggleRoomAssignment(btn, roomId, reservationId) {
    const isSelected = btn.classList.contains('selected');

    if (isSelected) {
        btn.classList.remove('selected');
        btn.innerHTML = '';
        // Free room
        const roomIdx = rooms.findIndex(r => r.id === roomId);
        if (roomIdx !== -1) rooms[roomIdx].status = 'available';
        // Unassign from guests
        guests.forEach(g => {
            if (g.reservationId === reservationId && g.roomId === roomId) {
                g.roomId = '';
            }
        });
    } else {
        btn.classList.add('selected');
        btn.innerHTML = '&#10003;';
        // Mark room occupied
        const roomIdx = rooms.findIndex(r => r.id === roomId);
        if (roomIdx !== -1) rooms[roomIdx].status = 'occupied';
    }

    saveData(STORAGE_KEYS.rooms, rooms);
    saveData(STORAGE_KEYS.guests, guests);
}

// =============================================
// ROOMS
// =============================================

function renderRooms() {
    const search = (document.getElementById('searchRooms')?.value || '').toLowerCase();
    let filtered = rooms;

    if (currentRoomFilter !== 'all') {
        filtered = filtered.filter(r => r.status === currentRoomFilter);
    }

    if (search) {
        filtered = filtered.filter(r =>
            r.number.toLowerCase().includes(search) ||
            r.type.toLowerCase().includes(search)
        );
    }

    filtered.sort((a, b) => parseInt(a.number) - parseInt(b.number));

    const grid = document.getElementById('roomsGrid');

    if (filtered.length === 0) {
        grid.innerHTML = '<div class="empty-state"><p>No rooms found</p></div>';
        return;
    }

    grid.innerHTML = filtered.map(r => `
        <div class="room-card ${r.status}" onclick="openEditRoom('${r.id}')">
            <div class="room-number">${r.number}</div>
            <div class="room-type">
                <span class="room-status-dot ${r.status}"></span>${r.type}
            </div>
            <div class="room-details">
                <span class="room-capacity">${r.capacity} pax &middot; Floor ${r.floor}</span>
            </div>
        </div>
    `).join('');
}

function setRoomFilter(filter, el) {
    currentRoomFilter = filter;
    document.querySelectorAll('#page-rooms .chip').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
    renderRooms();
}

function filterRooms() {
    renderRooms();
}

function openNewRoomModal() {
    document.getElementById('roomModalTitle').textContent = 'Add Room';
    document.getElementById('roomForm').reset();
    document.getElementById('roomId').value = '';
    document.getElementById('deleteRoomBtn').style.display = 'none';
    openModal('roomModal');
}

function openEditRoom(id) {
    const r = rooms.find(x => x.id === id);
    if (!r) return;

    document.getElementById('roomModalTitle').textContent = 'Edit Room';
    document.getElementById('roomId').value = r.id;
    document.getElementById('roomNumber').value = r.number;
    document.getElementById('roomFloor').value = r.floor;
    document.getElementById('roomType').value = r.type;
    document.getElementById('roomCapacity').value = r.capacity;
    document.getElementById('deleteRoomBtn').style.display = '';

    openModal('roomModal');
}

function saveRoom(e) {
    e.preventDefault();

    const id = document.getElementById('roomId').value;
    const data = {
        number: document.getElementById('roomNumber').value.trim(),
        floor: parseInt(document.getElementById('roomFloor').value) || 1,
        type: document.getElementById('roomType').value,
        capacity: parseInt(document.getElementById('roomCapacity').value) || 1,
        status: 'available'
    };

    if (id) {
        const idx = rooms.findIndex(r => r.id === id);
        if (idx !== -1) rooms[idx] = { ...rooms[idx], ...data };
        showToast('Room updated');
    } else {
        if (rooms.some(r => r.number === data.number)) {
            showToast('Room number already exists', 'error');
            return;
        }
        rooms.push({ id: generateId(), ...data });
        showToast('Room added');
    }

    saveData(STORAGE_KEYS.rooms, rooms);
    closeModal('roomModal');
    renderRooms();
    renderDashboard();
    refreshCalendar();
}

function deleteRoom() {
    const id = document.getElementById('roomId').value;
    if (!id) return;
    if (!confirm('Delete this room?')) return;
    rooms = rooms.filter(r => r.id !== id);
    guests = guests.filter(g => g.roomId !== id);
    saveData(STORAGE_KEYS.rooms, rooms);
    saveData(STORAGE_KEYS.guests, guests);
    closeModal('roomModal');
    showToast('Room deleted');
    renderRooms();
    renderDashboard();
    refreshCalendar();
}

// =============================================
// GUESTS
// =============================================

function renderGuests() {
    const search = (document.getElementById('searchGuests')?.value || '').toLowerCase();
    let allGuests = guests.map(g => {
        const res = reservations.find(r => r.id === g.reservationId);
        const room = g.roomId ? rooms.find(r => r.id === g.roomId) : null;
        return { ...g, reservation: res, room };
    });

    if (search) {
        allGuests = allGuests.filter(g =>
            (g.firstName + ' ' + g.lastName).toLowerCase().includes(search) ||
            (g.reservation?.groupName || '').toLowerCase().includes(search) ||
            (g.room?.number || '').toLowerCase().includes(search)
        );
    }

    const tbody = document.getElementById('guestsTableBody');

    if (allGuests.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state small">No guests found</td></tr>';
        return;
    }

    tbody.innerHTML = allGuests.map(g => {
        const statusLabel = g.reservation ? g.reservation.status.replace('-', ' ') : 'unknown';
        return `
            <tr>
                <td>
                    <div class="guest-name-cell">
                        <div class="guest-avatar">${getInitials(g.firstName + ' ' + g.lastName)}</div>
                        ${escapeHtml(g.firstName + ' ' + g.lastName)}
                    </div>
                </td>
                <td>${escapeHtml(g.reservation?.groupName || '—')}</td>
                <td>${g.room ? g.room.number : '—'}</td>
                <td>${g.reservation ? formatDateDisplay(g.reservation.checkin) : '—'}</td>
                <td>${g.reservation ? formatDateDisplay(g.reservation.checkout) : '—'}</td>
                <td><span class="status-badge ${g.reservation?.status || ''}">${statusLabel}</span></td>
                <td>
                    <button class="btn btn-ghost btn-sm" onclick="deleteGuest('${g.id}', '${g.reservationId}')">Remove</button>
                </td>
            </tr>
        `;
    }).join('');
}

function filterGuests() {
    renderGuests();
}

function openAddGuestModal(reservationId) {
    document.getElementById('guestForm').reset();
    document.getElementById('guestId').value = '';
    document.getElementById('guestReservationId').value = reservationId;

    // Populate room dropdown
    const select = document.getElementById('guestRoom');
    select.innerHTML = '<option value="">Unassigned</option>';
    rooms.filter(r => r.status === 'available' || r.status === 'occupied').forEach(r => {
        select.innerHTML += `<option value="${r.id}">Room ${r.number} (${r.type})</option>`;
    });

    closeModal('reservationDetailModal');
    openModal('guestModal');
}

function saveGuest(e) {
    e.preventDefault();

    const id = document.getElementById('guestId').value;
    const data = {
        reservationId: document.getElementById('guestReservationId').value,
        firstName: document.getElementById('guestFirstName').value.trim(),
        lastName: document.getElementById('guestLastName').value.trim(),
        email: document.getElementById('guestEmail').value.trim(),
        phone: document.getElementById('guestPhone').value.trim(),
        docType: document.getElementById('guestDocType').value,
        docNumber: document.getElementById('guestDocNumber').value.trim(),
        roomId: document.getElementById('guestRoom').value,
        notes: document.getElementById('guestNotes').value.trim()
    };

    if (id) {
        const idx = guests.findIndex(g => g.id === id);
        if (idx !== -1) guests[idx] = { ...guests[idx], ...data };
        showToast('Guest updated');
    } else {
        guests.push({ id: generateId(), ...data });
        showToast('Guest added to group');
    }

    saveData(STORAGE_KEYS.guests, guests);
    closeModal('guestModal');

    // Reopen reservation detail
    openReservationDetail(data.reservationId);
    renderGuests();
}

function deleteGuest(guestId, reservationId) {
    if (!confirm('Remove this guest?')) return;
    guests = guests.filter(g => g.id !== guestId);
    saveData(STORAGE_KEYS.guests, guests);
    showToast('Guest removed');

    // Refresh detail if open
    const detailModal = document.getElementById('reservationDetailModal');
    if (detailModal.classList.contains('open')) {
        openReservationDetail(reservationId);
    }
    renderGuests();
}

// =============================================
// PLANNING BOARD CALENDAR (4-panel grid layout)
// =============================================
//
// Layout:  CORNER  | HEADER  (horizontal scroll synced)
//          --------+---------
//          ROOMS   | GRID    (master scroll, both axes)
//
// Only .p-grid-panel scrolls. JS syncs header (h) and rooms (v).

const PLANNER_DAY_WIDTH = 38;
const PLANNER_INITIAL_PAST = 180;
const PLANNER_INITIAL_FUTURE = 365;
const PLANNER_EXTEND_CHUNK = 90;
const PLANNER_EXTEND_THRESHOLD = 400;

let plannerStartDate = null;
let plannerTotalDays = 0;
let plannerGridEl = null;   // .p-grid-panel (master scroller)
let plannerHeaderEl = null; // .p-header-panel
let plannerRoomsEl = null;  // .p-rooms-panel
let plannerIsExtending = false;

function dateToDayIndex(d) {
    return Math.round((d - plannerStartDate) / 86400000);
}
function dayIndexToDate(i) {
    return new Date(plannerStartDate.getFullYear(), plannerStartDate.getMonth(), plannerStartDate.getDate() + i);
}

function getPlannerSortedRooms() {
    return [...rooms].sort((a, b) => a.floor !== b.floor ? a.floor - b.floor : parseInt(a.number) - parseInt(b.number));
}
function getPlannerFloors(sortedRooms) {
    const floors = {};
    sortedRooms.forEach(r => { (floors[r.floor] = floors[r.floor] || []).push(r); });
    return floors;
}
function getPlannerRoomBookings(sortedRooms) {
    const rb = {};
    sortedRooms.forEach(rm => { rb[rm.id] = []; });
    reservations.forEach(res => {
        if (res.status === 'cancelled') return;
        const si = dateToDayIndex(new Date(res.checkin + 'T00:00:00'));
        const ei = dateToDayIndex(new Date(res.checkout + 'T00:00:00'));
        if (ei <= 0 || si >= plannerTotalDays) return;
        const booking = { res, startIdx: Math.max(0, si), endIdx: Math.min(plannerTotalDays, ei) };

        // Use roomIds if available, fall back to guest assignments
        const assignedIds = res.roomIds && res.roomIds.length > 0
            ? res.roomIds
            : [...new Set(guests.filter(g => g.reservationId === res.id && g.roomId).map(g => g.roomId))];
        if (assignedIds.length > 0) {
            assignedIds.forEach(rid => { if (rb[rid]) rb[rid].push(booking); });
        } else {
            // No rooms assigned — place on first available room
            for (let i = 0; i < sortedRooms.length; i++) {
                const rm = sortedRooms[i];
                const conflict = rb[rm.id].some(b =>
                    b.startIdx < booking.endIdx && b.endIdx > booking.startIdx
                );
                if (!conflict) {
                    rb[rm.id].push(booking);
                    break;
                }
            }
        }
    });
    return rb;
}

function renderCalendar() {
    const board = document.getElementById('plannerBoard');
    const anchor = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), calendarDate.getDate());
    plannerStartDate = new Date(anchor);
    plannerStartDate.setDate(plannerStartDate.getDate() - PLANNER_INITIAL_PAST);
    plannerTotalDays = PLANNER_INITIAL_PAST + PLANNER_INITIAL_FUTURE;

    board.innerHTML = buildBoardHTML();

    plannerGridEl = board.querySelector('.p-grid-panel');
    plannerHeaderEl = board.querySelector('.p-header-panel');
    plannerRoomsEl = board.querySelector('.p-rooms-panel');

    plannerGridEl.addEventListener('scroll', onPlannerScroll);

    // Scroll to anchor date
    const anchorIdx = dateToDayIndex(anchor);
    plannerGridEl.scrollLeft = Math.max(0, anchorIdx * PLANNER_DAY_WIDTH - plannerGridEl.clientWidth / 3);

    initGridDrag();
    renderPlannerMonthBar();
}

// Rebuild board without resetting scroll position
function refreshCalendar() {
    if (!plannerGridEl) { renderCalendar(); return; }
    const slBefore = plannerGridEl.scrollLeft;
    const stBefore = plannerGridEl.scrollTop;

    const board = document.getElementById('plannerBoard');
    plannerGridEl.removeEventListener('scroll', onPlannerScroll);
    board.innerHTML = buildBoardHTML();
    plannerGridEl = board.querySelector('.p-grid-panel');
    plannerHeaderEl = board.querySelector('.p-header-panel');
    plannerRoomsEl = board.querySelector('.p-rooms-panel');
    plannerGridEl.addEventListener('scroll', onPlannerScroll);
    initGridDrag();

    plannerGridEl.scrollLeft = slBefore;
    plannerGridEl.scrollTop = stBefore;
    const headerInner = plannerHeaderEl.querySelector('.p-header-inner');
    const roomsInner = plannerRoomsEl.querySelector('.p-rooms-inner');
    if (headerInner) headerInner.style.transform = `translateX(${-slBefore}px)`;
    if (roomsInner) roomsInner.style.transform = `translateY(${-stBefore}px)`;
}

function buildBoardHTML() {
    const DW = PLANNER_DAY_WIDTH;
    const today = formatDate(new Date());
    const dayAbbr = ['Su','Mo','Tu','We','Th','Fr','Sa'];
    const monthFull = ['January','February','March','April','May','June','July','August','September','October','November','December'];

    const sortedRooms = getPlannerSortedRooms();
    const floors = getPlannerFloors(sortedRooms);
    const rb = getPlannerRoomBookings(sortedRooms);
    const floorKeys = Object.keys(floors).sort((a, b) => a - b);
    const totalR = sortedRooms.length;

    // Month spans
    const monthSpans = [];
    let curMK = null;
    for (let i = 0; i < plannerTotalDays; i++) {
        const d = dayIndexToDate(i);
        const mk = d.getFullYear() + '-' + d.getMonth();
        if (mk !== curMK) { monthSpans.push({ label: monthFull[d.getMonth()] + ' ' + d.getFullYear(), count: 1 }); curMK = mk; }
        else monthSpans[monthSpans.length - 1].count++;
    }

    // Per-day occupancy
    const dayOcc = new Uint16Array(plannerTotalDays);
    sortedRooms.forEach(rm => {
        rb[rm.id].forEach(b => { for (let i = b.startIdx; i < b.endIdx; i++) dayOcc[i]++; });
    });

    // === 1. CORNER (top-left, fixed) ===
    let corner = '<div class="p-corner">';
    corner += '<div class="p-corner-cell months">&nbsp;</div>';
    corner += '<div class="p-corner-cell days">Room</div>';
    corner += '<div class="p-corner-cell stats">Available</div>';
    corner += '<div class="p-corner-cell stats">Occupied</div>';
    corner += '</div>';

    // === 2. HEADER (top-right, h-scroll synced) ===
    let header = '<div class="p-header-panel"><div class="p-header-inner">';

    // Months row
    header += '<div class="p-header-row months">';
    monthSpans.forEach(ms => {
        header += `<div class="p-month-label" style="width:${ms.count * DW}px">${ms.label}</div>`;
    });
    header += '</div>';

    // Days row
    header += '<div class="p-header-row days">';
    for (let i = 0; i < plannerTotalDays; i++) {
        const d = dayIndexToDate(i);
        const dow = d.getDay();
        let c = 'p-day-cell';
        if (formatDate(d) === today) c += ' today';
        else if (dow === 0 || dow === 6) c += ' weekend';
        header += `<div class="${c}" style="width:${DW}px"><span class="day-num">${d.getDate()}</span><span class="day-name">${dayAbbr[dow]}</span></div>`;
    }
    header += '</div>';

    // Available row
    header += '<div class="p-header-row stats">';
    for (let i = 0; i < plannerTotalDays; i++) {
        header += `<div class="p-stats-cell" style="width:${DW}px">${totalR - dayOcc[i]}</div>`;
    }
    header += '</div>';

    // Occupied row
    header += '<div class="p-header-row stats">';
    for (let i = 0; i < plannerTotalDays; i++) {
        const o = dayOcc[i];
        header += `<div class="p-stats-cell${o > 0 ? ' highlight' : ''}" style="width:${DW}px">${o}</div>`;
    }
    header += '</div>';

    header += '</div></div>';

    // === 3. ROOMS (bottom-left, v-scroll synced) ===
    let roomsPanel = '<div class="p-rooms-panel"><div class="p-rooms-inner">';
    floorKeys.forEach(floor => {
        roomsPanel += `<div class="p-floor-left">Floor ${floor}</div>`;
        floors[floor].forEach(room => {
            roomsPanel += `<div class="p-room-left" onclick="openEditRoom('${room.id}')">
                <span class="planner-room-status ${room.status}"></span>
                <span class="planner-room-label">${room.number}</span>
                <span class="planner-room-type">${room.type.substring(0, 3)}</span>
            </div>`;
        });
    });
    roomsPanel += '</div></div>';

    // === 4. GRID BODY (bottom-right, master scroller) ===
    let grid = '<div class="p-grid-panel"><div class="p-grid-inner">';

    // Today line
    const todayIdx = dateToDayIndex(new Date());
    if (todayIdx >= 0 && todayIdx < plannerTotalDays) {
        grid += `<div class="planner-today-line" style="left:${todayIdx * DW + DW / 2}px"></div>`;
    }

    floorKeys.forEach(floor => {
        // Floor header row
        grid += '<div class="p-grid-floor-row">';
        for (let i = 0; i < plannerTotalDays; i++) {
            grid += `<div class="p-floor-cell" style="width:${DW}px"></div>`;
        }
        grid += '</div>';

        // Room rows
        floors[floor].forEach(room => {
            grid += `<div class="p-grid-room-row" data-room-id="${room.id}">`;
            for (let i = 0; i < plannerTotalDays; i++) {
                const d = dayIndexToDate(i);
                const dow = d.getDay();
                let c = 'p-grid-cell';
                if (formatDate(d) === today) c += ' today-col';
                else if (dow === 0 || dow === 6) c += ' weekend';
                grid += `<div class="${c}" style="width:${DW}px" data-day="${i}"></div>`;
            }
            // Reservation bars
            (rb[room.id] || []).forEach(b => {
                const left = b.startIdx * DW;
                const width = (b.endIdx - b.startIdx) * DW - 2;
                const label = escapeHtml(b.res.groupName);
                grid += `<div class="planner-res-bar ${b.res.status}" style="left:${left}px;width:${width}px" onclick="openReservationDetail('${b.res.id}')" title="${label} (${formatDateDisplay(b.res.checkin)} - ${formatDateDisplay(b.res.checkout)})"><span class="bar-label">${label}</span></div>`;
            });
            grid += '</div>';
        });
    });

    grid += '</div></div>';

    return corner + header + roomsPanel + grid;
}

// ---- Scroll sync + infinite extend ----

function onPlannerScroll() {
    // Sync header horizontal scroll via transform (more reliable than scrollLeft on overflow:hidden)
    const headerInner = plannerHeaderEl.querySelector('.p-header-inner');
    const roomsInner = plannerRoomsEl.querySelector('.p-rooms-inner');
    if (headerInner) headerInner.style.transform = `translateX(${-plannerGridEl.scrollLeft}px)`;
    if (roomsInner) roomsInner.style.transform = `translateY(${-plannerGridEl.scrollTop}px)`;

    if (plannerIsExtending) return;

    const sl = plannerGridEl.scrollLeft;
    const maxScroll = plannerGridEl.scrollWidth - plannerGridEl.clientWidth;

    if (sl >= maxScroll - PLANNER_EXTEND_THRESHOLD) {
        plannerIsExtending = true;
        extendPlanner('right');
        plannerIsExtending = false;
    }
    if (sl <= PLANNER_EXTEND_THRESHOLD) {
        plannerIsExtending = true;
        extendPlanner('left');
        plannerIsExtending = false;
    }

    updateMonthBarFromScroll();
}

function extendPlanner(dir) {
    const chunk = PLANNER_EXTEND_CHUNK;
    const slBefore = plannerGridEl.scrollLeft;
    const stBefore = plannerGridEl.scrollTop;

    if (dir === 'left') {
        plannerStartDate = new Date(plannerStartDate);
        plannerStartDate.setDate(plannerStartDate.getDate() - chunk);
    }
    plannerTotalDays += chunk;

    const board = document.getElementById('plannerBoard');
    plannerGridEl.removeEventListener('scroll', onPlannerScroll);
    board.innerHTML = buildBoardHTML();
    plannerGridEl = board.querySelector('.p-grid-panel');
    plannerHeaderEl = board.querySelector('.p-header-panel');
    plannerRoomsEl = board.querySelector('.p-rooms-panel');
    plannerGridEl.addEventListener('scroll', onPlannerScroll);
    initGridDrag();

    plannerGridEl.scrollLeft = dir === 'left' ? slBefore + chunk * PLANNER_DAY_WIDTH : slBefore;
    plannerGridEl.scrollTop = stBefore;
    // Sync immediately via transform
    const headerInner = plannerHeaderEl.querySelector('.p-header-inner');
    const roomsInner = plannerRoomsEl.querySelector('.p-rooms-inner');
    if (headerInner) headerInner.style.transform = `translateX(${-plannerGridEl.scrollLeft}px)`;
    if (roomsInner) roomsInner.style.transform = `translateY(${-plannerGridEl.scrollTop}px)`;
}

// ---- Month bar ----

function updateMonthBarFromScroll() {
    if (!plannerGridEl) return;
    const centerX = plannerGridEl.scrollLeft + plannerGridEl.clientWidth / 2;
    const centerIdx = Math.floor(centerX / PLANNER_DAY_WIDTH);
    if (centerIdx < 0 || centerIdx >= plannerTotalDays) return;
    const centerDate = dayIndexToDate(centerIdx);
    const y = centerDate.getFullYear(), m = centerDate.getMonth();
    document.querySelectorAll('.planner-month-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.year === String(y) && btn.dataset.month === String(m));
    });
}

function renderPlannerMonthBar() {
    const bar = document.getElementById('plannerMonthBar');
    const mn = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
    const now = new Date();
    let html = '';
    for (let off = -12; off <= 12; off++) {
        const d = new Date(now.getFullYear(), now.getMonth() + off, 1);
        const y = d.getFullYear(), m = d.getMonth();
        html += `<button class="planner-month-btn" data-year="${y}" data-month="${m}" onclick="jumpToMonth(${y},${m})">${mn[m]} ${String(y).substring(2)}</button>`;
    }
    bar.innerHTML = html;
    updateMonthBarFromScroll();
}

function jumpToMonth(year, month) {
    if (!plannerGridEl) return;
    const targetDate = new Date(year, month, 1);
    let idx = dateToDayIndex(targetDate);
    if (idx < 0 || idx >= plannerTotalDays) { calendarDate = targetDate; renderCalendar(); return; }
    plannerGridEl.scrollTo({ left: Math.max(0, idx * PLANNER_DAY_WIDTH - 100), behavior: 'smooth' });
}

function calendarPrev() {
    if (!plannerGridEl) return;
    plannerGridEl.scrollBy({ left: -30 * PLANNER_DAY_WIDTH, behavior: 'smooth' });
}
function calendarNext() {
    if (!plannerGridEl) return;
    plannerGridEl.scrollBy({ left: 30 * PLANNER_DAY_WIDTH, behavior: 'smooth' });
}
function calendarToday() {
    if (!plannerGridEl) { calendarDate = new Date(); renderCalendar(); return; }
    const idx = dateToDayIndex(new Date());
    if (idx < 0 || idx >= plannerTotalDays) { calendarDate = new Date(); renderCalendar(); return; }
    plannerGridEl.scrollTo({ left: Math.max(0, idx * PLANNER_DAY_WIDTH - plannerGridEl.clientWidth / 3), behavior: 'smooth' });
}

// =============================================
// DRAG-TO-SELECT ON GRID
// =============================================

let dragState = null; // { startDayIdx, currentDayIdx, overlay }

function initGridDrag() {
    if (!plannerGridEl) return;
    const gridInner = plannerGridEl.querySelector('.p-grid-inner');
    if (!gridInner) return;

    gridInner.addEventListener('mousedown', onGridDragStart);
    gridInner.addEventListener('touchstart', onGridDragStart, { passive: false });
}

function getDayIdxFromEvent(e) {
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const rect = plannerGridEl.getBoundingClientRect();
    const x = clientX - rect.left + plannerGridEl.scrollLeft;
    return Math.floor(x / PLANNER_DAY_WIDTH);
}

function onGridDragStart(e) {
    // Ignore if clicking on a reservation bar
    const target = e.target.closest('.planner-res-bar');
    if (target) return;

    // Only left mouse button or touch
    if (e.type === 'mousedown' && e.button !== 0) return;
    if (e.type === 'touchstart') e.preventDefault();

    const dayIdx = getDayIdxFromEvent(e);
    if (dayIdx < 0 || dayIdx >= plannerTotalDays) return;

    // Create selection overlay
    const overlay = document.createElement('div');
    overlay.className = 'grid-drag-overlay';
    const gridInner = plannerGridEl.querySelector('.p-grid-inner');
    gridInner.appendChild(overlay);

    dragState = { startDayIdx: dayIdx, currentDayIdx: dayIdx, overlay };
    updateDragOverlay();

    document.addEventListener('mousemove', onGridDragMove);
    document.addEventListener('mouseup', onGridDragEnd);
    document.addEventListener('touchmove', onGridDragMove, { passive: false });
    document.addEventListener('touchend', onGridDragEnd);
}

function onGridDragMove(e) {
    if (!dragState) return;
    if (e.type === 'touchmove') e.preventDefault();

    const dayIdx = getDayIdxFromEvent(e);
    if (dayIdx < 0 || dayIdx >= plannerTotalDays) return;

    dragState.currentDayIdx = dayIdx;
    updateDragOverlay();
}

function updateDragOverlay() {
    if (!dragState || !dragState.overlay) return;
    const DW = PLANNER_DAY_WIDTH;
    const startIdx = Math.min(dragState.startDayIdx, dragState.currentDayIdx);
    const endIdx = Math.max(dragState.startDayIdx, dragState.currentDayIdx);
    const left = startIdx * DW;
    const width = (endIdx - startIdx + 1) * DW;

    const ov = dragState.overlay;
    ov.style.left = left + 'px';
    ov.style.top = '0';
    ov.style.width = width + 'px';
    ov.style.height = '100%';

    // Show date label
    const startDate = dayIndexToDate(startIdx);
    const endDate = dayIndexToDate(endIdx + 1); // checkout = day after last selected
    const nights = endIdx - startIdx + 1;
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const fmt = d => `${d.getDate()} ${monthNames[d.getMonth()]}`;
    ov.setAttribute('data-label', `${fmt(startDate)} → ${fmt(endDate)} (${nights}n)`);
}

function onGridDragEnd() {
    document.removeEventListener('mousemove', onGridDragMove);
    document.removeEventListener('mouseup', onGridDragEnd);
    document.removeEventListener('touchmove', onGridDragMove);
    document.removeEventListener('touchend', onGridDragEnd);

    if (!dragState) return;

    const startIdx = Math.min(dragState.startDayIdx, dragState.currentDayIdx);
    const endIdx = Math.max(dragState.startDayIdx, dragState.currentDayIdx);

    // Remove overlay
    if (dragState.overlay && dragState.overlay.parentNode) {
        dragState.overlay.parentNode.removeChild(dragState.overlay);
    }
    dragState = null;

    // Only open modal if dragged at least 1 day
    if (endIdx - startIdx < 1) return;

    const checkinDate = dayIndexToDate(startIdx);
    const checkoutDate = dayIndexToDate(endIdx + 1);

    // Open new reservation modal with dates pre-filled
    document.getElementById('reservationModalTitle').textContent = 'New Group Reservation';
    document.getElementById('reservationForm').reset();
    document.getElementById('resId').value = '';
    setDateFieldValue('resCheckin', formatDate(checkinDate));
    setDateFieldValue('resCheckout', formatDate(checkoutDate));
    setDateFieldValue('resExpiration', formatDate(addDays(new Date(), 7)));
    populateRoomChecklist([]);
    toggleExpirationField();
    openModal('reservationModal');
}

// =============================================
// SECURITY
// =============================================

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// =============================================
// INIT
// =============================================

seedDataIfEmpty();
renderDashboard();
