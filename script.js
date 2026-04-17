// =============================================
// GroupStay — Hotel Group Reservation Manager
// =============================================

// ---- DATA STORE (Neon Postgres via API) ----

const {
    API,
    CERT_TYPES,
    DOC_TYPES,
    NO_EXPIRY_CERTS,
    CACHE_KEY,
    CACHE_TTL
} = window.GroupStayConfig;

const {
    apiGet,
    apiPost,
    apiPut,
    apiDelete,
    clearSessionToken,
    primeSessionToken
} = window.GroupStayApi;

const {
    closeModal,
    hideLoading,
    openModal,
    showLoading,
    showToast
} = window.GroupStayUI;

const {
    addDays,
    escapeHtml,
    formatDate,
    generateId,
    nightsBetween
} = window.GroupStayUtils;

const formatDateDisplay = (dateStr) => window.GroupStayUtils.formatDateDisplay(dateStr, currentLang);

window.GroupStayDatePicker.init({
    calcIndividualPrice,
    calcReservationPrice,
    formatDate,
    getSelectedRoomIds,
    populateIndRoomSelect,
    populateRoomChecklist,
    t
});

const {
    closeAllDatePickers,
    datePickerNav,
    renderDatePicker,
    selectDatePickerDay,
    setDateFieldValue,
    toggleDatePicker
} = window.GroupStayDatePicker;

window.GroupStayUI.init({
    closeAllDatePickers
});

window.GroupStayRooms.init({
    API,
    apiDelete,
    apiPost,
    apiPut,
    closeModal,
    computeRoomStatuses,
    generateId,
    getCurrentRoomFilter: () => currentRoomFilter,
    getGuests: () => guests,
    getRooms: () => rooms,
    onRoomsChanged: () => window.GroupStayRooms.renderRooms(),
    openModal,
    refreshCalendar,
    renderDashboard,
    setCurrentRoomFilter: (filter) => { currentRoomFilter = filter; },
    setGuests: (nextGuests) => { guests = nextGuests; },
    setRooms: (nextRooms) => { rooms = nextRooms; },
    showToast,
    t
});

window.GroupStayMenus.init({
    API,
    apiGet,
    apiPost,
    apiPut,
    escapeHtml,
    formatDate,
    formatDateDisplay,
    generateId,
    getReservations: () => reservations,
    nightsBetween,
    setReservations: (nextReservations) => { reservations = nextReservations; }
});

window.GroupStayReservationsList.init({
    escapeHtml,
    formatDateDisplay,
    getCurrentFilter: () => currentFilter,
    getReservations: () => reservations,
    nightsBetween,
    setCurrentFilter: (filter) => { currentFilter = filter; },
    t
});

window.GroupStayReservationRooms.init({
    escapeHtml,
    getGuests: () => guests,
    getReservations: () => reservations,
    getRooms: () => rooms,
    t
});

window.GroupStayIndividualReservation.init({
    API,
    addDays,
    apiPost,
    apiPut,
    closeModal,
    computeRoomStatuses,
    escapeHtml,
    formatDate,
    generateId,
    getGuests: () => guests,
    getReservations: () => reservations,
    getRooms: () => rooms,
    nightsBetween,
    openModal,
    refreshCalendar,
    renderDashboard,
    renderReservations,
    setDateFieldValue,
    setReservations: (nextReservations) => { reservations = nextReservations; },
    showToast,
    t
});

window.GroupStayGroupReservation.init({
    API,
    addDays,
    apiDelete,
    apiPost,
    apiPut,
    calcReservationPrice,
    closeModal,
    formatDate,
    generateId,
    getAssignedRoomIds,
    getGuests: () => guests,
    getReservations: () => reservations,
    getSelectedRoomIds,
    openModal,
    populateRoomChecklist,
    refreshCalendar,
    renderDashboard,
    setDateFieldValue,
    setGuests: (nextGuests) => { guests = nextGuests; },
    setReservations: (nextReservations) => { reservations = nextReservations; },
    showToast,
    t
});

window.GroupStayReservationFiles.init({
    API,
    apiDelete,
    apiGet,
    apiPost,
    escapeHtml,
    generateId,
    showToast,
    t
});

window.GroupStayReservationDetail.init({
    API,
    apiPut,
    calcReservationRevenue,
    escapeHtml,
    formatDateDisplay,
    getReservations: () => reservations,
    getRooms: () => rooms,
    loadReservationFiles,
    loadReservationMenus,
    nightsBetween,
    openModal,
    showToast,
    t
});

window.GroupStayGuests.init({
    API,
    apiDelete,
    apiPost,
    apiPut,
    closeModal,
    escapeHtml,
    findLabelFromCode,
    formatDateDisplay,
    generateId,
    getAlloggiatiLuoghi: () => alloggiatiLuoghi,
    getAlloggiatiStati: () => alloggiatiStati,
    getGuests: () => guests,
    getInitials,
    getReservations: () => reservations,
    getRooms: () => rooms,
    loadAlloggiatiTables,
    openModal,
    openReservationDetail,
    setGuests: (nextGuests) => { guests = nextGuests; },
    showToast,
    t
});

window.GroupStayGuestImport.init({
    API,
    apiPost,
    apiPut,
    closeModal,
    escapeHtml,
    formatDate,
    generateId,
    getAlloggiatiLuoghi: () => alloggiatiLuoghi,
    getAlloggiatiStati: () => alloggiatiStati,
    getGuests: () => guests,
    hideLoading,
    lookupAlloggiatiLuogo,
    openModal,
    openFileImportModal,
    openGuestsList,
    parseImportDate,
    renderDashboard,
    setGuests: (nextGuests) => { guests = nextGuests; },
    showLoading,
    showToast,
    t
});

window.GroupStayDashboard.init({
    API,
    apiDelete,
    apiPost,
    apiPut,
    computeRoomStatuses,
    escapeHtml,
    formatDate,
    formatDateDisplay,
    generateId,
    getAgendaItems: () => agendaItems,
    getCurrentLang: () => currentLang,
    getReservations: () => reservations,
    getRooms: () => rooms,
    nightsBetween,
    openReservationDetail,
    setAgendaItems: (nextAgendaItems) => { agendaItems = nextAgendaItems; },
    showToast,
    t
});

window.GroupStayCompliance.init({
    API,
    CERT_TYPES,
    DOC_TYPES,
    apiDelete,
    apiPost,
    apiPut,
    closeModal,
    escapeHtml,
    formatDate,
    formatDateDisplay,
    generateId,
    getComplianceCerts: () => complianceCerts,
    getComplianceDocs: () => complianceDocs,
    getEmployees: () => employees,
    openModal,
    renderCompliance: () => window.GroupStayCompliance.renderCompliance(),
    setComplianceCerts: (nextCerts) => { complianceCerts = nextCerts; },
    setComplianceDocs: (nextDocs) => { complianceDocs = nextDocs; },
    setDateFieldValue,
    showToast
});

window.GroupStayEmployees.init({
    API,
    apiDelete,
    apiPost,
    apiPut,
    closeModal,
    escapeHtml,
    formatDate,
    generateId,
    getEmployees: () => employees,
    getEmpViewMonth: () => empViewMonth,
    getMonthPayOverrides: () => monthPayOverrides,
    getWorkEntries: () => workEntries,
    openModal,
    renderManagement,
    setEmployees: (nextEmployees) => { employees = nextEmployees; },
    setEmpViewMonth: (nextMonth) => { empViewMonth = nextMonth; },
    setMonthPayOverrides: (nextOverrides) => { monthPayOverrides = nextOverrides; },
    setWorkEntries: (nextEntries) => { workEntries = nextEntries; },
    showToast,
    t
});

window.GroupStayManagement.init({
    calcEstimatedPay,
    escapeHtml,
    getDaysInMonth,
    getEmployeeMonthStats,
    getEmployees: () => employees,
    getEmpMonthPay,
    getEmpViewMonth: () => empViewMonth,
    getMonthPayOverrides: () => monthPayOverrides,
    getReservations: () => reservations,
    getWorkEntries: () => workEntries,
    nightsBetween,
    renderEmployees,
    t
});

window.GroupStayPlanner.init({
    computeRoomStatuses,
    escapeHtml,
    formatDate,
    formatDateDisplay,
    getCalendarDate: () => calendarDate,
    getGuests: () => guests,
    getPlannerDayWidth: () => PLANNER_DAY_WIDTH,
    getPlannerExtendChunk: () => PLANNER_EXTEND_CHUNK,
    getPlannerExtendThreshold: () => PLANNER_EXTEND_THRESHOLD,
    getPlannerGridEl: () => plannerGridEl,
    getPlannerHeaderEl: () => plannerHeaderEl,
    getPlannerInitialFuture: () => PLANNER_INITIAL_FUTURE,
    getPlannerInitialPast: () => PLANNER_INITIAL_PAST,
    getPlannerIsExtending: () => plannerIsExtending,
    getPlannerRoomsEl: () => plannerRoomsEl,
    getPlannerRowHeight: () => PLANNER_ROW_HEIGHT,
    getPlannerStartDate: () => plannerStartDate,
    getPlannerTotalDays: () => plannerTotalDays,
    getReservations: () => reservations,
    getRooms: () => rooms,
    hideBarTooltip,
    initGridDrag,
    openReservationDetail,
    renderCalendar: () => window.GroupStayPlanner.renderCalendar(),
    renderExpiringBanner: () => window.GroupStayPlanner.renderExpiringBanner(),
    renderPlannerMonthBar: () => window.GroupStayPlanner.renderPlannerMonthBar(),
    setCalendarDate: (nextDate) => { calendarDate = nextDate; },
    setPlannerGridEl: (nextEl) => { plannerGridEl = nextEl; },
    setPlannerHeaderEl: (nextEl) => { plannerHeaderEl = nextEl; },
    setPlannerIsExtending: (next) => { plannerIsExtending = next; },
    setPlannerRoomsEl: (nextEl) => { plannerRoomsEl = nextEl; },
    setPlannerStartDate: (nextDate) => { plannerStartDate = nextDate; },
    setPlannerTotalDays: (nextTotal) => { plannerTotalDays = nextTotal; },
    t
});

window.GroupStayPlannerDrag.init({
    dayIndexToDate,
    formatDate,
    getPlannerDayWidth: () => PLANNER_DAY_WIDTH,
    getPlannerGridEl: () => plannerGridEl,
    getPlannerTotalDays: () => plannerTotalDays,
    openBookingTypeChooser
});

function saveDataCache() {
    try {
        if (!currentUser?.id) return;
        localStorage.setItem(`${CACHE_KEY}:${currentUser.id}`, JSON.stringify({
            ts: Date.now(),
            reservations, rooms, guests, employees, workEntries, complianceCerts, complianceDocs, agendaItems
        }));
    } catch (e) {} // ignore quota errors
}

function loadDataCache() {
    try {
        if (!currentUser?.id) return false;
        const raw = localStorage.getItem(`${CACHE_KEY}:${currentUser.id}`);
        if (!raw) return false;
        const cache = JSON.parse(raw);
        if (Date.now() - cache.ts > CACHE_TTL) return false;
        reservations   = cache.reservations   || [];
        rooms          = cache.rooms          || [];
        guests         = cache.guests         || [];
        employees      = cache.employees      || [];
        workEntries    = cache.workEntries    || [];
        complianceCerts = cache.complianceCerts || [];
        complianceDocs  = cache.complianceDocs  || [];
        agendaItems     = cache.agendaItems     || [];
        computeRoomStatuses();
        return true;
    } catch (e) { return false; }
}

async function loadAllData(retryOnUnauthorized = true) {
    try {
        setAuthDebug('Bootstrap: preparo il database...');
        // Keep schema migrations idempotent and run them on each load
        // so freshly added columns are available even in an existing session.
        try { await apiPost(API.init, {}); } catch (e) {}

        setAuthDebug('Bootstrap: carico dati principali...');
        const [resData, roomData, guestData, empData, certsData, docsData, agendaData] = await Promise.all([
            apiGet(API.reservations),
            apiGet(API.rooms),
            apiGet(API.guests),
            apiGet(API.employees).catch(() => ({ employees: [], workEntries: [] })),
            apiGet(API.compliance + '?target=certs').catch(() => []),
            apiGet(API.compliance + '?target=docs').catch(() => []),
            apiGet(API.agenda).catch(() => [])
        ]);
        reservations    = resData;
        rooms           = roomData;
        guests          = guestData;
        employees        = empData.employees      || [];
        workEntries      = empData.workEntries    || [];
        monthPayOverrides = empData.monthOverrides || [];
        complianceCerts = certsData;
        complianceDocs  = docsData;
        agendaItems     = agendaData;
        computeRoomStatuses();
        saveDataCache();
        setAuthDebug('Bootstrap completato.');
        return true;
    } catch (err) {
        console.error('Failed to load data from database:', err);
        setAuthDebug(`Bootstrap fallito: ${formatErrorMessage(err)}`);
        if (err && err.status === 401) {
            if (retryOnUnauthorized) {
                setAuthDebug('Bootstrap 401, ritento conferma sessione...');
                const user = await ensureSessionReady(3, 300);
                if (user) return loadAllData(false);
            }
            showToast('Sessione scaduta, effettua di nuovo l’accesso', 'error');
            await logoutUser();
            return false;
        }
        showToast(t('toast.dbError'), 'error');
        return false;
    }
}

function computeRoomStatuses() {
    const today = formatDate(new Date());
    // Build set of room IDs occupied today by active reservations
    const occupiedIds = new Set();
    reservations.forEach(r => {
        if (r.status !== 'confirmed' && r.status !== 'checked-in') return;
        if (r.checkin > today || r.checkout <= today) return;
        const rIds = r.roomIds && r.roomIds.length > 0
            ? r.roomIds
            : guests.filter(g => g.reservationId === r.id && g.roomId).map(g => g.roomId);
        rIds.forEach(id => occupiedIds.add(id));
    });
    rooms.forEach(rm => {
        if (rm.status === 'maintenance') return; // keep maintenance as-is
        rm.status = occupiedIds.has(rm.id) ? 'occupied' : 'available';
    });
}

// ---- STATE ----

let reservations = [];
let rooms = [];
let guests = [];
let currentFilter = 'all';
let currentRoomFilter = 'all';
let calendarDate = new Date();
let currentAssignmentReservationId = null;
let assignmentData = []; // current working copy of room assignments
let employees = [];
let workEntries = [];
let monthPayOverrides = [];
let complianceCerts = [];
let complianceDocs = [];
let agendaItems = [];
let _compCertFileData = '';
let _compCertFileName = '';
let _compDocFileData = '';
let _compDocFileName = '';
let empViewMonth = new Date(); // currently viewed month for employee pay
let currentUser = null;
let currentAuthMode = 'login';
const REMEMBERED_LOGIN_KEY = 'gs_remembered_login';

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function nextPaint() {
    return new Promise((resolve) => {
        requestAnimationFrame(() => {
            requestAnimationFrame(resolve);
        });
    });
}

// ---- i18n ----

let currentLang = localStorage.getItem('gs_lang') || 'it';

function setAuthLocked(locked) {
    document.body.classList.toggle('auth-locked', locked);
    const authScreen = document.getElementById('authScreen');
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('mainContent');
    const mobileTabBar = document.getElementById('mobileTabBar');

    if (authScreen) {
        authScreen.style.display = locked ? 'flex' : 'none';
        authScreen.setAttribute('aria-hidden', locked ? 'false' : 'true');
        authScreen.style.pointerEvents = locked ? 'auto' : 'none';
    }
    if (sidebar) sidebar.style.visibility = locked ? 'hidden' : 'visible';
    if (mainContent) mainContent.style.visibility = locked ? 'hidden' : 'visible';
    if (mobileTabBar) mobileTabBar.style.visibility = locked ? 'hidden' : 'visible';
}

function clearAuthErrors() {
    const loginError = document.getElementById('loginError');
    const registerError = document.getElementById('registerError');
    const authDebug = document.getElementById('authDebug');
    if (loginError) loginError.textContent = '';
    if (registerError) registerError.textContent = '';
    if (authDebug) authDebug.textContent = '';
}

function setAuthDebug(message) {
    const authDebug = document.getElementById('authDebug');
    if (authDebug) authDebug.textContent = message || '';
}

function formatErrorMessage(error) {
    if (!error) return 'Errore sconosciuto';
    const parts = [];
    if (error.message) parts.push(error.message);
    if (error.status) parts.push(`status ${error.status}`);
    return parts.join(' - ') || 'Errore sconosciuto';
}

function saveRememberedLogin(email, password, shouldRemember) {
    try {
        if (!shouldRemember) {
            localStorage.removeItem(REMEMBERED_LOGIN_KEY);
            return;
        }
        localStorage.setItem(REMEMBERED_LOGIN_KEY, JSON.stringify({
            email,
            password
        }));
    } catch (error) {
        console.warn('Unable to persist remembered login:', error);
    }
}

function restoreRememberedLogin() {
    const emailInput = document.getElementById('loginEmail');
    const passwordInput = document.getElementById('loginPassword');
    const rememberInput = document.getElementById('loginRemember');
    if (!emailInput || !passwordInput || !rememberInput) return;

    try {
        const raw = localStorage.getItem(REMEMBERED_LOGIN_KEY);
        if (!raw) {
            rememberInput.checked = false;
            return;
        }
        const saved = JSON.parse(raw);
        emailInput.value = saved?.email || '';
        passwordInput.value = saved?.password || '';
        rememberInput.checked = Boolean(saved?.email || saved?.password);
    } catch (error) {
        localStorage.removeItem(REMEMBERED_LOGIN_KEY);
        rememberInput.checked = false;
    }
}

function setupRememberedLoginToggle() {
    const rememberInput = document.getElementById('loginRemember');
    if (!rememberInput || rememberInput.dataset.bound === 'true') return;

    rememberInput.addEventListener('change', () => {
        if (!rememberInput.checked) {
            saveRememberedLogin('', '', false);
        }
    });
    rememberInput.dataset.bound = 'true';
}

function updateProfileHeader() {
    const nameEl = document.querySelector('.profile-name');
    const roleEl = document.querySelector('.profile-role');
    const avatarEl = document.querySelector('.avatar');
    if (!currentUser) return;

    const displayName = currentUser.fullName || currentUser.email;
    if (nameEl) nameEl.textContent = displayName;
    if (roleEl) roleEl.textContent = currentUser.email;
    if (avatarEl) avatarEl.textContent = getInitials(displayName);
}

function switchAuthMode(mode) {
    currentAuthMode = mode === 'register' ? 'register' : 'login';
    const isRegister = currentAuthMode === 'register';
    document.getElementById('loginForm').style.display = isRegister ? 'none' : '';
    document.getElementById('registerForm').style.display = isRegister ? '' : 'none';
    document.getElementById('authTabLogin').classList.toggle('active', !isRegister);
    document.getElementById('authTabRegister').classList.toggle('active', isRegister);
    clearAuthErrors();
}

async function fetchSession() {
    try {
        const data = await apiGet(API.auth);
        currentUser = data.user;
        updateProfileHeader();
        return currentUser;
    } catch (error) {
        currentUser = null;
        setAuthDebug(`Sessione non letta: ${formatErrorMessage(error)}`);
        return null;
    }
}

async function ensureSessionReady(maxAttempts = 4, waitMs = 250) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const user = await fetchSession();
        if (user) return user;
        if (attempt < maxAttempts - 1) await delay(waitMs);
    }
    return null;
}

async function submitLogin(event) {
    event.preventDefault();
    clearAuthErrors();

    try {
        setAuthDebug('Invio login...');
        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value;
        const shouldRemember = document.getElementById('loginRemember')?.checked;
        const data = await apiPost(`${API.auth}?action=login`, { email, password });
        setAuthDebug('Login ok, confermo sessione...');
        primeSessionToken?.(data.sessionToken);
        saveRememberedLogin(email, password, shouldRemember);
        currentUser = data.user;
        updateProfileHeader();
        const sessionUser = await ensureSessionReady();
        if (!sessionUser) throw new Error('Sessione non confermata. Riprova tra un attimo.');
        setAuthDebug('Sessione confermata, avvio app...');
        setAuthLocked(false);
        await startApplication(true);
    } catch (error) {
        setAuthDebug(`Login fallito: ${formatErrorMessage(error)}`);
        document.getElementById('loginError').textContent = error.message || 'Accesso non riuscito';
    }
}

async function submitRegister(event) {
    event.preventDefault();
    clearAuthErrors();

    const password = document.getElementById('registerPassword').value;
    const confirm = document.getElementById('registerPasswordConfirm').value;
    if (password !== confirm) {
        document.getElementById('registerError').textContent = 'Le password non coincidono';
        return;
    }

    try {
        setAuthDebug('Creazione account...');
        const fullName = document.getElementById('registerName').value.trim();
        const email = document.getElementById('registerEmail').value.trim();
        const data = await apiPost(`${API.auth}?action=register`, { fullName, email, password });
        setAuthDebug('Account creato, confermo sessione...');
        primeSessionToken?.(data.sessionToken);
        currentUser = data.user;
        updateProfileHeader();
        const sessionUser = await ensureSessionReady();
        if (!sessionUser) throw new Error('Sessione non confermata. Riprova tra un attimo.');
        setAuthDebug('Sessione confermata, avvio app...');
        setAuthLocked(false);
        await startApplication(true);
    } catch (error) {
        setAuthDebug(`Registrazione fallita: ${formatErrorMessage(error)}`);
        document.getElementById('registerError').textContent = error.message || 'Registrazione non riuscita';
    }
}

async function logoutUser() {
    const cacheUserId = currentUser?.id;
    try {
        await apiPost(`${API.auth}?action=logout`, {});
    } catch (error) {
        console.error('Logout failed:', error);
    }

    clearSessionToken?.();
    currentUser = null;
    if (cacheUserId) {
        localStorage.removeItem(`${CACHE_KEY}:${cacheUserId}`);
    }
    reservations = [];
    rooms = [];
    guests = [];
    employees = [];
    workEntries = [];
    monthPayOverrides = [];
    complianceCerts = [];
    complianceDocs = [];
    agendaItems = [];
    clearAuthErrors();
    switchAuthMode('login');
    document.getElementById('loginForm')?.reset();
    document.getElementById('registerForm')?.reset();
    setAuthLocked(true);
    window.location.reload();
}

