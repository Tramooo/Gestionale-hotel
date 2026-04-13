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
    apiDelete
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
    openFileImportModal,
    openGuestsList,
    parseImportDate,
    renderDashboard,
    setGuests: (nextGuests) => { guests = nextGuests; },
    showLoading,
    showToast,
    t
});

function saveDataCache() {
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({
            ts: Date.now(),
            reservations, rooms, guests, employees, workEntries, complianceCerts, complianceDocs
        }));
    } catch (e) {} // ignore quota errors
}

function loadDataCache() {
    try {
        const raw = localStorage.getItem(CACHE_KEY);
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
        computeRoomStatuses();
        return true;
    } catch (e) { return false; }
}

async function loadAllData() {
    try {
        // Run /api/init only once per session
        if (!sessionStorage.getItem('gs_init_done')) {
            try { await apiPost(API.init, {}); sessionStorage.setItem('gs_init_done', '1'); } catch (e) {}
        }

        const [resData, roomData, guestData, empData, certsData, docsData] = await Promise.all([
            apiGet(API.reservations),
            apiGet(API.rooms),
            apiGet(API.guests),
            apiGet(API.employees).catch(() => ({ employees: [], workEntries: [] })),
            apiGet(API.compliance + '?target=certs').catch(() => []),
            apiGet(API.compliance + '?target=docs').catch(() => [])
        ]);
        reservations    = resData;
        rooms           = roomData;
        guests          = guestData;
        employees        = empData.employees      || [];
        workEntries      = empData.workEntries    || [];
        monthPayOverrides = empData.monthOverrides || [];
        complianceCerts = certsData;
        complianceDocs  = docsData;
        computeRoomStatuses();
        saveDataCache();
    } catch (err) {
        console.error('Failed to load data from database:', err);
        showToast(t('toast.dbError'), 'error');
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
let _compCertFileData = '';
let _compCertFileName = '';
let _compDocFileData = '';
let _compDocFileName = '';
let empViewMonth = new Date(); // currently viewed month for employee pay

// ---- i18n ----

let currentLang = localStorage.getItem('gs_lang') || 'it';

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
    'dash.thisMonth': { en: 'This Month', it: 'Questo Mese' },
    'dash.thisYear': { en: 'This Year', it: 'Quest\'Anno' },
    'dash.upcomingCheckins': { en: 'Upcoming Check-ins', it: 'Check-in in Arrivo' },
    'dash.viewAll': { en: 'View All', it: 'Vedi Tutti' },
    'dash.noUpcoming': { en: 'No upcoming check-ins', it: 'Nessun check-in in arrivo' },
    'dash.todayActivity': { en: 'Today\'s Activity', it: 'Attività di Oggi' },
    'dash.noActivity': { en: 'No activity today', it: 'Nessuna attività oggi' },
    'dash.roomOccupancy': { en: 'Room Occupancy', it: 'Occupazione Camere' },
    'dash.occupied': { en: 'Occupied', it: 'Occupate' },
    'dash.available': { en: 'Available', it: 'Disponibili' },
    'dash.maintenance': { en: 'Maintenance', it: 'Manutenzione' },
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

function navigateTo(page) {
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
        case 'management': renderManagement(); break;
        case 'compliance': renderCompliance(); break;
    }
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

function renderDashboard() {
    computeRoomStatuses();
    // Stats
    const activeGroups = reservations.filter(r => r.status === 'confirmed' || r.status === 'checked-in');
    const todayStr = formatDate(new Date());
    const todayGuests = activeGroups
        .filter(r => r.checkin <= todayStr && r.checkout > todayStr)
        .reduce((sum, r) => sum + (r.guestCount || 0), 0);
    const occupiedRooms = rooms.filter(r => r.status === 'occupied').length;
    document.getElementById('stat-active-groups').textContent = activeGroups.length;
    document.getElementById('stat-total-guests').textContent = todayGuests;
    document.getElementById('stat-rooms-occupied').textContent = occupiedRooms + '/' + rooms.length;

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
        checkinEl.innerHTML = `<div class="empty-state small"><p>${t('dash.noUpcoming')}</p></div>`;
    } else {
        checkinEl.innerHTML = upcoming.map(r => `
            <div class="checkin-item" onclick="openReservationDetail('${r.id}')">
                <div class="checkin-dot" style="background: ${r.status === 'confirmed' ? 'var(--green)' : 'var(--orange)'}"></div>
                <div class="checkin-info">
                    <div class="checkin-name">${escapeHtml(r.groupName)}</div>
                    <div class="checkin-detail">${r.guestCount} ${t('dash.guests')} &middot; ${r.roomCount} ${t('res.rooms')}</div>
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
                    <div class="activity-text"><strong>${escapeHtml(r.groupName)}</strong> ${t('dash.checkingIn')}</div>
                    <div class="activity-time">${r.guestCount} ${t('dash.guests')}</div>
                </div>
            </div>
        `);
    });

    todayCheckouts.forEach(r => {
        activities.push(`
            <div class="activity-item">
                <div class="activity-icon checkout">&#8595;</div>
                <div>
                    <div class="activity-text"><strong>${escapeHtml(r.groupName)}</strong> ${t('dash.checkingOut')}</div>
                    <div class="activity-time">${r.guestCount} ${t('dash.guests')}</div>
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

            const entry = { code, name, prov, label };
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
    const lower = label.toLowerCase().trim();
    // First try exact match on display label
    const match = list.find(l => l.label.toLowerCase() === lower);
    if (match) return match.code;
    // Fallback: match by name only
    const nameMatch = list.find(l => l.name.toLowerCase() === lower);
    return nameMatch ? nameMatch.code : '';
}

function findLabelFromCode(list, code) {
    if (!list || !code) return '';
    const match = list.find(l => l.code === code);
    return match ? match.label : '';
}

// Resolve a raw comune name or code to its alloggiatiLuoghi entry.
function lookupAlloggiatiLuogo(val) {
    if (!val || !alloggiatiLuoghi) return null;
    const v = val.trim();
    const byCode = alloggiatiLuoghi.find(l => l.code === v);
    if (byCode) return byCode;
    const lower = v.toLowerCase();
    return alloggiatiLuoghi.find(l => l.name.toLowerCase() === lower)
        || alloggiatiLuoghi.find(l => l.label.toLowerCase() === lower)
        || alloggiatiLuoghi.find(l => l.name.toLowerCase().startsWith(lower))
        || null;
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
    if (searchId === 'guestBirthComuneSearch' || searchId === 'guestDocIssuedPlaceSearch') {
        searchEl.addEventListener('input', () => {
            const query = searchEl.value.toLowerCase().trim();
            if (query.length < 2 || !alloggiatiLuoghi) return;
            const listId = searchId === 'guestBirthComuneSearch' ? 'comuniList' : 'luoghiList';
            const dlEl = document.getElementById(listId);
            const source = searchId === 'guestBirthComuneSearch'
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
    setupAlloggiatiSearchField('guestCitizenshipSearch', 'guestCitizenship', 'stati');
    setupAlloggiatiSearchField('guestBirthCountrySearch', 'guestBirthCountry', 'stati');
    setupAlloggiatiSearchField('guestBirthComuneSearch', 'guestBirthComune', 'luoghi');
    setupAlloggiatiSearchField('guestDocIssuedPlaceSearch', 'guestDocIssuedPlace', 'luoghi');
});

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

    let html = '';
    if (mode === 'preview') {
        html += `<div class="alloggiati-preview">
            <p><strong>${data.guests.length} record(s) built</strong></p>
            <div class="alloggiati-records">`;
        data.guests.forEach((g, i) => {
            html += `<div class="alloggiati-record-item">
                <span>${g.name}</span>
                <span class="badge">${g.guestType === '17' ? 'CapoFam' : g.guestType === '18' ? 'Capo' : g.guestType === '19' ? 'Fam' : g.guestType === '20' ? 'Membro' : 'Singolo'}</span>
                <span style="color:${g.recordLength === 168 ? 'var(--green)' : 'var(--red)'}">${g.recordLength} chars</span>
            </div>`;
        });
        if (data.debug) {
            html += `<div style="margin-top:8px;padding:8px;background:var(--bg-tertiary);border-radius:6px;font-size:11px;font-family:monospace;word-break:break-all">
                <div>checkin raw: ${data.debug.checkinRaw} (${data.debug.checkinType})</div>
                <div>checkout raw: ${data.debug.checkoutRaw}</div>
                <div>record[0]: ${data.debug.record0}</div>
                <div>length: ${data.debug.recordLength}</div>
            </div>`;
        }
        html += `</div></div>`;
    } else {
        const icon = data.success ? '&#10003;' : '&#10007;';
        const color = data.success ? 'var(--green)' : 'var(--red)';
        html += `<div style="margin-bottom:8px">
            <span style="color:${color};font-weight:bold">${icon} ${mode === 'test' ? 'Test' : 'Send'}: ${data.validCount}/${data.totalCount} valid</span>
        </div>`;
        if (data.details && data.details.length > 0) {
            html += '<div class="alloggiati-records">';
            data.details.forEach(d => {
                const ok = d.esito;
                const typeLabel = d.guestType === '17' ? 'CapoFam' : d.guestType === '18' ? 'Capo' : d.guestType === '19' ? 'Fam' : d.guestType === '20' ? 'Membro' : 'Singolo';
                const debugTag = mode === 'test'
                    ? `<span style="font-size:10px;color:var(--text-tertiary);margin-left:4px">[${typeLabel}${d.docType ? ' · ' + d.docType : ''}]</span>`
                    : '';
                let debugRow = '';
                if (mode === 'test' && !ok && d.recDocType !== undefined) {
                    debugRow = `<div style="font-size:10px;font-family:monospace;color:var(--text-secondary);margin-top:2px;word-break:break-all">
                        tipo="${d.recGuestType}" | comune="${d.recBirthComune}" | prov="${d.recBirthProvince}" | paese="${d.recBirthCountry}" | citt="${d.recCitizenship}" | <strong>docTipo="${d.recDocType}"</strong> | docNum="${d.recDocNumber?.trim()}" | docLuogo="${d.recDocPlace}" | len=${d.recLength}
                    </div>`;
                }
                html += `<div class="alloggiati-record-item ${ok ? 'success' : 'error'}">
                    <div>
                        <span>${d.guestName}${debugTag}</span>
                        <span style="color:${ok ? 'var(--green)' : 'var(--red)'}"> — ${ok ? 'OK' : d.errorDesc + (d.errorDetail ? ': ' + d.errorDetail : '')}</span>
                        ${debugRow}
                    </div>
                </div>`;
            });
            html += '</div>';
        }
        if (mode === 'test' && data.rawXml) {
            console.log('[Alloggiati raw SOAP response]', data.rawXml);
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

    function resolveComune(val) {
        if (!val || !alloggiatiLuoghi) return { code: '', prov: '' };
        // Already numeric → it's a code
        if (/^\d/.test(val.trim())) {
            const entry = alloggiatiLuoghi.find(l => l.code === val.trim());
            return { code: val.trim(), prov: entry ? entry.prov : '' };
        }
        // Try exact name match, then partial
        const lower = val.toLowerCase().trim();
        let entry = alloggiatiLuoghi.find(l => l.name.toLowerCase() === lower);
        if (!entry) entry = alloggiatiLuoghi.find(l => l.label.toLowerCase() === lower);
        if (!entry) entry = alloggiatiLuoghi.find(l => l.name.toLowerCase().startsWith(lower));
        return entry ? { code: entry.code, prov: entry.prov } : { code: val, prov: '' };
    }

    return resGuests.map(g => {
        // Resolve birthComune and birthProvince
        const isForeign = g.birthCountry && g.birthCountry !== ITALY_CODE &&
            !['italia', 'italy'].includes((g.birthCountry || '').toLowerCase());
        let birthComune = '';
        let birthProvince = '';
        if (!isForeign) {
            const resolved = resolveComune(g.birthComune);
            birthComune = resolved.code;
            birthProvince = g.birthProvince || resolved.prov || '';
        } else {
            birthProvince = 'EE';
        }

        // Resolve docIssuedPlace the same way as comune
        const resolvedDoc = resolveComune(g.docIssuedPlace);
        const docIssuedPlace = resolvedDoc.code;

        // Resolve docType
        let docType = (g.docType || '').trim();
        if (docType && !VALID_DOC.has(docType)) {
            const mapped = DOC_MAP[docType.toLowerCase()];
            if (mapped) docType = mapped;
        }

        return {
            id: g.id,
            firstName: g.firstName,
            lastName: g.lastName,
            sex: g.sex,
            birthDate: g.birthDate,
            birthComune,
            birthProvince,
            birthCountry: g.birthCountry,
            citizenship: g.citizenship,
            docType,
            docNumber: g.docNumber,
            docIssuedPlace,
            guestType: g.guestType,
        };
    });
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
        const config = await apiGet(API.plannerConfig + '?reservation_id=' + reservationId);
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
        await apiPut(API.plannerConfig, {
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
    computeRoomStatuses();
    const board = document.getElementById('plannerBoard');
    const anchor = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), calendarDate.getDate());
    plannerStartDate = new Date(anchor);
    plannerStartDate.setHours(0, 0, 0, 0);
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
    renderExpiringBanner();
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
    renderExpiringBanner();
}

function renderExpiringBanner() {
    const banner = document.getElementById('expiringBanner');
    if (!banner) return;
    const today = formatDate(new Date());
    const expiring = reservations.filter(r => r.status === 'pending' && r.expiration === today);

    if (expiring.length === 0) {
        banner.style.display = 'none';
        return;
    }

    banner.style.display = 'block';
    banner.innerHTML = `
        <div class="expiring-banner">
            <div class="expiring-banner-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                ${t('cal.expiringToday')} (${expiring.length})
            </div>
            <div class="expiring-banner-list">
                ${expiring.map(r => `
                    <div class="expiring-banner-item" onclick="openReservationDetail('${r.id}')">
                        <span class="expiring-banner-name">${escapeHtml(r.groupName)}</span>
                        <span class="expiring-banner-dates">${formatDateDisplay(r.checkin)} → ${formatDateDisplay(r.checkout)}</span>
                        <span class="expiring-banner-info">${r.roomCount} ${r.roomCount !== 1 ? t('cal.roomPlural') : t('cal.roomSingular')} · ${r.guestCount} ${r.guestCount !== 1 ? t('cal.guestPlural') : t('cal.guestSingular')}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function buildBoardHTML() {
    const DW = PLANNER_DAY_WIDTH;
    const today = formatDate(new Date());
    const dayAbbr = t('days.short');
    const monthFull = t('months.full');

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
    corner += `<div class="p-corner-cell days">${t('cal.room')}</div>`;
    corner += `<div class="p-corner-cell stats">${t('cal.available')}</div>`;
    corner += `<div class="p-corner-cell stats">${t('cal.occupied')}</div>`;
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
        const RH = PLANNER_ROW_HEIGHT;
        roomsPanel += `<div class="p-floor-left">${t('rooms.floor')} ${floor}</div>`;
        floors[floor].forEach(room => {
            roomsPanel += `<div class="p-room-left" style="height:${RH}px" onclick="openEditRoom('${room.id}')">
                <span class="planner-room-status ${room.status}"></span>
                <span class="planner-room-label">${room.number}</span>
                <span class="planner-room-type">${room.type.substring(0, 3)}</span>
            </div>`;
        });
    });
    roomsPanel += '</div></div>';

    // === 4. GRID BODY (bottom-right, master scroller) ===
    let grid = '<div class="p-grid-panel"><div class="p-grid-inner">';

    // Today line — use midnight to avoid timezone drift
    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);
    const todayIdx = dateToDayIndex(todayMidnight);
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
            grid += `<div class="p-grid-room-row" style="height:${PLANNER_ROW_HEIGHT}px" data-room-id="${room.id}">`;
            for (let i = 0; i < plannerTotalDays; i++) {
                const d = dayIndexToDate(i);
                const dow = d.getDay();
                let c = 'p-grid-cell';
                if (formatDate(d) === today) c += ' today-col';
                else if (dow === 0 || dow === 6) c += ' weekend';
                grid += `<div class="${c}" style="width:${DW}px" data-day="${i}"></div>`;
            }
            // Reservation bars — sort by start
            const bookings = (rb[room.id] || []).slice().sort((a, b) => a.startIdx - b.startIdx);
            bookings.forEach((b, bi) => {
                const ARROW = 10;
                const hasNext = bi < bookings.length - 1 && bookings[bi + 1].startIdx <= b.endIdx;
                const hasPrev = bi > 0 && bookings[bi - 1].endIdx >= b.startIdx;
                const left = b.startIdx * DW;
                // Extend arrow tip into next bar's notch
                const width = (b.endIdx - b.startIdx) * DW + (hasNext ? ARROW : 0);
                const label = escapeHtml(b.res.groupName);
                const cls = `planner-res-bar ${b.res.status}${hasPrev ? ' bar-has-prev' : ''}`;
                const nights = Math.max(1, b.endIdx - b.startIdx);
                const resGuests = guests.filter(g => g.reservationId === b.res.id).length;
                const statusLabel = b.res.status.charAt(0).toUpperCase() + b.res.status.slice(1);
                const expirationInfo = b.res.status === 'pending' && b.res.expiration ? ` · ${t('cal.expires')} ${formatDateDisplay(b.res.expiration)}` : '';
                const tipData = `${label}||${formatDateDisplay(b.res.checkin)} → ${formatDateDisplay(b.res.checkout)}||${nights} ${nights > 1 ? t('cal.nightsPlural') : t('cal.nights')} · ${b.res.roomCount} ${b.res.roomCount !== 1 ? t('cal.roomPlural') : t('cal.roomSingular')} · ${resGuests} ${resGuests !== 1 ? t('cal.guestPlural') : t('cal.guestSingular')}||${statusLabel}${expirationInfo}${b.res.price ? ' · €' + Number(b.res.price).toLocaleString() : ''}`;
                grid += `<div class="${cls}" style="left:${left}px;width:${width}px;z-index:${2 + bi}" onclick="openReservationDetail('${b.res.id}')" data-tip="${tipData}" onmouseenter="showBarTooltip(event)" onmouseleave="hideBarTooltip()"><span class="bar-label">${label}</span></div>`;
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
    const mn = t('months.short');
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

let dragState = null; // { startDayIdx, currentDayIdx, overlay, rowTop, rowHeight }

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

    // Find which room row was clicked
    const gridInner = plannerGridEl.querySelector('.p-grid-inner');
    const rowEl = (e.touches ? document.elementFromPoint(e.touches[0].clientX, e.touches[0].clientY) : e.target).closest('.p-grid-room-row');
    let rowTop = 0;
    let rowHeight = gridInner.offsetHeight;
    if (rowEl) {
        rowTop = rowEl.offsetTop;
        rowHeight = rowEl.offsetHeight;
    }

    // Create selection overlay
    const overlay = document.createElement('div');
    overlay.className = 'grid-drag-overlay';
    gridInner.appendChild(overlay);

    dragState = { startDayIdx: dayIdx, currentDayIdx: dayIdx, overlay, rowTop, rowHeight };
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
    ov.style.top = dragState.rowTop + 'px';
    ov.style.width = width + 'px';
    ov.style.height = dragState.rowHeight + 'px';

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

    // Allow single click (1 night) or drag

    const checkinDate = dayIndexToDate(startIdx);
    const checkoutDate = dayIndexToDate(endIdx + 1);

    openBookingTypeChooser(formatDate(checkinDate), formatDate(checkoutDate));
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
    if (!expiryDate) return 'no-expiry';
    const today = new Date(); today.setHours(0,0,0,0);
    const exp = new Date(expiryDate); exp.setHours(0,0,0,0);
    const diff = Math.ceil((exp - today) / (1000 * 60 * 60 * 24));
    if (diff < 0) return 'expired';
    if (diff <= 30) return 'expiring';
    return 'valid';
}

function certStatusLabel(status) {
    return { expired: 'Scaduto', expiring: 'In Scadenza', valid: 'Valido', 'no-expiry': 'Permanente' }[status] || '';
}

function renderCompliance() {
    renderComplianceSummary();
    renderComplianceEmpGrid();
    renderComplianceDocList();
}

function renderComplianceSummary() {
    const today = new Date(); today.setHours(0,0,0,0);
    let expired = 0, expiring = 0, valid = 0;
    [...complianceCerts, ...complianceDocs].forEach(c => {
        const s = certStatus(c.expiryDate);
        if (s === 'expired') expired++;
        else if (s === 'expiring') expiring++;
        else if (s === 'valid') valid++;
    });
    document.getElementById('complianceSummary').innerHTML = `
        <div class="compliance-stats">
            <div class="comp-stat-card">
                <div class="comp-stat-value">${employees.length}</div>
                <div class="comp-stat-label">Dipendenti</div>
            </div>
            <div class="comp-stat-card comp-stat-expired">
                <div class="comp-stat-value">${expired}</div>
                <div class="comp-stat-label">Scaduti</div>
            </div>
            <div class="comp-stat-card comp-stat-expiring">
                <div class="comp-stat-value">${expiring}</div>
                <div class="comp-stat-label">In Scadenza (&le;30gg)</div>
            </div>
            <div class="comp-stat-card comp-stat-valid">
                <div class="comp-stat-value">${valid}</div>
                <div class="comp-stat-label">Validi</div>
            </div>
        </div>`;
}

function switchComplianceTab(tab) {
    document.querySelectorAll('.comp-tab').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
    document.getElementById('compTabDipendenti').style.display = tab === 'dipendenti' ? '' : 'none';
    document.getElementById('compTabStruttura').style.display = tab === 'struttura' ? '' : 'none';
}

function renderComplianceEmpGrid() {
    const container = document.getElementById('complianceEmpGrid');
    if (!container) return;
    if (employees.length === 0) {
        container.innerHTML = '<div class="comp-empty">Nessun dipendente trovato. Aggiungi dipendenti dalla sezione Gestione.</div>';
        return;
    }

    let html = '';
    employees.forEach(emp => {
        const empCerts = complianceCerts.filter(c => c.employeeId === emp.id);
        const empName = `${emp.firstName} ${emp.lastName}`;
        const hasAlert = empCerts.some(c => { const s = certStatus(c.expiryDate); return s === 'expired' || s === 'expiring'; });

        html += `<div class="comp-emp-card ${hasAlert ? 'comp-emp-alert' : ''}">
            <div class="comp-emp-header">
                <div>
                    <div class="comp-emp-name">${escapeHtml(empName)}</div>
                    <div class="comp-emp-role">${escapeHtml(emp.role || '')}</div>
                </div>
                <button class="btn btn-sm btn-primary" onclick="openCompCertModal(null, '${emp.id}')">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Aggiungi
                </button>
            </div>`;

        if (empCerts.length === 0) {
            html += `<div class="comp-no-certs">Nessun certificato registrato</div>`;
        } else {
            html += `<div class="comp-cert-list">`;
            empCerts.forEach(cert => {
                const s = certStatus(cert.expiryDate);
                const label = certStatusLabel(s);
                const expStr = cert.expiryDate ? formatDateDisplay(cert.expiryDate) : '—';
                const issuedStr = cert.issuedDate ? formatDateDisplay(cert.issuedDate) : '—';
                html += `<div class="comp-cert-row">
                    <div class="comp-cert-info">
                        <span class="comp-cert-name">${escapeHtml(CERT_TYPES[cert.certType] || cert.certType)}</span>
                        <span class="comp-cert-dates">Rilascio: ${issuedStr} · Scadenza: ${expStr}</span>
                        ${cert.notes ? `<span class="comp-cert-notes">${escapeHtml(cert.notes)}</span>` : ''}
                    </div>
                    <div class="comp-cert-actions">
                        <span class="comp-cert-badge comp-badge-${s}">${label}</span>
                        ${cert.fileData ? (() => { _filePreviewMap[cert.id] = { fileData: cert.fileData, fileName: cert.fileName || 'documento' }; return `<button class="btn btn-ghost btn-sm" title="Anteprima documento" onclick="openFilePreview('${cert.id}')"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>`; })() : ''}
                        <button class="btn btn-ghost btn-sm" onclick="openCompCertModal('${cert.id}', '${emp.id}')">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button class="btn btn-ghost btn-sm" onclick="deleteCompCert('${cert.id}')">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        </button>
                    </div>
                </div>`;
            });
            html += `</div>`;
        }
        html += `</div>`;
    });
    container.innerHTML = html;
}

function renderComplianceDocList() {
    const container = document.getElementById('complianceDocList');
    if (!container) return;
    if (complianceDocs.length === 0) {
        container.innerHTML = '<div class="comp-empty">Nessun documento di struttura registrato.</div>';
        return;
    }
    let html = '<div class="comp-doc-list">';
    complianceDocs.forEach(doc => {
        const s = certStatus(doc.expiryDate);
        const label = certStatusLabel(s);
        const expStr = doc.expiryDate ? formatDateDisplay(doc.expiryDate) : '—';
        const issuedStr = doc.issuedDate ? formatDateDisplay(doc.issuedDate) : '—';
        html += `<div class="comp-doc-row">
            <div class="comp-cert-info">
                <span class="comp-cert-name">${escapeHtml(DOC_TYPES[doc.docType] || doc.docType)}</span>
                <span class="comp-cert-dates">Rilascio: ${issuedStr} · Scadenza: ${expStr}</span>
                ${doc.notes ? `<span class="comp-cert-notes">${escapeHtml(doc.notes)}</span>` : ''}
            </div>
            <div class="comp-cert-actions">
                <span class="comp-cert-badge comp-badge-${s}">${label}</span>
                ${doc.fileData ? (() => { _filePreviewMap[doc.id] = { fileData: doc.fileData, fileName: doc.fileName || 'documento' }; return `<button class="btn btn-ghost btn-sm" title="Anteprima documento" onclick="openFilePreview('${doc.id}')"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>`; })() : ''}
                <button class="btn btn-ghost btn-sm" onclick="openCompDocModal('${doc.id}')">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button class="btn btn-ghost btn-sm" onclick="deleteCompDoc('${doc.id}')">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
            </div>
        </div>`;
    });
    html += '</div>';
    container.innerHTML = html;
}

// ---- Cert Modal ----

function openCompCertModal(certId, employeeId) {
    _compCertFileData = '';
    _compCertFileName = '';
    const form = document.getElementById('compCertForm');
    form.reset();
    document.getElementById('compCertFileName').textContent = '';

    if (certId) {
        const cert = complianceCerts.find(c => c.id === certId);
        if (!cert) return;
        document.getElementById('compCertModalTitle').textContent = 'Modifica Certificato';
        document.getElementById('compCertId').value = cert.id;
        document.getElementById('compCertEmployeeId').value = cert.employeeId;
        document.getElementById('compCertType').value = cert.certType;
        if (cert.issuedDate) setDateFieldValue('compCertIssued', cert.issuedDate);
        if (cert.expiryDate) setDateFieldValue('compCertExpiry', cert.expiryDate);
        document.getElementById('compCertNotes').value = cert.notes || '';
        _compCertFileData = cert.fileData || '';
        _compCertFileName = cert.fileName || '';
        if (cert.fileName) document.getElementById('compCertFileName').textContent = cert.fileName;
    } else {
        document.getElementById('compCertModalTitle').textContent = 'Aggiungi Certificato';
        document.getElementById('compCertId').value = '';
        document.getElementById('compCertEmployeeId').value = employeeId;
    }
    openModal('compCertModal');
}

function handleCompCertFile(input) {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { showToast('File troppo grande (max 5MB)', 'error'); return; }
    const reader = new FileReader();
    reader.onload = e => {
        _compCertFileData = e.target.result;
        _compCertFileName = file.name;
        document.getElementById('compCertFileName').textContent = file.name;
    };
    reader.readAsDataURL(file);
}

async function saveCompCert(e) {
    e.preventDefault();
    const id = document.getElementById('compCertId').value;
    const data = {
        employeeId: document.getElementById('compCertEmployeeId').value,
        certType: document.getElementById('compCertType').value,
        issuedDate: document.getElementById('compCertIssued').value || null,
        expiryDate: document.getElementById('compCertExpiry').value || null,
        notes: document.getElementById('compCertNotes').value.trim(),
        fileData: _compCertFileData,
        fileName: _compCertFileName
    };
    try {
        if (id) {
            await apiPut(API.compliance + '?target=certs', { ...data, id });
            const idx = complianceCerts.findIndex(c => c.id === id);
            if (idx !== -1) complianceCerts[idx] = { ...complianceCerts[idx], ...data };
        } else {
            const newCert = { id: generateId(), ...data, createdAt: new Date().toISOString() };
            await apiPost(API.compliance + '?target=certs', newCert);
            complianceCerts.push(newCert);
        }
        closeModal('compCertModal');
        renderCompliance();
        showToast('Certificato salvato');
    } catch (err) {
        showToast('Errore salvataggio certificato', 'error');
    }
}

async function deleteCompCert(id) {
    if (!confirm('Eliminare questo certificato?')) return;
    await apiDelete(API.compliance + '?target=certs', id);
    complianceCerts = complianceCerts.filter(c => c.id !== id);
    renderCompliance();
    showToast('Certificato eliminato');
}

// ---- Doc Modal ----

function openCompDocModal(docId) {
    _compDocFileData = '';
    _compDocFileName = '';
    const form = document.getElementById('compDocForm');
    form.reset();
    document.getElementById('compDocFileName').textContent = '';

    if (docId) {
        const doc = complianceDocs.find(d => d.id === docId);
        if (!doc) return;
        document.getElementById('compDocModalTitle').textContent = 'Modifica Documento';
        document.getElementById('compDocId').value = doc.id;
        document.getElementById('compDocType').value = doc.docType;
        if (doc.issuedDate) setDateFieldValue('compDocIssued', doc.issuedDate);
        if (doc.expiryDate) setDateFieldValue('compDocExpiry', doc.expiryDate);
        document.getElementById('compDocNotes').value = doc.notes || '';
        _compDocFileData = doc.fileData || '';
        _compDocFileName = doc.fileName || '';
        if (doc.fileName) document.getElementById('compDocFileName').textContent = doc.fileName;
    } else {
        document.getElementById('compDocModalTitle').textContent = 'Aggiungi Documento';
        document.getElementById('compDocId').value = '';
    }
    openModal('compDocModal');
}

function handleCompDocFile(input) {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { showToast('File troppo grande (max 5MB)', 'error'); return; }
    const reader = new FileReader();
    reader.onload = e => {
        _compDocFileData = e.target.result;
        _compDocFileName = file.name;
        document.getElementById('compDocFileName').textContent = file.name;
    };
    reader.readAsDataURL(file);
}

async function saveCompDoc(e) {
    e.preventDefault();
    const id = document.getElementById('compDocId').value;
    const data = {
        docType: document.getElementById('compDocType').value,
        issuedDate: document.getElementById('compDocIssued').value || null,
        expiryDate: document.getElementById('compDocExpiry').value || null,
        notes: document.getElementById('compDocNotes').value.trim(),
        fileData: _compDocFileData,
        fileName: _compDocFileName
    };
    try {
        if (id) {
            await apiPut(API.compliance + '?target=docs', { ...data, id });
            const idx = complianceDocs.findIndex(d => d.id === id);
            if (idx !== -1) complianceDocs[idx] = { ...complianceDocs[idx], ...data };
        } else {
            const newDoc = { id: generateId(), ...data, createdAt: new Date().toISOString() };
            await apiPost(API.compliance + '?target=docs', newDoc);
            complianceDocs.push(newDoc);
        }
        closeModal('compDocModal');
        renderCompliance();
        showToast('Documento salvato');
    } catch (err) {
        showToast('Errore salvataggio documento', 'error');
    }
}

async function deleteCompDoc(id) {
    if (!confirm('Eliminare questo documento?')) return;
    await apiDelete(API.compliance + '?target=docs', id);
    complianceDocs = complianceDocs.filter(d => d.id !== id);
    renderCompliance();
    showToast('Documento eliminato');
}

// ---- File Preview ----

const _filePreviewMap = {};

function openFilePreview(key) {
    const { fileData, fileName } = _filePreviewMap[key] || {};
    if (!fileData) return;
    const overlay = document.getElementById('filePreviewOverlay');
    const content = document.getElementById('filePreviewContent');
    const nameEl = document.getElementById('filePreviewName');
    const dlBtn = document.getElementById('filePreviewDownload');

    nameEl.textContent = fileName;
    dlBtn.href = fileData;
    dlBtn.download = fileName;

    const isPdf = fileData.startsWith('data:application/pdf') || fileName.toLowerCase().endsWith('.pdf');
    if (isPdf) {
        content.innerHTML = `<iframe src="${fileData}" class="file-preview-iframe"></iframe>`;
    } else {
        content.innerHTML = `<img src="${fileData}" class="file-preview-img" alt="${escapeHtml(fileName)}">`;
    }

    overlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closeFilePreview() {
    document.getElementById('filePreviewOverlay').style.display = 'none';
    document.getElementById('filePreviewContent').innerHTML = '';
    document.body.style.overflow = '';
}

// ---- PDF Export ----

function exportCompliancePDF() {
    const today = new Date().toLocaleDateString('it-IT');
    const todayStr = formatDate(new Date());

    const statusBadge = s => ({
        expired: '<span style="color:#c0392b;font-weight:700">● Scaduto</span>',
        expiring: '<span style="color:#e67e22;font-weight:700">● In Scadenza</span>',
        valid:    '<span style="color:#27ae60;font-weight:700">● Valido</span>',
        'no-expiry': '<span style="color:#555">● Permanente</span>'
    }[s] || '');

    let empRows = '';
    employees.forEach(emp => {
        const empCerts = complianceCerts.filter(c => c.employeeId === emp.id);
        if (empCerts.length === 0) {
            empRows += `<tr><td>${escapeHtml(emp.lastName)} ${escapeHtml(emp.firstName)}</td><td>${escapeHtml(emp.role||'')}</td><td colspan="4" style="color:#aaa;font-style:italic">Nessun certificato registrato</td></tr>`;
        } else {
            empCerts.forEach((cert, i) => {
                const s = certStatus(cert.expiryDate);
                empRows += `<tr>
                    ${i === 0 ? `<td rowspan="${empCerts.length}">${escapeHtml(emp.lastName)} ${escapeHtml(emp.firstName)}</td><td rowspan="${empCerts.length}">${escapeHtml(emp.role||'')}</td>` : ''}
                    <td>${escapeHtml(CERT_TYPES[cert.certType] || cert.certType)}</td>
                    <td>${cert.issuedDate ? new Date(cert.issuedDate).toLocaleDateString('it-IT') : '—'}</td>
                    <td>${cert.expiryDate ? new Date(cert.expiryDate).toLocaleDateString('it-IT') : '—'}</td>
                    <td>${statusBadge(s)}</td>
                </tr>`;
            });
        }
    });

    let docRows = complianceDocs.map(doc => {
        const s = certStatus(doc.expiryDate);
        return `<tr>
            <td>${escapeHtml(DOC_TYPES[doc.docType] || doc.docType)}</td>
            <td>${doc.issuedDate ? new Date(doc.issuedDate).toLocaleDateString('it-IT') : '—'}</td>
            <td>${doc.expiryDate ? new Date(doc.expiryDate).toLocaleDateString('it-IT') : '—'}</td>
            <td>${statusBadge(s)}</td>
            <td>${escapeHtml(doc.notes || '')}</td>
        </tr>`;
    }).join('');

    const html = `<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8">
    <title>Report Sicurezza & Compliance</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, sans-serif; color: #1a1a1a; padding: 40px; font-size: 13px; }
        h1 { font-size: 22px; margin-bottom: 4px; }
        .subtitle { color: #666; font-size: 12px; margin-bottom: 32px; }
        h2 { font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #555; margin: 28px 0 10px; border-bottom: 1px solid #ddd; padding-bottom: 6px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
        th { background: #f5f5f5; font-weight: 700; text-align: left; padding: 8px 10px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; }
        td { padding: 7px 10px; border-bottom: 1px solid #eee; vertical-align: top; }
        tr:last-child td { border-bottom: none; }
        .footer { margin-top: 40px; padding-top: 12px; border-top: 1px solid #ddd; font-size: 11px; color: #aaa; text-align: right; }
        @page { margin: 20px; }
        @media print { body { padding: 0; } }
    </style>
    </head><body>
    <h1>Report Sicurezza & Compliance</h1>
    <div class="subtitle">Generato il ${today} · Dati aggiornati a oggi</div>

    <h2>Certificati Dipendenti</h2>
    <table>
        <thead><tr><th>Cognome Nome</th><th>Ruolo</th><th>Certificato</th><th>Rilascio</th><th>Scadenza</th><th>Stato</th></tr></thead>
        <tbody>${empRows || '<tr><td colspan="6" style="color:#aaa">Nessun dipendente</td></tr>'}</tbody>
    </table>

    <h2>Documenti di Struttura</h2>
    <table>
        <thead><tr><th>Documento</th><th>Rilascio</th><th>Scadenza</th><th>Stato</th><th>Note</th></tr></thead>
        <tbody>${docRows || '<tr><td colspan="5" style="color:#aaa">Nessun documento</td></tr>'}</tbody>
    </table>

    <div class="footer">Report generato dal gestionale alberghiero · ${today}</div>
    </body></html>`;

    const w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
}

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

function empMonthNav(delta) {
    empViewMonth.setMonth(empViewMonth.getMonth() + delta);
    renderEmployees();
}

function getDaysInMonth(year, month) {
    return new Date(year, month + 1, 0).getDate();
}

function getEmployeeMonthStats(empId, year, month) {
    const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
    const entries = workEntries.filter(w => w.employeeId === empId && w.workDate && w.workDate.startsWith(monthStr));
    const daysWorked = entries.length;
    const totalHours = entries.reduce((sum, w) => sum + (w.hours || 0), 0);
    return { daysWorked, totalHours, entries };
}

// Returns effective {payType, payRate} for an employee in a given month (YYYY-MM),
// using a month-level override if one exists, otherwise the employee's default.
function getEmpMonthPay(emp, yearMonth) {
    const override = monthPayOverrides.find(o => o.employeeId === emp.id && o.yearMonth === yearMonth);
    if (override) return { payType: override.payType, payRate: override.payRate };
    return { payType: emp.payType, payRate: emp.payRate };
}

function calcEstimatedPay(emp, daysWorked, totalHours, yearMonth) {
    const { payType, payRate } = yearMonth ? getEmpMonthPay(emp, yearMonth) : emp;
    if (payType === 'hourly') {
        return totalHours * payRate;
    }
    // monthly: daily rate = monthly pay / 30, then multiply by days worked
    return (payRate / 30) * daysWorked;
}

function calcReservationRevenue(r) {
    // Dynamically recalculate price based on presenze formula
    const gc = r.guestCount || 0;
    const ppn = r.pricePerPerson || 0;
    const grat = r.gratuity || 0;
    const nights = (r.checkin && r.checkout) ? nightsBetween(r.checkin, r.checkout) : 0;
    if (ppn > 0 && gc > 0 && nights > 0) {
        const free = grat > 0 ? Math.floor(gc / grat) : 0;
        return Math.max(0, gc - free) * nights * ppn;
    }
    return r.price || 0;
}

function renderManagement() {
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();

    // Monthly revenue (confirmed/checked-in this month)
    const monthRevenue = reservations
        .filter(r => {
            const d = new Date(r.checkin);
            return (r.status === 'confirmed' || r.status === 'checked-in') && d.getMonth() === thisMonth && d.getFullYear() === thisYear;
        })
        .reduce((sum, r) => sum + calcReservationRevenue(r), 0);

    // Annual revenue (confirmed/checked-in this year)
    const yearRevenue = reservations
        .filter(r => (r.status === 'confirmed' || r.status === 'checked-in') && new Date(r.checkin).getFullYear() === thisYear)
        .reduce((sum, r) => sum + calcReservationRevenue(r), 0);

    // Pending revenue (non-confirmed reservations)
    const pendingRevenue = reservations
        .filter(r => r.status === 'pending')
        .reduce((sum, r) => sum + calcReservationRevenue(r), 0);

    const revEl = document.getElementById('stat-revenue');
    const yearEl = document.getElementById('stat-year-revenue');
    const pendingEl = document.getElementById('stat-pending-revenue');
    if (revEl) revEl.textContent = '\u20AC' + monthRevenue.toLocaleString();
    if (yearEl) yearEl.textContent = '\u20AC' + yearRevenue.toLocaleString();
    if (pendingEl) pendingEl.textContent = '\u20AC' + pendingRevenue.toLocaleString();

    // Total presenze (confirmed/checked-in, ospiti × notti)
    const totalPresenze = reservations
        .filter(r => r.status === 'confirmed' || r.status === 'checked-in')
        .reduce((sum, r) => {
            const nights = (r.checkin && r.checkout) ? nightsBetween(r.checkin, r.checkout) : 0;
            return sum + (r.guestCount || 0) * nights;
        }, 0);
    const presenzeEl = document.getElementById('stat-total-presenze');
    if (presenzeEl) presenzeEl.textContent = totalPresenze.toLocaleString();

    // Employee total cost (all time from work entries, respecting per-month overrides)
    let totalEmpCostAll = 0;
    employees.forEach(emp => {
        const empEntries = workEntries.filter(w => w.employeeId === emp.id);
        // Group entries by month then apply effective pay type for each month
        const byMonth = {};
        empEntries.forEach(w => {
            const m = w.workDate ? w.workDate.substring(0, 7) : null;
            if (m) {
                if (!byMonth[m]) byMonth[m] = { days: 0, hours: 0 };
                byMonth[m].days++;
                byMonth[m].hours += w.hours || 0;
            }
        });
        Object.entries(byMonth).forEach(([m, { days, hours }]) => {
            const { payType, payRate } = getEmpMonthPay(emp, m);
            if (payType === 'hourly') {
                totalEmpCostAll += hours * payRate;
            } else {
                totalEmpCostAll += (days / 30) * payRate;
            }
        });
    });

    const empCostEl = document.getElementById('stat-emp-cost');
    if (empCostEl) empCostEl.textContent = '\u20AC' + Math.round(totalEmpCostAll).toLocaleString();

    // Employee cost breakdown for currently viewed month only
    const empYear = empViewMonth.getFullYear();
    const empMonth = empViewMonth.getMonth();

    const breakdownEl = document.getElementById('empCostBreakdown');
    if (breakdownEl) {
        const empCosts = [];
        let totalMonthCost = 0;
        const breakdownMonthStr = `${empYear}-${String(empMonth + 1).padStart(2, '0')}`;
        employees.forEach(emp => {
            const stats = getEmployeeMonthStats(emp.id, empYear, empMonth);
            const cost = calcEstimatedPay(emp, stats.daysWorked, stats.totalHours, breakdownMonthStr);
            totalMonthCost += cost;
            if (cost > 0 || stats.daysWorked > 0) {
                empCosts.push({ emp, cost, stats });
            }
        });

        if (empCosts.length > 0) {
            breakdownEl.style.display = '';
            const monthNames = t('months.full');
            const monthLabel = `${monthNames[empMonth]} ${empYear}`;
            let rows = empCosts.map(({ emp, cost, stats }) => {
                const effPay = getEmpMonthPay(emp, breakdownMonthStr);
                const detail = effPay.payType === 'hourly'
                    ? `${stats.totalHours % 1 === 0 ? stats.totalHours : stats.totalHours.toFixed(1)}h \u00D7 \u20AC${effPay.payRate.toFixed(2)}/h`
                    : `${stats.daysWorked}g / 30 \u00D7 \u20AC${effPay.payRate.toFixed(0)}`;
                return `<tr>
                    <td style="padding:8px 12px;font-weight:500">${escapeHtml(emp.lastName)} ${escapeHtml(emp.firstName)}</td>
                    <td style="padding:8px 12px;color:var(--text-secondary);font-size:13px">${detail}</td>
                    <td style="padding:8px 12px;text-align:right;font-weight:600;font-variant-numeric:tabular-nums">\u20AC${Math.round(cost).toLocaleString()}</td>
                </tr>`;
            }).join('');
            breakdownEl.innerHTML = `
                <div style="padding:12px 12px 4px;font-weight:600;font-size:14px">Costo dipendenti — ${monthLabel}</div>
                <table style="width:100%;border-collapse:collapse">
                    <thead><tr>
                        <th style="padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:var(--text-secondary);border-bottom:1px solid var(--border-light)">Dipendente</th>
                        <th style="padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:var(--text-secondary);border-bottom:1px solid var(--border-light)">Dettaglio</th>
                        <th style="padding:10px 12px;text-align:right;font-size:11px;text-transform:uppercase;color:var(--text-secondary);border-bottom:1px solid var(--border-light)">Costo</th>
                    </tr></thead>
                    <tbody>${rows}
                        <tr style="border-top:2px solid var(--border-light)">
                            <td colspan="2" style="padding:10px 12px;font-weight:700">Totale mese</td>
                            <td style="padding:10px 12px;text-align:right;font-weight:700;font-variant-numeric:tabular-nums">\u20AC${Math.round(totalMonthCost).toLocaleString()}</td>
                        </tr>
                    </tbody>
                </table>`;
        } else {
            breakdownEl.style.display = 'none';
        }
    }

    renderEmployees();
}

function renderEmployees() {
    const grid = document.getElementById('employeesGrid');
    const search = (document.getElementById('searchEmployees')?.value || '').toLowerCase();
    const year = empViewMonth.getFullYear();
    const month = empViewMonth.getMonth();
    const monthNames = t('months.full');
    document.getElementById('empMonthLabel').textContent = `${monthNames[month]} ${year}`;

    let filtered = employees;
    if (search) {
        filtered = filtered.filter(e =>
            (e.firstName + ' ' + e.lastName + ' ' + (e.role || '')).toLowerCase().includes(search)
        );
    }

    if (filtered.length === 0) {
        grid.innerHTML = `<div class="empty-state"><p>${t('emp.noEmployees')}</p></div>`;
        return;
    }

    const dim = getDaysInMonth(year, month);
    const dayHeaders = t('months.dayHeaders') || ['Lu','Ma','Me','Gi','Ve','Sa','Do'];
    const todayStr = formatDate(new Date());
    const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;

    // Build header row
    let headerCells = `<th class="emp-tbl-sticky">${t('emp.employee')}</th><th class="emp-tbl-type">${t('emp.type')}</th>`;
    for (let d = 1; d <= dim; d++) {
        const dateStr = `${monthStr}-${String(d).padStart(2, '0')}`;
        const dow = (new Date(year, month, d).getDay() + 6) % 7; // Mon=0
        const isWeekend = dow >= 5;
        const isToday = dateStr === todayStr;
        let cls = 'emp-tbl-day';
        if (isWeekend) cls += ' emp-tbl-weekend';
        if (isToday) cls += ' emp-tbl-today';
        headerCells += `<th class="${cls}"><span class="emp-tbl-dow">${dayHeaders[dow]}</span><span class="emp-tbl-dnum">${d}</span></th>`;
    }
    headerCells += `<th class="emp-tbl-total">${t('emp.totalCol')}</th><th class="emp-tbl-pay">${t('emp.estimatedPay')}</th>`;

    // Build body rows
    let bodyRows = '';
    filtered.forEach(emp => {
        const stats = getEmployeeMonthStats(emp.id, year, month);
        const effPay = getEmpMonthPay(emp, monthStr);
        const estimated = calcEstimatedPay(emp, stats.daysWorked, stats.totalHours, monthStr);
        const entryMap = {};
        stats.entries.forEach(w => { entryMap[w.workDate] = w; });

        const isOverridden = monthPayOverrides.some(o => o.employeeId === emp.id && o.yearMonth === monthStr);
        const typeLabel = effPay.payType === 'hourly' ? '\u20AC/h' : '\u20AC/m';
        const typeCls = 'emp-tbl-type emp-tbl-type-btn' + (isOverridden ? ' emp-tbl-type-override' : '');
        const typeTitle = isOverridden ? 'Override attivo — clicca per modificare' : 'Clicca per cambiare tipo paga questo mese';
        const roleStr = emp.role ? `<span class="emp-tbl-role">${escapeHtml(emp.role)}</span>` : '';
        let row = `<td class="emp-tbl-sticky emp-tbl-name" onclick="openEditEmployee('${emp.id}')"><span class="emp-tbl-empname">${escapeHtml(emp.lastName)} ${escapeHtml(emp.firstName)}</span>${roleStr}</td>`;
        row += `<td class="${typeCls}" title="${typeTitle}" onclick="openPayTypePopover('${emp.id}','${monthStr}',this)">${typeLabel}</td>`;

        for (let d = 1; d <= dim; d++) {
            const dateStr = `${monthStr}-${String(d).padStart(2, '0')}`;
            const entry = entryMap[dateStr];
            const dow = (new Date(year, month, d).getDay() + 6) % 7;
            const isWeekend = dow >= 5;
            const isToday = dateStr === todayStr;
            let cls = 'emp-tbl-cell';
            if (isWeekend) cls += ' emp-tbl-weekend';
            if (isToday) cls += ' emp-tbl-today';
            if (entry) cls += ' emp-tbl-worked';

            if (effPay.payType === 'hourly') {
                let display = '';
                if (entry) {
                    const hStr = entry.hours % 1 === 0 ? entry.hours.toString() : entry.hours.toFixed(1);
                    display = entry.startTime2 ? `<span class="emp-tbl-2shifts">${hStr}</span>` : hStr;
                }
                row += `<td class="${cls}" data-emp="${emp.id}" data-date="${dateStr}" onclick="openTimePopover('${emp.id}','${dateStr}',this)">${display}</td>`;
            } else {
                const display = entry ? '\u2713' : '';
                row += `<td class="${cls}" data-emp="${emp.id}" data-date="${dateStr}" onclick="empTableToggle('${emp.id}','${dateStr}')">${display}</td>`;
            }
        }

        const totalDisplay = effPay.payType === 'hourly'
            ? (stats.totalHours % 1 === 0 ? stats.totalHours + 'h' : stats.totalHours.toFixed(1) + 'h')
            : stats.daysWorked + 'g';
        row += `<td class="emp-tbl-total">${totalDisplay}</td>`;
        row += `<td class="emp-tbl-pay">\u20AC${estimated.toFixed(0)}</td>`;

        bodyRows += `<tr>${row}</tr>`;
    });

    // Build colgroup for proper column sizing
    let colgroup = '<colgroup><col style="width:140px"><col style="width:40px">';
    for (let d = 1; d <= dim; d++) colgroup += '<col>';
    colgroup += '<col style="width:56px"><col style="width:64px"></colgroup>';

    grid.innerHTML = `
        <div class="emp-table-wrap">
            <table class="emp-table">
                ${colgroup}
                <thead><tr>${headerCells}</tr></thead>
                <tbody>${bodyRows}</tbody>
            </table>
        </div>
    `;
}

// Toggle day for monthly employees in table view
async function empTableToggle(empId, dateStr) {
    const existing = workEntries.find(w => w.employeeId === empId && w.workDate === dateStr);
    if (existing) {
        try {
            await fetch(`${API.employees}?id=${existing.id}&type=work`, { method: 'DELETE' });
            workEntries = workEntries.filter(w => w.id !== existing.id);
        } catch (err) { console.error(err); }
    } else {
        const data = { id: generateId(), employeeId: empId, workDate: dateStr, hours: 8, notes: '' };
        try {
            await apiPost(API.employees + '?type=work', data);
            workEntries.push(data);
        } catch (err) { console.error(err); }
    }
    renderEmployees();
}

// Time entry popover for hourly employees
function openTimePopover(empId, dateStr, cellEl) {
    // Remove any existing popover
    closeTimePopover();

    const existing = workEntries.find(w => w.employeeId === empId && w.workDate === dateStr);
    const startVal  = (existing && existing.startTime)  || '08:00';
    const endVal    = (existing && existing.endTime)    || '16:00';
    const start2Val = (existing && existing.startTime2) || '';
    const end2Val   = (existing && existing.endTime2)   || '';
    const hasShift2 = !!(existing && existing.startTime2);

    const pop = document.createElement('div');
    pop.id = 'empTimePopover';
    pop.className = 'emp-time-popover';
    pop.innerHTML = `
        <div class="emp-time-popover-inner">
            <div class="emp-time-shift-label">Turno 1</div>
            <div class="emp-time-row">
                <label>${t('emp.startTime')}</label>
                <input type="time" id="empPopStart" value="${startVal}">
            </div>
            <div class="emp-time-row">
                <label>${t('emp.endTime')}</label>
                <input type="time" id="empPopEnd" value="${endVal}">
            </div>
            <div id="empPopShift2" style="${hasShift2 ? '' : 'display:none'}">
                <div class="emp-time-shift-label" style="margin-top:8px">Turno 2</div>
                <div class="emp-time-row">
                    <label>${t('emp.startTime')}</label>
                    <input type="time" id="empPopStart2" value="${start2Val}">
                </div>
                <div class="emp-time-row">
                    <label>${t('emp.endTime')}</label>
                    <input type="time" id="empPopEnd2" value="${end2Val}">
                </div>
            </div>
            <div style="display:flex;align-items:center;gap:8px;margin-top:4px">
                <div class="emp-time-calc" id="empPopCalc"></div>
                <button id="empPopAddShift2" class="btn btn-ghost btn-sm" style="font-size:11px;padding:2px 6px;${hasShift2 ? 'display:none' : ''}" onclick="toggleShift2Popover()">+ Turno 2</button>
                <button id="empPopRemoveShift2" class="btn btn-ghost btn-sm" style="font-size:11px;padding:2px 6px;color:var(--red);${hasShift2 ? '' : 'display:none'}" onclick="toggleShift2Popover()">- Turno 2</button>
            </div>
            <div class="emp-time-actions">
                <button class="btn btn-primary btn-sm" onclick="saveTimePopover('${empId}','${dateStr}')">${t('emp.save')}</button>
                ${existing ? `<button class="btn btn-ghost btn-sm" style="color:var(--red)" onclick="deleteTimePopover('${empId}','${dateStr}')">${t('emp.delete')}</button>` : ''}
            </div>
        </div>
    `;
    document.body.appendChild(pop);

    // Position near cell
    const rect = cellEl.getBoundingClientRect();
    const popW = 210, popH = hasShift2 ? 300 : 200;
    let left = rect.left + rect.width / 2 - popW / 2;
    let top = rect.bottom + 6;
    if (left < 8) left = 8;
    if (left + popW > window.innerWidth - 8) left = window.innerWidth - popW - 8;
    if (top + popH > window.innerHeight - 8) top = rect.top - popH - 6;
    pop.style.left = left + 'px';
    pop.style.top = top + 'px';

    // Live calc — total of both shifts
    function updateCalc() {
        let totalH = 0;
        const s1 = document.getElementById('empPopStart').value;
        const e1 = document.getElementById('empPopEnd').value;
        if (s1 && e1) totalH += calcHoursFromTimes(s1, e1);
        const s2 = document.getElementById('empPopStart2')?.value;
        const e2 = document.getElementById('empPopEnd2')?.value;
        if (s2 && e2) totalH += calcHoursFromTimes(s2, e2);
        document.getElementById('empPopCalc').textContent = totalH > 0 ? totalH.toFixed(1) + 'h' : '';
    }
    ['empPopStart','empPopEnd','empPopStart2','empPopEnd2'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', updateCalc);
    });
    updateCalc();

    // Close on outside click (deferred)
    setTimeout(() => {
        document.addEventListener('mousedown', _timePopoverOutsideClick);
    }, 10);
}

function toggleShift2Popover() {
    const section = document.getElementById('empPopShift2');
    const addBtn  = document.getElementById('empPopAddShift2');
    const remBtn  = document.getElementById('empPopRemoveShift2');
    const visible = section.style.display !== 'none';
    section.style.display = visible ? 'none' : '';
    addBtn.style.display  = visible ? '' : 'none';
    remBtn.style.display  = visible ? 'none' : '';
    if (visible) {
        // Clear shift 2 values when hiding
        const s2 = document.getElementById('empPopStart2');
        const e2 = document.getElementById('empPopEnd2');
        if (s2) s2.value = '';
        if (e2) e2.value = '';
    }
    // Recalculate total
    let totalH = 0;
    const s1 = document.getElementById('empPopStart').value;
    const e1 = document.getElementById('empPopEnd').value;
    if (s1 && e1) totalH += calcHoursFromTimes(s1, e1);
    document.getElementById('empPopCalc').textContent = totalH > 0 ? totalH.toFixed(1) + 'h' : '';
}

function _timePopoverOutsideClick(e) {
    const pop = document.getElementById('empTimePopover');
    if (pop && !pop.contains(e.target)) {
        closeTimePopover();
    }
}

function closeTimePopover() {
    const pop = document.getElementById('empTimePopover');
    if (pop) pop.remove();
    document.removeEventListener('mousedown', _timePopoverOutsideClick);
}

// Pay type override popover — lets you switch hourly/monthly for one specific month
function openPayTypePopover(empId, yearMonth, cellEl) {
    closePayTypePopover();
    closeTimePopover();
    const emp = employees.find(e => e.id === empId);
    if (!emp) return;

    const override = monthPayOverrides.find(o => o.employeeId === empId && o.yearMonth === yearMonth);
    const effPay = getEmpMonthPay(emp, yearMonth);

    const pop = document.createElement('div');
    pop.id = 'empPayTypePopover';
    pop.className = 'emp-time-popover';
    pop.innerHTML = `
        <div class="emp-time-popover-inner">
            <div style="font-size:11px;color:var(--text-secondary);margin-bottom:10px;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Tipo paga — ${yearMonth}</div>
            <div class="emp-time-row">
                <label>Tipo</label>
                <select id="payTypePopSelect" style="font-size:13px;padding:4px 6px;border:1px solid var(--border);border-radius:6px;background:var(--bg-secondary);color:var(--text-primary)">
                    <option value="monthly" ${effPay.payType === 'monthly' ? 'selected' : ''}>Mensile (€/mese)</option>
                    <option value="hourly" ${effPay.payType === 'hourly' ? 'selected' : ''}>Oraria (€/ora)</option>
                </select>
            </div>
            <div class="emp-time-row">
                <label id="payTypePopRateLabel">${effPay.payType === 'hourly' ? 'Tariffa (€/h)' : 'Stipendio (€)'}</label>
                <input type="number" id="payTypePopRate" value="${effPay.payRate}" min="0" step="0.01" style="width:80px">
            </div>
            ${override ? `<div style="font-size:11px;color:var(--text-secondary);margin-bottom:6px">Default: ${emp.payType === 'hourly' ? '€/h' : '€/mese'} · €${emp.payRate.toFixed(2)}</div>` : ''}
            <div class="emp-time-actions">
                <button class="btn btn-primary btn-sm" onclick="savePayTypeOverride('${empId}','${yearMonth}')">Salva</button>
                ${override ? `<button class="btn btn-ghost btn-sm" style="color:var(--red)" onclick="deletePayTypeOverride('${override.id}','${empId}','${yearMonth}')">Ripristina default</button>` : ''}
            </div>
        </div>
    `;
    document.body.appendChild(pop);

    // Update rate label when type changes
    document.getElementById('payTypePopSelect').addEventListener('change', function () {
        document.getElementById('payTypePopRateLabel').textContent = this.value === 'hourly' ? 'Tariffa (€/h)' : 'Stipendio (€)';
    });

    // Position near cell
    const rect = cellEl.getBoundingClientRect();
    const popW = 220, popH = 200;
    let left = rect.left + rect.width / 2 - popW / 2;
    let top = rect.bottom + 6;
    if (left < 8) left = 8;
    if (left + popW > window.innerWidth - 8) left = window.innerWidth - popW - 8;
    if (top + popH > window.innerHeight - 8) top = rect.top - popH - 6;
    pop.style.left = left + 'px';
    pop.style.top = top + 'px';

    setTimeout(() => {
        document.addEventListener('mousedown', _payTypePopoverOutsideClick);
    }, 10);
}

function _payTypePopoverOutsideClick(e) {
    const pop = document.getElementById('empPayTypePopover');
    if (pop && !pop.contains(e.target)) closePayTypePopover();
}

function closePayTypePopover() {
    const pop = document.getElementById('empPayTypePopover');
    if (pop) pop.remove();
    document.removeEventListener('mousedown', _payTypePopoverOutsideClick);
}

async function savePayTypeOverride(empId, yearMonth) {
    const payType = document.getElementById('payTypePopSelect').value;
    const payRate = parseFloat(document.getElementById('payTypePopRate').value) || 0;
    closePayTypePopover();

    const existing = monthPayOverrides.find(o => o.employeeId === empId && o.yearMonth === yearMonth);
    const data = { id: existing ? existing.id : generateId(), employeeId: empId, yearMonth, payType, payRate };

    try {
        await apiPost(API.employees + '?type=monthOverride', data);
        if (existing) {
            existing.payType = payType;
            existing.payRate = payRate;
        } else {
            monthPayOverrides.push(data);
        }
    } catch (err) { console.error(err); }

    renderEmployees();
    renderManagement();
}

async function deletePayTypeOverride(overrideId, empId, yearMonth) {
    closePayTypePopover();
    try {
        await fetch(`${API.employees}?id=${overrideId}&type=monthOverride`, { method: 'DELETE' });
        monthPayOverrides = monthPayOverrides.filter(o => !(o.employeeId === empId && o.yearMonth === yearMonth));
    } catch (err) { console.error(err); }

    renderEmployees();
    renderManagement();
}

function calcHoursFromTimes(start, end) {
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    let mins = (eh * 60 + em) - (sh * 60 + sm);
    if (mins < 0) mins += 24 * 60; // overnight
    return mins / 60;
}

async function saveTimePopover(empId, dateStr) {
    const startTime  = document.getElementById('empPopStart').value;
    const endTime    = document.getElementById('empPopEnd').value;
    if (!startTime || !endTime) return;

    const startTime2 = document.getElementById('empPopStart2')?.value || null;
    const endTime2   = document.getElementById('empPopEnd2')?.value   || null;

    let hours = calcHoursFromTimes(startTime, endTime);
    if (startTime2 && endTime2) hours += calcHoursFromTimes(startTime2, endTime2);

    const existing = workEntries.find(w => w.employeeId === empId && w.workDate === dateStr);
    if (existing) {
        existing.hours      = hours;
        existing.startTime  = startTime;
        existing.endTime    = endTime;
        existing.startTime2 = startTime2 || null;
        existing.endTime2   = endTime2   || null;
        try { await apiPut(API.employees + '?type=work', existing); } catch (err) { console.error(err); }
    } else {
        const data = { id: generateId(), employeeId: empId, workDate: dateStr, hours, notes: '', startTime, endTime, startTime2: startTime2 || null, endTime2: endTime2 || null };
        try {
            await apiPost(API.employees + '?type=work', data);
            workEntries.push(data);
        } catch (err) { console.error(err); }
    }
    closeTimePopover();
    renderEmployees();
}

async function deleteTimePopover(empId, dateStr) {
    const existing = workEntries.find(w => w.employeeId === empId && w.workDate === dateStr);
    if (existing) {
        try {
            await fetch(`${API.employees}?id=${existing.id}&type=work`, { method: 'DELETE' });
            workEntries = workEntries.filter(w => w.id !== existing.id);
        } catch (err) { console.error(err); }
    }
    closeTimePopover();
    renderEmployees();
}

function openNewEmployeeModal() {
    document.getElementById('employeeForm').reset();
    document.getElementById('empId').value = '';
    document.getElementById('employeeModalTitle').textContent = t('emp.addEmployee');
    document.getElementById('deleteEmpBtn').style.display = 'none';
    togglePayRateLabel();
    openModal('employeeModal');
}

function openEditEmployee(id) {
    const emp = employees.find(e => e.id === id);
    if (!emp) return;
    document.getElementById('empId').value = emp.id;
    document.getElementById('empFirstName').value = emp.firstName;
    document.getElementById('empLastName').value = emp.lastName;
    document.getElementById('empRole').value = emp.role || '';
    document.getElementById('empPayType').value = emp.payType;
    document.getElementById('empPayRate').value = emp.payRate || '';
    document.getElementById('empNotes').value = emp.notes || '';
    document.getElementById('employeeModalTitle').textContent = t('emp.editEmployee');
    document.getElementById('deleteEmpBtn').style.display = 'inline-flex';
    togglePayRateLabel();
    openModal('employeeModal');
}

function togglePayRateLabel() {
    const payType = document.getElementById('empPayType').value;
    const label = document.getElementById('empPayRateLabel');
    label.textContent = (payType === 'hourly' ? t('emp.hourlyPay') : t('emp.monthlyPay')) + ' (\u20AC)';
}

async function saveEmployee(e) {
    e.preventDefault();
    const id = document.getElementById('empId').value;
    const data = {
        id: id || generateId(),
        firstName: document.getElementById('empFirstName').value.trim(),
        lastName: document.getElementById('empLastName').value.trim(),
        role: document.getElementById('empRole').value.trim(),
        payType: document.getElementById('empPayType').value,
        payRate: parseFloat(document.getElementById('empPayRate').value) || 0,
        phone: '',
        email: '',
        notes: document.getElementById('empNotes').value.trim(),
    };

    try {
        if (id) {
            await apiPut(API.employees, data);
            const idx = employees.findIndex(e => e.id === id);
            if (idx >= 0) employees[idx] = data;
        } else {
            await apiPost(API.employees, data);
            employees.push(data);
        }
        showToast(t('toast.empSaved'));
        closeModal('employeeModal');
        renderEmployees();
    } catch (err) {
        console.error('Employee save error:', err);
        showToast(t('toast.empSaveFail') + ': ' + err.message, 'error');
    }
}

async function deleteEmployee() {
    const id = document.getElementById('empId').value;
    if (!id || !confirm(t('confirm.deleteEmployee'))) return;
    try {
        await apiDelete(API.employees, id);
        employees = employees.filter(e => e.id !== id);
        workEntries = workEntries.filter(w => w.employeeId !== id);
        showToast(t('toast.empDeleted'));
        closeModal('employeeModal');
        renderEmployees();
    } catch (err) {
        showToast(t('toast.empDeleteFail'), 'error');
    }
}

function openEmployeeDetail(empId) {
    const emp = employees.find(e => e.id === empId);
    if (!emp) return;

    const year = empViewMonth.getFullYear();
    const month = empViewMonth.getMonth();
    const monthNames = t('months.full');
    const dim = getDaysInMonth(year, month);
    const detailMonthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
    const stats = getEmployeeMonthStats(empId, year, month);
    const effPay = getEmpMonthPay(emp, detailMonthStr);
    const estimated = calcEstimatedPay(emp, stats.daysWorked, stats.totalHours, detailMonthStr);

    document.getElementById('empDetailName').textContent = `${emp.lastName} ${emp.firstName}`;

    const isOverridden = monthPayOverrides.some(o => o.employeeId === empId && o.yearMonth === detailMonthStr);
    const payInfo = effPay.payType === 'hourly'
        ? `${t('emp.hourlyPay')}: \u20AC${effPay.payRate.toFixed(2)}/h${isOverridden ? ' \u26A0\uFE0F' : ''}`
        : `${t('emp.monthlyPay')}: \u20AC${effPay.payRate.toFixed(2)}${isOverridden ? ' \u26A0\uFE0F' : ''}`;

    // Build calendar grid
    const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
    const startOffset = (firstDay + 6) % 7; // convert to Mon=0
    const dayHeaders = t('months.dayHeaders') || ['Lu','Ma','Me','Gi','Ve','Sa','Do'];

    // Map entries by date string
    const entryMap = {};
    stats.entries.forEach(w => { entryMap[w.workDate] = w; });

    const todayStr = formatDate(new Date());

    let calCells = '';
    // Day headers
    calCells += dayHeaders.map(d => `<div class="emp-cal-header">${d}</div>`).join('');
    // Empty cells before first day
    for (let i = 0; i < startOffset; i++) calCells += '<div class="emp-cal-cell empty"></div>';
    // Day cells
    for (let d = 1; d <= dim; d++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const entry = entryMap[dateStr];
        const isToday = dateStr === todayStr;
        const dayOfWeek = (startOffset + d - 1) % 7;
        const isWeekend = dayOfWeek >= 5;
        let cls = 'emp-cal-cell';
        if (isToday) cls += ' today';
        if (isWeekend) cls += ' weekend';
        if (entry) cls += ' worked';

        if (effPay.payType === 'hourly') {
            calCells += `<div class="${cls}" onclick="empCalDayClick('${empId}','${dateStr}')">
                <span class="emp-cal-day">${d}</span>
                ${entry ? `<span class="emp-cal-hours">${entry.hours}h</span>` : ''}
            </div>`;
        } else {
            calCells += `<div class="${cls}" onclick="empCalDayToggle('${empId}','${dateStr}')">
                <span class="emp-cal-day">${d}</span>
                ${entry ? `<svg class="emp-cal-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" width="16" height="16"><polyline points="20 6 9 17 4 12"/></svg>` : ''}
            </div>`;
        }
    }

    const body = document.getElementById('employeeDetailBody');
    body.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:8px">
            <div>
                <span style="color:var(--text-secondary);font-size:13px">${escapeHtml(emp.role || '—')} · ${payInfo}</span>
            </div>
            <button class="btn btn-secondary btn-sm" onclick="closeModal('employeeDetailModal');openEditEmployee('${empId}')">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                ${t('common.edit')}
            </button>
        </div>

        <div class="emp-detail-section">
            <div class="emp-summary-grid">
                <div class="emp-summary-card">
                    <div class="value">${stats.daysWorked}</div>
                    <div class="label">${t('emp.workDays')}</div>
                </div>
                <div class="emp-summary-card">
                    <div class="value">${stats.totalHours.toFixed(1)}</div>
                    <div class="label">${t('emp.totalHours')}</div>
                </div>
                <div class="emp-summary-card">
                    <div class="value" style="color:var(--green)">&euro;${estimated.toFixed(2)}</div>
                    <div class="label">${t('emp.estimatedPay')}</div>
                </div>
            </div>
        </div>

        <div class="emp-detail-section">
            <h4>${monthNames[month]} ${year}</h4>
            <div class="emp-cal-grid">
                ${calCells}
            </div>
            ${effPay.payType === 'hourly' ? `<p style="font-size:11px;color:var(--text-secondary);margin-top:8px">${t('emp.calHintHourly')}</p>` :
            `<p style="font-size:11px;color:var(--text-secondary);margin-top:8px">${t('emp.calHintMonthly')}</p>`}
        </div>
    `;

    openModal('employeeDetailModal');
}

// Calendar day click for hourly employees — prompt for hours
async function empCalDayClick(empId, dateStr) {
    const existing = workEntries.find(w => w.employeeId === empId && w.workDate === dateStr);
    if (existing) {
        const input = prompt(t('emp.enterHours'), existing.hours);
        if (input === null) return;
        const hours = parseFloat(input);
        if (isNaN(hours) || hours < 0) return;
        if (hours === 0) {
            // Remove entry
            try {
                await fetch(`${API.employees}?id=${existing.id}&type=work`, { method: 'DELETE' });
                workEntries = workEntries.filter(w => w.id !== existing.id);
            } catch (err) { console.error(err); }
        } else {
            existing.hours = hours;
            try { await apiPut(API.employees + '?type=work', existing); } catch (err) { console.error(err); }
        }
    } else {
        const input = prompt(t('emp.enterHours'), '8');
        if (input === null) return;
        const hours = parseFloat(input);
        if (isNaN(hours) || hours <= 0) return;
        const data = { id: generateId(), employeeId: empId, workDate: dateStr, hours, notes: '' };
        try {
            await apiPost(API.employees + '?type=work', data);
            workEntries.push(data);
        } catch (err) { console.error(err); }
    }
    renderEmployees();
    openEmployeeDetail(empId);
}

// Calendar day toggle for monthly employees — toggle worked/not worked
async function empCalDayToggle(empId, dateStr) {
    const existing = workEntries.find(w => w.employeeId === empId && w.workDate === dateStr);
    if (existing) {
        try {
            await fetch(`${API.employees}?id=${existing.id}&type=work`, { method: 'DELETE' });
            workEntries = workEntries.filter(w => w.id !== existing.id);
        } catch (err) { console.error(err); }
    } else {
        const data = { id: generateId(), employeeId: empId, workDate: dateStr, hours: 8, notes: '' };
        try {
            await apiPost(API.employees + '?type=work', data);
            workEntries.push(data);
        } catch (err) { console.error(err); }
    }
    renderEmployees();
    openEmployeeDetail(empId);
}

function closeWorkEntryModal() {
    const empId = document.getElementById('workEntryEmployeeId').value;
    closeModal('workEntryModal');
    if (empId) openEmployeeDetail(empId);
}

function openNewWorkEntry(empId) {
    closeModal('employeeDetailModal');
    document.getElementById('workEntryForm').reset();
    document.getElementById('workEntryId').value = '';
    document.getElementById('workEntryEmployeeId').value = empId;
    document.getElementById('workEntryDate').value = formatDate(new Date());
    document.getElementById('workEntryHours').value = '8';
    document.getElementById('workEntryModalTitle').textContent = t('emp.addWorkDay');
    openModal('workEntryModal');
}

function openEditWorkEntry(workId) {
    const entry = workEntries.find(w => w.id === workId);
    if (!entry) return;
    closeModal('employeeDetailModal');
    document.getElementById('workEntryId').value = entry.id;
    document.getElementById('workEntryEmployeeId').value = entry.employeeId;
    document.getElementById('workEntryDate').value = entry.workDate;
    document.getElementById('workEntryHours').value = entry.hours || '';
    document.getElementById('workEntryNotes').value = entry.notes || '';
    document.getElementById('workEntryModalTitle').textContent = t('emp.editWorkDay');
    openModal('workEntryModal');
}

async function saveWorkEntry(e) {
    e.preventDefault();
    const id = document.getElementById('workEntryId').value;
    const empId = document.getElementById('workEntryEmployeeId').value;
    const data = {
        id: id || generateId(),
        employeeId: empId,
        workDate: document.getElementById('workEntryDate').value,
        hours: parseFloat(document.getElementById('workEntryHours').value) || 0,
        notes: document.getElementById('workEntryNotes').value.trim(),
    };

    try {
        if (id) {
            await apiPut(API.employees + '?type=work', data);
            const idx = workEntries.findIndex(w => w.id === id);
            if (idx >= 0) workEntries[idx] = data;
        } else {
            await apiPost(API.employees + '?type=work', data);
            workEntries.push(data);
        }
        showToast(t('toast.workSaved'));
        closeModal('workEntryModal');
        renderEmployees();
        openEmployeeDetail(empId);
    } catch (err) {
        showToast(t('toast.workSaveFail'), 'error');
    }
}

async function deleteWorkEntry(workId, empId) {
    if (!confirm(t('confirm.deleteWorkEntry'))) return;
    try {
        await fetch(`${API.employees}?id=${workId}&type=work`, { method: 'DELETE' });
        workEntries = workEntries.filter(w => w.id !== workId);
        showToast(t('toast.workDeleted'));
        renderEmployees();
        openEmployeeDetail(empId);
    } catch (err) {
        showToast(t('toast.workDeleteFail'), 'error');
    }
}

// Apply saved theme immediately
applyTheme(getTheme());

// =============================================
// INIT
// =============================================

(async function init() {
    initSettingsModal();
    applyTranslations();
    // Set up language toggle buttons
    document.querySelectorAll('[data-lang-val]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.langVal === currentLang);
        btn.addEventListener('click', () => setLanguage(btn.dataset.langVal));
    });
    const hasCached = loadDataCache();
    if (hasCached) {
        // Show UI immediately with cached data
        renderDashboard();
        renderCalendar();
        // Refresh in background silently
        loadAllData().then(() => {
            const current = document.querySelector('.nav-item.active, .tab-item.active');
            const page = current ? current.dataset.page : 'dashboard';
            if (page === 'dashboard') renderDashboard();
            else if (page === 'calendar') renderCalendar();
        });
    } else {
        showLoading('Caricamento dati...');
        await loadAllData();
        hideLoading();
        renderDashboard();
        renderCalendar();
    }
})();
