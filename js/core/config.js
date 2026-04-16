(function initAppConfig(global) {
    const API = {
        reservations: '/api/reservations',
        auth: '/api/auth',
        rooms: '/api/rooms',
        guests: '/api/guests',
        init: '/api/init',
        assignments: '/api/assignments',
        alloggiati: '/api/alloggiati',
        employees: '/api/employees',
        files: '/api/files',
        menus: '/api/menus',
        compliance: '/api/compliance',
        agenda: '/api/agenda'
    };

    const CERT_TYPES = {
        sicurezza_generale: 'Formazione sicurezza generale (D.Lgs. 81/08)',
        formazione_specifica: 'Formazione specifica settore turistico-ricettivo',
        antincendio_basso: 'Antincendio rischio basso',
        antincendio_medio: 'Antincendio rischio medio',
        primo_soccorso: 'Primo soccorso',
        haccp: 'HACCP (manipolazione alimenti)',
        privacy_gdpr: 'Privacy / GDPR – Nomina incaricato',
        spp_datore: 'DL SPP – Datore di lavoro (D.Lgs. 81/08)'
    };

    const DOC_TYPES = {
        agibilita: 'Certificato di agibilità',
        cpi: 'CPI / SCIA antincendio',
        autorizzazione_sanitaria: 'Autorizzazione sanitaria',
        classificazione: 'Classificazione regionale (stelle)',
        licenza_esercizio: 'Licenza di esercizio (Comune)',
        verifica_elettrico: 'Verifica impianto elettrico',
        verifica_caldaia: 'Verifica caldaia / impianto termico',
        verifica_ascensore: 'Verifica ascensore',
        estintori: 'Controllo estintori'
    };

    global.GroupStayConfig = {
        API,
        CERT_TYPES,
        DOC_TYPES,
        NO_EXPIRY_CERTS: new Set([
            'privacy_gdpr',
            'agibilita',
            'autorizzazione_sanitaria',
            'classificazione',
            'licenza_esercizio'
        ]),
        CACHE_KEY: 'gs_data_cache',
        CACHE_TTL: 60 * 1000
    };
})(window);