const TRANSLATIONS = {
    // Navigation & Layout
    'nav.dashboard': { en: 'Dashboard', it: 'Dashboard' },
    'nav.rooms': { en: 'Rooms', it: 'Camere' },
    'nav.calendar': { en: 'Calendar', it: 'Calendario' },
    'nav.settings': { en: 'Settings', it: 'Impostazioni' },
    'nav.receptionManager': { en: 'Reception Manager', it: 'Responsabile Reception' },
    'nav.admin': { en: 'Admin', it: 'Amministratore' },

    // Dashboard
    'dash.title': { en: 'Dashboard', it: 'Dashboard' },
    'dash.subtitle': { en: 'Overview of your hotel operations', it: 'Panoramica delle operazioni dell\'hotel' },
    'dash.newGroup': { en: 'New Group', it: 'Nuovo Gruppo' },
    'dash.activeGroups': { en: 'Active Groups', it: 'Gruppi Attivi' },
    'dash.totalGuests': { en: "Today's Guests", it: 'Ospiti Oggi' },
    'dash.roomsOccupied': { en: 'Rooms Occupied', it: 'Camere Occupate' },
    'dash.roomsAvailableMeta': { en: '{available} available', it: '{available} disponibili' },
    'dash.arrivalsDepartures': { en: 'Arrivals / Departures', it: 'Arrivi / Partenze' },
    'dash.arrivalsDeparturesMeta': { en: '{arrivals} arrivals, {departures} departures', it: '{arrivals} arrivi, {departures} partenze' },
    'dash.arrivalsToday': { en: 'Arrivals Today', it: 'Arrivi Oggi' },
    'dash.departuresToday': { en: 'Departures Today', it: 'Partenze Oggi' },
    'dash.pendingReservations': { en: 'Pending Reservations', it: 'In Attesa' },
    'dash.thisMonth': { en: 'This Month', it: 'Questo Mese' },
    'dash.thisYear': { en: 'This Year', it: 'Quest\'Anno' },
    'dash.upcomingCheckins': { en: 'Upcoming Check-ins', it: 'Check-in in Arrivo' },
    'dash.viewAll': { en: 'View All', it: 'Vedi Tutti' },
    'dash.noUpcoming': { en: 'No upcoming check-ins', it: 'Nessun check-in in arrivo' },
    'dash.todayActivity': { en: 'Today\'s Activity', it: 'Attività di Oggi' },
    'dash.noActivity': { en: 'No activity today', it: 'Nessuna attività oggi' },
    'dash.dailyAgenda': { en: 'Daily Agenda', it: 'Agenda Giornaliera' },
    'dash.dailyAgendaSubtitle': { en: 'Operational reminders and appointments, including future days', it: 'Promemoria operativi e appuntamenti programmati anche per i prossimi giorni' },
    'dash.todoDate': { en: 'Date', it: 'Data' },
    'dash.todoTime': { en: 'Time', it: 'Ora' },
    'dash.todoTask': { en: 'Task', it: 'Attivita' },
    'dash.todoPlaceholder': { en: 'E.g. boiler technician 14:30', it: 'Es. tecnico caldaia 14:30' },
    'dash.todayShortcut': { en: 'Today', it: 'Oggi' },
    'dash.addTask': { en: 'Add', it: 'Aggiungi' },
    'dash.noTasks': { en: 'No planned tasks', it: 'Nessuna attivita pianificata' },
    'dash.noTasksForDate': { en: 'No planned tasks for {date}', it: 'Nessuna attivita pianificata per {date}' },
    'dash.noTime': { en: 'No time', it: 'Senza orario' },
    'dash.deleteTask': { en: 'Delete task', it: 'Elimina attivita' },
    'dash.markTodoDone': { en: 'Mark task as done', it: 'Segna attivita come completata' },
    'dash.markTodoUndone': { en: 'Reopen task', it: 'Riapri attivita' },
    'dash.todoTextRequired': { en: 'Enter a task before saving', it: 'Inserisci un attivita prima di salvare' },
    'dash.taskSaved': { en: 'Task saved', it: 'Attivita salvata' },
    'dash.taskSaveFail': { en: 'Failed to save task', it: 'Salvataggio attivita fallito' },
    'dash.taskDeleted': { en: 'Task deleted', it: 'Attivita eliminata' },
    'dash.taskDeleteFail': { en: 'Failed to delete task', it: 'Eliminazione attivita fallita' },
    'dash.taskCompleted': { en: 'Task completed', it: 'Attivita completata' },
    'dash.taskReopened': { en: 'Task reopened', it: 'Attivita riaperta' },
    'dash.taskUpdateFail': { en: 'Failed to update task', it: 'Aggiornamento attivita fallito' },
    'dash.roomOccupancy': { en: 'Room Occupancy', it: 'Occupazione Camere' },
    'dash.occupied': { en: 'Occupied', it: 'Occupate' },
    'dash.available': { en: 'Available', it: 'Disponibili' },
    'dash.maintenance': { en: 'Maintenance', it: 'Manutenzione' },
    'dash.next7Days': { en: 'Next 7 Days', it: 'Prossimi 7 Giorni' },
    'dash.next7DaysSubtitle': { en: 'Requested rooms and expected guests day by day', it: 'Camere richieste e ospiti previsti giorno per giorno' },
    'dash.peakOccupancy': { en: 'Peak occupancy', it: 'Picco occupazione' },
    'dash.peakGuestLoad': { en: 'Peak guests', it: 'Picco ospiti' },
    'dash.busiestDay': { en: 'Busiest day', it: 'Giorno piu intenso' },
    'dash.reservationMix': { en: 'Reservation Mix', it: 'Mix Prenotazioni' },
    'dash.reservationMixSubtitle': { en: 'Distribution by status and average stay length', it: 'Distribuzione per stato e durata media soggiorno' },
    'dash.avgStay': { en: 'Average stay', it: 'Soggiorno medio' },
    'dash.arrivalsNextWeek': { en: 'Arrivals next 7 days', it: 'Arrivi 7g' },
    'dash.departuresNextWeek': { en: 'Departures next 7 days', it: 'Partenze 7g' },
    'dash.checkedIn': { en: 'Checked in', it: 'In casa' },
    'dash.percentOfTotal': { en: '{percent}% of total', it: '{percent}% del totale' },
    'dash.noReservationMix': { en: 'No reservation data yet', it: 'Nessun dato prenotazioni disponibile' },
    'dash.noTrendData': { en: 'No reservation trend available', it: 'Nessun andamento disponibile' },
    'dash.nightsShort': { en: '{count} nights', it: '{count} notti' },
    'dash.checkingIn': { en: 'checking in', it: 'in arrivo' },
    'dash.checkingOut': { en: 'checking out', it: 'in partenza' },
    'dash.guests': { en: 'guests', it: 'ospiti' },

    // Rooms page
    'rooms.title': { en: 'Rooms', it: 'Camere' },
    'rooms.subtitle': { en: 'Manage hotel rooms and availability', it: 'Gestisci le camere e la disponibilità' },
    'rooms.addRoom': { en: 'Add Room', it: 'Aggiungi Camera' },
    'rooms.searchRooms': { en: 'Search rooms...', it: 'Cerca camere...' },
    'rooms.all': { en: 'All', it: 'Tutte' },
    'rooms.available': { en: 'Available', it: 'Disponibili' },
    'rooms.occupied': { en: 'Occupied', it: 'Occupate' },
    'rooms.maintenance': { en: 'Maintenance', it: 'Manutenzione' },
    'rooms.noRooms': { en: 'No rooms found', it: 'Nessuna camera trovata' },
    'rooms.pax': { en: 'pax', it: 'posti' },
    'rooms.floor': { en: 'Floor', it: 'Piano' },
    'rooms.room': { en: 'Room', it: 'Camera' },
    'rooms.type': { en: 'Type', it: 'Tipo' },
    'rooms.capacity': { en: 'Capacity', it: 'Capacità' },
    'rooms.roomNumber': { en: 'Room Number', it: 'Numero Camera' },

    // Room types
    'roomType.single': { en: 'Single', it: 'Singola' },
    'roomType.double': { en: 'Double', it: 'Doppia' },
    'roomType.twin': { en: 'Twin', it: 'Twin' },
    'roomType.triple': { en: 'Triple', it: 'Tripla' },
    'roomType.quad': { en: 'Quad', it: 'Quadrupla' },
    'roomType.suite': { en: 'Suite', it: 'Suite' },
    'roomType.family': { en: 'Family', it: 'Familiare' },

    // Calendar / Planner
    'cal.title': { en: 'Calendar', it: 'Calendario' },
    'cal.today': { en: 'Today', it: 'Oggi' },
    'cal.newBooking': { en: 'New Booking', it: 'Nuova Prenotazione' },
    'cal.confirmed': { en: 'Confirmed', it: 'Confermata' },
    'cal.pending': { en: 'Pending', it: 'In Attesa' },
    'cal.room': { en: 'Room', it: 'Camera' },
    'cal.available': { en: 'Available', it: 'Disponibili' },
    'cal.occupied': { en: 'Occupied', it: 'Occupate' },
    'cal.nights': { en: 'night', it: 'notte' },
    'cal.nightsPlural': { en: 'nights', it: 'notti' },
    'cal.roomSingular': { en: 'room', it: 'camera' },
    'cal.roomPlural': { en: 'rooms', it: 'camere' },
    'cal.guestSingular': { en: 'guest', it: 'ospite' },
    'cal.guestPlural': { en: 'guests', it: 'ospiti' },
    'cal.expires': { en: 'Expires', it: 'Scade il' },
    'cal.expiringToday': { en: 'Expiring today', it: 'In scadenza oggi' },

    // Days & Months
    'days.short': { en: ['Su','Mo','Tu','We','Th','Fr','Sa'], it: ['Do','Lu','Ma','Me','Gi','Ve','Sa'] },
    'days.datepicker': { en: ['Mo','Tu','We','Th','Fr','Sa','Su'], it: ['Lu','Ma','Me','Gi','Ve','Sa','Do'] },
    'months.full': { en: ['January','February','March','April','May','June','July','August','September','October','November','December'], it: ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'] },
    'months.dayHeaders': { en: ['Mo','Tu','We','Th','Fr','Sa','Su'], it: ['Lu','Ma','Me','Gi','Ve','Sa','Do'] },
    'months.short': { en: ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'], it: ['GEN','FEB','MAR','APR','MAG','GIU','LUG','AGO','SET','OTT','NOV','DIC'] },

    // Navigation
    'nav.reservations': { en: 'Reservations', it: 'Prenotazioni' },

    // Reservations page
    'res.pageTitle': { en: 'Reservations', it: 'Prenotazioni' },
    'res.pageSubtitle': { en: 'Manage groups and individual reservations', it: 'Gestisci gruppi e prenotazioni individuali' },
    'res.newGroup': { en: 'New Group', it: 'Nuovo Gruppo' },
    'res.newIndividual': { en: 'New Individual', it: 'Nuova Individuale' },
    'res.filterAll': { en: 'All', it: 'Tutti' },
    'res.typeGroup': { en: 'Group', it: 'Gruppo' },
    'res.typeIndividual': { en: 'Individual', it: 'Individuale' },
    'res.newBooking': { en: 'New Reservation', it: 'Nuova Prenotazione' },
    'res.chooserGroupDesc': { en: 'Multiple guests, room planner', it: 'Più ospiti, planner camere' },
    'res.chooserIndDesc': { en: 'Single guest, single room', it: 'Ospite singolo, camera singola' },

    // Individual reservation fields
    'ind.firstName': { en: 'First Name', it: 'Nome' },
    'ind.lastName': { en: 'Last Name', it: 'Cognome' },
    'ind.phone': { en: 'Phone', it: 'Telefono' },
    'ind.email': { en: 'Email', it: 'Email' },
    'ind.room': { en: 'Room', it: 'Camera' },
    'ind.pricePerNight': { en: 'Price/Night (€)', it: 'Prezzo/Notte (€)' },

    // Reservations
    'res.newGroupReservation': { en: 'New Group Reservation', it: 'Nuova Prenotazione Gruppo' },
    'res.editReservation': { en: 'Edit Reservation', it: 'Modifica Prenotazione' },
    'res.groupName': { en: 'Group Name', it: 'Nome Gruppo' },
    'res.groupNamePlaceholder': { en: 'e.g. Smith Family Reunion', it: 'es. Famiglia Rossi' },
    'res.checkin': { en: 'Check-in', it: 'Check-in' },
    'res.checkout': { en: 'Check-out', it: 'Check-out' },
    'res.status': { en: 'Status', it: 'Stato' },
    'res.pending': { en: 'Pending', it: 'In Attesa' },
    'res.confirmed': { en: 'Confirmed', it: 'Confermata' },
    'res.checkedIn': { en: 'Checked-in', it: 'Registrato' },
    'res.cancelled': { en: 'Cancelled', it: 'Cancellata' },
    'res.expirationDate': { en: 'Expiration Date', it: 'Data Scadenza' },
    'res.totalPrice': { en: 'Total Price', it: 'Prezzo Totale' },
    'res.pricePerPerson': { en: 'Price/Person (\u20AC)', it: 'Prezzo/Persona (\u20AC)' },
    'res.gratuity': { en: 'Gratuity', it: 'Gratuità' },
    'res.mealPlan': { en: 'Meal Plan', it: 'Piano Pasti' },
    'res.guests': { en: 'Guests', it: 'Ospiti' },
    'res.freeGuests': { en: 'free guests', it: 'ospiti gratuiti' },
    'res.notes': { en: 'Notes', it: 'Note' },
    'res.notesPlaceholder': { en: 'Special requests, dietary needs, etc.', it: 'Richieste speciali, esigenze alimentari, ecc.' },
    'res.rooms': { en: 'Rooms', it: 'Camere' },
    'res.selectAll': { en: 'Select All', it: 'Seleziona Tutte' },
    'res.roomsSelected': { en: 'rooms selected', it: 'camere selezionate' },
    'res.roomSelected': { en: 'room selected', it: 'camera selezionata' },
    'res.selectDate': { en: 'Select date...', it: 'Seleziona data...' },
    'res.saveReservation': { en: 'Save Reservation', it: 'Salva Prenotazione' },
    'res.noReservations': { en: 'No reservations found', it: 'Nessuna prenotazione trovata' },
    'res.noRoomsYet': { en: 'No rooms yet.<br>Add rooms first.', it: 'Nessuna camera.<br>Aggiungi prima le camere.' },
    'res.nights': { en: 'Nights', it: 'Notti' },
    'res.guests': { en: 'Guests', it: 'Ospiti' },

    // Reservation Detail
    'detail.groupDetails': { en: 'Group Details', it: 'Dettagli Gruppo' },
    'detail.edit': { en: 'Edit', it: 'Modifica' },
    'detail.roomPlanner': { en: 'Room Planner', it: 'Assegnazione Camere' },
    'detail.manageGuests': { en: 'Manage Guests', it: 'Gestisci Ospiti' },
    'detail.delete': { en: 'Delete', it: 'Elimina' },
    'detail.expires': { en: 'Expires', it: 'Scadenza' },
    'detail.addNotes': { en: 'Add notes about this reservation...', it: 'Aggiungi note su questa prenotazione...' },
    'detail.saveNotes': { en: 'Save Notes', it: 'Salva Note' },
    'detail.schedine': { en: 'Schedine Alloggiati', it: 'Schedine Alloggiati' },
    'detail.schedineDesc': { en: 'Send guest registration forms to the Italian police (Alloggiati Web).', it: 'Invia le schedine alla Polizia di Stato (Alloggiati Web).' },
    'detail.previewRecords': { en: 'Preview Records', it: 'Anteprima' },
    'detail.test': { en: 'Test', it: 'Test' },
    'detail.sendToPolice': { en: 'Send to Police', it: 'Invia alla Polizia' },
    'detail.files': { en: 'Attached Files', it: 'File Allegati' },
    'detail.uploadFile': { en: 'Upload File', it: 'Carica File' },
    'detail.noFiles': { en: 'No files attached', it: 'Nessun file allegato' },
    'detail.fileMaxSize': { en: 'Max 3MB per file', it: 'Max 3MB per file' },
    'toast.fileUploaded': { en: 'File uploaded', it: 'File caricato' },
    'toast.fileUploadFail': { en: 'Failed to upload file', it: 'Caricamento file fallito' },
    'toast.fileDeleted': { en: 'File deleted', it: 'File eliminato' },
    'toast.fileDeleteFail': { en: 'Failed to delete file', it: 'Eliminazione file fallita' },
    'toast.fileTooLarge': { en: 'File too large (max 3MB)', it: 'File troppo grande (max 3MB)' },
    'guest.regType': { en: 'Registration type', it: 'Tipo registrazione' },
    'guest.regSingle': { en: 'Single Guests', it: 'Ospiti Singoli' },
    'guest.regGroup': { en: 'Group', it: 'Gruppo' },
    'guest.setLeader': { en: 'Set as Leader', it: 'Capogruppo' },
    'guest.leader': { en: 'Leader', it: 'Capogruppo' },
    'guest.member': { en: 'Member', it: 'Membro' },
    'guest.missingFields': { en: 'Missing', it: 'Mancano' },
    'guest.schedineErrors': { en: 'errors in schedine', it: 'errori nelle schedine' },
    'guest.noErrors': { en: 'All schedine are valid', it: 'Tutte le schedine sono valide' },
    'guestList.search': { en: 'Search guest...', it: 'Cerca ospite...' },

    // Guest list modal
    'guestList.title': { en: 'Guests', it: 'Ospiti' },
    'guestList.importFromFile': { en: 'Import from File', it: 'Importa da File' },
    'guestList.addGuest': { en: 'Add Guest', it: 'Aggiungi Ospite' },
    'guestList.noGuests': { en: 'No guests added yet', it: 'Nessun ospite aggiunto' },
    'guestList.noRoomAssigned': { en: 'No room assigned', it: 'Nessuna camera assegnata' },
    'guestList.edit': { en: 'Edit', it: 'Modifica' },
    'guestList.remove': { en: 'Remove', it: 'Rimuovi' },
    'guestList.removeAll': { en: 'Remove All', it: 'Rimuovi Tutti' },
    'confirm.removeAllGuests': { en: 'Remove all guests from this reservation?', it: 'Rimuovere tutti gli ospiti da questa prenotazione?' },
    'toast.allGuestsRemoved': { en: 'All guests removed', it: 'Tutti gli ospiti rimossi' },

    // Guest form
    'guest.addToGroup': { en: 'Add Guest to Group', it: 'Aggiungi Ospite al Gruppo' },
    'guest.personalInfo': { en: 'Personal Info', it: 'Dati Personali' },
    'guest.lastName': { en: 'Last Name (Cognome)', it: 'Cognome' },
    'guest.firstName': { en: 'First Name (Nome)', it: 'Nome' },
    'guest.sex': { en: 'Sex (Sesso)', it: 'Sesso' },
    'guest.select': { en: 'Select...', it: 'Seleziona...' },
    'guest.dateOfBirth': { en: 'Date of Birth', it: 'Data di Nascita' },
    'guest.citizenship': { en: 'Citizenship', it: 'Cittadinanza' },
    'guest.searchCountry': { en: 'Search country...', it: 'Cerca nazione...' },
    'guest.guestType': { en: 'Guest Type (Tipo Alloggiato)', it: 'Tipo Alloggiato' },
    'guest.birthPlace': { en: 'Birth Place (Luogo di Nascita)', it: 'Luogo di Nascita' },
    'guest.country': { en: 'Country', it: 'Nazione' },
    'guest.comune': { en: 'Comune', it: 'Comune' },
    'guest.searchComune': { en: 'Search comune...', it: 'Cerca comune...' },
    'guest.province': { en: 'Province (Sigla)', it: 'Provincia (Sigla)' },
    'guest.provincePlaceholder': { en: 'e.g. RM, MI', it: 'es. RM, MI' },
    'guest.document': { en: 'Document (Documento)', it: 'Documento' },
    'guest.docType': { en: 'Document Type (Codice)', it: 'Tipo Documento (Codice)' },
    'guest.docNumber': { en: 'Document Number', it: 'Numero Documento' },
    'guest.issuedPlace': { en: 'Issued Place', it: 'Luogo Rilascio' },
    'guest.searchPlace': { en: 'Search place...', it: 'Cerca luogo...' },
    'guest.other': { en: 'Other', it: 'Altro' },
    'guest.email': { en: 'Email', it: 'Email' },
    'guest.phone': { en: 'Phone', it: 'Telefono' },
    'guest.assignedRoom': { en: 'Assigned Room', it: 'Camera Assegnata' },
    'guest.unassigned': { en: 'Unassigned', it: 'Non assegnata' },
    'guest.notesPlaceholder': { en: 'Allergies, preferences...', it: 'Allergie, preferenze...' },
    'guest.saveGuest': { en: 'Save Guest', it: 'Salva Ospite' },

    // Guests page
    'guests.title': { en: 'Guests', it: 'Ospiti' },
    'guests.subtitle': { en: 'All guests across groups', it: 'Tutti gli ospiti dei gruppi' },
    'guests.searchGuests': { en: 'Search guests...', it: 'Cerca ospiti...' },
    'guests.guest': { en: 'Guest', it: 'Ospite' },
    'guests.group': { en: 'Group', it: 'Gruppo' },
    'guests.room': { en: 'Room', it: 'Camera' },
    'guests.checkin': { en: 'Check-in', it: 'Check-in' },
    'guests.checkout': { en: 'Check-out', it: 'Check-out' },
    'guests.status': { en: 'Status', it: 'Stato' },
    'guests.noGuests': { en: 'No guests found', it: 'Nessun ospite trovato' },
    'guests.unknown': { en: 'unknown', it: 'sconosciuto' },

    // Room assignment / planner
    'assign.title': { en: 'Assign Rooms to Group', it: 'Assegna Camere al Gruppo' },
    'assign.selectRooms': { en: 'Select rooms for', it: 'Seleziona le camere per' },
    'assign.needed': { en: 'needed', it: 'necessarie' },
    'assign.done': { en: 'Done', it: 'Fatto' },
    'assign.roomPlanner': { en: 'Room Planner', it: 'Assegnazione Camere' },
    'assign.usage': { en: 'Usage', it: 'Utilizzo' },
    'assign.group': { en: 'Group', it: 'Gruppo' },
    'assign.occ': { en: 'Occ.', it: 'Occ.' },
    'assign.notes': { en: 'Notes', it: 'Note' },
    'assign.removeColumn': { en: 'Remove column', it: 'Rimuovi colonna' },
    'assign.addColumn': { en: 'Add column', it: 'Aggiungi colonna' },
    'assign.roomsAssigned': { en: 'Rooms assigned', it: 'Camere assegnate' },
    'assign.columns': { en: 'Columns', it: 'Colonne' },
    'assign.column': { en: 'Column', it: 'Colonna' },
    'assign.save': { en: 'Save', it: 'Salva' },

    // Settings
    'settings.title': { en: 'Settings', it: 'Impostazioni' },
    'settings.theme': { en: 'Theme', it: 'Tema' },
    'settings.light': { en: 'Light', it: 'Chiaro' },
    'settings.dark': { en: 'Dark', it: 'Scuro' },
    'settings.auto': { en: 'Auto', it: 'Auto' },
    'settings.language': { en: 'Language', it: 'Lingua' },
    'settings.calColumnWidth': { en: 'Calendar Column Width', it: 'Larghezza Colonna Calendario' },
    'settings.calRowHeight': { en: 'Calendar Row Height', it: 'Altezza Riga Calendario' },
    'settings.importScidoo': { en: 'Import Reservations from Scidoo', it: 'Importa Prenotazioni da Scidoo' },
    'settings.importScidooDesc': { en: 'Upload a CSV exported from Scidoo. You\'ll map columns before importing.', it: 'Carica un CSV esportato da Scidoo. Mapperai le colonne prima dell\'importazione.' },
    'settings.chooseCsv': { en: 'Choose CSV File', it: 'Scegli File CSV' },

    // CSV Import
    'csv.importReservations': { en: 'Import Reservations', it: 'Importa Prenotazioni' },
    'csv.mapColumns': { en: 'Map CSV Columns', it: 'Mappa Colonne CSV' },
    'csv.mapDesc': { en: 'Match each GroupStay field to a column from your CSV. Leave empty to skip.', it: 'Associa ogni campo a una colonna del CSV. Lascia vuoto per saltare.' },
    'csv.preview': { en: 'Preview', it: 'Anteprima' },
    'csv.importAll': { en: 'Import All', it: 'Importa Tutto' },
    'csv.skip': { en: '— skip —', it: '— salta —' },
    'csv.noValidRows': { en: 'No valid rows. Check your column mapping.', it: 'Nessuna riga valida. Controlla la mappatura delle colonne.' },
    'csv.groupName': { en: 'Group Name', it: 'Nome Gruppo' },
    'csv.checkinDate': { en: 'Check-in Date', it: 'Data Check-in' },
    'csv.checkoutDate': { en: 'Check-out Date', it: 'Data Check-out' },
    'csv.roomCount': { en: 'Room Count', it: 'Numero Camere' },
    'csv.status': { en: 'Status', it: 'Stato' },
    'csv.price': { en: 'Price', it: 'Prezzo' },
    'csv.notes': { en: 'Notes', it: 'Note' },
    'csv.guestCount': { en: 'Guest Count', it: 'Numero Ospiti' },

    // File import
    'file.importGuests': { en: 'Import Guests from File', it: 'Importa Ospiti da File' },
    'file.dropHere': { en: 'Drop file here or', it: 'Trascina il file qui o' },
    'file.browse': { en: 'browse', it: 'sfoglia' },
    'file.supports': { en: 'Supports PDF, Word (.docx), Excel (.xlsx)', it: 'Supporta PDF, Word (.docx), Excel (.xlsx)' },
    'file.extracting': { en: 'Extracting and parsing guest data...', it: 'Estrazione e analisi dei dati degli ospiti...' },
    'file.extractedText': { en: 'Extracted Text', it: 'Testo Estratto' },
    'file.preview': { en: 'Preview', it: 'Anteprima' },
    'file.importAll': { en: 'Import All', it: 'Importa Tutto' },

    // Guest import fields
    'field.lastName': { en: 'Last Name', it: 'Cognome' },
    'field.firstName': { en: 'First Name', it: 'Nome' },
    'field.sex': { en: 'Sex', it: 'Sesso' },
    'field.birthDate': { en: 'Date of Birth', it: 'Data di Nascita' },
    'field.birthCity': { en: 'Birth City', it: 'Città di Nascita' },
    'field.birthComune': { en: 'Birth Comune', it: 'Comune di Nascita' },
    'field.residenceComune': { en: 'Residence Comune', it: 'Comune di Residenza' },
    'field.birthProvince': { en: 'Birth Province', it: 'Provincia di Nascita' },
    'field.birthCountry': { en: 'Birth Country', it: 'Nazione di Nascita' },
    'field.citizenship': { en: 'Citizenship', it: 'Cittadinanza' },
    'field.docType': { en: 'Document Type', it: 'Tipo Documento' },
    'field.docNumber': { en: 'Document Number', it: 'Numero Documento' },
    'field.docIssuedPlace': { en: 'Doc Issued Place', it: 'Luogo Rilascio Doc.' },
    'field.email': { en: 'Email', it: 'Email' },
    'field.phone': { en: 'Phone', it: 'Telefono' },
    'field.guestType': { en: 'Guest Type', it: 'Tipo Alloggiato' },

    // Common
    'common.cancel': { en: 'Cancel', it: 'Annulla' },
    'common.save': { en: 'Save', it: 'Salva' },
    'common.delete': { en: 'Delete', it: 'Elimina' },
    'common.edit': { en: 'Edit', it: 'Modifica' },
    'common.close': { en: 'Close', it: 'Chiudi' },

    // Toast messages
    'toast.dbError': { en: 'Failed to connect to database', it: 'Connessione al database fallita' },
    'toast.checkoutAfterCheckin': { en: 'Check-out must be after check-in', it: 'Il check-out deve essere successivo al check-in' },
    'toast.selectRoom': { en: 'Please select at least one room', it: 'Seleziona almeno una camera' },
    'toast.resUpdated': { en: 'Reservation updated', it: 'Prenotazione aggiornata' },
    'toast.resCreated': { en: 'Group reservation created', it: 'Prenotazione gruppo creata' },
    'toast.resSaveFail': { en: 'Failed to save reservation', it: 'Salvataggio prenotazione fallito' },
    'toast.resDeleted': { en: 'Reservation deleted', it: 'Prenotazione eliminata' },
    'toast.resDeleteFail': { en: 'Failed to delete reservation', it: 'Eliminazione prenotazione fallita' },
    'toast.notesSaved': { en: 'Notes saved', it: 'Note salvate' },
    'toast.notesSaveFail': { en: 'Failed to save notes', it: 'Salvataggio note fallito' },
    'toast.assignSaved': { en: 'Room assignments saved', it: 'Assegnazioni camere salvate' },
    'toast.assignSaveFail': { en: 'Failed to save assignments', it: 'Salvataggio assegnazioni fallito' },
    'toast.assignRoomFail': { en: 'Failed to save room assignment', it: 'Salvataggio assegnazione camera fallito' },
    'toast.roomUpdated': { en: 'Room updated', it: 'Camera aggiornata' },
    'toast.roomExists': { en: 'Room number already exists', it: 'Numero camera già esistente' },
    'toast.roomAdded': { en: 'Room added', it: 'Camera aggiunta' },
    'toast.roomSaveFail': { en: 'Failed to save room', it: 'Salvataggio camera fallito' },
    'toast.roomDeleted': { en: 'Room deleted', it: 'Camera eliminata' },
    'toast.roomDeleteFail': { en: 'Failed to delete room', it: 'Eliminazione camera fallita' },
    'toast.guestUpdated': { en: 'Guest updated', it: 'Ospite aggiornato' },
    'toast.guestAdded': { en: 'Guest added to group', it: 'Ospite aggiunto al gruppo' },
    'toast.guestSaveFail': { en: 'Failed to save guest', it: 'Salvataggio ospite fallito' },
    'toast.guestRemoved': { en: 'Guest removed', it: 'Ospite rimosso' },
    'toast.guestRemoveFail': { en: 'Failed to delete guest', it: 'Eliminazione ospite fallita' },
    'toast.csvParseFail': { en: 'Could not parse CSV file', it: 'Impossibile leggere il file CSV' },
    'toast.csvMappingRequired': { en: 'Group Name, Check-in and Check-out mappings are required', it: 'Nome Gruppo, Check-in e Check-out sono obbligatori' },
    'toast.noValidRows': { en: 'No valid rows to import', it: 'Nessuna riga valida da importare' },
    'toast.unsupportedFile': { en: 'Unsupported file type. Use PDF, DOCX, or XLSX.', it: 'Tipo file non supportato. Usa PDF, DOCX o XLSX.' },
    'toast.fileFail': { en: 'Failed to process file', it: 'Elaborazione file fallita' },
    'toast.noDataSpreadsheet': { en: 'No data found in spreadsheet', it: 'Nessun dato trovato nel foglio di calcolo' },
    'toast.noGuestsSpreadsheet': { en: 'Could not detect guest data in spreadsheet. Check that it contains names.', it: 'Dati ospiti non rilevati nel foglio. Verifica che contenga dei nomi.' },
    'toast.pdfNotLoaded': { en: 'PDF library not loaded yet. Please try again.', it: 'Libreria PDF non ancora caricata. Riprova.' },
    'toast.pdfNoText': { en: 'Could not extract text from PDF. It may be a scanned image.', it: 'Impossibile estrarre il testo dal PDF. Potrebbe essere un\'immagine scansionata.' },
    'toast.docxNotLoaded': { en: 'Word library not loaded yet. Please try again.', it: 'Libreria Word non ancora caricata. Riprova.' },
    'toast.docxNoText': { en: 'Could not extract text from document.', it: 'Impossibile estrarre il testo dal documento.' },
    'toast.noGuestsDetected': { en: 'Could not detect any guest data. Check the extracted text.', it: 'Nessun dato ospite rilevato. Controlla il testo estratto.' },
    'toast.noValidGuests': { en: 'No valid guests to import', it: 'Nessun ospite valido da importare' },
    'toast.schedineOk': { en: 'All schedine sent successfully!', it: 'Tutte le schedine inviate con successo!' },

    // Confirm messages
    'confirm.deleteReservation': { en: 'Delete this group reservation and all associated guests?', it: 'Eliminare questa prenotazione gruppo e tutti gli ospiti associati?' },
    'confirm.sendSchedule': { en: 'Send schedine to the police? Make sure you tested first.', it: 'Inviare le schedine alla Polizia? Assicurati di aver fatto prima il test.' },
    'confirm.removeColumn': { en: 'Remove column', it: 'Rimuovere la colonna' },
    'confirm.removeColumnData': { en: 'Data in this column will be lost on save.', it: 'I dati di questa colonna verranno persi al salvataggio.' },
    'confirm.deleteRoom': { en: 'Delete this room?', it: 'Eliminare questa camera?' },
    'confirm.removeGuest': { en: 'Remove this guest?', it: 'Rimuovere questo ospite?' },
    'confirm.importReservations': { en: 'Import {n} reservations?', it: 'Importare {n} prenotazioni?' },
    'confirm.importGuests': { en: 'Import {n} guest(s) into this reservation?', it: 'Importare {n} ospite/i in questa prenotazione?' },

    // Guest preview table
    'preview.guestsFound': { en: 'guest(s) found', it: 'ospite/i trovato/i' },
    'preview.noGuestsDetected': { en: 'No guests detected. Try a different file or check the extracted text above.', it: 'Nessun ospite rilevato. Prova un file diverso o controlla il testo estratto sopra.' },
    'preview.showingFirst': { en: 'Showing first 20 of', it: 'Primi 20 di' },
    'preview.docNo': { en: 'Doc No.', it: 'N. Doc.' },
    'preview.birthDate': { en: 'Birth Date', it: 'Data Nascita' },

    // Employees
    'nav.employees': { en: 'Employees', it: 'Dipendenti' },
    'nav.management': { en: 'Management', it: 'Gestione' },
    'mgmt.title': { en: 'Management', it: 'Gestione' },
    'mgmt.subtitle': { en: 'Revenue, employees, attendance and payroll', it: 'Guadagni, dipendenti, presenze e retribuzioni' },
    'emp.title': { en: 'Employees', it: 'Dipendenti' },
    'emp.subtitle': { en: 'Manage employees, attendance and payroll', it: 'Gestisci dipendenti, presenze e retribuzioni' },
    'emp.addEmployee': { en: 'Add Employee', it: 'Aggiungi Dipendente' },
    'emp.editEmployee': { en: 'Edit Employee', it: 'Modifica Dipendente' },
    'emp.searchEmployees': { en: 'Search employees...', it: 'Cerca dipendenti...' },
    'emp.firstName': { en: 'First Name', it: 'Nome' },
    'emp.lastName': { en: 'Last Name', it: 'Cognome' },
    'emp.role': { en: 'Role', it: 'Ruolo' },
    'emp.rolePlaceholder': { en: 'e.g. Receptionist, Waiter...', it: 'es. Receptionist, Cameriere...' },
    'emp.payType': { en: 'Pay Type', it: 'Tipo Retribuzione' },
    'emp.monthly': { en: 'Monthly', it: 'Mensile' },
    'emp.hourly': { en: 'Hourly', it: 'Oraria' },
    'emp.monthlyPay': { en: 'Monthly Pay', it: 'Retribuzione Mensile' },
    'emp.hourlyPay': { en: 'Hourly Rate', it: 'Tariffa Oraria' },
    'emp.daysWorked': { en: 'Days', it: 'Giorni' },
    'emp.hoursWorked': { en: 'Hours', it: 'Ore' },
    'emp.estimatedPay': { en: 'Est. Pay', it: 'Retrib. Stimata' },
    'emp.addWorkDay': { en: 'Add Work Day', it: 'Aggiungi Giornata' },
    'emp.editWorkDay': { en: 'Edit Work Day', it: 'Modifica Giornata' },
    'emp.date': { en: 'Date', it: 'Data' },
    'emp.hours': { en: 'Hours Worked', it: 'Ore Lavorate' },
    'emp.noEmployees': { en: 'No employees yet', it: 'Nessun dipendente' },
    'emp.noWorkDays': { en: 'No work days recorded this month', it: 'Nessuna giornata registrata questo mese' },
    'emp.monthlySummary': { en: 'Monthly Summary', it: 'Riepilogo Mensile' },
    'emp.workDays': { en: 'Work Days', it: 'Giornate Lavorative' },
    'emp.totalHours': { en: 'Total Hours', it: 'Ore Totali' },
    'emp.daysInMonth': { en: 'Days in Month', it: 'Giorni nel Mese' },
    'emp.actions': { en: 'Actions', it: 'Azioni' },
    'emp.enterHours': { en: 'Enter hours worked (0 to remove):', it: 'Inserisci ore lavorate (0 per rimuovere):' },
    'emp.calHintHourly': { en: 'Click a day to enter hours worked. Click again to edit or enter 0 to remove.', it: 'Clicca un giorno per inserire le ore. Clicca di nuovo per modificare o inserisci 0 per rimuovere.' },
    'emp.calHintMonthly': { en: 'Click a day to mark as worked. Click again to unmark.', it: 'Clicca un giorno per segnarlo come lavorato. Clicca di nuovo per rimuovere.' },
    'emp.startTime': { en: 'Start', it: 'Inizio' },
    'emp.endTime': { en: 'End', it: 'Fine' },
    'emp.totalCol': { en: 'Total', it: 'Totale' },
    'emp.save': { en: 'Save', it: 'Salva' },
    'emp.delete': { en: 'Delete', it: 'Elimina' },
    'emp.employee': { en: 'Employee', it: 'Dipendente' },
    'emp.type': { en: 'Type', it: 'Tipo' },
    'toast.empSaved': { en: 'Employee saved', it: 'Dipendente salvato' },
    'toast.empSaveFail': { en: 'Failed to save employee', it: 'Salvataggio dipendente fallito' },
    'toast.empDeleted': { en: 'Employee deleted', it: 'Dipendente eliminato' },
    'toast.empDeleteFail': { en: 'Failed to delete employee', it: 'Eliminazione dipendente fallita' },
    'toast.workSaved': { en: 'Work entry saved', it: 'Giornata salvata' },
    'toast.workSaveFail': { en: 'Failed to save work entry', it: 'Salvataggio giornata fallito' },
    'toast.workDeleted': { en: 'Work entry deleted', it: 'Giornata eliminata' },
    'toast.workDeleteFail': { en: 'Failed to delete work entry', it: 'Eliminazione giornata fallita' },
    'confirm.deleteEmployee': { en: 'Delete this employee and all their work records?', it: 'Eliminare questo dipendente e tutte le sue presenze?' },
    'confirm.deleteWorkEntry': { en: 'Delete this work entry?', it: 'Eliminare questa giornata?' },
    'assign.roomRequest': { en: 'Room request notes', it: 'Note richiesta camere' },
    'assign.roomRequestPlaceholder': { en: 'e.g. 10 double, 5 twin, 3 quad...', it: 'es. 10 doppie, 5 twin, 3 quadruple...' },
    'assign.print': { en: 'Print', it: 'Stampa' },
    'assign.printCleaning': { en: 'Print Cleaning', it: 'Stampa Pulizie' },
    'assign.roomType': { en: 'Type', it: 'Tipo' },
    'pin.title': { en: 'Enter PIN', it: 'Inserisci PIN' },
    'pin.placeholder': { en: 'Enter 4-digit PIN', it: 'Inserisci PIN a 4 cifre' },
    'pin.unlock': { en: 'Unlock', it: 'Sblocca' },
    'pin.wrong': { en: 'Wrong PIN', it: 'PIN errato' },
    'settings.empPin': { en: 'Management Section PIN', it: 'PIN Sezione Gestione' },
    'settings.empPinDesc': { en: 'Set a 4-digit PIN to protect access to management', it: 'Imposta un PIN a 4 cifre per proteggere l\'accesso alla gestione' },
    'settings.empPinPlaceholder': { en: 'Enter 4-digit PIN', it: 'Inserisci PIN a 4 cifre' },
    'settings.empPinSave': { en: 'Save PIN', it: 'Salva PIN' },
    'settings.empPinRemove': { en: 'Remove PIN', it: 'Rimuovi PIN' },
    'settings.empPinSaved': { en: 'PIN saved', it: 'PIN salvato' },
    'settings.empPinRemoved': { en: 'PIN removed', it: 'PIN rimosso' },
    'settings.empPinInvalid': { en: 'PIN must be 4 digits', it: 'Il PIN deve essere di 4 cifre' },
};

function t(key, replacements) {
    const entry = TRANSLATIONS[key];
    if (!entry) return key;
    let text = entry[currentLang] || entry['en'] || key;
    if (replacements) {
        for (const [k, v] of Object.entries(replacements)) {
            text = text.replace(`{${k}}`, v);
        }
    }
    return text;
}

function setLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('gs_lang', lang);
    applyTranslations();
    updateProfileHeader();
    // Re-render current page
    const activePage = document.querySelector('.page.active');
    if (activePage) {
        const pageId = activePage.id.replace('page-', '');
        navigateTo(pageId);
    }
}

function applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        el.textContent = t(key);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        el.placeholder = t(key);
    });
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        el.title = t(key);
    });
    document.querySelectorAll('[data-i18n-html]').forEach(el => {
        const key = el.getAttribute('data-i18n-html');
        el.innerHTML = t(key);
    });
    // Update language toggle buttons
    document.querySelectorAll('[data-lang-val]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.langVal === currentLang);
    });
    document.documentElement.setAttribute('lang', currentLang);
}

