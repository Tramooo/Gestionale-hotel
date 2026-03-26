// =============================================
// GroupStay — Hotel Group Reservation Manager
// =============================================

// ---- DATA STORE (Neon Postgres via API) ----

const API = {
    reservations: '/api/reservations',
    rooms: '/api/rooms',
    guests: '/api/guests',
    init: '/api/init',
    assignments: '/api/assignments',
    plannerConfig: '/api/planner-config',
    alloggiati: '/api/alloggiati',
    employees: '/api/employees'
};

async function apiGet(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
}

async function apiPost(url, data) {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `API error: ${res.status}`);
    }
    return res.json();
}

async function apiPut(url, data) {
    const res = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
}

async function apiDelete(url, id) {
    const res = await fetch(`${url}?id=${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
}

async function loadAllData() {
    try {
        // Ensure all tables and columns exist
        try { await apiPost(API.init, {}); } catch (e) {}

        const [resData, roomData, guestData, empData] = await Promise.all([
            apiGet(API.reservations),
            apiGet(API.rooms),
            apiGet(API.guests),
            apiGet(API.employees).catch(() => ({ employees: [], workEntries: [] }))
        ]);
        reservations = resData;
        rooms = roomData;
        guests = guestData;
        employees = empData.employees || [];
        workEntries = empData.workEntries || [];
        computeRoomStatuses();
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

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
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
    'dash.totalGuests': { en: 'Total Guests', it: 'Ospiti Totali' },
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
    'months.short': { en: ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'], it: ['GEN','FEB','MAR','APR','MAG','GIU','LUG','AGO','SET','OTT','NOV','DIC'] },

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

function formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function formatDateDisplay(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    const locale = currentLang === 'it' ? 'it-IT' : 'en-GB';
    return d.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
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
    computeRoomStatuses();
    // Stats
    const activeGroups = reservations.filter(r => r.status === 'confirmed' || r.status === 'checked-in');
    const totalGuests = activeGroups.reduce((sum, r) => sum + (r.guestCount || 0), 0);
    const occupiedRooms = rooms.filter(r => r.status === 'occupied').length;
    document.getElementById('stat-active-groups').textContent = activeGroups.length;
    document.getElementById('stat-total-guests').textContent = totalGuests;
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
                <p>${t('res.noReservations')}</p>
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
                        <span class="res-meta-label">${t('res.guests')}</span>
                    </div>
                    <div class="res-meta-item">
                        <span class="res-meta-value">${r.roomCount}</span>
                        <span class="res-meta-label">${t('res.rooms')}</span>
                    </div>
                    <div class="res-meta-item">
                        <span class="res-meta-value">${nights}</span>
                        <span class="res-meta-label">${t('res.nights')}</span>
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

    let html = '';
    let currentFloor = null;
    sortedRooms.forEach(r => {
        if (r.floor !== currentFloor) {
            currentFloor = r.floor;
            const floorRooms = sortedRooms.filter(rm => rm.floor === r.floor);
            const allChecked = floorRooms.every(rm => selected.has(rm.id));
            html += `<label class="room-check-floor-header"><input type="checkbox" data-floor="${r.floor}" ${allChecked ? 'checked' : ''} onchange="toggleFloorCheckboxes(this)"> ${t('rooms.floor')} ${r.floor}</label>`;
        }
        const checked = selected.has(r.id);
        html += `
            <label class="room-check-item${checked ? ' checked' : ''}">
                <input type="checkbox" value="${r.id}" ${checked ? 'checked' : ''} onchange="onRoomCheckChange(this)">
                <div class="room-check-info">
                    <span class="room-check-number">${r.number}</span>
                    <span class="room-check-type">${r.type} &middot; ${r.capacity} ${t('rooms.pax')}</span>
                </div>
            </label>`;
    });

    if (sortedRooms.length === 0) {
        html = `<div style="padding:20px;text-align:center;color:var(--text-tertiary);font-size:13px">${t('res.noRoomsYet')}</div>`;
    }

    checklist.innerHTML = html;
    document.getElementById('resRoomSelectAll').checked = selected.size > 0 && selected.size === rooms.length;
    updateRoomCount();
}

function toggleAllRoomCheckboxes(el) {
    const checklist = document.getElementById('resRoomChecklist');
    checklist.querySelectorAll('input[type="checkbox"]').forEach(c => {
        c.checked = el.checked;
        const item = c.closest('.room-check-item');
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
    const floor = el.dataset.floor;
    const checklist = document.getElementById('resRoomChecklist');
    // Find room checkboxes that belong to this floor — they follow the floor header
    const roomItems = checklist.querySelectorAll('.room-check-item');
    roomItems.forEach(item => {
        const cb = item.querySelector('input[type="checkbox"]');
        const roomId = cb.value;
        const room = rooms.find(r => r.id === roomId);
        if (room && String(room.floor) === floor) {
            cb.checked = el.checked;
            item.classList.toggle('checked', el.checked);
        }
    });
    updateFloorAndSelectAll();
    updateRoomCount();
}

function updateFloorAndSelectAll() {
    const checklist = document.getElementById('resRoomChecklist');
    const roomChecks = checklist.querySelectorAll('.room-check-item input[type="checkbox"]');
    const floorChecks = checklist.querySelectorAll('.room-check-floor-header input[type="checkbox"]');

    // Update each floor checkbox
    floorChecks.forEach(fc => {
        const floor = fc.dataset.floor;
        const floorRoomChecks = [...roomChecks].filter(c => {
            const room = rooms.find(r => r.id === c.value);
            return room && String(room.floor) === floor;
        });
        fc.checked = floorRoomChecks.length > 0 && floorRoomChecks.every(c => c.checked);
    });

    // Update select all
    const all = roomChecks.length > 0 && [...roomChecks].every(c => c.checked);
    document.getElementById('resRoomSelectAll').checked = all;
}

function updateRoomCount() {
    const count = document.querySelectorAll('#resRoomChecklist .room-check-item input[type="checkbox"]:checked').length;
    const el = document.getElementById('resRoomCount');
    if (el) el.textContent = `${count} ${count !== 1 ? t('res.roomsSelected') : t('res.roomSelected')}`;
}

function getSelectedRoomIds() {
    return [...document.querySelectorAll('#resRoomChecklist .room-check-item input[type="checkbox"]:checked')].map(c => c.value);
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
    const monthNames = t('months.full');
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
    if (!dateStr) { display.textContent = t('res.selectDate'); return; }
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
    document.getElementById('reservationModalTitle').textContent = t('res.newGroupReservation');
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

    document.getElementById('reservationModalTitle').textContent = t('res.editReservation');
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

async function saveReservation(e) {
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
        showToast(t('toast.checkoutAfterCheckin'), 'error');
        return;
    }

    if (selectedRooms.length === 0) {
        showToast(t('toast.selectRoom'), 'error');
        return;
    }

    try {
        if (id) {
            const idx = reservations.findIndex(r => r.id === id);
            if (idx !== -1) {
                reservations[idx] = { ...reservations[idx], ...data };
            }
            await apiPut(API.reservations, { ...data, id });
            showToast(t('toast.resUpdated'));
        } else {
            const newRes = { id: generateId(), ...data, createdAt: new Date().toISOString() };
            reservations.push(newRes);
            await apiPost(API.reservations, newRes);
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
    if (!confirm(t('confirm.deleteReservation'))) return;
    reservations = reservations.filter(r => r.id !== id);
    guests = guests.filter(g => g.reservationId !== id);
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

// ---- Reservation Detail ----

function openReservationDetail(id) {
    const r = reservations.find(x => x.id === id);
    if (!r) return;

    document.getElementById('detailGroupName').textContent = r.groupName;
    const statusLabel = r.status.replace('-', ' ');
    const badge = document.getElementById('detailStatusBadge');
    badge.textContent = statusLabel;
    badge.className = 'status-badge ' + r.status;

    const nights = nightsBetween(r.checkin, r.checkout);

    const body = document.getElementById('reservationDetailBody');
    body.innerHTML = `
        <div class="detail-toolbar">
            <button class="btn btn-secondary btn-sm" onclick="openEditReservation('${r.id}')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                ${t('detail.edit')}
            </button>
            <button class="btn btn-secondary btn-sm" onclick="openRoomAssignment('${r.id}')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
                ${t('detail.roomPlanner')}
            </button>
            <button class="btn btn-secondary btn-sm" onclick="openGuestsList('${r.id}')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                ${t('detail.manageGuests')}
            </button>
            <button class="btn btn-ghost btn-sm detail-delete-btn" onclick="deleteReservation('${r.id}')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                ${t('detail.delete')}
            </button>
        </div>

        <div class="detail-info-card">
            <div class="detail-info-grid">
                <div class="detail-info-item">
                    <span class="detail-info-label">${t('res.checkin')}</span>
                    <span class="detail-info-value">${formatDateDisplay(r.checkin)}</span>
                </div>
                <div class="detail-info-item">
                    <span class="detail-info-label">${t('res.checkout')}</span>
                    <span class="detail-info-value">${formatDateDisplay(r.checkout)}</span>
                </div>
                <div class="detail-info-item">
                    <span class="detail-info-label">${t('res.rooms')}</span>
                    <span class="detail-info-value">${r.roomCount}</span>
                </div>
                <div class="detail-info-item">
                    <span class="detail-info-label">${t('res.nights')}</span>
                    <span class="detail-info-value">${nights}</span>
                </div>
                <div class="detail-info-item detail-info-price">
                    <span class="detail-info-label">${t('res.totalPrice')}</span>
                    <span class="detail-info-value">&euro;${(r.price || 0).toLocaleString()}</span>
                </div>
                ${r.status === 'pending' && r.expiration ? `<div class="detail-info-item">
                    <span class="detail-info-label">${t('detail.expires')}</span>
                    <span class="detail-info-value">${formatDateDisplay(r.expiration)}</span>
                </div>` : ''}
            </div>
        </div>

        <div class="detail-notes-section">
            <span class="detail-info-label">${t('res.notes')}</span>
            <textarea id="detailNotesField" class="form-control" rows="4" placeholder="${t('detail.addNotes')}">${escapeHtml(r.notes || '')}</textarea>
            <button class="btn btn-sm btn-primary" onclick="saveDetailNotes('${r.id}')">${t('detail.saveNotes')}</button>
        </div>
    `;

    openModal('reservationDetailModal');
}

async function saveDetailNotes(id) {
    const r = reservations.find(x => x.id === id);
    if (!r) return;
    const notes = document.getElementById('detailNotesField').value.trim();
    r.notes = notes;
    try {
        await apiPut(API.reservations, { ...r });
        showToast(t('toast.notesSaved'));
    } catch (err) {
        console.error(err);
        showToast(t('toast.notesSaveFail'), 'error');
    }
}

// ---- Guests List Modal ----

function getGuestMissingFields(g) {
    const missing = [];
    if (!g.firstName) missing.push(t('field.firstName'));
    if (!g.lastName) missing.push(t('field.lastName'));
    if (!g.sex) missing.push(t('field.sex'));
    if (!g.birthDate) missing.push(t('field.birthDate'));
    if (!g.birthComune) missing.push(t('field.birthComune'));
    if (!g.citizenship) missing.push(t('field.citizenship'));
    // Document required only for capogruppo (17) and single guests (16)
    if ((g.guestType === '16' || g.guestType === '17') && !g.docNumber) missing.push(t('field.docNumber'));
    if ((g.guestType === '16' || g.guestType === '17') && !g.docType) missing.push(t('field.docType'));
    return missing;
}

function openGuestsList(reservationId) {
    const r = reservations.find(x => x.id === reservationId);
    if (!r) return;

    const resGuests = guests.filter(g => g.reservationId === reservationId);

    // Check if group mode (any guest has type 17 or 19)
    const hasGroupTypes = resGuests.some(g => g.guestType === '17' || g.guestType === '19');
    const isGroup = hasGroupTypes || resGuests.length > 1;

    // Count total errors
    let totalErrors = 0;
    resGuests.forEach(g => { totalErrors += getGuestMissingFields(g).length; });

    document.getElementById('guestsListTitle').textContent = `${t('detail.manageGuests')} — ${r.groupName}`;
    const body = document.getElementById('guestsListBody');

    // Build guest list HTML separately to catch errors per-guest
    let guestListHtml = '';
    if (resGuests.length === 0) {
        guestListHtml = `<div class="empty-state small"><p>${t('guestList.noGuests')}</p></div>`;
    } else {
        for (const g of resGuests) {
            try {
                const room = g.roomId ? rooms.find(rm => rm.id === g.roomId) : null;
                const missing = getGuestMissingFields(g);
                const isLeader = g.guestType === '17';
                const guestTypeLabel = g.guestType === '17' ? t('guest.leader') : g.guestType === '19' ? t('guest.member') : '';
                guestListHtml += `
                    <div class="detail-guest-item ${missing.length > 0 ? 'guest-has-errors' : ''}">
                        <div class="guest-avatar">${getInitials((g.firstName || '') + ' ' + (g.lastName || ''))}</div>
                        <div class="guest-info" style="flex:1;min-width:0">
                            <div style="display:flex;align-items:center;gap:6px">
                                <strong>${escapeHtml((g.firstName || '') + ' ' + (g.lastName || ''))}</strong>
                                ${guestTypeLabel ? `<span class="guest-type-badge ${isLeader ? 'leader' : 'member'}">${guestTypeLabel}</span>` : ''}
                            </div>
                            <span>${room ? t('rooms.room') + ' ' + room.number : t('guestList.noRoomAssigned')}${g.docNumber ? ' &middot; ' + escapeHtml(g.docType || '') + ': ' + escapeHtml(g.docNumber) : ''}</span>
                            ${missing.length > 0 ? `<div class="guest-missing-fields">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                                ${t('guest.missingFields')}: ${missing.join(', ')}
                            </div>` : ''}
                        </div>
                        <div style="display:flex;gap:4px;align-items:center;flex-shrink:0">
                            ${isGroup && !isLeader ? `<button class="btn btn-ghost btn-sm" onclick="setGuestAsLeader('${g.id}', '${reservationId}')" title="${t('guest.setLeader')}">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                            </button>` : ''}
                            <button class="btn btn-ghost btn-sm" onclick="openEditGuestModal('${g.id}')">${t('guestList.edit')}</button>
                            <button class="btn btn-ghost btn-sm" onclick="deleteGuest('${g.id}', '${reservationId}')">${t('guestList.remove')}</button>
                        </div>
                    </div>
                `;
            } catch (e) {
                console.error('Error rendering guest', g.id, e);
                guestListHtml += `<div class="detail-guest-item" style="color:red">Error rendering guest ${escapeHtml((g.firstName || '') + ' ' + (g.lastName || ''))}: ${escapeHtml(e.message)}</div>`;
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
                <button class="btn btn-sm btn-primary" onclick="alloggiatiSend('${reservationId}')" ${totalErrors > 0 || resGuests.length === 0 ? 'disabled' : ''}>${t('detail.sendToPolice')}</button>
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
                <span style="color:var(--text-secondary)">${resGuests.length} ${resGuests.length !== 1 ? t('cal.guestPlural') : t('cal.guestSingular')}</span>
                <div style="display:flex;gap:8px">
                    ${resGuests.length > 0 ? `<button class="btn btn-sm btn-ghost detail-delete-btn" onclick="removeAllGuests('${reservationId}')">${t('guestList.removeAll')}</button>` : ''}
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
    document.querySelectorAll('.detail-guests-list .detail-guest-item').forEach(el => {
        const name = el.querySelector('strong')?.textContent.toLowerCase() || '';
        el.style.display = name.includes(query) ? '' : 'none';
    });
}

async function setAllGuestsType(reservationId, mode) {
    const resGuests = guests.filter(g => g.reservationId === reservationId);
    if (resGuests.length === 0) return;

    if (mode === 'single') {
        for (const g of resGuests) { g.guestType = '16'; }
    } else {
        // First guest becomes leader, rest become members
        const hasLeader = resGuests.some(g => g.guestType === '17');
        if (!hasLeader && resGuests.length > 0) resGuests[0].guestType = '17';
        for (const g of resGuests) {
            if (g.guestType !== '17') g.guestType = '19';
        }
    }

    try {
        await Promise.all(resGuests.map(g => apiPut(API.guests, g)));
    } catch (err) { console.error(err); }

    openGuestsList(reservationId);
}

async function setGuestAsLeader(guestId, reservationId) {
    const resGuests = guests.filter(g => g.reservationId === reservationId);
    for (const g of resGuests) {
        g.guestType = g.id === guestId ? '17' : '19';
    }
    try {
        await Promise.all(resGuests.map(g => apiPut(API.guests, g)));
    } catch (err) { console.error(err); }

    openGuestsList(reservationId);
}

// ---- Alloggiati Web ----

let alloggiatiToken = null;
let alloggiatiTokenExpires = null;
let alloggiatiLuoghi = null; // cached: [{code, name}]
let alloggiatiStati = null;  // cached: [{code, name}]

async function loadAlloggiatiTables() {
    if (alloggiatiLuoghi && alloggiatiStati) return;
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

function setupAlloggiatiSearchField(searchId, hiddenId, listSource) {
    const searchEl = document.getElementById(searchId);
    if (!searchEl) return;

    const resolveCode = () => {
        const list = listSource === 'stati' ? alloggiatiStati : alloggiatiLuoghi;
        const code = findCodeFromLabel(list, searchEl.value);
        // If no match found, treat the typed value as a raw code (fallback)
        document.getElementById(hiddenId).value = code || searchEl.value.trim();
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
                <span class="badge">${g.guestType === '17' ? 'Leader' : g.guestType === '18' ? 'Member' : g.guestType === '19' ? 'Family Head' : g.guestType === '20' ? 'Family' : 'Single'}</span>
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
                html += `<div class="alloggiati-record-item ${ok ? 'success' : 'error'}">
                    <span>${d.guestName}</span>
                    <span style="color:${ok ? 'var(--green)' : 'var(--red)'}">${ok ? 'OK' : d.errorDesc + (d.errorDetail ? ': ' + d.errorDetail : '')}</span>
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

async function alloggiatiTest(reservationId) {
    const container = document.getElementById('alloggiatiResults');
    container.innerHTML = '<p>Getting token & testing...</p>';
    try {
        const token = await getAlloggiatiToken();
        const data = await apiPost(API.alloggiati + '?action=test', { reservationId, token });
        renderAlloggiatiResults(container, data, 'test');
    } catch (err) {
        container.innerHTML = `<p style="color:var(--red)">Error: ${err.message}</p>`;
    }
}

async function alloggiatiSend(reservationId) {
    if (!confirm(t('confirm.sendSchedule'))) return;
    const container = document.getElementById('alloggiatiResults');
    container.innerHTML = '<p>Sending to Alloggiati Web...</p>';
    try {
        const token = await getAlloggiatiToken();
        const data = await apiPost(API.alloggiati + '?action=send', { reservationId, token });
        renderAlloggiatiResults(container, data, 'send');
        if (data.success && data.validCount === data.totalCount) {
            showToast(t('toast.schedineOk'));
        } else {
            showToast(`${data.validCount}/${data.totalCount} schedine accepted`, 'error');
        }
    } catch (err) {
        container.innerHTML = `<p style="color:var(--red)">Error: ${err.message}</p>`;
    }
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
            ${t('assign.selectRooms')} <strong>${escapeHtml(r.groupName)}</strong> (${r.roomCount} ${t('assign.needed')})
        </p>
        <div id="assignRoomsList">
            ${availableRooms.map(rm => {
                const isSelected = assignedRoomIds.includes(rm.id);
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

function printAssignments() {
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

    // Group assigned rooms by floor
    const assignedFloors = {};
    const floorKeys = Object.keys(floors).sort((a, b) => a - b);
    for (const fk of floorKeys) {
        const floorRooms = floors[fk].filter(rm => {
            const a = assignMap[rm.id];
            if (!a) return false;
            const vals = a.cellValues || {};
            return Object.values(vals).some(v => v !== '' && v !== 0 && v != null);
        });
        if (floorRooms.length > 0) assignedFloors[fk] = floorRooms;
    }

    const assignedFloorKeys = Object.keys(assignedFloors);
    const theadHtml = `<thead><tr><th>${t('rooms.room')}</th>${plannerColumns.map(col => `<th>${col.name}</th>`).join('')}</tr></thead>`;

    // Build pages with 2 floors each
    let pages = '';
    for (let i = 0; i < assignedFloorKeys.length; i += 2) {
        let rows = '';
        for (let j = i; j < Math.min(i + 2, assignedFloorKeys.length); j++) {
            const fk = assignedFloorKeys[j];
            rows += `<tr><td colspan="${1 + plannerColumns.length}" style="background:#f0f0f0;font-weight:700;padding:6px 10px">${t('rooms.floor')} ${fk}</td></tr>`;
            for (const rm of assignedFloors[fk]) {
                const vals = (assignMap[rm.id] || {}).cellValues || {};
                rows += `<tr>
                    <td style="padding:5px 10px;font-weight:600;border:1px solid #ddd">${rm.number}</td>
                    ${plannerColumns.map(col => `<td style="padding:5px 10px;border:1px solid #ddd">${vals[col.id] != null ? vals[col.id] : ''}</td>`).join('')}
                </tr>`;
            }
        }
        pages += `<div class="page-block"><table>${theadHtml}<tbody>${rows}</tbody></table></div>`;
    }

    const printHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${r.groupName}</title>
        <style>
            body { font-family: -apple-system, sans-serif; padding: 24px; color: #222; }
            table { border-collapse: collapse; width: 100%; }
            th { background: #333; color: #fff; padding: 6px 10px; text-align: left; font-size: 12px; }
            td { font-size: 12px; }
            .page-block { page-break-after: always; }
            .page-block:last-child { page-break-after: avoid; }
            @media print { @page { margin: 0; } body { padding: 10mm; } }
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

function renderRooms() {
    computeRoomStatuses();
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
        grid.innerHTML = `<div class="empty-state"><p>${t('rooms.noRooms')}</p></div>`;
        return;
    }

    grid.innerHTML = filtered.map(r => `
        <div class="room-card ${r.status}" onclick="openEditRoom('${r.id}')">
            <div class="room-number">${r.number}</div>
            <div class="room-type">
                <span class="room-status-dot ${r.status}"></span>${r.type}
            </div>
            <div class="room-details">
                <span class="room-capacity">${r.capacity} ${t('rooms.pax')} &middot; ${t('rooms.floor')} ${r.floor}</span>
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
    document.getElementById('roomModalTitle').textContent = t('rooms.addRoom');
    document.getElementById('roomForm').reset();
    document.getElementById('roomId').value = '';
    document.getElementById('deleteRoomBtn').style.display = 'none';
    openModal('roomModal');
}

function openEditRoom(id) {
    const r = rooms.find(x => x.id === id);
    if (!r) return;

    document.getElementById('roomModalTitle').textContent = t('common.edit') + ' ' + t('rooms.room');
    document.getElementById('roomId').value = r.id;
    document.getElementById('roomNumber').value = r.number;
    document.getElementById('roomFloor').value = r.floor;
    document.getElementById('roomType').value = r.type;
    document.getElementById('roomCapacity').value = r.capacity;
    document.getElementById('deleteRoomBtn').style.display = '';

    openModal('roomModal');
}

async function saveRoom(e) {
    e.preventDefault();

    const id = document.getElementById('roomId').value;
    const data = {
        number: document.getElementById('roomNumber').value.trim(),
        floor: parseInt(document.getElementById('roomFloor').value) || 1,
        type: document.getElementById('roomType').value,
        capacity: parseInt(document.getElementById('roomCapacity').value) || 1,
        status: 'available'
    };

    try {
        if (id) {
            const idx = rooms.findIndex(r => r.id === id);
            if (idx !== -1) rooms[idx] = { ...rooms[idx], ...data };
            await apiPut(API.rooms, { ...data, id });
            showToast(t('toast.roomUpdated'));
        } else {
            if (rooms.some(r => r.number === data.number)) {
                showToast(t('toast.roomExists'), 'error');
                return;
            }
            const newRoom = { id: generateId(), ...data };
            rooms.push(newRoom);
            await apiPost(API.rooms, newRoom);
            showToast(t('toast.roomAdded'));
        }
    } catch (err) {
        console.error(err);
        showToast(t('toast.roomSaveFail'), 'error');
        return;
    }

    closeModal('roomModal');
    renderRooms();
    renderDashboard();
    refreshCalendar();
}

async function deleteRoom() {
    const id = document.getElementById('roomId').value;
    if (!id) return;
    if (!confirm(t('confirm.deleteRoom'))) return;
    rooms = rooms.filter(r => r.id !== id);
    guests = guests.filter(g => g.roomId !== id);
    try {
        await apiDelete(API.rooms, id);
    } catch (err) {
        console.error(err);
        showToast(t('toast.roomDeleteFail'), 'error');
        return;
    }
    closeModal('roomModal');
    showToast(t('toast.roomDeleted'));
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
        tbody.innerHTML = `<tr><td colspan="7" class="empty-state small">${t('guests.noGuests')}</td></tr>`;
        return;
    }

    tbody.innerHTML = allGuests.map(g => {
        const statusLabel = g.reservation ? g.reservation.status.replace('-', ' ') : t('guests.unknown');
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
                    <button class="btn btn-ghost btn-sm" onclick="deleteGuest('${g.id}', '${g.reservationId}')">${t('guestList.remove')}</button>
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

    // Clear search fields and hidden code fields
    ['guestCitizenshipSearch', 'guestBirthCountrySearch', 'guestBirthComuneSearch', 'guestDocIssuedPlaceSearch',
     'guestCitizenship', 'guestBirthCountry', 'guestBirthComune', 'guestDocIssuedPlace'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });

    // Populate room dropdown
    const select = document.getElementById('guestRoom');
    select.innerHTML = `<option value="">${t('guest.unassigned')}</option>`;
    rooms.filter(r => r.status === 'available' || r.status === 'occupied').forEach(r => {
        select.innerHTML += `<option value="${r.id}">${t('rooms.room')} ${r.number} (${r.type})</option>`;
    });

    closeModal('guestsListModal');
    openModal('guestModal');
    loadAlloggiatiTables(); // load in background
}

function openEditGuestModal(guestId) {
    const g = guests.find(x => x.id === guestId);
    if (!g) return;

    document.getElementById('guestForm').reset();
    document.getElementById('guestId').value = g.id;
    document.getElementById('guestReservationId').value = g.reservationId;
    document.getElementById('guestFirstName').value = g.firstName || '';
    document.getElementById('guestLastName').value = g.lastName || '';
    document.getElementById('guestEmail').value = g.email || '';
    document.getElementById('guestPhone').value = g.phone || '';
    document.getElementById('guestDocType').value = g.docType || '';
    document.getElementById('guestDocNumber').value = g.docNumber || '';
    document.getElementById('guestNotes').value = g.notes || '';
    document.getElementById('guestSex').value = g.sex || '';
    document.getElementById('guestBirthDate').value = g.birthDate || '';
    document.getElementById('guestBirthComune').value = g.birthComune || '';
    document.getElementById('guestBirthProvince').value = g.birthProvince || '';
    document.getElementById('guestBirthCountry').value = g.birthCountry || '';
    document.getElementById('guestCitizenship').value = g.citizenship || '';
    document.getElementById('guestDocIssuedPlace').value = g.docIssuedPlace || '';
    document.getElementById('guestType').value = g.guestType || '16';

    // Populate search fields with resolved names
    const setSearch = (searchId, code, list) => {
        const el = document.getElementById(searchId);
        if (!el) return;
        const name = findLabelFromCode(list, code);
        el.value = name || code || '';
    };
    // Do this after tables load
    loadAlloggiatiTables().then(() => {
        setSearch('guestCitizenshipSearch', g.citizenship, alloggiatiStati);
        setSearch('guestBirthCountrySearch', g.birthCountry, alloggiatiStati);
        setSearch('guestBirthComuneSearch', g.birthComune, alloggiatiLuoghi);
        setSearch('guestDocIssuedPlaceSearch', g.docIssuedPlace, alloggiatiLuoghi);
    }).catch(() => {
        // If tables fail to load, show raw codes
        document.getElementById('guestCitizenshipSearch').value = g.citizenship || '';
        document.getElementById('guestBirthCountrySearch').value = g.birthCountry || '';
        document.getElementById('guestBirthComuneSearch').value = g.birthComune || '';
        document.getElementById('guestDocIssuedPlaceSearch').value = g.docIssuedPlace || '';
    });

    // Populate room dropdown
    const select = document.getElementById('guestRoom');
    select.innerHTML = `<option value="">${t('guest.unassigned')}</option>`;
    rooms.filter(r => r.status === 'available' || r.status === 'occupied').forEach(r => {
        select.innerHTML += `<option value="${r.id}" ${r.id === g.roomId ? 'selected' : ''}>${t('rooms.room')} ${r.number} (${r.type})</option>`;
    });

    closeModal('guestsListModal');
    openModal('guestModal');
}

async function saveGuest(e) {
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
        notes: document.getElementById('guestNotes').value.trim(),
        sex: document.getElementById('guestSex').value,
        birthDate: document.getElementById('guestBirthDate').value,
        birthComune: document.getElementById('guestBirthComune').value.trim(),
        birthProvince: document.getElementById('guestBirthProvince').value.trim().toUpperCase(),
        birthCountry: document.getElementById('guestBirthCountry').value.trim(),
        citizenship: document.getElementById('guestCitizenship').value.trim(),
        docIssuedPlace: document.getElementById('guestDocIssuedPlace').value.trim(),
        guestType: document.getElementById('guestType').value
    };

    try {
        if (id) {
            const idx = guests.findIndex(g => g.id === id);
            if (idx !== -1) guests[idx] = { ...guests[idx], ...data };
            await apiPut(API.guests, { ...data, id });
            showToast(t('toast.guestUpdated'));
        } else {
            const newGuest = { id: generateId(), ...data };
            guests.push(newGuest);
            await apiPost(API.guests, newGuest);
            showToast(t('toast.guestAdded'));
        }
    } catch (err) {
        console.error('Save guest error:', err);
        showToast(t('toast.guestSaveFail') + ': ' + err.message, 'error');
        return;
    }

    closeModal('guestModal');

    // Reopen guests list and refresh reservation detail
    openGuestsList(data.reservationId);
    openReservationDetail(data.reservationId);
    renderGuests();
}

async function removeAllGuests(reservationId) {
    if (!confirm(t('confirm.removeAllGuests'))) return;
    const resGuests = guests.filter(g => g.reservationId === reservationId);
    try {
        await Promise.all(resGuests.map(g => apiDelete(API.guests, g.id)));
    } catch (err) {
        console.error(err);
        showToast(t('toast.guestRemoveFail'), 'error');
        return;
    }
    guests = guests.filter(g => g.reservationId !== reservationId);
    showToast(t('toast.allGuestsRemoved'));
    openGuestsList(reservationId);
}

async function deleteGuest(guestId, reservationId) {
    if (!confirm(t('confirm.removeGuest'))) return;
    guests = guests.filter(g => g.id !== guestId);
    try {
        await apiDelete(API.guests, guestId);
    } catch (err) {
        console.error(err);
        showToast(t('toast.guestRemoveFail'), 'error');
        return;
    }
    showToast(t('toast.guestRemoved'));

    // Refresh guests list and reservation detail
    openGuestsList(reservationId);
    openReservationDetail(reservationId);
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

    // Open new reservation modal with dates pre-filled
    document.getElementById('reservationModalTitle').textContent = t('res.newGroupReservation');
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
    }

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
    document.getElementById('fileImportReservationId').value = reservationId;
    // Reset state
    guestFileParsedRows = [];
    guestFileXlsxHeaders = [];
    guestFileMode = '';
    document.getElementById('guestFileInput').value = '';
    const nameEl = document.getElementById('guestFileName');
    nameEl.style.display = 'none';
    nameEl.textContent = '';
    document.getElementById('textParseSection').style.display = 'none';
    document.getElementById('fileImportPreviewSection').style.display = 'none';
    document.getElementById('fileImportActions').style.display = 'none';
    document.getElementById('fileImportLoading').style.display = 'none';
    closeModal('guestsListModal');
    openModal('fileImportModal');

    // Setup drag & drop
    const drop = document.getElementById('fileImportDrop');
    drop.ondragover = e => { e.preventDefault(); drop.classList.add('dragover'); };
    drop.ondragleave = () => drop.classList.remove('dragover');
    drop.ondrop = e => {
        e.preventDefault();
        drop.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file) processGuestFile(file);
    };
}

function handleGuestFileImport(e) {
    const file = e.target.files[0];
    if (file) processGuestFile(file);
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
        birthCountry: get('birthCountry'),
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
        results.push({
            firstName, lastName,
            sex: normalizeSex(get('sex')),
            birthDate: parseImportDate(get('birthDate')) || '',
            birthComune: get('birthComune'),
            birthProvince: get('birthProvince').toUpperCase().substring(0, 2),
            birthCountry: get('birthCountry'),
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

function normalizeGuestType(val) {
    if (!val) return '16'; // default: Ospite Singolo
    const v = val.toLowerCase().trim();
    if (['16', 'ospite singolo', 'single guest', 'singolo'].includes(v)) return '16';
    if (['17', 'capogruppo', 'group leader', 'capo gruppo'].includes(v)) return '17';
    if (['18', 'membro gruppo', 'group member', 'membro'].includes(v)) return '18';
    if (['19', 'capofamiglia', 'family head', 'capo famiglia'].includes(v)) return '19';
    if (['20', 'membro famiglia', 'family member'].includes(v)) return '20';
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
    const reservationId = document.getElementById('fileImportReservationId').value;
    let toImport;

    toImport = guestFileParsedRows.filter(g => g.firstName || g.lastName);

    if (toImport.length === 0) {
        showToast(t('toast.noValidGuests'), 'error');
        return;
    }

    if (!confirm(t('confirm.importGuests', { n: toImport.length }))) return;

    let success = 0, errors = 0;

    for (const data of toImport) {
        const newGuest = {
            id: generateId(),
            reservationId,
            ...data,
            roomId: '',
        };
        try {
            await apiPost(API.guests, newGuest);
            guests.push(newGuest);
            success++;
        } catch (err) {
            console.error('Guest import error:', err);
            errors++;
        }
    }

    closeModal('fileImportModal');
    showToast(`Imported ${success} guest(s)${errors ? ', ' + errors + ' failed' : ''}`);

    // Refresh guests list
    openGuestsList(reservationId);
    renderDashboard();
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

function calcEstimatedPay(emp, daysWorked, totalHours) {
    if (emp.payType === 'hourly') {
        return totalHours * emp.payRate;
    }
    // monthly: daily rate = monthly pay / 30, then multiply by days worked
    return (emp.payRate / 30) * daysWorked;
}

function renderManagement() {
    // Revenue stats
    const now = new Date();
    const monthRevenue = reservations
        .filter(r => {
            const d = new Date(r.checkin);
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        })
        .reduce((sum, r) => sum + (r.price || 0), 0);
    const yearRevenue = reservations
        .filter(r => (r.status === 'confirmed' || r.status === 'checked-in') && new Date(r.checkin).getFullYear() === now.getFullYear())
        .reduce((sum, r) => sum + (r.price || 0), 0);

    const revEl = document.getElementById('stat-revenue');
    const yearEl = document.getElementById('stat-year-revenue');
    if (revEl) revEl.textContent = '\u20AC' + monthRevenue.toLocaleString();
    if (yearEl) yearEl.textContent = '\u20AC' + yearRevenue.toLocaleString();

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

    grid.innerHTML = filtered.map(emp => {
        const stats = getEmployeeMonthStats(emp.id, year, month);
        const estimated = calcEstimatedPay(emp, stats.daysWorked, stats.totalHours);
        const initials = getInitials(emp.firstName + ' ' + emp.lastName);

        return `
            <div class="employee-card" onclick="openEmployeeDetail('${emp.id}')">
                <div class="employee-card-header">
                    <div class="avatar">${initials}</div>
                    <div class="emp-info">
                        <div class="emp-name">${escapeHtml(emp.lastName)} ${escapeHtml(emp.firstName)}</div>
                        <div class="emp-role">${escapeHtml(emp.role || '—')} · ${emp.payType === 'hourly' ? t('emp.hourly') : t('emp.monthly')}</div>
                    </div>
                </div>
                <div class="employee-card-stats">
                    <div class="emp-stat">
                        <span class="emp-stat-value">${stats.daysWorked}</span>
                        <span class="emp-stat-label">${t('emp.daysWorked')}</span>
                    </div>
                    <div class="emp-stat">
                        <span class="emp-stat-value">${stats.totalHours.toFixed(1)}</span>
                        <span class="emp-stat-label">${t('emp.hoursWorked')}</span>
                    </div>
                    <div class="emp-stat">
                        <span class="emp-stat-value">&euro;${estimated.toFixed(0)}</span>
                        <span class="emp-stat-label">${t('emp.estimatedPay')}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
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
    const daysInMonth = getDaysInMonth(year, month);
    const stats = getEmployeeMonthStats(empId, year, month);
    const estimated = calcEstimatedPay(emp, stats.daysWorked, stats.totalHours);

    document.getElementById('empDetailName').textContent = `${emp.lastName} ${emp.firstName}`;

    const payInfo = emp.payType === 'hourly'
        ? `${t('emp.hourlyPay')}: \u20AC${emp.payRate.toFixed(2)}/h`
        : `${t('emp.monthlyPay')}: \u20AC${emp.payRate.toFixed(2)}`;

    let workRowsHtml = '';
    if (stats.entries.length > 0) {
        const sorted = [...stats.entries].sort((a, b) => a.workDate.localeCompare(b.workDate));
        workRowsHtml = sorted.map(w => `
            <tr>
                <td>${formatDateDisplay(w.workDate)}</td>
                <td>${w.hours.toFixed(1)}h</td>
                <td>${escapeHtml(w.notes || '—')}</td>
                <td style="text-align:right">
                    <button class="btn btn-ghost btn-sm" onclick="openEditWorkEntry('${w.id}')" title="${t('common.edit')}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button class="btn btn-ghost btn-sm" onclick="deleteWorkEntry('${w.id}','${empId}')" title="${t('common.delete')}" style="color:var(--red)">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
                    </button>
                </td>
            </tr>
        `).join('');
    }

    const body = document.getElementById('employeeDetailBody');
    body.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:8px">
            <div>
                <span style="color:var(--text-secondary);font-size:13px">${escapeHtml(emp.role || '—')} · ${payInfo}</span>
            </div>
            <div style="display:flex;gap:8px">
                <button class="btn btn-secondary btn-sm" onclick="closeModal('employeeDetailModal');openEditEmployee('${empId}')">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    ${t('common.edit')}
                </button>
                <button class="btn btn-primary btn-sm" onclick="openNewWorkEntry('${empId}')">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    ${t('emp.addWorkDay')}
                </button>
            </div>
        </div>

        <div class="emp-detail-section">
            <h4>${t('emp.monthlySummary')} — ${monthNames[month]} ${year}</h4>
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
                    <div class="value">${daysInMonth}</div>
                    <div class="label">${t('emp.daysInMonth')}</div>
                </div>
                <div class="emp-summary-card">
                    <div class="value" style="color:var(--green)">&euro;${estimated.toFixed(2)}</div>
                    <div class="label">${t('emp.estimatedPay')}</div>
                </div>
            </div>
        </div>

        <div class="emp-detail-section">
            <h4>${t('emp.workDays')} — ${monthNames[month]} ${year}</h4>
            ${stats.entries.length === 0 ? `<div class="emp-no-data">${t('emp.noWorkDays')}</div>` : `
            <div style="overflow-x:auto;border:1px solid var(--border);border-radius:8px">
                <table class="emp-work-table">
                    <thead><tr>
                        <th>${t('emp.date')}</th>
                        <th>${t('emp.hours')}</th>
                        <th>${t('res.notes')}</th>
                        <th style="text-align:right">${t('emp.actions')}</th>
                    </tr></thead>
                    <tbody>${workRowsHtml}</tbody>
                </table>
            </div>
            `}
        </div>
    `;

    openModal('employeeDetailModal');
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
    await loadAllData();
    renderDashboard();
    renderCalendar();
})();