// ---- HELPERS ----

function calcReservationPrice() {
    const guestCount = parseInt(document.getElementById('resGuestCount').value) || 0;
    const pricePerPerson = parseFloat(document.getElementById('resPricePerPerson').value) || 0;
    const gratuity = parseInt(document.getElementById('resGratuity').value) || 0;
    const checkin = document.getElementById('resCheckin').value;
    const checkout = document.getElementById('resCheckout').value;

    const nights = (checkin && checkout) ? nightsBetween(checkin, checkout) : 0;
    const freeGuests = gratuity > 0 ? Math.floor(guestCount / gratuity) : 0;
    const payingGuests = Math.max(0, guestCount - freeGuests);
    const total = payingGuests * nights * pricePerPerson;

    document.getElementById('resPrice').value = total;
    const display = document.getElementById('resTotalPrice');
    display.textContent = '\u20AC' + total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const presenze = payingGuests * nights;
    let detail = '';
    if (freeGuests > 0) detail += `${freeGuests} gratuiti, `;
    if (presenze > 0) detail += `${presenze} presenze`;
    if (detail) {
        display.innerHTML += ` <span class="res-calc-detail">(${detail})</span>`;
    }
}

function getInitials(name) {
    return name.split(' ').map(w => w[0]).join('').toUpperCase().substring(0, 2);
}

// ---- NAVIGATION ----

let empPinUnlocked = false;

function isMobileViewport() {
    return window.matchMedia('(max-width: 768px)').matches;
}

function resolveActiveNavPage(page) {
    if (isMobileViewport() && ['management', 'compliance'].includes(page)) {
        return 'more';
    }
    return page;
}

function syncAppViewportState() {
    const vv = window.visualViewport;
    const viewportHeight = vv ? vv.height : window.innerHeight;
    const viewportWidth = vv ? vv.width : window.innerWidth;
    const keyboardOpen = vv ? (window.innerHeight - vv.height) > 140 : false;
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

    document.documentElement.style.setProperty('--app-height', `${Math.round(viewportHeight)}px`);
    document.documentElement.style.setProperty('--app-width', `${Math.round(viewportWidth)}px`);
    document.body.classList.toggle('is-mobile-viewport', isMobileViewport());
    document.body.classList.toggle('is-ios', !!isIos);
    document.body.classList.toggle('is-standalone', !!isStandalone);
    document.body.classList.toggle('keyboard-open', keyboardOpen);
}

function navigateTo(page) {
    if (page === 'more' && isMobileViewport()) {
        openModal('mobileMoreModal');
        document.querySelectorAll('.nav-item, .tab-item').forEach((n) => n.classList.remove('active'));
        document.querySelectorAll('[data-page="more"]').forEach((n) => n.classList.add('active'));
        return;
    }

    // Check PIN protection for management page (ask every time)
    if (page === 'management' && !empPinUnlocked) {
        const pin = localStorage.getItem('gs_emp_pin');
        if (pin) {
            openPinModal();
            return;
        }
    }

    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item, .tab-item').forEach(n => n.classList.remove('active'));
    closeModal('mobileMoreModal');

    const pageEl = document.getElementById('page-' + page);
    if (pageEl) {
        pageEl.classList.remove('active');
        // Force reflow for animation
        void pageEl.offsetWidth;
        pageEl.classList.add('active');
    }

    const navPage = resolveActiveNavPage(page);
    document.querySelectorAll(`[data-page="${navPage}"]`).forEach(n => n.classList.add('active'));
    document.body.dataset.activePage = page;

    // Refresh page content
    switch (page) {
        case 'dashboard': renderDashboard(); break;
        case 'reservations': renderReservations(); break;
        case 'calendar': renderCalendar(); break;
        case 'rooms': renderRooms(); break;
        case 'guests': renderGuests(); break;
        case 'management': renderManagement(); break;
        case 'compliance': renderCompliance(); break;
    }

    const mainContent = document.getElementById('mainContent');
    if (mainContent) mainContent.scrollTo({ top: 0, behavior: 'auto' });
}

function openPinModal() {
    const modal = document.getElementById('pinModal');
    const input = document.getElementById('pinInput');
    const error = document.getElementById('pinError');
    modal.classList.add('open');
    input.value = '';
    error.style.display = 'none';
    setTimeout(() => input.focus(), 100);
}

function closePinModal() {
    document.getElementById('pinModal').classList.remove('open');
}

function submitPin() {
    const input = document.getElementById('pinInput');
    const error = document.getElementById('pinError');
    const stored = localStorage.getItem('gs_emp_pin');

    if (input.value === stored) {
        empPinUnlocked = true; // temporary flag, cleared after navigation
        closePinModal();
        navigateTo('management');
        empPinUnlocked = false;
    } else {
        error.style.display = 'block';
        input.value = '';
        input.focus();
    }
}

function saveEmpPin() {
    const input = document.getElementById('settingEmpPin');
    const val = input.value.trim();
    if (!/^\d{4}$/.test(val)) {
        showToast(t('settings.empPinInvalid'), 'error');
        return;
    }
    localStorage.setItem('gs_emp_pin', val);
    empPinUnlocked = false;
    input.value = '';
    showToast(t('settings.empPinSaved'), 'success');
}

function removeEmpPin() {
    localStorage.removeItem('gs_emp_pin');
    empPinUnlocked = false;
    document.getElementById('settingEmpPin').value = '';
    showToast(t('settings.empPinRemoved'), 'success');
}

// Setup nav listeners
document.querySelectorAll('.nav-item, .tab-item').forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        navigateTo(item.dataset.page);
    });
});

// =============================================
// DASHBOARD
// =============================================

function renderDashboard() { return window.GroupStayDashboard.renderDashboard(); }

// =============================================
// RESERVATIONS
// =============================================

function renderReservations() { return window.GroupStayReservationsList.renderReservations(); }
function setReservationFilter(filter, el) { return window.GroupStayReservationsList.setReservationFilter(filter, el); }
function filterReservations() { return window.GroupStayReservationsList.filterReservations(); }

// ---- New / Edit Reservation ----

function getOccupiedRoomMap(excludeResId) { return window.GroupStayReservationRooms.getOccupiedRoomMap(excludeResId); }
function populateRoomChecklist(selectedRoomIds, excludeResId) { return window.GroupStayReservationRooms.populateRoomChecklist(selectedRoomIds, excludeResId); }
function toggleAllRoomCheckboxes(el) { return window.GroupStayReservationRooms.toggleAllRoomCheckboxes(el); }
function onRoomCheckChange(el) { return window.GroupStayReservationRooms.onRoomCheckChange(el); }
function toggleFloorCheckboxes(el) { return window.GroupStayReservationRooms.toggleFloorCheckboxes(el); }
function updateFloorAndSelectAll() { return window.GroupStayReservationRooms.updateFloorAndSelectAll(); }
function updateRoomCount() { return window.GroupStayReservationRooms.updateRoomCount(); }
function getSelectedRoomIds() { return window.GroupStayReservationRooms.getSelectedRoomIds(); }
function getAssignedRoomIds(resId) { return window.GroupStayReservationRooms.getAssignedRoomIds(resId); }

function toggleExpirationField() { return window.GroupStayGroupReservation.toggleExpirationField(); }
function openNewReservationModal() { return window.GroupStayGroupReservation.openNewReservationModal(); }
function openEditReservation(id) { return window.GroupStayGroupReservation.openEditReservation(id); }

// ---- Individual Reservation ----

function populateIndRoomSelect(excludeResId) { return window.GroupStayIndividualReservation.populateIndRoomSelect(excludeResId); }
function calcIndividualPrice() { return window.GroupStayIndividualReservation.calcIndividualPrice(); }
function openNewIndividualModal() { return window.GroupStayIndividualReservation.openNewIndividualModal(); }
function openEditIndividualReservation(id) { return window.GroupStayIndividualReservation.openEditIndividualReservation(id); }
async function saveIndividualReservation(e) { return window.GroupStayIndividualReservation.saveIndividualReservation(e); }

async function saveReservation(e) { return window.GroupStayGroupReservation.saveReservation(e); }

async function deleteReservation(id) { return window.GroupStayGroupReservation.deleteReservation(id); }

// ---- Reservation Detail ----

function openReservationDetail(id) { return window.GroupStayReservationDetail.openReservationDetail(id); }
async function saveDetailNotes(id) { return window.GroupStayReservationDetail.saveDetailNotes(id); }

// ---- Reservation Files ----

async function loadReservationMenus(r) { return window.GroupStayMenus.loadReservationMenus(r); }
function getMealDays(r) { return window.GroupStayMenus.getMealDays(r); }
function renderMenuSection(r, menus) { return window.GroupStayMenus.renderMenuSection(r, menus); }
function addIntoleranceRow(resId) { return window.GroupStayMenus.addIntoleranceRow(resId); }
function removeIntoleranceRow(btn, resId) { return window.GroupStayMenus.removeIntoleranceRow(btn, resId); }
async function saveIntolerances(resId) { return window.GroupStayMenus.saveIntolerances(resId); }
function printMenu(resId) { return window.GroupStayMenus.printMenu(resId); }
async function saveMenuField(input) { return window.GroupStayMenus.saveMenuField(input); }

async function loadReservationFiles(reservationId) { return window.GroupStayReservationFiles.loadReservationFiles(reservationId); }
function renderReservationFiles(reservationId, files) { return window.GroupStayReservationFiles.renderReservationFiles(reservationId, files); }
function getFileIcon(fileName) { return window.GroupStayReservationFiles.getFileIcon(fileName); }
function formatFileSize(bytes) { return window.GroupStayReservationFiles.formatFileSize(bytes); }
async function uploadReservationFile(reservationId) { return window.GroupStayReservationFiles.uploadReservationFile(reservationId); }
function fileToBase64(file) { return window.GroupStayReservationFiles.fileToBase64(file); }
async function downloadReservationFile(fileId) { return window.GroupStayReservationFiles.downloadReservationFile(fileId); }
async function deleteReservationFile(fileId, reservationId) { return window.GroupStayReservationFiles.deleteReservationFile(fileId, reservationId); }

// ---- Guests List Modal ----

function getGuestMissingFields(g) { return window.GroupStayGuests.getGuestMissingFields(g); }
function openGuestsList(reservationId) { return window.GroupStayGuests.openGuestsList(reservationId); }
function filterGuestsList() { return window.GroupStayGuests.filterGuestsList(); }
async function setAllGuestsType(reservationId, mode) { return window.GroupStayGuests.setAllGuestsType(reservationId, mode); }
async function setGuestAsLeader(guestId, reservationId) { return window.GroupStayGuests.setGuestAsLeader(guestId, reservationId); }

// ---- Alloggiati Web ----

let alloggiatiToken = null;
let alloggiatiTokenExpires = null;
let alloggiatiLuoghi = null; // cached: [{code, name}]
let alloggiatiStati = null;  // cached: [{code, name}]

async function loadAlloggiatiTables() {
    if (alloggiatiLuoghi && alloggiatiStati) return;
    // Try sessionStorage cache first (avoids re-downloading large CSV every page open)
    try {
        const cached = sessionStorage.getItem('gs_alloggiati_tables');
        if (cached) {
            const { luoghi, stati } = JSON.parse(cached);
            alloggiatiLuoghi = luoghi;
            alloggiatiStati = stati;
            return;
        }
    } catch (e) {}
    try {
        const token = await getAlloggiatiToken();
        const data = await apiGet(API.alloggiati + '?action=tabella&token=' + encodeURIComponent(token) + '&tipo=Luoghi');
        if (!data.csv) return;

        const lines = data.csv.split('\n').filter(l => l.trim());
        const luoghi = [];
        const stati = [];

        for (const line of lines) {
            const parts = line.split(';');
            if (parts.length < 2) continue;
            const code = parts[0].trim();
            const name = parts[1].trim();
            if (!code || !name) continue;

            // Try to get province from CSV (usually 3rd or 4th column)
            const prov = (parts.length >= 3 ? parts[2].trim() : '') || (parts.length >= 4 ? parts[3].trim() : '');

            // Build a display label: "San Leo (RN)" for comuni, just "ITALIA" for states
            const isState = code.length === 9 && code.startsWith('1') && code.charAt(1) === '0';
            const label = prov && !isState ? `${name} (${prov})` : name;

            const entry = { code, name, prov, label, rawParts: parts.map((part) => part.trim()) };
            if (isState) {
                stati.push(entry);
            }
            luoghi.push(entry);
        }

        alloggiatiLuoghi = luoghi;
        alloggiatiStati = stati.length > 0 ? stati : luoghi;

        // Cache for this session so we don't re-download on every guest open
        try { sessionStorage.setItem('gs_alloggiati_tables', JSON.stringify({ luoghi: alloggiatiLuoghi, stati: alloggiatiStati })); } catch (e) {}

        // Populate countries datalist — just show country name
        const countriesList = document.getElementById('countriesList');
        countriesList.innerHTML = alloggiatiStati.map(s =>
            `<option value="${s.label}">`
        ).join('');

        // Don't pre-populate comuni/luoghi — they're filtered on input (too large)

    } catch (err) {
        console.error('Failed to load Alloggiati tables:', err);
    }
}

function findCodeFromLabel(list, label) {
    if (!list || !label) return '';
    const match = lookupAlloggiatiEntry(list, label);
    return match ? match.code : '';
}

function findLabelFromCode(list, code) {
    if (!list || !code) return '';
    const match = list.find(l => l.code === code);
    return match ? match.label : '';
}

// Resolve a raw comune name or code to its alloggiatiLuoghi entry.
function lookupAlloggiatiLuogo(val) {
    if (!val || !alloggiatiLuoghi) return null;
    return lookupAlloggiatiEntry(alloggiatiLuoghi, val);
}

function normalizeAlloggiatiLookupValue(value) {
    return String(value || '')
        .trim()
        .replace(/\s+/g, ' ');
}

function normalizeAlloggiatiLookupName(value) {
    return normalizeAlloggiatiLookupValue(value)
        .replace(/\s*\(([A-Z]{2})\)\s*$/i, '')
        .trim()
        .toLowerCase();
}

function extractAlloggiatiProvinceHint(value) {
    const normalized = normalizeAlloggiatiLookupValue(value);
    const suffixMatch = normalized.match(/\(([A-Z]{2})\)\s*$/i);
    if (suffixMatch) return suffixMatch[1].toUpperCase();
    return '';
}

function parseAlloggiatiDateToken(value) {
    const token = String(value || '').trim();
    if (!token) return null;

    let match = token.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
        return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    }

    match = token.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (match) {
        return Date.UTC(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
    }

    return null;
}

function getAlloggiatiEntryValidity(entry) {
    const rawParts = Array.isArray(entry?.rawParts) ? entry.rawParts : [];
    const dateValues = rawParts
        .map(parseAlloggiatiDateToken)
        .filter((value) => value !== null);

    if (dateValues.length === 0) return { start: null, end: null };
    return {
        start: dateValues[0] ?? null,
        end: dateValues[1] ?? null
    };
}

function scoreAlloggiatiEntry(entry, value, normalizedName, requestedProvince, contextDateUtc) {
    let score = 0;
    const labelLower = normalizeAlloggiatiLookupValue(entry.label).toLowerCase();
    const nameLower = normalizeAlloggiatiLookupValue(entry.name).toLowerCase();
    const normalizedEntryLabel = normalizeAlloggiatiLookupName(entry.label);
    const normalizedEntryName = normalizeAlloggiatiLookupName(entry.name);
    const entryProvince = String(entry.prov || '').toUpperCase();

    if (labelLower === value.toLowerCase()) score += 500;
    if (nameLower === value.toLowerCase()) score += 450;
    if (normalizedEntryLabel === normalizedName) score += 300;
    if (normalizedEntryName === normalizedName) score += 280;
    if (normalizedEntryLabel.startsWith(normalizedName)) score += 150;
    if (normalizedEntryName.startsWith(normalizedName)) score += 140;
    if (requestedProvince && entryProvince === requestedProvince) score += 120;

    if (contextDateUtc !== null) {
        const validity = getAlloggiatiEntryValidity(entry);
        const startOk = validity.start === null || contextDateUtc >= validity.start;
        const endOk = validity.end === null || contextDateUtc <= validity.end;
        if (startOk && endOk) {
            score += 200;
        } else if (validity.start !== null || validity.end !== null) {
            score -= 200;
        }
    }

    return score;
}

function lookupAlloggiatiEntry(list, rawValue, provinceHint = '', options = {}) {
    if (!list || !rawValue) return null;
    const value = normalizeAlloggiatiLookupValue(rawValue);
    if (!value) return null;

    const byCode = list.find((entry) => entry.code === value);
    if (byCode) return byCode;

    const requestedProvince = (provinceHint || extractAlloggiatiProvinceHint(value) || '').toUpperCase();
    const normalizedName = normalizeAlloggiatiLookupName(value);
    const candidates = list.filter((entry) => entry && entry.code);
    const contextDateUtc = options.birthDate ? parseAlloggiatiDateToken(String(options.birthDate).substring(0, 10).replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$1-$2-$3')) : null;

    const scored = candidates
        .map((entry) => ({
            entry,
            score: scoreAlloggiatiEntry(entry, value, normalizedName, requestedProvince, contextDateUtc)
        }))
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score);

    return scored.length > 0 ? scored[0].entry : null;
}

function setupAlloggiatiSearchField(searchId, hiddenId, listSource) {
    const searchEl = document.getElementById(searchId);
    if (!searchEl) return;

    const resolveCode = () => {
        const list = listSource === 'stati' ? alloggiatiStati : alloggiatiLuoghi;
        const code = findCodeFromLabel(list, searchEl.value);
        if (code) {
            document.getElementById(hiddenId).value = code;
            // Auto-populate province from comune label, e.g. "San Benedetto del Tronto (AP)" → "AP"
            if (searchId === 'guestBirthComuneSearch') {
                const provEl = document.getElementById('guestBirthProvince');
                if (provEl) {
                    const m = searchEl.value.match(/\(([A-Z]{2})\)\s*$/);
                    provEl.value = m ? m[1] : '';
                }
            }
            if (searchId === 'guestResidenceComuneSearch') {
                const docPlaceSearch = document.getElementById('guestDocIssuedPlaceSearch');
                const docPlaceHidden = document.getElementById('guestDocIssuedPlace');
                const guestType = document.getElementById('guestType')?.value || '20';
                if (docPlaceSearch && docPlaceHidden && (guestType === '16' || guestType === '17' || guestType === '18')) {
                    docPlaceSearch.value = searchEl.value;
                    docPlaceHidden.value = code;
                }
            }
        } else if (listSource === 'stati') {
            // For country fields: only accept if it's a valid 9-digit code or empty — never accept free text
            const raw = searchEl.value.trim();
            if (/^\d{9}$/.test(raw)) {
                document.getElementById(hiddenId).value = raw;
            } else if (raw === '') {
                document.getElementById(hiddenId).value = '';
            } else {
                // Not a valid country — clear the field and warn
                searchEl.value = '';
                document.getElementById(hiddenId).value = '';
                searchEl.placeholder = 'Seleziona una nazione valida';
                searchEl.classList.add('input-error');
                setTimeout(() => { searchEl.classList.remove('input-error'); searchEl.placeholder = ''; }, 2500);
            }
        } else {
            document.getElementById(hiddenId).value = searchEl.value.trim();
        }
    };

    searchEl.addEventListener('change', resolveCode);
    searchEl.addEventListener('blur', resolveCode);

    // Filter datalist for comuni (large list) on input
    if (searchId === 'guestBirthComuneSearch' || searchId === 'guestResidenceComuneSearch' || searchId === 'guestDocIssuedPlaceSearch') {
        searchEl.addEventListener('input', () => {
            const query = searchEl.value.toLowerCase().trim();
            if (query.length < 2 || !alloggiatiLuoghi) return;
            const listId = (searchId === 'guestBirthComuneSearch' || searchId === 'guestResidenceComuneSearch') ? 'comuniList' : 'luoghiList';
            const dlEl = document.getElementById(listId);
            const source = (searchId === 'guestBirthComuneSearch' || searchId === 'guestResidenceComuneSearch')
                ? alloggiatiLuoghi.filter(l => !alloggiatiStati.includes(l))
                : alloggiatiLuoghi;
            const filtered = source.filter(l => l.label.toLowerCase().includes(query)).slice(0, 200);
            dlEl.innerHTML = filtered.map(l =>
                `<option value="${l.label}">`
            ).join('');
        });
    }
}

// Initialize search fields once DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    syncAppViewportState();
    setupAlloggiatiSearchField('guestCitizenshipSearch', 'guestCitizenship', 'stati');
    setupAlloggiatiSearchField('guestBirthCountrySearch', 'guestBirthCountry', 'stati');
    setupAlloggiatiSearchField('guestBirthComuneSearch', 'guestBirthComune', 'luoghi');
    setupAlloggiatiSearchField('guestResidenceComuneSearch', 'guestResidenceComune', 'luoghi');
    setupAlloggiatiSearchField('guestDocIssuedPlaceSearch', 'guestDocIssuedPlace', 'luoghi');
});

window.addEventListener('resize', syncAppViewportState);
window.addEventListener('orientationchange', syncAppViewportState);
window.visualViewport?.addEventListener('resize', syncAppViewportState);
window.visualViewport?.addEventListener('scroll', syncAppViewportState);
document.addEventListener('focusin', syncAppViewportState);
document.addEventListener('focusout', () => window.setTimeout(syncAppViewportState, 120));

async function getAlloggiatiToken() {
    // Reuse token if still valid (with 5 min buffer)
    if (alloggiatiToken && alloggiatiTokenExpires && new Date(alloggiatiTokenExpires) > new Date(Date.now() + 5 * 60000)) {
        return alloggiatiToken;
    }
    const data = await apiGet(API.alloggiati + '?action=token');
    alloggiatiToken = data.token;
    alloggiatiTokenExpires = data.expires;
    return alloggiatiToken;
}

function renderAlloggiatiResults(container, data, mode) {
    if (!data) return;

    const escapeHtml = (value) => String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    let html = '';
    if (mode === 'preview') {
        html += `<div class="alloggiati-preview">
            <p><strong>${data.guests.length} record(s) built</strong></p>
            <div class="alloggiati-records">`;
        data.guests.forEach((g) => {
            html += `<div class="alloggiati-record-item">
                <span>${g.name}</span>
                <span class="badge">${g.guestType === '17' ? 'CapoFam' : g.guestType === '18' ? 'Capo' : g.guestType === '19' ? 'Fam' : g.guestType === '20' ? 'Membro' : 'Singolo'}</span>
                <span style="color:${g.recordLength === 168 ? 'var(--green)' : 'var(--red)'}">${g.recordLength} chars</span>
            </div>`;
        });
        html += `</div></div>`;
    } else {
        const icon = data.success ? '&#10003;' : '&#10007;';
        const color = data.success ? 'var(--green)' : 'var(--red)';
        html += `<div style="margin-bottom:8px">
            <span style="color:${color};font-weight:bold">${icon} ${mode === 'test' ? 'Test' : 'Send'}: ${data.validCount}/${data.totalCount} valid</span>
        </div>`;
        if (data.details && data.details.length > 0) {
            html += '<div class="alloggiati-records">';
            data.details.forEach((d) => {
                const ok = d.esito;
                html += `<div class="alloggiati-record-item ${ok ? 'success' : 'error'}">
                    <div>
                        <span>${d.guestName}</span>
                        <span style="color:${ok ? 'var(--green)' : 'var(--red)'}"> - ${ok ? 'OK' : d.errorDesc + (d.errorDetail ? ': ' + d.errorDetail : '')}</span>
                    </div>
                </div>`;
            });
            html += '</div>';
        }
    }
    container.innerHTML = html;
}

async function alloggiatiPreview(reservationId) {
    const container = document.getElementById('alloggiatiResults');
    container.innerHTML = '<p>Building records...</p>';
    try {
        const data = await apiGet(API.alloggiati + '?action=build&reservationId=' + reservationId);
        renderAlloggiatiResults(container, data, 'preview');
    } catch (err) {
        container.innerHTML = `<p style="color:var(--red)">Error: ${err.message}</p>`;
    }
}

// Resolve guest fields to valid Alloggiati codes before test/send.
// Uses the already-loaded alloggiatiLuoghi table so no extra API call is needed.
async function resolveGuestsForAlloggiati(reservationId) {
    await loadAlloggiatiTables();
    const resGuests = guests.filter(g => g.reservationId === reservationId);
    const guestTypeRank = (guestType) => {
        if (guestType === '17' || guestType === '18') return 0;
        if (guestType === '19' || guestType === '20') return 1;
        return 2;
    };
    const orderedGuests = resGuests
        .map((guest, index) => ({ guest, index }))
        .sort((a, b) => {
            const rankDiff = guestTypeRank(String(a.guest.guestType || '16')) - guestTypeRank(String(b.guest.guestType || '16'));
            return rankDiff !== 0 ? rankDiff : a.index - b.index;
        })
        .map((entry) => entry.guest);

    const VALID_DOC = new Set(['IDENT', 'PASOR', 'PATEN', 'PNAUZ', 'PORDF']);
    const DOC_MAP = {
        'ci': 'IDENT', "carta d'identita": 'IDENT', "carta d'identità": 'IDENT',
        'carta identita': 'IDENT', 'carta identità': 'IDENT', 'carta di identità': 'IDENT',
        'identity card': 'IDENT', 'id card': 'IDENT', 'cni': 'IDENT',
        'passaporto': 'PASOR', 'passport': 'PASOR', 'pp': 'PASOR',
        'patente': 'PATEN', 'driving licence': 'PATEN', 'driving license': 'PATEN',
        'patente nautica': 'PNAUZ', 'porto d\'armi': 'PORDF', 'porto darmi': 'PORDF',
    };
    const ITALY_CODE = '100000100';
    const VALID_GUEST_TYPES = new Set(['16', '17', '18', '19', '20']);
    const normalizeText = (value) => String(value || '').trim();

    function findStateEntry(val) {
        if (!val || !alloggiatiStati) return null;
        const raw = normalizeText(val);
        if (!raw) return null;
        if (/^\d{9}$/.test(raw)) {
            return alloggiatiStati.find((entry) => entry.code === raw) || null;
        }
        const lower = raw.toLowerCase();
        return alloggiatiStati.find((entry) => entry.name.toLowerCase() === lower)
            || alloggiatiStati.find((entry) => entry.label.toLowerCase() === lower)
            || alloggiatiStati.find((entry) => entry.name.toLowerCase().startsWith(lower))
            || null;
    }

    function resolveComune(val, provinceHint = '', birthDate = '') {
        if (!val || !alloggiatiLuoghi) return { code: '', prov: '' };
        const raw = normalizeText(val);
        if (!raw) return { code: '', prov: '' };
        const entry = lookupAlloggiatiEntry(
            alloggiatiLuoghi.filter((luogo) => luogo.prov),
            raw,
            normalizeText(provinceHint),
            { birthDate }
        );
        return entry ? { code: entry.code, prov: entry.prov || '' } : { code: '', prov: '' };
    }

    function resolveStateCode(val, fallbackToItaly = false) {
        const entry = findStateEntry(val);
        if (entry) return entry.code;
        return fallbackToItaly ? ITALY_CODE : '';
    }

    function resolveDocIssuedPlace(val) {
        const comune = resolveComune(val);
        if (comune.code) return comune.code;
        const state = findStateEntry(val);
        return state ? state.code : '';
    }

    function normalizeDocType(value) {
        const raw = normalizeText(value).toUpperCase();
        if (VALID_DOC.has(raw)) return raw;
        const mapped = DOC_MAP[normalizeText(value).toLowerCase()];
        return mapped || '';
    }

    function normalizeGuestType(value) {
        const raw = normalizeText(value);
        return VALID_GUEST_TYPES.has(raw) ? raw : '16';
    }

    function validateResolvedGuest(guest) {
        const errors = [];
        const requiresDocument = guest.guestType === '16' || guest.guestType === '17' || guest.guestType === '18';

        if (!normalizeText(guest.lastName)) errors.push('cognome mancante');
        if (!normalizeText(guest.firstName)) errors.push('nome mancante');
        if (!['1', '2'].includes(normalizeText(guest.sex))) errors.push('sesso non valido');
        if (!normalizeText(guest.birthDate)) errors.push('data di nascita mancante');
        if (!/^\d{9}$/.test(normalizeText(guest.birthCountry))) {
            errors.push('stato di nascita non valido');
        }
        if (!/^\d{9}$/.test(normalizeText(guest.citizenship))) {
            errors.push('cittadinanza non valida');
        }

        if (guest.birthCountry === ITALY_CODE) {
            if (!/^\d{9}$/.test(normalizeText(guest.birthComune))) {
                errors.push('comune di nascita non valido');
            }
            if (!/^[A-Z]{2}$/.test(normalizeText(guest.birthProvince))) {
                errors.push('provincia di nascita non valida');
            }
        }

        if (requiresDocument) {
            if (!VALID_DOC.has(normalizeText(guest.docType))) {
                errors.push('tipo documento non valido');
            }
            if (!normalizeText(guest.docNumber)) {
                errors.push('numero documento mancante');
            }
            if (!/^\d{9}$/.test(normalizeText(guest.docIssuedPlace))) {
                errors.push('luogo rilascio documento non valido');
            }
        }

        return errors;
    }

    const resolvedGuests = orderedGuests.map((g, index) => {
        const birthCountry = resolveStateCode(g.birthCountry, !!normalizeText(g.birthComune));
        const citizenship = resolveStateCode(g.citizenship, false);
        const isItalianBirth = birthCountry === ITALY_CODE;
        const resolvedBirthComune = isItalianBirth ? resolveComune(g.birthComune, g.birthProvince, g.birthDate) : { code: '', prov: '' };
        const guestType = normalizeGuestType(g.guestType);
        const requiresDocument = guestType === '16' || guestType === '17' || guestType === '18';

        const guest = {
            id: g.id,
            firstName: g.firstName,
            lastName: g.lastName,
            sex: normalizeText(g.sex),
            birthDate: g.birthDate,
            birthComune: isItalianBirth ? resolvedBirthComune.code : '',
            birthProvince: isItalianBirth ? normalizeText(resolvedBirthComune.prov || g.birthProvince).toUpperCase().substring(0, 2) : '',
            birthCountry,
            citizenship,
            docType: requiresDocument ? normalizeDocType(g.docType) : '',
            docNumber: requiresDocument ? normalizeText(g.docNumber) : '',
            docIssuedPlace: requiresDocument ? resolveDocIssuedPlace(g.docIssuedPlace) : '',
            guestType,
            _alloggiatiOrder: index,
        };

        return {
            ...guest,
            _validationErrors: validateResolvedGuest(guest)
        };
    });

    const invalidGuests = resolvedGuests.filter((guest) => guest._validationErrors.length > 0);
    if (invalidGuests.length > 0) {
        throw new Error(invalidGuests
            .map((guest) => `${guest.firstName || 'Ospite'} ${guest.lastName || ''}`.trim() + ': ' + guest._validationErrors.join(', '))
            .join(' | '));
    }

    return resolvedGuests.map(({ _validationErrors, ...guest }) => guest);
}

async function alloggiatiTest(reservationId) {
    const container = document.getElementById('alloggiatiResults');
    container.innerHTML = '<p>Getting token & testing...</p>';
    try {
        const token = await getAlloggiatiToken();
        const resolvedGuests = await resolveGuestsForAlloggiati(reservationId);
        const data = await apiPost(API.alloggiati + '?action=test', { reservationId, token, resolvedGuests });
        renderAlloggiatiResults(container, data, 'test');
    } catch (err) {
        container.innerHTML = `<p style="color:var(--red)">Error: ${err.message}</p>`;
    }
}

async function alloggiatiSend(reservationId) {
    if (!confirm(t('confirm.sendSchedule'))) return;
    const container = document.getElementById('alloggiatiResults');
    container.innerHTML = '';
    showLoading('Invio schedine alla Polizia...');
    try {
        const token = await getAlloggiatiToken();
        const resolvedGuests = await resolveGuestsForAlloggiati(reservationId);
        const data = await apiPost(API.alloggiati + '?action=send', { reservationId, token, resolvedGuests });
        hideLoading();
        renderAlloggiatiResults(container, data, 'send');
        if (data.success && data.validCount === data.totalCount) {
            showToast(t('toast.schedineOk'));
        } else {
            showToast(`${data.validCount}/${data.totalCount} schedine accepted`, 'error');
        }
    } catch (err) {
        hideLoading();
        container.innerHTML = `<p style="color:var(--red)">Error: ${err.message}</p>`;
    }
}

// ---- Assign Rooms ----

function openAssignRooms(reservationId) {
    const r = reservations.find(x => x.id === reservationId);
    if (!r) return;

    const resGuests = guests.filter(g => g.reservationId === reservationId);
    const assignedRoomIds = resGuests.map(g => g.roomId).filter(Boolean);

    // Build map of rooms occupied by other overlapping reservations
    const occupiedByOther = {};
    reservations.forEach(res => {
        if (res.id === reservationId || res.status === 'cancelled') return;
        if (res.checkin < r.checkout && res.checkout > r.checkin) {
            const rIds = res.roomIds && res.roomIds.length > 0
                ? res.roomIds
                : guests.filter(g => g.reservationId === res.id && g.roomId).map(g => g.roomId);
            rIds.forEach(id => { occupiedByOther[id] = res.groupName; });
        }
    });

    const sortedRooms = [...rooms].sort((a, b) => a.floor !== b.floor ? a.floor - b.floor : parseInt(a.number) - parseInt(b.number));

    const body = document.getElementById('assignRoomsBody');
    body.innerHTML = `
        <p style="margin-bottom:16px;color:var(--text-secondary);font-size:14px">
            ${t('assign.selectRooms')} <strong>${escapeHtml(r.groupName)}</strong> (${r.roomCount} ${t('assign.needed')})
        </p>
        <div id="assignRoomsList">
            ${sortedRooms.map(rm => {
                const isSelected = assignedRoomIds.includes(rm.id);
                const occupier = occupiedByOther[rm.id];
                if (occupier) {
                    return `
                        <div class="assign-room-item" style="opacity:0.5">
                            <div class="assign-room-info">
                                <span class="assign-room-number">${t('rooms.room')} ${rm.number}</span>
                                <span class="assign-room-type">${rm.type} &middot; ${rm.capacity} ${t('rooms.pax')}</span>
                            </div>
                            <span class="room-check-occupied">${escapeHtml(occupier)}</span>
                        </div>
                    `;
                }
                return `
                    <div class="assign-room-item">
                        <div class="assign-room-info">
                            <span class="assign-room-number">${t('rooms.room')} ${rm.number}</span>
                            <span class="assign-room-type">${rm.type} &middot; ${rm.capacity} ${t('rooms.pax')} &middot; &euro;${rm.price}/night</span>
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
            <button class="btn btn-ghost" onclick="closeModal('assignRoomsModal')">${t('assign.done')}</button>
        </div>
    `;

    closeModal('reservationDetailModal');
    openModal('assignRoomsModal');
}

async function toggleRoomAssignment(btn, roomId, reservationId) {
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

    try {
        // Save all modified rooms and guests
        const modifiedRoom = rooms.find(r => r.id === roomId);
        if (modifiedRoom) await apiPut(API.rooms, modifiedRoom);
        for (const g of guests.filter(g => g.reservationId === reservationId)) {
            await apiPut(API.guests, g);
        }
    } catch (err) {
        console.error(err);
        showToast(t('toast.assignRoomFail'), 'error');
    }
}

// =============================================
// ROOM ASSIGNMENT SPREADSHEET (Dynamic Columns)
// =============================================

function getDefaultPlannerColumns() {
    return [
        { id: 'usage', name: t('assign.usage') },
        { id: 'group', name: t('assign.group') },
        { id: 'occ', name: t('assign.occ') },
        { id: 'notes', name: t('assign.notes') }
    ];
}

let plannerColumns = [];

async function openRoomAssignment(reservationId) {
    currentAssignmentReservationId = reservationId;
    const r = reservations.find(x => x.id === reservationId);
    if (!r) return;

    document.getElementById('assignmentModalTitle').textContent = t('assign.roomPlanner') + ' — ' + r.groupName;

    // Load column config
    try {
        const config = await apiGet(API.assignments + '?resource=planner-config&reservation_id=' + reservationId);
        plannerColumns = (config && config.columns && config.columns.length > 0)
            ? config.columns
            : getDefaultPlannerColumns().map(c => ({ ...c }));
    } catch {
        plannerColumns = getDefaultPlannerColumns().map(c => ({ ...c }));
    }

    // Load existing assignments
    try {
        assignmentData = await apiGet(API.assignments + '?reservation_id=' + reservationId);
    } catch {
        assignmentData = [];
    }

    renderAssignmentSpreadsheet();
    closeModal('reservationDetailModal');
    openModal('roomAssignmentModal');
}

function renderAssignmentSpreadsheet() {
    const body = document.getElementById('roomAssignmentBody');
    const sortedRooms = [...rooms].sort((a, b) => a.floor - b.floor || a.number.localeCompare(b.number, undefined, { numeric: true }));

    // Group by floor
    const floors = {};
    sortedRooms.forEach(rm => {
        if (!floors[rm.floor]) floors[rm.floor] = [];
        floors[rm.floor].push(rm);
    });

    // Build assignment lookup
    const assignMap = {};
    assignmentData.forEach(a => { assignMap[a.roomId] = a; });

    const totalCols = 1 + plannerColumns.length + 1; // room + dynamic cols + add btn

    const r = reservations.find(x => x.id === currentAssignmentReservationId);
    const roomNotesVal = r ? escapeHtml(r.roomNotes || '') : '';

    let html = `
        <div class="assignment-layout">
            <div class="assignment-sidebar">
                <label class="assignment-room-notes-label">${t('assign.roomRequest')}</label>
                <textarea id="assignmentRoomNotes" class="form-control"
                    placeholder="${t('assign.roomRequestPlaceholder')}"
                    onchange="saveAssignmentRoomNotes()">${roomNotesVal}</textarea>
            </div>
            <div class="assignment-main">
                <div class="assignment-toolbar">
                    <div class="assignment-stats" id="assignmentStats">
                        ${getAssignmentStatsHTML()}
                    </div>
                </div>
                <table class="assignment-table">
            <thead>
                <tr>
                    <th class="col-room">${t('rooms.room')}</th>
                    ${plannerColumns.map((col, i) => `
                        <th class="col-dynamic">
                            <div class="col-header-wrap">
                                <input type="text" class="col-header-input" value="${escapeHtml(col.name)}"
                                    data-col-idx="${i}" onchange="renamePlannerColumn(this)" onkeydown="if(event.key==='Enter')this.blur()">
                                <button class="col-remove-btn" onclick="removePlannerColumn(${i})" title="${t('assign.removeColumn')}">&times;</button>
                            </div>
                        </th>
                    `).join('')}
                    <th class="col-add">
                        <button class="col-add-btn" onclick="addPlannerColumn()" title="${t('assign.addColumn')}">+</button>
                    </th>
                </tr>
            </thead>
            <tbody>
    `;

    for (const [floor, floorRooms] of Object.entries(floors)) {
        html += `<tr class="floor-header-row"><td colspan="${totalCols}">${t('rooms.floor')} ${floor}</td></tr>`;

        for (const rm of floorRooms) {
            const a = assignMap[rm.id] || {};
            const vals = a.cellValues || {};
            const hasData = Object.values(vals).some(v => v !== '' && v !== 0 && v != null);

            html += `
                <tr class="assignment-row ${hasData ? 'assigned' : ''}" data-room-id="${rm.id}">
                    <td class="col-room"><strong>${escapeHtml(rm.number)}</strong></td>
                    ${plannerColumns.map(col => {
                        const val = vals[col.id] != null ? vals[col.id] : '';
                        return `
                            <td class="col-dynamic">
                                <input type="text" class="cell-input" data-col="${col.id}" data-room="${rm.id}"
                                    value="${escapeHtml(String(val))}" placeholder="..." onchange="onAssignmentChange(this)">
                            </td>
                        `;
                    }).join('')}
                    <td class="col-add"></td>
                </tr>
            `;
        }
    }

    html += `</tbody></table></div></div>`;
    body.innerHTML = html;
}

function getAssignmentStatsHTML() {
    let filled = 0;
    assignmentData.forEach(a => {
        const vals = a.cellValues || {};
        if (Object.values(vals).some(v => v !== '' && v !== 0 && v != null)) filled++;
    });
    return `
        <span>${t('assign.roomsAssigned')}: <strong>${filled}</strong> / ${rooms.length}</span>
        <span>${t('assign.columns')}: <strong>${plannerColumns.length}</strong></span>
    `;
}

function onAssignmentChange(el) {
    const roomId = el.dataset.room;
    const colId = el.dataset.col;
    const value = el.value;

    let existing = assignmentData.find(a => a.roomId === roomId);
    if (!existing) {
        existing = {
            id: generateId(),
            reservationId: currentAssignmentReservationId,
            roomId: roomId,
            cellValues: {},
            _isNew: true
        };
        assignmentData.push(existing);
    }
    if (!existing.cellValues) existing.cellValues = {};
    existing.cellValues[colId] = value;
    existing._dirty = true;

    // Update row styling
    const row = el.closest('tr');
    const vals = existing.cellValues;
    const hasData = Object.values(vals).some(v => v !== '' && v !== 0 && v != null);
    row.classList.toggle('assigned', hasData);

    // Update stats
    const stats = document.getElementById('assignmentStats');
    if (stats) stats.innerHTML = getAssignmentStatsHTML();
}

function addPlannerColumn() {
    const id = 'col_' + Date.now().toString(36);
    const name = t('assign.column') + ' ' + (plannerColumns.length + 1);
    plannerColumns.push({ id, name });
    renderAssignmentSpreadsheet();
}

function removePlannerColumn(idx) {
    const col = plannerColumns[idx];
    if (!confirm(`${t('confirm.removeColumn')} "${col.name}"? ${t('confirm.removeColumnData')}`)) return;

    plannerColumns.splice(idx, 1);

    // Remove this column's data from assignments
    assignmentData.forEach(a => {
        if (a.cellValues && a.cellValues[col.id] !== undefined) {
            delete a.cellValues[col.id];
            a._dirty = true;
        }
    });

    renderAssignmentSpreadsheet();
}

function renamePlannerColumn(el) {
    const idx = parseInt(el.dataset.colIdx);
    const newName = el.value.trim();
    if (!newName) {
        el.value = plannerColumns[idx].name;
        return;
    }
    plannerColumns[idx].name = newName;
}

function printAssignments(mode) {
    const r = reservations.find(x => x.id === currentAssignmentReservationId);
    if (!r) return;

    const sortedRooms = [...rooms].sort((a, b) => a.floor - b.floor || a.number.localeCompare(b.number, undefined, { numeric: true }));
    const floors = {};
    sortedRooms.forEach(rm => {
        if (!floors[rm.floor]) floors[rm.floor] = [];
        floors[rm.floor].push(rm);
    });
    const assignMap = {};
    assignmentData.forEach(a => { assignMap[a.roomId] = a; });

    const floorKeys = Object.keys(floors).sort((a, b) => a - b);
    const isCleaning = mode === 'cleaning';

    let theadHtml;
    if (isCleaning) {
        theadHtml = `<thead><tr><th>${t('rooms.room')}</th><th>${t('assign.roomType')}</th><th>${t('assign.notes')}</th></tr></thead>`;
    } else {
        theadHtml = `<thead><tr><th>${t('rooms.room')}</th>${plannerColumns.map(col => `<th>${col.name}</th>`).join('')}</tr></thead>`;
    }

    const colCount = isCleaning ? 3 : 1 + plannerColumns.length;

    // Build pages with 2 floors each
    let pages = '';
    for (let i = 0; i < floorKeys.length; i += 2) {
        let rows = '';
        for (let j = i; j < Math.min(i + 2, floorKeys.length); j++) {
            const fk = floorKeys[j];
            rows += isCleaning
                ? `<tr><td colspan="${colCount}" style="background:#f0f0f0;font-weight:700;font-size:14px;padding:8px 10px">${t('rooms.floor')} ${fk}</td></tr>`
                : `<tr class="print-floor-row"><td colspan="${colCount}"><span class="print-floor-badge">${t('rooms.floor')} ${fk}</span></td></tr>`;
            for (const rm of floors[fk]) {
                if (isCleaning) {
                    const a = assignMap[rm.id];
                    const vals = a ? (a.cellValues || {}) : {};
                    const hasData = Object.values(vals).some(v => v !== '' && v !== 0 && v != null);
                    // Use the first planner column value (usually "Utilizzo"/usage) as the type
                    let typeLabel = '';
                    if (hasData && plannerColumns.length > 0) {
                        typeLabel = vals[plannerColumns[0].id] || '';
                    }
                    rows += `<tr>
                        <td style="padding:7px 10px;font-weight:600;font-size:13px;border:1px solid #ddd">${rm.number}</td>
                        <td style="padding:7px 10px;font-size:13px;border:1px solid #ddd">${escapeHtml(String(typeLabel))}</td>
                        <td style="padding:7px 10px;font-size:13px;border:1px solid #ddd;min-width:220px"></td>
                    </tr>`;
                } else {
                    const vals = (assignMap[rm.id] || {}).cellValues || {};
                    rows += `<tr>
                        <td class="print-room-cell">${rm.number}</td>
                        ${plannerColumns.map(col => `<td class="print-value-cell">${vals[col.id] != null ? vals[col.id] : ''}</td>`).join('')}
                    </tr>`;
                }
            }
        }
        pages += isCleaning
            ? `<div class="page-block"><table>${theadHtml}<tbody>${rows}</tbody></table></div>`
            : `<div class="page-block"><table class="print-assign-table">${theadHtml}<tbody>${rows}</tbody></table></div>`;
    }

    const title = isCleaning ? `${r.groupName} — ${t('assign.printCleaning')}` : r.groupName;
    const printHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
        <style>
            body { font-family: ${isCleaning ? "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" : "'Avenir Next', 'Helvetica Neue', Arial, sans-serif"}; margin: 0; padding: 0; color: #222; background: #fff; }
            table { border-collapse: collapse; width: 100%; table-layout: fixed; }
            th { background: ${isCleaning ? '#e8e8e8' : '#f5f1e8'}; color: ${isCleaning ? '#000' : '#5a4a33'}; padding: ${isCleaning ? '8px 10px' : '7px 10px'}; text-align: left; font-size: ${isCleaning ? '13px' : '11px'}; line-height: 1.2; text-transform: ${isCleaning ? 'none' : 'uppercase'}; letter-spacing: ${isCleaning ? 'normal' : '0.05em'}; border-bottom: ${isCleaning ? 'none' : '1px solid #d9cfbf'}; }
            td { font-size: 13px; line-height: 1.3; vertical-align: middle; word-wrap: break-word; }
            .page-block { padding: ${isCleaning ? '10mm 12mm' : '7mm 10mm'}; box-sizing: border-box; page-break-after: always; }
            .page-block:last-child { page-break-after: avoid; }
            tr { page-break-inside: avoid; }
            .print-assign-table { border: 1px solid #d9cfbf; border-radius: 12px; overflow: hidden; }
            .print-floor-row td { padding: 8px 10px 5px; background: #fcfaf6; border-top: 1px solid #e6ddcf; border-bottom: 1px solid #e6ddcf; }
            .print-floor-badge { display: inline-block; padding: 4px 8px; background: #efe6d8; border-radius: 999px; color: #6a563d; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; }
            .print-room-cell { padding: 6px 10px; font-weight: 700; font-size: 12px; color: #2f2418; border-bottom: 1px solid #ece6dc; background: #fff; }
            .print-value-cell { padding: 6px 10px; font-size: 12px; color: #4b3d2c; border-bottom: 1px solid #ece6dc; background: #fff; }
            .print-assign-table tbody tr:last-child td { border-bottom: none; }
            @page { margin: 0; }
        </style></head><body>
        ${pages}
        <script>window.onload=function(){window.print();}<\/script>
    </body></html>`;

    const w = window.open('', '_blank');
    w.document.write(printHtml);
    w.document.close();
}

async function saveAssignmentRoomNotes() {
    const r = reservations.find(x => x.id === currentAssignmentReservationId);
    if (!r) return;
    r.roomNotes = document.getElementById('assignmentRoomNotes').value;
    try {
        await apiPut(API.reservations, { ...r });
    } catch (err) {
        console.error('Failed to save room notes:', err);
    }
}

async function saveAllAssignments() {
    const btn = document.getElementById('saveAssignmentsBtn');
    btn.textContent = 'Saving...';
    btn.disabled = true;

    try {
        // Save column config
        await apiPut(API.assignments, {
            resource: 'planner-config',
            reservationId: currentAssignmentReservationId,
            columns: plannerColumns
        });

        // Save cell data
        for (const a of assignmentData) {
            if (!a._dirty) continue;

            const vals = a.cellValues || {};
            const hasData = Object.values(vals).some(v => v !== '' && v !== 0 && v != null);

            if (!hasData) {
                if (!a._isNew) {
                    await apiDelete(API.assignments, a.id);
                }
                continue;
            }

            const payload = {
                id: a.id,
                reservationId: a.reservationId,
                roomId: a.roomId,
                cellValues: vals
            };

            if (a._isNew) {
                await apiPost(API.assignments, payload);
                a._isNew = false;
            } else {
                await apiPut(API.assignments, payload);
            }
            a._dirty = false;
        }

        showToast(t('toast.assignSaved'));
    } catch (err) {
        console.error(err);
        showToast(t('toast.assignSaveFail'), 'error');
    }

    btn.textContent = t('assign.save');
    btn.disabled = false;
}

// =============================================
// ROOMS
// =============================================

function renderRooms() { return window.GroupStayRooms.renderRooms(); }
function setRoomFilter(filter, el) { return window.GroupStayRooms.setRoomFilter(filter, el); }
function filterRooms() { return window.GroupStayRooms.filterRooms(); }
function openNewRoomModal() { return window.GroupStayRooms.openNewRoomModal(); }
function openEditRoom(id) { return window.GroupStayRooms.openEditRoom(id); }
async function saveRoom(e) { return window.GroupStayRooms.saveRoom(e); }
async function deleteRoom() { return window.GroupStayRooms.deleteRoom(); }

// =============================================
// GUESTS
// =============================================

function renderGuests() { return window.GroupStayGuests.renderGuests(); }
function filterGuests() { return window.GroupStayGuests.filterGuests(); }
function openAddGuestModal(reservationId) { return window.GroupStayGuests.openAddGuestModal(reservationId); }
function openEditGuestModal(guestId) { return window.GroupStayGuests.openEditGuestModal(guestId); }
async function saveGuest(e) { return window.GroupStayGuests.saveGuest(e); }
async function removeAllGuests(reservationId) { return window.GroupStayGuests.removeAllGuests(reservationId); }
async function deleteGuest(guestId, reservationId) { return window.GroupStayGuests.deleteGuest(guestId, reservationId); }

// =============================================
// PLANNING BOARD CALENDAR (4-panel grid layout)
// =============================================
//
// Layout:  CORNER  | HEADER  (horizontal scroll synced)
//          --------+---------
//          ROOMS   | GRID    (master scroll, both axes)
//
// Only .p-grid-panel scrolls. JS syncs header (h) and rooms (v).

let PLANNER_DAY_WIDTH = 38;
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

function dateToDayIndex(d) { return window.GroupStayPlanner.dateToDayIndex(d); }
function dayIndexToDate(i) { return window.GroupStayPlanner.dayIndexToDate(i); }
function getPlannerSortedRooms() { return window.GroupStayPlanner.getPlannerSortedRooms(); }
function getPlannerFloors(sortedRooms) { return window.GroupStayPlanner.getPlannerFloors(sortedRooms); }
function getPlannerRoomBookings(sortedRooms) { return window.GroupStayPlanner.getPlannerRoomBookings(sortedRooms); }
function renderCalendar() { return window.GroupStayPlanner.renderCalendar(); }
function refreshCalendar() { return window.GroupStayPlanner.refreshCalendar(); }
function renderExpiringBanner() { return window.GroupStayPlanner.renderExpiringBanner(); }
function buildBoardHTML() { return window.GroupStayPlanner.buildBoardHTML(); }

// ---- Scroll sync + infinite extend ----

function onPlannerScroll() { return window.GroupStayPlanner.onPlannerScroll(); }
function extendPlanner(dir) { return window.GroupStayPlanner.extendPlanner(dir); }

// ---- Month bar ----

function updateMonthBarFromScroll() { return window.GroupStayPlanner.updateMonthBarFromScroll(); }
function renderPlannerMonthBar() { return window.GroupStayPlanner.renderPlannerMonthBar(); }
function jumpToMonth(year, month) { return window.GroupStayPlanner.jumpToMonth(year, month); }
function calendarPrev() { return window.GroupStayPlanner.calendarPrev(); }
function calendarNext() { return window.GroupStayPlanner.calendarNext(); }
function calendarToday() { return window.GroupStayPlanner.calendarToday(); }

// =============================================
// DRAG-TO-SELECT ON GRID
// =============================================

function initGridDrag() {
    return window.GroupStayPlannerDrag.initGridDrag();
}

function getDayIdxFromEvent(e) {
    return window.GroupStayPlannerDrag.getDayIdxFromEvent(e);
}

function onGridDragStart(e) {
    return window.GroupStayPlannerDrag.onGridDragStart(e);
}

function onGridDragMove(e) {
    return window.GroupStayPlannerDrag.onGridDragMove(e);
}

function updateDragOverlay() {
    return window.GroupStayPlannerDrag.updateDragOverlay();
}

function onGridDragEnd() {
    return window.GroupStayPlannerDrag.onGridDragEnd();
}

function openBookingTypeChooser(checkin, checkout) {
    const nights = nightsBetween(checkin, checkout);
    const label = `${formatDateDisplay(checkin)} → ${formatDateDisplay(checkout)} (${nights} ${nights === 1 ? t('cal.nights') : t('cal.nightsPlural')})`;
    document.getElementById('chooserDateLabel').textContent = label;
    document.getElementById('bookingTypeChooser').dataset.checkin = checkin;
    document.getElementById('bookingTypeChooser').dataset.checkout = checkout;
    openModal('bookingTypeChooser');
}

function chooseBookingType(type) {
    const el = document.getElementById('bookingTypeChooser');
    const checkin = el.dataset.checkin;
    const checkout = el.dataset.checkout;
    closeModal('bookingTypeChooser');

    if (type === 'group') {
        document.getElementById('reservationModalTitle').textContent = t('res.newGroupReservation');
        document.getElementById('reservationForm').reset();
        document.getElementById('resId').value = '';
        setDateFieldValue('resCheckin', checkin);
        setDateFieldValue('resCheckout', checkout);
        setDateFieldValue('resExpiration', formatDate(addDays(new Date(), 7)));
        populateRoomChecklist([]);
        toggleExpirationField();
        openModal('reservationModal');
    } else {
        document.getElementById('indModalTitle').textContent = t('res.newIndividual') || 'Nuova Prenotazione Individuale';
        document.getElementById('indForm').reset();
        document.getElementById('indId').value = '';
        setDateFieldValue('indCheckin', checkin);
        setDateFieldValue('indCheckout', checkout);
        document.getElementById('indStatus').value = 'confirmed';
        document.getElementById('indTotalPrice').textContent = '€0';
        document.getElementById('indPrice').value = 0;
        populateIndRoomSelect(null);
        openModal('individualModal');
    }
}

// =============================================
// SECURITY
// =============================================

// =============================================
// COMPLIANCE / SAFETY MODULE
// =============================================

function certStatus(expiryDate) {
    return window.GroupStayCompliance.certStatus(expiryDate);
}

function certStatusLabel(status) {
    return window.GroupStayCompliance.certStatusLabel(status);
}

function renderCompliance() {
    return window.GroupStayCompliance.renderCompliance();
}

function renderComplianceSummary() {
    return window.GroupStayCompliance.renderComplianceSummary();
}

function switchComplianceTab(tab) {
    return window.GroupStayCompliance.switchComplianceTab(tab, event?.target);
}

function renderComplianceEmpGrid() {
    return window.GroupStayCompliance.renderComplianceEmpGrid();
}

function renderComplianceDocList() {
    return window.GroupStayCompliance.renderComplianceDocList();
}

// ---- Cert Modal ----

function openCompCertModal(certId, employeeId) {
    return window.GroupStayCompliance.openCompCertModal(certId, employeeId);
}

function handleCompCertFile(input) {
    return window.GroupStayCompliance.handleCompCertFile(input);
}

async function saveCompCert(e) {
    return window.GroupStayCompliance.saveCompCert(e);
}

async function deleteCompCert(id) {
    return window.GroupStayCompliance.deleteCompCert(id);
}

// ---- Doc Modal ----

function openCompDocModal(docId) {
    return window.GroupStayCompliance.openCompDocModal(docId);
}

function handleCompDocFile(input) {
    return window.GroupStayCompliance.handleCompDocFile(input);
}

async function saveCompDoc(e) {
    return window.GroupStayCompliance.saveCompDoc(e);
}

async function deleteCompDoc(id) {
    return window.GroupStayCompliance.deleteCompDoc(id);
}

function openFilePreview(key) { return window.GroupStayCompliance.openFilePreview(key); }
function closeFilePreview() { return window.GroupStayCompliance.closeFilePreview(); }
function exportCompliancePDF() { return window.GroupStayCompliance.exportCompliancePDF(); }

// =============================================
// THEME
// =============================================

function getTheme() {
    return localStorage.getItem('gs_theme') || 'auto';
}

function applyTheme(theme) {
    if (theme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
    } else if (theme === 'light') {
        document.documentElement.setAttribute('data-theme', 'light');
    } else {
        document.documentElement.removeAttribute('data-theme');
    }
    updateThemeToggle(theme);
}

function updateThemeToggle(theme) {
    const btn = document.getElementById('themeToggle');
    if (!btn) return;
    const isDark = theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    btn.classList.toggle('is-dark', isDark);
}

function setTheme(theme) {
    localStorage.setItem('gs_theme', theme);
    applyTheme(theme);
    updateThemeButtons();
}

function updateThemeButtons() {
    const current = getTheme();
    document.querySelectorAll('.settings-toggle-btn[data-theme-val]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.themeVal === current);
    });
}

// Calendar size settings
let PLANNER_ROW_HEIGHT = parseInt(localStorage.getItem('gs_row_height')) || 34;

function updateCalendarSize() {
    const colW = document.getElementById('settingColWidth');
    const rowH = document.getElementById('settingRowHeight');
    if (!colW || !rowH) return;

    const cw = parseInt(colW.value);
    const rh = parseInt(rowH.value);

    document.getElementById('settingColWidthVal').textContent = cw + 'px';
    document.getElementById('settingRowHeightVal').textContent = rh + 'px';

    PLANNER_DAY_WIDTH = cw;
    PLANNER_ROW_HEIGHT = rh;

    localStorage.setItem('gs_col_width', cw);
    localStorage.setItem('gs_row_height', rh);

    renderCalendar();
}

function initSettingsModal() {
    const savedCW = parseInt(localStorage.getItem('gs_col_width')) || 38;
    const savedRH = parseInt(localStorage.getItem('gs_row_height')) || 34;

    PLANNER_DAY_WIDTH = savedCW;
    PLANNER_ROW_HEIGHT = savedRH;

    const colW = document.getElementById('settingColWidth');
    const rowH = document.getElementById('settingRowHeight');
    if (colW) { colW.value = savedCW; document.getElementById('settingColWidthVal').textContent = savedCW + 'px'; }
    if (rowH) { rowH.value = savedRH; document.getElementById('settingRowHeightVal').textContent = savedRH + 'px'; }

    updateThemeButtons();
}

// ---- CSV Import (Scidoo) ----

let csvParsedRows = [];
let csvHeaders = [];

function getCsvFields() {
    return [
        { key: 'groupName', label: t('csv.groupName'), required: true },
        { key: 'checkin', label: t('csv.checkinDate'), required: true },
        { key: 'checkout', label: t('csv.checkoutDate'), required: true },
        { key: 'roomCount', label: t('csv.roomCount'), required: false },
        { key: 'status', label: t('csv.status'), required: false },
        { key: 'price', label: t('csv.price'), required: false },
        { key: 'notes', label: t('csv.notes'), required: false },
        { key: 'guestCount', label: t('csv.guestCount'), required: false }
    ];
}

// Common Scidoo column name auto-mapping
const SCIDOO_MAP = {
    groupName: ['nome gruppo', 'group name', 'gruppo', 'nome', 'name', 'cliente', 'customer', 'ospite', 'guest', 'cognome', 'intestatario', 'prenotante', 'denominazione'],
    checkin: ['check-in', 'checkin', 'check in', 'data arrivo', 'arrivo', 'arrival', 'data_arrivo', 'dal', 'from', 'data inizio', 'ingresso'],
    checkout: ['check-out', 'checkout', 'check out', 'data partenza', 'partenza', 'departure', 'data_partenza', 'al', 'to', 'data fine', 'uscita'],
    roomCount: ['camere', 'rooms', 'room count', 'n. camere', 'num camere', 'numero camere', 'n camere', 'qty'],
    status: ['stato', 'status', 'state'],
    price: ['prezzo', 'price', 'totale', 'total', 'importo', 'amount', 'tariffa', 'rate'],
    notes: ['note', 'notes', 'commenti', 'comments', 'annotazioni', 'osservazioni'],
    guestCount: ['ospiti', 'guests', 'guest count', 'pax', 'persone', 'n. ospiti', 'num ospiti', 'adulti']
};

function parseCsv(text) {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return { headers: [], rows: [] };

    // Detect delimiter
    const firstLine = lines[0];
    const semicolons = (firstLine.match(/;/g) || []).length;
    const commas = (firstLine.match(/,/g) || []).length;
    const tabs = (firstLine.match(/\t/g) || []).length;
    let delim = ',';
    if (semicolons > commas && semicolons > tabs) delim = ';';
    else if (tabs > commas && tabs > semicolons) delim = '\t';

    function splitRow(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') {
                if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
                else inQuotes = !inQuotes;
            } else if (ch === delim && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += ch;
            }
        }
        result.push(current.trim());
        return result;
    }

    const headers = splitRow(lines[0]);
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
        const vals = splitRow(lines[i]);
        if (vals.every(v => !v)) continue; // skip empty rows
        const row = {};
        headers.forEach((h, j) => { row[h] = vals[j] || ''; });
        rows.push(row);
    }
    return { headers, rows };
}

function handleCsvFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    document.getElementById('csvFileName').textContent = file.name;

    const reader = new FileReader();
    reader.onload = function(ev) {
        const { headers, rows } = parseCsv(ev.target.result);
        if (headers.length === 0) {
            showToast(t('toast.csvParseFail'), 'error');
            return;
        }
        csvHeaders = headers;
        csvParsedRows = rows;
        buildCsvMappingUI();
        closeModal('settingsModal');
        openModal('csvImportModal');
    };
    reader.readAsText(file);
}

function autoMapColumn(fieldKey) {
    const candidates = SCIDOO_MAP[fieldKey] || [];
    for (const candidate of candidates) {
        const match = csvHeaders.find(h => h.toLowerCase().trim() === candidate);
        if (match) return match;
    }
    // Partial match
    for (const candidate of candidates) {
        const match = csvHeaders.find(h => h.toLowerCase().trim().includes(candidate));
        if (match) return match;
    }
    return '';
}

function buildCsvMappingUI() {
    const grid = document.getElementById('csvMappingGrid');
    const options = csvHeaders.map(h => `<option value="${escapeHtml(h)}">${escapeHtml(h)}</option>`).join('');

    grid.innerHTML = getCsvFields().map(f => {
        const autoVal = autoMapColumn(f.key);
        return `
            <label>${f.label}${f.required ? ' *' : ''}</label>
            <select id="csvMap_${f.key}" onchange="updateCsvPreview()">
                <option value="">${t('csv.skip')}</option>
                ${options}
            </select>`;
    }).join('');

    // Set auto-mapped values
    getCsvFields().forEach(f => {
        const mapped = autoMapColumn(f.key);
        if (mapped) document.getElementById('csvMap_' + f.key).value = mapped;
    });

    updateCsvPreview();
}

function getCsvMapping() {
    const mapping = {};
    getCsvFields().forEach(f => {
        const sel = document.getElementById('csvMap_' + f.key);
        if (sel && sel.value) mapping[f.key] = sel.value;
    });
    return mapping;
}

function parseImportDate(raw) {
    if (!raw) return null;
    raw = raw.trim();
    // Try ISO: YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.substring(0, 10);
    // Try DD/MM/YYYY or DD-MM-YYYY
    let m = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
    if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
    // Try MM/DD/YYYY (if first number > 12, assume DD/MM)
    m = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
    if (m) {
        if (parseInt(m[1]) > 12) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
        return `${m[3]}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`;
    }
    // Fallback: try native Date parse
    const d = new Date(raw);
    if (!isNaN(d.getTime())) return formatDate(d);
    return null;
}

function mapCsvRow(row, mapping) {
    const get = (key) => mapping[key] ? (row[mapping[key]] || '') : '';
    const checkin = parseImportDate(get('checkin'));
    const checkout = parseImportDate(get('checkout'));
    if (!checkin || !checkout) return null;

    const groupName = get('groupName') || 'Imported';
    const roomCount = parseInt(get('roomCount')) || 1;
    const price = parseFloat(get('price')) || 0;
    const notes = get('notes');
    const guestCount = parseInt(get('guestCount')) || 0;

    let status = (get('status') || 'confirmed').toLowerCase().trim();
    // Normalize Italian status terms
    if (['confermata', 'confermato', 'confirmed'].includes(status)) status = 'confirmed';
    else if (['in attesa', 'pending', 'opzione', 'tentativo'].includes(status)) status = 'pending';
    else if (['cancellata', 'cancellato', 'cancelled', 'canceled', 'annullata'].includes(status)) status = 'cancelled';
    else if (['checked-in', 'check-in', 'in casa', 'in house'].includes(status)) status = 'checked-in';
    else status = 'confirmed';

    return { groupName, checkin, checkout, roomCount, roomIds: [], status, price, notes, guestCount };
}

function updateCsvPreview() {
    const mapping = getCsvMapping();
    const preview = csvParsedRows.slice(0, 10).map(r => mapCsvRow(r, mapping)).filter(Boolean);

    document.getElementById('csvPreviewCount').textContent = `(${csvParsedRows.length} rows found, showing first ${Math.min(10, preview.length)})`;

    if (preview.length === 0) {
        document.getElementById('csvPreviewTable').innerHTML = `<p style="padding:12px;color:var(--text-secondary);font-size:13px">${t('csv.noValidRows')}</p>`;
        return;
    }

    let html = `<table><thead><tr><th>${t('csv.groupName')}</th><th>${t('res.checkin')}</th><th>${t('res.checkout')}</th><th>${t('res.rooms')}</th><th>${t('res.status')}</th><th>${t('csv.price')}</th></tr></thead><tbody>`;
    preview.forEach(r => {
        html += `<tr>
            <td>${escapeHtml(r.groupName)}</td>
            <td>${r.checkin}</td>
            <td>${r.checkout}</td>
            <td>${r.roomCount}</td>
            <td>${r.status}</td>
            <td>${r.price ? '€' + r.price.toLocaleString() : '—'}</td>
        </tr>`;
    });
    html += '</tbody></table>';
    document.getElementById('csvPreviewTable').innerHTML = html;
}

async function executeCsvImport() {
    const mapping = getCsvMapping();
    if (!mapping.groupName || !mapping.checkin || !mapping.checkout) {
        showToast(t('toast.csvMappingRequired'), 'error');
        return;
    }

    const toImport = csvParsedRows.map(r => mapCsvRow(r, mapping)).filter(Boolean);
    if (toImport.length === 0) {
        showToast(t('toast.noValidRows'), 'error');
        return;
    }

    if (!confirm(t('confirm.importReservations', { n: toImport.length }))) return;

    showLoading(`Importazione prenotazioni (0 / ${toImport.length})...`);
    let success = 0;
    let errors = 0;

    for (const data of toImport) {
        const newRes = { id: generateId(), ...data, createdAt: new Date().toISOString() };
        try {
            await apiPost(API.reservations, newRes);
            reservations.push(newRes);
            success++;
        } catch (err) {
            console.error('Import error:', err);
            errors++;
        }
        document.getElementById('loadingMessage').textContent =
            `Importazione prenotazioni (${success + errors} / ${toImport.length})...`;
    }

    hideLoading();
    closeModal('csvImportModal');
    showToast(`Imported ${success} reservations${errors ? ', ' + errors + ' failed' : ''}`);
    renderDashboard();
    refreshCalendar();

    // Reset file input
    document.getElementById('csvFileInput').value = '';
    document.getElementById('csvFileName').textContent = '';
    csvParsedRows = [];
    csvHeaders = [];
}

// ---- Smart Guest File Import ----

function getGuestImportFields() {
    return [
        { key: 'lastName',       label: t('field.lastName'),       required: true },
        { key: 'firstName',      label: t('field.firstName'),      required: true },
        { key: 'sex',            label: t('field.sex') },
        { key: 'birthDate',      label: t('field.birthDate') },
        { key: 'birthComune',    label: t('field.birthCity') },
        { key: 'birthProvince',  label: t('field.birthProvince') },
        { key: 'birthCountry',   label: t('field.birthCountry') },
        { key: 'citizenship',    label: t('field.citizenship') },
        { key: 'docType',        label: t('field.docType') },
        { key: 'docNumber',      label: t('field.docNumber') },
        { key: 'docIssuedPlace', label: t('field.docIssuedPlace') },
        { key: 'email',          label: t('field.email') },
        { key: 'phone',          label: t('field.phone') },
        { key: 'guestType',      label: t('field.guestType') },
        { key: 'residenceComune', label: t('field.residenceComune') },
    ];
}

const GUEST_COL_ALIASES = {
    lastName:       ['cognome', 'last name', 'surname', 'family name', 'last_name'],
    firstName:      ['nome', 'first name', 'given name', 'first_name'],
    sex:            ['sesso', 'sex', 'gender', 'genere'],
    birthDate:      ['data nascita', 'data di nascita', 'birth date', 'date of birth', 'nato il', 'dob', 'data_nascita', 'birth_date'],
    birthComune:    ['comune nascita', 'comune di nascita', 'birth city', 'birth place', 'luogo nascita', 'luogo di nascita', 'citta nascita'],
    birthProvince:  ['provincia nascita', 'prov nascita', 'birth province', 'provincia', 'sigla', 'prov'],
    birthCountry:   ['stato nascita', 'country of birth', 'birth country', 'nazione nascita', 'stato'],
    citizenship:    ['cittadinanza', 'citizenship', 'nazionalita', 'nationality'],
    docType:        ['tipo documento', 'document type', 'doc type', 'tipo doc', 'tipo_documento'],
    docNumber:      ['numero documento', 'document number', 'doc number', 'n. documento', 'num documento', 'numero_documento'],
    docIssuedPlace: ['luogo rilascio', 'issued place', 'rilasciato da', 'autorita', 'luogo_rilascio'],
    email:          ['email', 'e-mail', 'mail', 'posta elettronica'],
    phone:          ['telefono', 'phone', 'cellulare', 'mobile', 'tel'],
    guestType:      ['tipo alloggiato', 'guest type', 'tipo ospite', 'tipo'],
    residenceComune: ['comune residenza', 'comune di residenza', 'residenza', 'residence', 'residence city', 'comune_residenza'],
};

let guestFileParsedRows = [];
let guestFileXlsxHeaders = [];
let guestFileMode = ''; // 'xlsx' or 'text'

function openFileImportModal(reservationId) {
    return window.GroupStayGuestImport.openFileImportModal(reservationId);
}

function handleGuestFileImport(e) {
    return window.GroupStayGuestImport.handleGuestFileImport(e);
}

async function processGuestFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['pdf', 'docx', 'xlsx', 'xls'].includes(ext)) {
        showToast(t('toast.unsupportedFile'), 'error');
        return;
    }

    // Show file name
    const nameEl = document.getElementById('guestFileName');
    nameEl.textContent = file.name;
    nameEl.style.display = 'inline';

    // Show loading
    document.getElementById('fileImportLoading').style.display = 'block';
    document.getElementById('textParseSection').style.display = 'none';
    document.getElementById('fileImportPreviewSection').style.display = 'none';
    document.getElementById('fileImportActions').style.display = 'none';

    try {
        if (ext === 'xlsx' || ext === 'xls') {
            await processXlsxFile(file);
        } else if (ext === 'docx') {
            await processDocxFile(file);
        } else if (ext === 'pdf') {
            await processPdfFile(file);
        }
    } catch (err) {
        console.error('File import error:', err);
        showToast(t('toast.fileFail') + ': ' + err.message, 'error');
    } finally {
        document.getElementById('fileImportLoading').style.display = 'none';
    }
}

// ---- XLSX Path ----

function scoreSheetHeaders(headers) {
    let score = 0;
    for (const field of getGuestImportFields()) {
        const aliases = GUEST_COL_ALIASES[field.key] || [];
        for (const alias of aliases) {
            if (headers.some(h => normalizeStr(h) === alias || normalizeStr(h).includes(alias))) {
                score++;
                break;
            }
        }
    }
    return score;
}

async function processXlsxFile(file) {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array', cellDates: true });
    const jsonOpts = { defval: '', raw: false, dateNF: 'DD/MM/YYYY' };

    // Try all sheets and pick the one with the most recognized headers
    let bestSheet = wb.SheetNames[0];
    let bestScore = 0;
    for (const name of wb.SheetNames) {
        const sj = XLSX.utils.sheet_to_json(wb.Sheets[name], jsonOpts);
        if (sj.length === 0) continue;
        const score = scoreSheetHeaders(Object.keys(sj[0]));
        if (score > bestScore) { bestScore = score; bestSheet = name; }
    }

    const ws = wb.Sheets[bestSheet];
    let json = XLSX.utils.sheet_to_json(ws, jsonOpts);
    if (json.length === 0) { showToast(t('toast.noDataSpreadsheet'), 'error'); return; }

    // If no headers recognized on any sheet, re-read with generic column names
    if (bestScore === 0) {
        const rawRows = XLSX.utils.sheet_to_json(ws, { ...jsonOpts, header: 1 });
        if (rawRows.length === 0) { showToast(t('toast.noDataSpreadsheet'), 'error'); return; }
        const numCols = Math.max(...rawRows.map(r => r.length));
        const genHeaders = [];
        for (let i = 0; i < numCols; i++) genHeaders.push(`Column ${i + 1}`);
        json = rawRows.map(row => {
            const obj = {};
            genHeaders.forEach((h, i) => obj[h] = row[i] !== undefined ? row[i] : '');
            return obj;
        });
    }

    // Auto-detect column mapping (header aliases first, then content-based)
    guestFileXlsxHeaders = Object.keys(json[0]);
    guestFileParsedRows = json;
    const contentDetected = autoDetectColumnsByContent();
    const mapping = {};
    getGuestImportFields().forEach(f => {
        const mapped = autoMapGuestColumn(f.key) || contentDetected[f.key] || '';
        if (mapped) mapping[f.key] = mapped;
    });

    // Map all rows using auto-detected mapping and store as guest objects
    guestFileMode = 'text'; // treat as pre-mapped (no manual mapping needed)
    guestFileParsedRows = json.map(r => mapXlsxGuestRow(r, mapping)).filter(Boolean);

    if (guestFileParsedRows.length === 0) {
        showToast(t('toast.noGuestsSpreadsheet'), 'error');
        return;
    }

    document.getElementById('fileImportPreviewSection').style.display = 'block';
    document.getElementById('fileImportActions').style.display = 'flex';
    renderGuestFilePreviewTable(guestFileParsedRows);
}

function normalizeStr(s) {
    return s.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function autoMapGuestColumn(fieldKey) {
    const candidates = GUEST_COL_ALIASES[fieldKey] || [];
    for (const c of candidates) {
        const match = guestFileXlsxHeaders.find(h => normalizeStr(h) === c);
        if (match) return match;
    }
    for (const c of candidates) {
        const match = guestFileXlsxHeaders.find(h => normalizeStr(h).includes(c));
        if (match) return match;
    }
    return '';
}

// Content-based column detection: analyze actual cell values to determine field type
function autoDetectColumnsByContent() {
    if (guestFileParsedRows.length === 0) return {};

    const sampleSize = Math.min(guestFileParsedRows.length, 30);
    const samples = guestFileParsedRows.slice(0, sampleSize);
    const headers = guestFileXlsxHeaders;

    // Collect non-empty values per column
    const colValues = {};
    for (const h of headers) {
        colValues[h] = samples.map(r => String(r[h] || '').trim()).filter(Boolean);
    }

    // Score each column for each field type
    const detectors = {
        sex: vals => {
            const sexVals = ['m', 'f', 'male', 'female', 'maschile', 'femminile', 'maschio', 'femmina', '1', '2'];
            const matches = vals.filter(v => sexVals.includes(v.toLowerCase().trim()));
            // Also detect columns where ALL values are single char M or F
            const mfMatches = vals.filter(v => /^[mfMF]$/.test(v.trim()));
            const score = Math.max(matches.length, mfMatches.length) / Math.max(vals.length, 1);
            return score;
        },
        birthDate: vals => {
            const datePattern = /^(\d{1,2}[\/.\\-]\d{1,2}[\/.\\-]\d{2,4}|\d{4}[\/.\\-]\d{1,2}[\/.\\-]\d{1,2})$/;
            // Also match dates like "01 gen 2000", "1 gennaio 2000", Excel serial numbers, JS date strings
            const itMonths = /gen|feb|mar|apr|mag|giu|lug|ago|set|ott|nov|dic|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/i;
            const matches = vals.filter(v => {
                const s = v.trim();
                if (datePattern.test(s)) return true;
                if (itMonths.test(s) && /\d/.test(s)) return true;
                // JS Date toString or ISO format
                if (/^\d{4}-\d{2}-\d{2}/.test(s)) return true;
                if (/\w{3}\s+\w{3}\s+\d{1,2}\s+\d{4}/.test(s)) return true;
                return false;
            });
            return matches.length / Math.max(vals.length, 1);
        },
        email: vals => {
            const matches = vals.filter(v => /^[\w.+-]+@[\w.-]+\.\w{2,}$/.test(v));
            return matches.length / Math.max(vals.length, 1);
        },
        phone: vals => {
            const matches = vals.filter(v => /^\+?[\d\s\-().]{7,}$/.test(v) && (v.replace(/\D/g, '').length >= 7));
            return matches.length / Math.max(vals.length, 1);
        },
        birthProvince: vals => {
            // Exactly 2 uppercase letters
            const matches = vals.filter(v => /^[A-Za-z]{2}$/.test(v));
            return vals.length > 0 && matches.length === vals.length ? 0.85 : matches.length / Math.max(vals.length, 1) * 0.7;
        },
        docType: vals => {
            const docCodes = ['ident', 'pasor', 'paten', 'pnauz', 'pordf', 'carta identita', "carta d'identita",
                "carta d'identità", 'passaporto', 'passport', 'patente', 'identity card', 'id card', 'ci', 'driving license'];
            const matches = vals.filter(v => docCodes.includes(v.toLowerCase()) || /^[A-Z]{5}$/.test(v));
            return matches.length / Math.max(vals.length, 1);
        },
        docNumber: vals => {
            // Mix of letters and digits, typical document number patterns
            const matches = vals.filter(v => /^[A-Za-z]{0,2}\d{5,}$/.test(v) || /^[A-Z]{2}\d+[A-Z]*$/i.test(v));
            return matches.length / Math.max(vals.length, 1);
        },
        guestType: vals => {
            const types = ['16', '17', '18', '19', '20', 'ospite singolo', 'capogruppo', 'capofamiglia',
                'membro gruppo', 'membro famiglia', 'single guest', 'group leader', 'family head'];
            const matches = vals.filter(v => types.includes(v.toLowerCase()));
            return matches.length / Math.max(vals.length, 1);
        },
        citizenship: vals => {
            const commonNationalities = ['italia', 'italiano', 'italiana', 'germany', 'germania', 'tedesco', 'tedesca',
                'france', 'francia', 'francese', 'spain', 'spagna', 'spagnolo', 'spagnola', 'uk', 'british', 'inglese',
                'usa', 'american', 'americano', 'americana', 'romania', 'rumeno', 'rumena', 'poland', 'polonia', 'polacco',
                'china', 'cina', 'cinese', 'brazil', 'brasile', 'brasiliano', 'brasiliana', 'albanese', 'albania',
                'marocco', 'marocchino', 'marocchina', 'tunisia', 'tunisino', 'tunisina', 'italian', 'french', 'spanish',
                'german', 'dutch', 'portuguese', 'swiss', 'austrian', 'belgian', 'svizzera', 'austria', 'belgio'];
            const matches = vals.filter(v => commonNationalities.includes(v.toLowerCase().trim()));
            if (matches.length > 0) return matches.length / Math.max(vals.length, 1);
            // Fallback: country-like text with low unique ratio
            const unique = new Set(vals.map(v => v.toLowerCase()));
            const isCountryLike = vals.every(v => /^[A-Za-zÀ-ÿ\s'-]{2,}$/.test(v) && v.length <= 30);
            return isCountryLike && unique.size <= Math.ceil(vals.length * 0.5) ? 0.4 : 0;
        },
    };

    // Name detection: columns where values look like proper names (capitalized words, no numbers/special chars)
    function looksLikeName(vals) {
        const namePattern = /^[A-ZÀ-ÿ][a-zà-ÿ']+(?:\s+[A-ZÀ-ÿ][a-zà-ÿ']+)*$/;
        const upperNamePattern = /^[A-ZÀ-ÿ'\s]+$/; // ALL CAPS names
        const matches = vals.filter(v => namePattern.test(v) || (upperNamePattern.test(v) && v.length >= 2 && v.length <= 40));
        return matches.length / Math.max(vals.length, 1);
    }

    // Score every column for every field
    const scores = {}; // { fieldKey: { header: score, ... } }
    const assigned = new Set(); // headers already assigned

    // First pass: detect clear-signal fields (email, phone, sex, dates, docType, etc.)
    for (const [field, detector] of Object.entries(detectors)) {
        scores[field] = {};
        for (const h of headers) {
            scores[field][h] = detector(colValues[h]);
        }
    }

    // Assign fields by confidence, highest first
    const result = {};
    const fieldOrder = ['email', 'phone', 'sex', 'docType', 'guestType', 'birthDate', 'birthProvince', 'docNumber', 'citizenship'];

    for (const field of fieldOrder) {
        let bestHeader = '';
        let bestScore = 0.5; // minimum threshold
        for (const h of headers) {
            if (assigned.has(h)) continue;
            const s = scores[field]?.[h] || 0;
            if (s > bestScore) { bestScore = s; bestHeader = h; }
        }
        if (bestHeader) {
            result[field] = bestHeader;
            assigned.add(bestHeader);
        }
    }

    // Name columns: find columns that look like person names
    const nameCandidates = [];
    for (const h of headers) {
        if (assigned.has(h)) continue;
        const score = looksLikeName(colValues[h]);
        if (score >= 0.5) nameCandidates.push({ header: h, score });
    }
    nameCandidates.sort((a, b) => b.score - a.score);

    // Heuristic for lastName vs firstName: typically last name comes first in Italian documents,
    // or the header with shorter average values is the last name
    if (nameCandidates.length >= 2 && !result.lastName && !result.firstName) {
        const c1 = nameCandidates[0].header;
        const c2 = nameCandidates[1].header;
        const idx1 = headers.indexOf(c1);
        const idx2 = headers.indexOf(c2);
        // In Italian convention: cognome (lastName) before nome (firstName)
        if (idx1 < idx2) {
            result.lastName = c1; result.firstName = c2;
        } else {
            result.lastName = c2; result.firstName = c1;
        }
        assigned.add(c1); assigned.add(c2);
    } else if (nameCandidates.length === 1) {
        if (!result.lastName) { result.lastName = nameCandidates[0].header; assigned.add(nameCandidates[0].header); }
        else if (!result.firstName) { result.firstName = nameCandidates[0].header; assigned.add(nameCandidates[0].header); }
    }

    // Remaining location-like columns (birthComune, birthCountry, docIssuedPlace)
    const locationFields = ['birthComune', 'birthCountry', 'docIssuedPlace'].filter(f => !result[f]);
    const locationCandidates = [];
    for (const h of headers) {
        if (assigned.has(h)) continue;
        const vals = colValues[h];
        const isTextLike = vals.every(v => /^[A-Za-zÀ-ÿ\s'-]{2,}$/.test(v));
        if (isTextLike && vals.length > 0) locationCandidates.push(h);
    }

    // Assign location columns by position (birthComune typically comes before birthCountry)
    for (let i = 0; i < Math.min(locationFields.length, locationCandidates.length); i++) {
        result[locationFields[i]] = locationCandidates[i];
        assigned.add(locationCandidates[i]);
    }

    return result;
}


function mapXlsxGuestRow(row, mapping) {
    const get = key => mapping[key] ? (String(row[mapping[key]] || '')).trim() : '';
    const firstName = get('firstName');
    const lastName = get('lastName');
    if (!firstName && !lastName) return null;

    return {
        firstName,
        lastName,
        sex: normalizeSex(get('sex')),
        birthDate: parseImportDate(get('birthDate')) || '',
        birthComune: get('birthComune'),
        birthProvince: get('birthProvince').toUpperCase().substring(0, 2),
        birthCountry: normalizeBirthCountry(get('birthCountry'), get('birthComune')),
        citizenship: get('citizenship'),
        docType: normalizeDocType(get('docType')),
        docNumber: get('docNumber'),
        docIssuedPlace: get('docIssuedPlace'),
        email: get('email'),
        phone: get('phone'),
        guestType: normalizeGuestType(get('guestType')),
        residenceComune: get('residenceComune'),
        notes: '',
    };
}

// ---- PDF Path ----

async function processPdfFile(file) {
    if (!window.pdfjsLib) {
        showToast(t('toast.pdfNotLoaded'), 'error');
        return;
    }
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items.map(item => item.str).join(' ');
        fullText += pageText + '\n';
    }
    if (fullText.trim().length < 5) {
        showToast(t('toast.pdfNoText'), 'error');
        return;
    }
    processExtractedText(fullText);
}

// ---- DOCX Path ----

async function processDocxFile(file) {
    if (!window.mammoth) {
        showToast(t('toast.docxNotLoaded'), 'error');
        return;
    }
    const buf = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer: buf });
    if (result.value.trim().length < 5) {
        showToast(t('toast.docxNoText'), 'error');
        return;
    }
    processExtractedText(result.value);
}

// ---- Smart Text Parser (PDF/DOCX) ----

function processExtractedText(text) {
    guestFileMode = 'text';

    // Show the raw text
    document.getElementById('extractedTextPreview').textContent = text;
    document.getElementById('textParseSection').style.display = 'block';

    // Parse into guest records
    guestFileParsedRows = parseGuestText(text);

    if (guestFileParsedRows.length === 0) {
        showToast(t('toast.noGuestsDetected'), 'error');
    }

    document.getElementById('fileImportPreviewSection').style.display = 'block';
    document.getElementById('fileImportActions').style.display = 'flex';
    renderGuestFilePreview();
}

const KEY_VALUE_PATTERNS = {
    lastName:       /(?:cognome|last\s*name|surname|family\s*name)\s*[:=\-–]\s*(.+)/i,
    firstName:      /(?:nome(?!\s*gruppo)|first\s*name|given\s*name)\s*[:=\-–]\s*(.+)/i,
    sex:            /(?:sesso|sex|gender|genere)\s*[:=\-–]\s*(.+)/i,
    birthDate:      /(?:data\s*(?:di\s*)?nascita|birth\s*date|date\s*of\s*birth|nato\s*(?:il|a)|dob)\s*[:=\-–]\s*(.+)/i,
    birthComune:    /(?:(?:comune|luogo|citta|citt[aà])\s*(?:di\s*)?nascita|birth\s*(?:city|place))\s*[:=\-–]\s*(.+)/i,
    birthProvince:  /(?:provincia\s*(?:di\s*)?nascita|prov(?:incia)?(?:\s*nascita)?)\s*[:=\-–]\s*([A-Z]{2})/i,
    birthCountry:   /(?:stato\s*(?:di\s*)?nascita|(?:birth|country\s*of)\s*(?:country|birth)|nazione\s*(?:di\s*)?nascita)\s*[:=\-–]\s*(.+)/i,
    citizenship:    /(?:cittadinanza|citizenship|nazionalit[aà]|nationality)\s*[:=\-–]\s*(.+)/i,
    docType:        /(?:tipo\s*(?:di\s*)?documento|document\s*type|doc(?:ument)?\s*type)\s*[:=\-–]\s*(.+)/i,
    docNumber:      /(?:n(?:umero)?\.?\s*(?:di\s*)?documento|document\s*(?:number|no)|doc\s*n(?:umber)?)\s*[:=\-–]\s*(.+)/i,
    docIssuedPlace: /(?:luogo\s*(?:di\s*)?rilascio|(?:issued|released)\s*(?:by|place|at)|rilasciato\s*(?:da|a))\s*[:=\-–]\s*(.+)/i,
    email:          /(?:email|e-mail|mail|posta\s*elettronica)\s*[:=\-–]\s*(\S+)/i,
    phone:          /(?:telefono|phone|cellulare|mobile|tel)\s*[:=\-–]\s*([\d\s\+\-\.()]+)/i,
    guestType:      /(?:tipo\s*(?:di\s*)?(?:alloggiato|ospite)|guest\s*type)\s*[:=\-–]\s*(.+)/i,
};

function parseGuestText(text) {
    // First try: detect if text looks like a table (tab or multi-space separated)
    const tableGuests = tryParseAsTable(text);
    if (tableGuests.length > 0) return tableGuests;

    // Second try: key-value pairs, split into guest blocks
    const blocks = splitIntoGuestBlocks(text);
    const guests = [];

    for (const block of blocks) {
        const guest = parseGuestBlock(block);
        if (guest.firstName || guest.lastName) {
            guests.push(guest);
        }
    }

    // If no key-value matches, try line-by-line name detection
    if (guests.length === 0) {
        return tryFallbackNameDetection(text);
    }

    return guests;
}

function tryParseAsTable(text) {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return [];

    // Detect delimiter
    let delimiter = null;
    const firstLine = lines[0];
    if ((firstLine.match(/\t/g) || []).length >= 2) delimiter = '\t';
    else if ((firstLine.match(/\s{2,}/g) || []).length >= 2) delimiter = /\s{2,}/;
    if (!delimiter) return [];

    const firstCols = firstLine.split(delimiter).map(h => h.trim()).filter(Boolean);
    if (firstCols.length < 2) return [];

    // Try to auto-map using first row as headers
    const mapping = {};
    for (const field of getGuestImportFields()) {
        const aliases = GUEST_COL_ALIASES[field.key] || [];
        for (const alias of aliases) {
            const idx = firstCols.findIndex(h => h.toLowerCase().includes(alias));
            if (idx !== -1) { mapping[field.key] = idx; break; }
        }
    }

    let dataStartIdx = 1;
    const headersMapped = !!(mapping.firstName || mapping.lastName);

    // If headers didn't match, try content-based detection (first row is data, not headers)
    if (!headersMapped) {
        dataStartIdx = 0; // first row is data too
        const sampleRows = lines.slice(0, Math.min(lines.length, 20)).map(l => l.split(delimiter).map(c => c.trim()));
        const numCols = Math.max(...sampleRows.map(r => r.length));

        // Collect values per column index
        const colVals = [];
        for (let c = 0; c < numCols; c++) {
            colVals[c] = sampleRows.map(r => r[c] || '').filter(Boolean);
        }

        const assigned = new Set();

        // Detect specific fields by content
        const colDetectors = {
            sex: vals => { const sexVals = ['m', 'f', 'male', 'female', 'maschile', 'femminile', 'maschio', 'femmina', '1', '2']; return vals.filter(v => sexVals.includes(v.toLowerCase())).length / Math.max(vals.length, 1); },
            birthDate: vals => { return vals.filter(v => /^(\d{1,2}[\/.\\-]\d{1,2}[\/.\\-]\d{2,4}|\d{4}[\/.\\-]\d{1,2}[\/.\\-]\d{1,2})$/.test(v)).length / Math.max(vals.length, 1); },
            email: vals => vals.filter(v => /^[\w.+-]+@[\w.-]+\.\w{2,}$/.test(v)).length / Math.max(vals.length, 1),
            phone: vals => vals.filter(v => /^\+?[\d\s\-().]{7,}$/.test(v) && v.replace(/\D/g, '').length >= 7).length / Math.max(vals.length, 1),
            birthProvince: vals => vals.length > 0 && vals.filter(v => /^[A-Za-z]{2}$/.test(v)).length === vals.length ? 0.85 : 0,
            docType: vals => { const codes = ['ident', 'pasor', 'paten', 'pnauz', 'pordf', 'passaporto', 'passport', 'patente', 'carta identita', "carta d'identita"]; return vals.filter(v => codes.includes(v.toLowerCase()) || /^[A-Z]{5}$/.test(v)).length / Math.max(vals.length, 1); },
            guestType: vals => { const types = ['16', '17', '18', '19', '20', 'ospite singolo', 'capogruppo', 'capofamiglia']; return vals.filter(v => types.includes(v.toLowerCase())).length / Math.max(vals.length, 1); },
        };

        const fieldOrder = ['email', 'phone', 'sex', 'docType', 'guestType', 'birthDate', 'birthProvince'];
        for (const field of fieldOrder) {
            let bestIdx = -1, bestScore = 0.5;
            for (let c = 0; c < numCols; c++) {
                if (assigned.has(c)) continue;
                const s = colDetectors[field]?.(colVals[c]) || 0;
                if (s > bestScore) { bestScore = s; bestIdx = c; }
            }
            if (bestIdx >= 0) { mapping[field] = bestIdx; assigned.add(bestIdx); }
        }

        // Detect name columns
        const nameLike = v => /^[A-ZÀ-ÿ][a-zà-ÿ']+(?:\s+[A-ZÀ-ÿ][a-zà-ÿ']+)*$/.test(v) || /^[A-ZÀ-ÿ'\s]{2,}$/.test(v);
        const nameCandidates = [];
        for (let c = 0; c < numCols; c++) {
            if (assigned.has(c)) continue;
            const score = colVals[c].filter(nameLike).length / Math.max(colVals[c].length, 1);
            if (score >= 0.5) nameCandidates.push({ idx: c, score });
        }
        nameCandidates.sort((a, b) => b.score - a.score);
        if (nameCandidates.length >= 2) {
            const [a, b] = nameCandidates[0].idx < nameCandidates[1].idx
                ? [nameCandidates[0], nameCandidates[1]]
                : [nameCandidates[1], nameCandidates[0]];
            mapping.lastName = a.idx; mapping.firstName = b.idx;
            assigned.add(a.idx); assigned.add(b.idx);
        } else if (nameCandidates.length === 1) {
            mapping.lastName = nameCandidates[0].idx;
            assigned.add(nameCandidates[0].idx);
        }
    }

    if (!mapping.firstName && !mapping.lastName) return [];

    const results = [];
    for (let i = dataStartIdx; i < lines.length; i++) {
        const cols = lines[i].split(delimiter).map(c => c.trim());
        const get = key => mapping[key] !== undefined ? (cols[mapping[key]] || '') : '';
        const firstName = get('firstName');
        const lastName = get('lastName');
        if (!firstName && !lastName) continue;
        const csvBirthComune = get('birthComune');
        const csvBirthCountry = normalizeBirthCountry(get('birthCountry'), csvBirthComune);
        results.push({
            firstName, lastName,
            sex: normalizeSex(get('sex')),
            birthDate: parseImportDate(get('birthDate')) || '',
            birthComune: csvBirthComune,
            birthProvince: get('birthProvince').toUpperCase().substring(0, 2),
            birthCountry: csvBirthCountry,
            citizenship: get('citizenship'),
            docType: normalizeDocType(get('docType')),
            docNumber: get('docNumber'),
            docIssuedPlace: get('docIssuedPlace'),
            email: get('email'),
            phone: get('phone'),
            guestType: normalizeGuestType(get('guestType')),
            notes: '',
        });
    }
    return results;
}

function splitIntoGuestBlocks(text) {
    // Split on patterns like "Guest 1", "Ospite 2", "--- Guest ---", numbered lists, or repeated label patterns
    const splitters = /(?:^|\n)\s*(?:(?:guest|ospite|alloggiato|persona)\s*(?:#|n[°.]?)?\s*\d+|(?:---+|===+)\s*|\d+\s*[.)]\s*(?:guest|ospite|nome|cognome))/gi;
    const parts = text.split(splitters).filter(s => s.trim().length > 10);

    if (parts.length > 1) return parts;

    // Try splitting by repeated "Cognome:" or "Last Name:" patterns
    const labelSplit = text.split(/(?=(?:cognome|last\s*name|surname)\s*[:=\-–])/gi).filter(s => s.trim().length > 5);
    if (labelSplit.length > 1) return labelSplit;

    // No clear boundaries — treat the whole text as one block
    return [text];
}

function parseGuestBlock(block) {
    const guest = {
        firstName: '', lastName: '', sex: '', birthDate: '', birthComune: '',
        birthProvince: '', birthCountry: '', citizenship: '', docType: '',
        docNumber: '', docIssuedPlace: '', email: '', phone: '', guestType: '', notes: ''
    };

    const lines = block.split(/\r?\n/);

    for (const line of lines) {
        for (const [field, regex] of Object.entries(KEY_VALUE_PATTERNS)) {
            if (guest[field]) continue; // already matched
            const m = line.match(regex);
            if (m) {
                let val = m[1].trim().replace(/[;,]$/, '').trim();
                guest[field] = val;
            }
        }
    }

    // Standalone pattern fallbacks
    if (!guest.email) {
        const em = block.match(/\b[\w.+-]+@[\w.-]+\.\w{2,}\b/);
        if (em) guest.email = em[0];
    }
    if (!guest.phone) {
        const ph = block.match(/(?<![@\w])(\+?\d[\d\s\-().]{7,}\d)(?!\w)/);
        if (ph) guest.phone = ph[1].trim();
    }

    // Normalize
    guest.sex = normalizeSex(guest.sex);
    guest.birthDate = parseImportDate(guest.birthDate) || '';
    guest.docType = normalizeDocType(guest.docType);
    guest.guestType = normalizeGuestType(guest.guestType);
    guest.birthProvince = guest.birthProvince.toUpperCase().substring(0, 2);
    guest.birthCountry = normalizeBirthCountry(guest.birthCountry, guest.birthComune);

    return guest;
}

function tryFallbackNameDetection(text) {
    // Last resort: look for lines that look like full names (two+ capitalized words, no special chars)
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const namePattern = /^([A-ZÀÁÂÃÄÅÈÉÊËÌÍÎÏÒÓÔÕÖÙÚÛÜÑÇ][a-zàáâãäåèéêëìíîïòóôõöùúûüñç]+)\s+([A-ZÀÁÂÃÄÅÈÉÊËÌÍÎÏÒÓÔÕÖÙÚÛÜÑÇ][a-zàáâãäåèéêëìíîïòóôõöùúûüñç]+(?:\s+[A-ZÀÁÂÃÄÅÈÉÊËÌÍÎÏÒÓÔÕÖÙÚÛÜÑÇ][a-zàáâãäåèéêëìíîïòóôõöùúûüñç]+)?)$/;
    const guests = [];
    for (const line of lines) {
        const m = line.match(namePattern);
        if (m) {
            guests.push({
                firstName: m[1], lastName: m[2],
                sex: '', birthDate: '', birthComune: '', birthProvince: '',
                birthCountry: '', citizenship: '', docType: '', docNumber: '',
                docIssuedPlace: '', email: '', phone: '', guestType: '', notes: ''
            });
        }
    }
    return guests;
}

// ---- Normalizers ----

function normalizeSex(val) {
    if (!val) return '';
    const v = val.toLowerCase().trim();
    if (['m', 'male', 'maschile', 'maschio', '1'].includes(v)) return '1';
    if (['f', 'female', 'femminile', 'femmina', '2'].includes(v)) return '2';
    return val;
}

function normalizeDocType(val) {
    if (!val) return '';
    const v = val.toLowerCase().trim();
    if (['ident', 'carta identita', "carta d'identita", "carta d'identità", 'carta identità', 'identity card', 'id card', 'ci'].includes(v)) return 'IDENT';
    if (['pasor', 'passaporto', 'passport'].includes(v)) return 'PASOR';
    if (['paten', 'patente', 'driving license', "driver's license", 'patente guida'].includes(v)) return 'PATEN';
    if (['pnauz', 'patente nautica'].includes(v)) return 'PNAUZ';
    if (['pordf', "porto d'armi", 'porto armi'].includes(v)) return 'PORDF';
    // If it's already a valid code, return as-is
    if (['IDENT', 'PASOR', 'PATEN', 'PNAUZ', 'PORDF'].includes(val.trim().toUpperCase())) return val.trim().toUpperCase();
    return val;
}

const COUNTRY_NAME_TO_CODE = {
    'italia': '100000100', 'italy': '100000100',
    'germania': '100000214', 'germany': '100000214',
    'francia': '100000212', 'france': '100000212',
    'spagna': '100000239', 'spain': '100000239',
    'regno unito': '100000219', 'united kingdom': '100000219',
    'svizzera': '100000241', 'switzerland': '100000241',
    'austria': '100000203',
    'stati uniti': '100000536', 'usa': '100000536',
    'romania': '100000235', 'polonia': '100000233', 'poland': '100000233',
    'paesi bassi': '100000232', 'netherlands': '100000232', 'olanda': '100000232',
    'belgio': '100000206', 'belgium': '100000206',
    'portogallo': '100000234', 'portugal': '100000234',
    'croazia': '100000250', 'croatia': '100000250',
    'albania': '100000201', 'grecia': '100000220', 'greece': '100000220',
    'russia': '100000236', 'ucraina': '100000246', 'ukraine': '100000246',
    'cina': '100000358', 'china': '100000358',
    'brasile': '100000351', 'brazil': '100000351',
    'argentina': '100000347', 'australia': '100000302',
};

// Returns a country code given a raw value from import.
// If the value looks like an Italian comune (not a country name/code), returns ITALIA code.
function normalizeBirthCountry(val, birthComune) {
    if (!val) {
        return birthComune ? '100000100' : '';
    }
    const v = val.trim();
    // Already a 9-digit alloggiati code
    if (/^\d{9}$/.test(v)) return v;
    // Known country name
    const code = COUNTRY_NAME_TO_CODE[v.toLowerCase()];
    if (code) return code;
    // Try matching against loaded alloggiatiStati list if available
    if (alloggiatiStati) {
        const match = alloggiatiStati.find(s => s.label.toLowerCase() === v.toLowerCase());
        if (match) return match.code;
    }
    // Value is not a known country — assume it's an Italian comune
    return '100000100';
}

function normalizeGuestType(val) {
    if (!val) return '16'; // default: Ospite Singolo
    const v = val.toLowerCase().trim();
    if (['16', 'ospite singolo', 'single guest', 'singolo'].includes(v)) return '16';
    if (['17', 'capofamiglia', 'family head', 'capo famiglia'].includes(v)) return '17';
    if (['18', 'capogruppo', 'group leader', 'capo gruppo'].includes(v)) return '18';
    if (['19', 'familiare', 'family member', 'membro famiglia'].includes(v)) return '19';
    if (['20', 'membro gruppo', 'group member', 'membro'].includes(v)) return '20';
    return '16';
}

// ---- Preview & Import ----

function renderGuestFilePreview() {
    if (guestFileMode === 'text') {
        renderGuestFilePreviewTable(guestFileParsedRows);
    }
}

function renderGuestFilePreviewTable(rows) {
    const count = rows.length;
    document.getElementById('guestFilePreviewCount').textContent = `${count} ${t('preview.guestsFound')}`;

    if (count === 0) {
        document.getElementById('guestFilePreviewTable').innerHTML = `<p style="padding:16px;color:var(--text-secondary);font-size:13px">${t('preview.noGuestsDetected')}</p>`;
        return;
    }

    const showCols = [
        { key: 'lastName', label: t('field.lastName'), required: true },
        { key: 'firstName', label: t('field.firstName'), required: true },
        { key: 'sex', label: t('field.sex'), required: true },
        { key: 'birthDate', label: t('preview.birthDate'), required: true },
        { key: 'birthComune', label: t('field.birthComune') },
        { key: 'residenceComune', label: t('field.residenceComune') },
        { key: 'citizenship', label: t('field.citizenship'), required: true },
        { key: 'docType', label: t('field.docType') },
        { key: 'docNumber', label: t('preview.docNo') },
    ];

    let html = '<table><thead><tr>';
    showCols.forEach(c => { html += `<th>${c.label}</th>`; });
    html += '</tr></thead><tbody>';
    rows.forEach(r => {
        html += '<tr>';
        showCols.forEach(c => {
            const val = r[c.key] || '';
            const missing = c.required && !val;
            html += `<td${missing ? ' style="color:var(--red);font-style:italic"' : ''}>${val ? escapeHtml(val) : (missing ? 'missing' : '—')}</td>`;
        });
        html += '</tr>';
    });
    html += '</tbody></table>';
    document.getElementById('guestFilePreviewTable').innerHTML = html;
}

async function executeGuestFileImport() {
    return window.GroupStayGuestImport.executeGuestFileImport();
}

// ---- Bar tooltip (body-appended to avoid overflow clipping) ----

let barTipEl = null;

function showBarTooltip(e) {
    const bar = e.currentTarget;
    const raw = bar.getAttribute('data-tip');
    if (!raw) return;

    if (!barTipEl) {
        barTipEl = document.createElement('div');
        barTipEl.className = 'bar-tooltip';
        document.body.appendChild(barTipEl);
    }

    const lines = raw.split('||');
    barTipEl.innerHTML = `<strong>${lines[0]}</strong>` +
        lines.slice(1).map(l => `<div class="bar-tooltip-row">${l}</div>`).join('');
    barTipEl.style.display = 'block';

    const rect = bar.getBoundingClientRect();
    let tipLeft = rect.left + rect.width / 2;
    let tipTop = rect.top - 8;

    barTipEl.style.left = tipLeft + 'px';
    barTipEl.style.top = tipTop + 'px';
    barTipEl.style.transform = 'translate(-50%, -100%)';

    // Keep within viewport
    requestAnimationFrame(() => {
        const tr = barTipEl.getBoundingClientRect();
        if (tr.left < 8) barTipEl.style.left = (8 + tr.width / 2) + 'px';
        if (tr.right > window.innerWidth - 8) barTipEl.style.left = (window.innerWidth - 8 - tr.width / 2) + 'px';
    });
}

function hideBarTooltip() {
    if (barTipEl) barTipEl.style.display = 'none';
}

// =============================================
// EMPLOYEES
// =============================================

function empMonthNav(delta) { return window.GroupStayEmployees.empMonthNav(delta); }
function getDaysInMonth(year, month) { return window.GroupStayEmployees.getDaysInMonth(year, month); }
function getEmployeeMonthStats(empId, year, month) { return window.GroupStayEmployees.getEmployeeMonthStats(empId, year, month); }
function getEmpMonthPay(emp, yearMonth) { return window.GroupStayEmployees.getEmpMonthPay(emp, yearMonth); }
function calcEstimatedPay(emp, daysWorked, totalHours, yearMonth) { return window.GroupStayEmployees.calcEstimatedPay(emp, daysWorked, totalHours, yearMonth); }

function calcReservationRevenue(r) { return window.GroupStayManagement.calcReservationRevenue(r); }
function renderManagement() { return window.GroupStayManagement.renderManagement(); }

function renderEmployees() { return window.GroupStayEmployees.renderEmployees(); }

// Toggle day for monthly employees in table view
async function empTableToggle(empId, dateStr) { return window.GroupStayEmployees.empTableToggle(empId, dateStr); }

function toggleShift2Popover() { return window.GroupStayEmployees.toggleShift2Popover(); }

function closeTimePopover() { return window.GroupStayEmployees.closeTimePopover(); }

// Pay type override popover — lets you switch hourly/monthly for one specific month
function openTimePopover(empId, dateStr, cellEl) { return window.GroupStayEmployees.openTimePopover(empId, dateStr, cellEl); }
function openPayTypePopover(empId, yearMonth, cellEl) { return window.GroupStayEmployees.openPayTypePopover(empId, yearMonth, cellEl); }

function closePayTypePopover() { return window.GroupStayEmployees.closePayTypePopover(); }
async function savePayTypeOverride(empId, yearMonth) { return window.GroupStayEmployees.savePayTypeOverride(empId, yearMonth); }
async function deletePayTypeOverride(overrideId, empId, yearMonth) { return window.GroupStayEmployees.deletePayTypeOverride(overrideId, empId, yearMonth); }
async function saveTimePopover(empId, dateStr) { return window.GroupStayEmployees.saveTimePopover(empId, dateStr); }
async function deleteTimePopover(empId, dateStr) { return window.GroupStayEmployees.deleteTimePopover(empId, dateStr); }
function openNewEmployeeModal() { return window.GroupStayEmployees.openNewEmployeeModal(); }
function openEditEmployee(id) { return window.GroupStayEmployees.openEditEmployee(id); }
function togglePayRateLabel() { return window.GroupStayEmployees.togglePayRateLabel(); }
async function saveEmployee(e) { return window.GroupStayEmployees.saveEmployee(e); }
async function deleteEmployee() { return window.GroupStayEmployees.deleteEmployee(); }
function openEmployeeDetail(empId) { return window.GroupStayEmployees.openEmployeeDetail(empId); }
async function empCalDayClick(empId, dateStr) { return window.GroupStayEmployees.empCalDayClick(empId, dateStr); }
async function empCalDayToggle(empId, dateStr) { return window.GroupStayEmployees.empCalDayToggle(empId, dateStr); }
function closeWorkEntryModal() { return window.GroupStayEmployees.closeWorkEntryModal(); }
function openNewWorkEntry(empId) { return window.GroupStayEmployees.openNewWorkEntry(empId); }
function openEditWorkEntry(workId) { return window.GroupStayEmployees.openEditWorkEntry(workId); }
async function saveWorkEntry(e) { return window.GroupStayEmployees.saveWorkEntry(e); }
async function deleteWorkEntry(workId, empId) { return window.GroupStayEmployees.deleteWorkEntry(workId, empId); }

// Apply saved theme immediately
applyTheme(getTheme());

// =============================================
// INIT
// =============================================

let appStarted = false;
let appStarting = false;
let appStartPromise = null;

function getBootPage() {
    return document.body.dataset.activePage || 'dashboard';
}

async function startApplication(forceRestart = false) {
    if (forceRestart) {
        appStarted = false;
        appStarting = false;
        appStartPromise = null;
    }
    if (appStarted) return true;
    if (appStartPromise) return appStartPromise;

    appStarting = true;
    appStartPromise = (async () => {
        try {
        setAuthDebug('Avvio applicazione...');
        initSettingsModal();
        setAuthDebug('Avvio applicazione...\nImpostazioni inizializzate.');
        applyTranslations();
        setAuthDebug('Avvio applicazione...\nTraduzioni applicate.');
        updateProfileHeader();
        setAuthDebug('Avvio applicazione...\nProfilo aggiornato.');
        document.querySelectorAll('[data-lang-val]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.langVal === currentLang);
            btn.addEventListener('click', () => setLanguage(btn.dataset.langVal));
        });
        setAuthDebug('Avvio applicazione...\nControlli lingua pronti.');
        const bootPage = getBootPage();
        const hasCached = loadDataCache();
        if (hasCached) {
            setAuthDebug('Cache locale trovata, disegno l\'interfaccia...');
            // Show UI immediately with cached data
            await nextPaint();
            if (bootPage === 'calendar') {
                renderCalendar();
                setAuthDebug('Calendario disegnato.');
            } else {
                renderDashboard();
                setAuthDebug('Dashboard disegnata.');
            }
            setAuthDebug('Cache locale trovata, aggiorno in background...');
            // Refresh in background silently
            loadAllData().then((ok) => {
                if (!ok) return;
                const current = document.querySelector('.nav-item.active, .tab-item.active');
                const page = current ? current.dataset.page : 'dashboard';
                if (page === 'dashboard') renderDashboard();
                else if (page === 'calendar') renderCalendar();
            });
        } else {
            setAuthDebug('Nessuna cache, carico da server...');
            showLoading('Caricamento dati...');
            const ok = await loadAllData();
            hideLoading();
            if (!ok) {
                appStarting = false;
                return;
            }
            setAuthDebug('Dati server caricati, disegno l\'interfaccia...');
            await nextPaint();
            if (bootPage === 'calendar') {
                renderCalendar();
                setAuthDebug('Calendario disegnato.');
            } else {
                renderDashboard();
                setAuthDebug('Dashboard disegnata.');
            }
        }
        appStarted = true;
        appStarting = false;
        return true;
        } catch (error) {
            appStarting = false;
            setAuthDebug(`Avvio app fallito: ${formatErrorMessage(error)}`);
            document.getElementById('loginError').textContent = error.message || 'Errore durante l\'avvio dell\'app';
            hideLoading();
            return false;
        } finally {
            appStartPromise = null;
        }
    })();

    return appStartPromise;
}

(async function init() {
    switchAuthMode('login');
    restoreRememberedLogin();
    setupRememberedLoginToggle();
    applyTranslations();
    const user = await fetchSession();
    if (!user) {
        setAuthLocked(true);
        return;
    }
    setAuthLocked(false);
    await startApplication();
})();
