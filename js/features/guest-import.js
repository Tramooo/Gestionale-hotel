(function initGuestImportFeature(global) {
    let deps = null;
    let guestFileParsedRows = [];
    let guestFileXlsxHeaders = [];
    let guestFileMode = '';

    const GUEST_COL_ALIASES = {
        lastName: ['cognome', 'last name', 'surname', 'family name', 'last_name'],
        firstName: ['nome', 'first name', 'given name', 'first_name'],
        sex: ['sesso', 'sex', 'gender', 'genere'],
        birthDate: ['data nascita', 'data di nascita', 'birth date', 'date of birth', 'nato il', 'dob', 'data_nascita', 'birth_date'],
        birthComune: ['comune nascita', 'comune di nascita', 'birth city', 'birth place', 'luogo nascita', 'luogo di nascita', 'citta nascita'],
        birthProvince: ['provincia nascita', 'prov nascita', 'birth province', 'provincia', 'sigla', 'prov'],
        birthCountry: ['stato nascita', 'country of birth', 'birth country', 'nazione nascita', 'stato'],
        citizenship: ['cittadinanza', 'citizenship', 'nazionalita', 'nationality'],
        docType: ['tipo documento', 'document type', 'doc type', 'tipo doc', 'tipo_documento'],
        docNumber: ['numero documento', 'document number', 'doc number', 'n. documento', 'num documento', 'numero_documento'],
        docIssuedPlace: ['luogo rilascio', 'issued place', 'rilasciato da', 'autorita', 'luogo_rilascio'],
        email: ['email', 'e-mail', 'mail', 'posta elettronica'],
        phone: ['telefono', 'phone', 'cellulare', 'mobile', 'tel'],
        guestType: ['tipo alloggiato', 'guest type', 'tipo ospite', 'tipo'],
        residenceComune: ['comune residenza', 'comune di residenza', 'residenza', 'residence', 'residence city', 'comune_residenza']
    };

    const KEY_VALUE_PATTERNS = {
        lastName: /(?:cognome|last\s*name|surname|family\s*name)\s*[:=\-–]\s*(.+)/i,
        firstName: /(?:nome(?!\s*gruppo)|first\s*name|given\s*name)\s*[:=\-–]\s*(.+)/i,
        sex: /(?:sesso|sex|gender|genere)\s*[:=\-–]\s*(.+)/i,
        birthDate: /(?:data\s*(?:di\s*)?nascita|birth\s*date|date\s*of\s*birth|nato\s*(?:il|a)|dob)\s*[:=\-–]\s*(.+)/i,
        birthComune: /(?:(?:comune|luogo|citta|citt[aà])\s*(?:di\s*)?nascita|birth\s*(?:city|place))\s*[:=\-–]\s*(.+)/i,
        birthProvince: /(?:provincia\s*(?:di\s*)?nascita|prov(?:incia)?(?:\s*nascita)?)\s*[:=\-–]\s*([A-Z]{2})/i,
        birthCountry: /(?:stato\s*(?:di\s*)?nascita|(?:birth|country\s*of)\s*(?:country|birth)|nazione\s*(?:di\s*)?nascita)\s*[:=\-–]\s*(.+)/i,
        citizenship: /(?:cittadinanza|citizenship|nazionalit[aà]|nationality)\s*[:=\-–]\s*(.+)/i,
        docType: /(?:tipo\s*(?:di\s*)?documento|document\s*type|doc(?:ument)?\s*type)\s*[:=\-–]\s*(.+)/i,
        docNumber: /(?:n(?:umero)?\.?\s*(?:di\s*)?documento|document\s*(?:number|no)|doc\s*n(?:umber)?)\s*[:=\-–]\s*(.+)/i,
        docIssuedPlace: /(?:luogo\s*(?:di\s*)?rilascio|(?:issued|released)\s*(?:by|place|at)|rilasciato\s*(?:da|a))\s*[:=\-–]\s*(.+)/i,
        email: /(?:email|e-mail|mail|posta\s*elettronica)\s*[:=\-–]\s*(\S+)/i,
        phone: /(?:telefono|phone|cellulare|mobile|tel)\s*[:=\-–]\s*([\d\s\+\-\.()]+)/i,
        guestType: /(?:tipo\s*(?:di\s*)?(?:alloggiato|ospite)|guest\s*type)\s*[:=\-–]\s*(.+)/i
    };

    const COUNTRY_NAME_TO_CODE = {
        italia: '100000100', italy: '100000100',
        germania: '100000214', germany: '100000214',
        francia: '100000212', france: '100000212',
        spagna: '100000239', spain: '100000239',
        'regno unito': '100000219', 'united kingdom': '100000219',
        svizzera: '100000241', switzerland: '100000241',
        austria: '100000203',
        'stati uniti': '100000536', usa: '100000536',
        romania: '100000235', polonia: '100000233', poland: '100000233',
        'paesi bassi': '100000232', netherlands: '100000232', olanda: '100000232',
        belgio: '100000206', belgium: '100000206',
        portogallo: '100000234', portugal: '100000234',
        croazia: '100000250', croatia: '100000250',
        albania: '100000201', grecia: '100000220', greece: '100000220',
        russia: '100000236', ucraina: '100000246', ukraine: '100000246',
        cina: '100000358', china: '100000358',
        brasile: '100000351', brazil: '100000351',
        argentina: '100000347', australia: '100000302'
    };

    function requireDeps() {
        if (!deps) throw new Error('GroupStayGuestImport not initialized');
        return deps;
    }

    function getGuestImportFields() {
        const { t } = requireDeps();
        return [
            { key: 'lastName', label: t('field.lastName'), required: true },
            { key: 'firstName', label: t('field.firstName'), required: true },
            { key: 'sex', label: t('field.sex') },
            { key: 'birthDate', label: t('field.birthDate') },
            { key: 'birthComune', label: t('field.birthCity') },
            { key: 'birthProvince', label: t('field.birthProvince') },
            { key: 'birthCountry', label: t('field.birthCountry') },
            { key: 'citizenship', label: t('field.citizenship') },
            { key: 'docType', label: t('field.docType') },
            { key: 'docNumber', label: t('field.docNumber') },
            { key: 'docIssuedPlace', label: t('field.docIssuedPlace') },
            { key: 'email', label: t('field.email') },
            { key: 'phone', label: t('field.phone') },
            { key: 'guestType', label: t('field.guestType') },
            { key: 'residenceComune', label: t('field.residenceComune') }
        ];
    }

    function normalizeStr(value) {
        return value.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }

    function normalizeSex(value) {
        if (!value) return '';
        const normalized = value.toLowerCase().trim();
        if (['m', 'male', 'maschile', 'maschio', '1'].includes(normalized)) return '1';
        if (['f', 'female', 'femminile', 'femmina', '2'].includes(normalized)) return '2';
        return value;
    }

    function normalizeDocType(value) {
        if (!value) return '';
        const normalized = value.toLowerCase().trim();
        if (['ident', 'carta identita', "carta d'identita", "carta d'identità", 'carta identità', 'identity card', 'id card', 'ci'].includes(normalized)) return 'IDENT';
        if (['pasor', 'passaporto', 'passport'].includes(normalized)) return 'PASOR';
        if (['paten', 'patente', 'driving license', "driver's license", 'patente guida'].includes(normalized)) return 'PATEN';
        if (['pnauz', 'patente nautica'].includes(normalized)) return 'PNAUZ';
        if (['pordf', "porto d'armi", 'porto armi'].includes(normalized)) return 'PORDF';
        if (['IDENT', 'PASOR', 'PATEN', 'PNAUZ', 'PORDF'].includes(value.trim().toUpperCase())) return value.trim().toUpperCase();
        return value;
    }

    function normalizeBirthCountry(value, birthComune) {
        const { getAlloggiatiStati } = requireDeps();
        if (!value) return birthComune ? '100000100' : '';
        const raw = value.trim();
        if (/^\d{9}$/.test(raw)) return raw;
        const known = COUNTRY_NAME_TO_CODE[raw.toLowerCase()];
        if (known) return known;
        const stati = getAlloggiatiStati();
        if (stati) {
            const match = stati.find((entry) => entry.label.toLowerCase() === raw.toLowerCase());
            if (match) return match.code;
        }
        return '100000100';
    }

    function normalizeGuestType(value) {
        if (!value) return '16';
        const normalized = value.toLowerCase().trim();
        if (['16', 'ospite singolo', 'single guest', 'singolo'].includes(normalized)) return '16';
        if (['17', 'capofamiglia', 'family head', 'capo famiglia'].includes(normalized)) return '17';
        if (['18', 'capogruppo', 'group leader', 'capo gruppo'].includes(normalized)) return '18';
        if (['19', 'familiare', 'family member', 'membro famiglia'].includes(normalized)) return '19';
        if (['20', 'membro gruppo', 'group member', 'membro'].includes(normalized)) return '20';
        return '16';
    }

    function openFileImportModal(reservationId) {
        const { closeModal, openModal } = requireDeps();
        document.getElementById('fileImportReservationId').value = reservationId;
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

        const drop = document.getElementById('fileImportDrop');
        drop.ondragover = (event) => { event.preventDefault(); drop.classList.add('dragover'); };
        drop.ondragleave = () => drop.classList.remove('dragover');
        drop.ondrop = (event) => {
            event.preventDefault();
            drop.classList.remove('dragover');
            const file = event.dataTransfer.files[0];
            if (file) processGuestFile(file);
        };
    }

    function handleGuestFileImport(event) {
        const file = event.target.files[0];
        if (file) processGuestFile(file);
    }

    async function processGuestFile(file) {
        const { showToast, t } = requireDeps();
        const ext = file.name.split('.').pop().toLowerCase();
        if (!['pdf', 'docx', 'xlsx', 'xls'].includes(ext)) {
            showToast(t('toast.unsupportedFile'), 'error');
            return;
        }

        const nameEl = document.getElementById('guestFileName');
        nameEl.textContent = file.name;
        nameEl.style.display = 'inline';

        document.getElementById('fileImportLoading').style.display = 'block';
        document.getElementById('textParseSection').style.display = 'none';
        document.getElementById('fileImportPreviewSection').style.display = 'none';
        document.getElementById('fileImportActions').style.display = 'none';

        try {
            if (ext === 'xlsx' || ext === 'xls') await processXlsxFile(file);
            else if (ext === 'docx') await processDocxFile(file);
            else if (ext === 'pdf') await processPdfFile(file);
        } catch (error) {
            console.error('File import error:', error);
            showToast(t('toast.fileFail') + ': ' + error.message, 'error');
        } finally {
            document.getElementById('fileImportLoading').style.display = 'none';
        }
    }

    function scoreSheetHeaders(headers) {
        let score = 0;
        for (const field of getGuestImportFields()) {
            const aliases = GUEST_COL_ALIASES[field.key] || [];
            for (const alias of aliases) {
                if (headers.some((header) => normalizeStr(header) === alias || normalizeStr(header).includes(alias))) {
                    score++;
                    break;
                }
            }
        }
        return score;
    }

    async function processXlsxFile(file) {
        const { showToast, t } = requireDeps();
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array', cellDates: true });
        const jsonOpts = { defval: '', raw: false, dateNF: 'DD/MM/YYYY' };

        let bestSheet = wb.SheetNames[0];
        let bestScore = 0;
        for (const name of wb.SheetNames) {
            const data = XLSX.utils.sheet_to_json(wb.Sheets[name], jsonOpts);
            if (data.length === 0) continue;
            const score = scoreSheetHeaders(Object.keys(data[0]));
            if (score > bestScore) {
                bestScore = score;
                bestSheet = name;
            }
        }

        const ws = wb.Sheets[bestSheet];
        let json = XLSX.utils.sheet_to_json(ws, jsonOpts);
        if (json.length === 0) {
            showToast(t('toast.noDataSpreadsheet'), 'error');
            return;
        }

        if (bestScore === 0) {
            const rawRows = XLSX.utils.sheet_to_json(ws, { ...jsonOpts, header: 1 });
            if (rawRows.length === 0) {
                showToast(t('toast.noDataSpreadsheet'), 'error');
                return;
            }
            const numCols = Math.max(...rawRows.map((row) => row.length));
            const generatedHeaders = [];
            for (let i = 0; i < numCols; i++) generatedHeaders.push(`Column ${i + 1}`);
            json = rawRows.map((row) => {
                const obj = {};
                generatedHeaders.forEach((header, i) => {
                    obj[header] = row[i] !== undefined ? row[i] : '';
                });
                return obj;
            });
        }

        guestFileXlsxHeaders = Object.keys(json[0]);
        guestFileParsedRows = json;
        const contentDetected = autoDetectColumnsByContent();
        const mapping = {};
        getGuestImportFields().forEach((field) => {
            const mapped = autoMapGuestColumn(field.key) || contentDetected[field.key] || '';
            if (mapped) mapping[field.key] = mapped;
        });

        guestFileMode = 'text';
        guestFileParsedRows = json.map((row) => mapXlsxGuestRow(row, mapping)).filter(Boolean);

        if (guestFileParsedRows.length === 0) {
            showToast(t('toast.noGuestsSpreadsheet'), 'error');
            return;
        }

        document.getElementById('fileImportPreviewSection').style.display = 'block';
        document.getElementById('fileImportActions').style.display = 'flex';
        renderGuestFilePreviewTable(guestFileParsedRows);
    }

    function autoMapGuestColumn(fieldKey) {
        const candidates = GUEST_COL_ALIASES[fieldKey] || [];
        for (const candidate of candidates) {
            const exact = guestFileXlsxHeaders.find((header) => normalizeStr(header) === candidate);
            if (exact) return exact;
        }
        for (const candidate of candidates) {
            const partial = guestFileXlsxHeaders.find((header) => normalizeStr(header).includes(candidate));
            if (partial) return partial;
        }
        return '';
    }

    function autoDetectColumnsByContent() {
        if (guestFileParsedRows.length === 0) return {};
        const sampleSize = Math.min(guestFileParsedRows.length, 30);
        const samples = guestFileParsedRows.slice(0, sampleSize);
        const headers = guestFileXlsxHeaders;
        const colValues = {};
        for (const header of headers) {
            colValues[header] = samples.map((row) => String(row[header] || '').trim()).filter(Boolean);
        }

        const detectors = {
            sex: (vals) => {
                const sexVals = ['m', 'f', 'male', 'female', 'maschile', 'femminile', 'maschio', 'femmina', '1', '2'];
                const matches = vals.filter((v) => sexVals.includes(v.toLowerCase().trim()));
                const mfMatches = vals.filter((v) => /^[mfMF]$/.test(v.trim()));
                return Math.max(matches.length, mfMatches.length) / Math.max(vals.length, 1);
            },
            birthDate: (vals) => {
                const datePattern = /^(\d{1,2}[\/.\\-]\d{1,2}[\/.\\-]\d{2,4}|\d{4}[\/.\\-]\d{1,2}[\/.\\-]\d{1,2})$/;
                const monthsPattern = /gen|feb|mar|apr|mag|giu|lug|ago|set|ott|nov|dic|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/i;
                const matches = vals.filter((v) => {
                    const s = v.trim();
                    return datePattern.test(s) || (monthsPattern.test(s) && /\d/.test(s)) || /^\d{4}-\d{2}-\d{2}/.test(s) || /\w{3}\s+\w{3}\s+\d{1,2}\s+\d{4}/.test(s);
                });
                return matches.length / Math.max(vals.length, 1);
            },
            email: (vals) => vals.filter((v) => /^[\w.+-]+@[\w.-]+\.\w{2,}$/.test(v)).length / Math.max(vals.length, 1),
            phone: (vals) => vals.filter((v) => /^\+?[\d\s\-().]{7,}$/.test(v) && v.replace(/\D/g, '').length >= 7).length / Math.max(vals.length, 1),
            birthProvince: (vals) => {
                const matches = vals.filter((v) => /^[A-Za-z]{2}$/.test(v));
                return vals.length > 0 && matches.length === vals.length ? 0.85 : (matches.length / Math.max(vals.length, 1)) * 0.7;
            },
            docType: (vals) => {
                const codes = ['ident', 'pasor', 'paten', 'pnauz', 'pordf', 'carta identita', "carta d'identita", "carta d'identità", 'passaporto', 'passport', 'patente', 'identity card', 'id card', 'ci', 'driving license'];
                return vals.filter((v) => codes.includes(v.toLowerCase()) || /^[A-Z]{5}$/.test(v)).length / Math.max(vals.length, 1);
            },
            docNumber: (vals) => vals.filter((v) => /^[A-Za-z]{0,2}\d{5,}$/.test(v) || /^[A-Z]{2}\d+[A-Z]*$/i.test(v)).length / Math.max(vals.length, 1),
            guestType: (vals) => {
                const types = ['16', '17', '18', '19', '20', 'ospite singolo', 'capogruppo', 'capofamiglia', 'membro gruppo', 'membro famiglia', 'single guest', 'group leader', 'family head'];
                return vals.filter((v) => types.includes(v.toLowerCase())).length / Math.max(vals.length, 1);
            },
            citizenship: (vals) => {
                const common = ['italia', 'italiano', 'italiana', 'germany', 'germania', 'tedesco', 'tedesca', 'france', 'francia', 'francese', 'spain', 'spagna', 'spagnolo', 'spagnola', 'uk', 'british', 'inglese', 'usa', 'american', 'americano', 'americana', 'romania', 'rumeno', 'rumena', 'poland', 'polonia', 'polacco', 'china', 'cina', 'cinese', 'brazil', 'brasile', 'brasiliano', 'brasiliana', 'albanese', 'albania', 'marocco', 'marocchino', 'marocchina', 'tunisia', 'tunisino', 'tunisina', 'italian', 'french', 'spanish', 'german', 'dutch', 'portuguese', 'swiss', 'austrian', 'belgian', 'svizzera', 'austria', 'belgio'];
                const matches = vals.filter((v) => common.includes(v.toLowerCase().trim()));
                if (matches.length > 0) return matches.length / Math.max(vals.length, 1);
                const unique = new Set(vals.map((v) => v.toLowerCase()));
                const isCountryLike = vals.every((v) => /^[A-Za-zÀ-ÿ\s'-]{2,}$/.test(v) && v.length <= 30);
                return isCountryLike && unique.size <= Math.ceil(vals.length * 0.5) ? 0.4 : 0;
            }
        };

        function looksLikeName(vals) {
            const namePattern = /^[A-ZÀ-ÿ][a-zà-ÿ']+(?:\s+[A-ZÀ-ÿ][a-zà-ÿ']+)*$/;
            const upperPattern = /^[A-ZÀ-ÿ'\s]+$/;
            const matches = vals.filter((v) => namePattern.test(v) || (upperPattern.test(v) && v.length >= 2 && v.length <= 40));
            return matches.length / Math.max(vals.length, 1);
        }

        const scores = {};
        const assigned = new Set();
        for (const [field, detector] of Object.entries(detectors)) {
            scores[field] = {};
            for (const header of headers) scores[field][header] = detector(colValues[header]);
        }

        const result = {};
        const fieldOrder = ['email', 'phone', 'sex', 'docType', 'guestType', 'birthDate', 'birthProvince', 'docNumber', 'citizenship'];
        for (const field of fieldOrder) {
            let bestHeader = '';
            let bestScore = 0.5;
            for (const header of headers) {
                if (assigned.has(header)) continue;
                const score = scores[field]?.[header] || 0;
                if (score > bestScore) {
                    bestScore = score;
                    bestHeader = header;
                }
            }
            if (bestHeader) {
                result[field] = bestHeader;
                assigned.add(bestHeader);
            }
        }

        const nameCandidates = [];
        for (const header of headers) {
            if (assigned.has(header)) continue;
            const score = looksLikeName(colValues[header]);
            if (score >= 0.5) nameCandidates.push({ header, score });
        }
        nameCandidates.sort((a, b) => b.score - a.score);
        if (nameCandidates.length >= 2 && !result.lastName && !result.firstName) {
            const first = nameCandidates[0].header;
            const second = nameCandidates[1].header;
            if (headers.indexOf(first) < headers.indexOf(second)) {
                result.lastName = first;
                result.firstName = second;
            } else {
                result.lastName = second;
                result.firstName = first;
            }
            assigned.add(first);
            assigned.add(second);
        } else if (nameCandidates.length === 1) {
            if (!result.lastName) {
                result.lastName = nameCandidates[0].header;
                assigned.add(nameCandidates[0].header);
            } else if (!result.firstName) {
                result.firstName = nameCandidates[0].header;
                assigned.add(nameCandidates[0].header);
            }
        }

        const locationFields = ['birthComune', 'birthCountry', 'docIssuedPlace'].filter((field) => !result[field]);
        const locationCandidates = [];
        for (const header of headers) {
            if (assigned.has(header)) continue;
            const vals = colValues[header];
            const isTextLike = vals.every((v) => /^[A-Za-zÀ-ÿ\s'-]{2,}$/.test(v));
            if (isTextLike && vals.length > 0) locationCandidates.push(header);
        }
        for (let i = 0; i < Math.min(locationFields.length, locationCandidates.length); i++) {
            result[locationFields[i]] = locationCandidates[i];
            assigned.add(locationCandidates[i]);
        }
        return result;
    }

    function mapXlsxGuestRow(row, mapping) {
        const { parseImportDate } = requireDeps();
        const get = (key) => mapping[key] ? String(row[mapping[key]] || '').trim() : '';
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
            notes: ''
        };
    }

    async function processPdfFile(file) {
        const { showToast, t } = requireDeps();
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
            fullText += content.items.map((item) => item.str).join(' ') + '\n';
        }
        if (fullText.trim().length < 5) {
            showToast(t('toast.pdfNoText'), 'error');
            return;
        }
        processExtractedText(fullText);
    }

    async function processDocxFile(file) {
        const { showToast, t } = requireDeps();
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

    function processExtractedText(text) {
        const { showToast, t } = requireDeps();
        guestFileMode = 'text';
        document.getElementById('extractedTextPreview').textContent = text;
        document.getElementById('textParseSection').style.display = 'block';
        guestFileParsedRows = parseGuestText(text);
        if (guestFileParsedRows.length === 0) showToast(t('toast.noGuestsDetected'), 'error');
        document.getElementById('fileImportPreviewSection').style.display = 'block';
        document.getElementById('fileImportActions').style.display = 'flex';
        renderGuestFilePreview();
    }

    function parseGuestText(text) {
        const tableGuests = tryParseAsTable(text);
        if (tableGuests.length > 0) return tableGuests;
        const blocks = splitIntoGuestBlocks(text);
        const guests = [];
        for (const block of blocks) {
            const guest = parseGuestBlock(block);
            if (guest.firstName || guest.lastName) guests.push(guest);
        }
        return guests.length === 0 ? tryFallbackNameDetection(text) : guests;
    }

    function tryParseAsTable(text) {
        const { parseImportDate } = requireDeps();
        const lines = text.split(/\r?\n/).filter((line) => line.trim());
        if (lines.length < 2) return [];
        let delimiter = null;
        const firstLine = lines[0];
        if ((firstLine.match(/\t/g) || []).length >= 2) delimiter = '\t';
        else if ((firstLine.match(/\s{2,}/g) || []).length >= 2) delimiter = /\s{2,}/;
        if (!delimiter) return [];

        const firstCols = firstLine.split(delimiter).map((header) => header.trim()).filter(Boolean);
        if (firstCols.length < 2) return [];
        const mapping = {};
        for (const field of getGuestImportFields()) {
            const aliases = GUEST_COL_ALIASES[field.key] || [];
            for (const alias of aliases) {
                const idx = firstCols.findIndex((header) => header.toLowerCase().includes(alias));
                if (idx !== -1) {
                    mapping[field.key] = idx;
                    break;
                }
            }
        }

        let dataStartIdx = 1;
        if (!(mapping.firstName || mapping.lastName)) {
            dataStartIdx = 0;
            const sampleRows = lines.slice(0, Math.min(lines.length, 20)).map((line) => line.split(delimiter).map((cell) => cell.trim()));
            const numCols = Math.max(...sampleRows.map((row) => row.length));
            const colVals = [];
            for (let c = 0; c < numCols; c++) colVals[c] = sampleRows.map((row) => row[c] || '').filter(Boolean);
            const assigned = new Set();
            const detectors = {
                sex: (vals) => ['m', 'f', 'male', 'female', 'maschile', 'femminile', 'maschio', 'femmina', '1', '2'].filter((v) => vals.map((x) => x.toLowerCase()).includes(v)).length / Math.max(vals.length, 1),
                birthDate: (vals) => vals.filter((v) => /^(\d{1,2}[\/.\\-]\d{1,2}[\/.\\-]\d{2,4}|\d{4}[\/.\\-]\d{1,2}[\/.\\-]\d{1,2})$/.test(v)).length / Math.max(vals.length, 1),
                email: (vals) => vals.filter((v) => /^[\w.+-]+@[\w.-]+\.\w{2,}$/.test(v)).length / Math.max(vals.length, 1),
                phone: (vals) => vals.filter((v) => /^\+?[\d\s\-().]{7,}$/.test(v) && v.replace(/\D/g, '').length >= 7).length / Math.max(vals.length, 1),
                birthProvince: (vals) => vals.length > 0 && vals.filter((v) => /^[A-Za-z]{2}$/.test(v)).length === vals.length ? 0.85 : 0,
                docType: (vals) => ['ident', 'pasor', 'paten', 'pnauz', 'pordf', 'passaporto', 'passport', 'patente', 'carta identita', "carta d'identita"].filter((v) => vals.map((x) => x.toLowerCase()).includes(v)).length / Math.max(vals.length, 1),
                guestType: (vals) => ['16', '17', '18', '19', '20', 'ospite singolo', 'capogruppo', 'capofamiglia'].filter((v) => vals.map((x) => x.toLowerCase()).includes(v)).length / Math.max(vals.length, 1)
            };
            for (const field of ['email', 'phone', 'sex', 'docType', 'guestType', 'birthDate', 'birthProvince']) {
                let bestIdx = -1;
                let bestScore = 0.5;
                for (let c = 0; c < numCols; c++) {
                    if (assigned.has(c)) continue;
                    const score = detectors[field]?.(colVals[c]) || 0;
                    if (score > bestScore) {
                        bestScore = score;
                        bestIdx = c;
                    }
                }
                if (bestIdx >= 0) {
                    mapping[field] = bestIdx;
                    assigned.add(bestIdx);
                }
            }
            const nameLike = (value) => /^[A-ZÀ-ÿ][a-zà-ÿ']+(?:\s+[A-ZÀ-ÿ][a-zà-ÿ']+)*$/.test(value) || /^[A-ZÀ-ÿ'\s]{2,}$/.test(value);
            const candidates = [];
            for (let c = 0; c < numCols; c++) {
                if (assigned.has(c)) continue;
                const score = colVals[c].filter(nameLike).length / Math.max(colVals[c].length, 1);
                if (score >= 0.5) candidates.push({ idx: c, score });
            }
            candidates.sort((a, b) => b.score - a.score);
            if (candidates.length >= 2) {
                const [a, b] = candidates[0].idx < candidates[1].idx ? [candidates[0], candidates[1]] : [candidates[1], candidates[0]];
                mapping.lastName = a.idx;
                mapping.firstName = b.idx;
            } else if (candidates.length === 1) {
                mapping.lastName = candidates[0].idx;
            }
        }

        if (mapping.firstName === undefined && mapping.lastName === undefined) return [];
        const results = [];
        for (let i = dataStartIdx; i < lines.length; i++) {
            const cols = lines[i].split(delimiter).map((cell) => cell.trim());
            const get = (key) => mapping[key] !== undefined ? (cols[mapping[key]] || '') : '';
            const firstName = get('firstName');
            const lastName = get('lastName');
            if (!firstName && !lastName) continue;
            const birthComune = get('birthComune');
            results.push({
                firstName,
                lastName,
                sex: normalizeSex(get('sex')),
                birthDate: parseImportDate(get('birthDate')) || '',
                birthComune,
                birthProvince: get('birthProvince').toUpperCase().substring(0, 2),
                birthCountry: normalizeBirthCountry(get('birthCountry'), birthComune),
                citizenship: get('citizenship'),
                docType: normalizeDocType(get('docType')),
                docNumber: get('docNumber'),
                docIssuedPlace: get('docIssuedPlace'),
                email: get('email'),
                phone: get('phone'),
                guestType: normalizeGuestType(get('guestType')),
                notes: ''
            });
        }
        return results;
    }

    function splitIntoGuestBlocks(text) {
        const splitters = /(?:^|\n)\s*(?:(?:guest|ospite|alloggiato|persona)\s*(?:#|n[°.]?)?\s*\d+|(?:---+|===+)\s*|\d+\s*[.)]\s*(?:guest|ospite|nome|cognome))/gi;
        const parts = text.split(splitters).filter((part) => part.trim().length > 10);
        if (parts.length > 1) return parts;
        const labelSplit = text.split(/(?=(?:cognome|last\s*name|surname)\s*[:=\-–])/gi).filter((part) => part.trim().length > 5);
        if (labelSplit.length > 1) return labelSplit;
        return [text];
    }

    function parseGuestBlock(block) {
        const { parseImportDate } = requireDeps();
        const guest = {
            firstName: '', lastName: '', sex: '', birthDate: '', birthComune: '', birthProvince: '', birthCountry: '', citizenship: '', docType: '', docNumber: '', docIssuedPlace: '', email: '', phone: '', guestType: '', notes: ''
        };
        const lines = block.split(/\r?\n/);
        for (const line of lines) {
            for (const [field, regex] of Object.entries(KEY_VALUE_PATTERNS)) {
                if (guest[field]) continue;
                const match = line.match(regex);
                if (match) guest[field] = match[1].trim().replace(/[;,]$/, '').trim();
            }
        }
        if (!guest.email) {
            const emailMatch = block.match(/\b[\w.+-]+@[\w.-]+\.\w{2,}\b/);
            if (emailMatch) guest.email = emailMatch[0];
        }
        if (!guest.phone) {
            const phoneMatch = block.match(/(?<![@\w])(\+?\d[\d\s\-().]{7,}\d)(?!\w)/);
            if (phoneMatch) guest.phone = phoneMatch[1].trim();
        }
        guest.sex = normalizeSex(guest.sex);
        guest.birthDate = parseImportDate(guest.birthDate) || '';
        guest.docType = normalizeDocType(guest.docType);
        guest.guestType = normalizeGuestType(guest.guestType);
        guest.birthProvince = guest.birthProvince.toUpperCase().substring(0, 2);
        guest.birthCountry = normalizeBirthCountry(guest.birthCountry, guest.birthComune);
        return guest;
    }

    function tryFallbackNameDetection(text) {
        const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
        const pattern = /^([A-ZÀÁÂÃÄÅÈÉÊËÌÍÎÏÒÓÔÕÖÙÚÛÜÑÇ][a-zàáâãäåèéêëìíîïòóôõöùúûüñç]+)\s+([A-ZÀÁÂÃÄÅÈÉÊËÌÍÎÏÒÓÔÕÖÙÚÛÜÑÇ][a-zàáâãäåèéêëìíîïòóôõöùúûüñç]+(?:\s+[A-ZÀÁÂÃÄÅÈÉÊËÌÍÎÏÒÓÔÕÖÙÚÛÜÑÇ][a-zàáâãäåèéêëìíîïòóôõöùúûüñç]+)?)$/;
        const guests = [];
        for (const line of lines) {
            const match = line.match(pattern);
            if (!match) continue;
            guests.push({
                firstName: match[1],
                lastName: match[2],
                sex: '', birthDate: '', birthComune: '', birthProvince: '', birthCountry: '', citizenship: '', docType: '', docNumber: '', docIssuedPlace: '', email: '', phone: '', guestType: '', notes: ''
            });
        }
        return guests;
    }

    function renderGuestFilePreview() {
        if (guestFileMode === 'text') renderGuestFilePreviewTable(guestFileParsedRows);
    }

    function renderGuestFilePreviewTable(rows) {
        const { escapeHtml, t } = requireDeps();
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
            { key: 'docNumber', label: t('preview.docNo') }
        ];
        let html = '<table><thead><tr>';
        showCols.forEach((col) => { html += `<th>${col.label}</th>`; });
        html += '</tr></thead><tbody>';
        rows.forEach((row) => {
            html += '<tr>';
            showCols.forEach((col) => {
                const value = row[col.key] || '';
                const missing = col.required && !value;
                html += `<td${missing ? ' style="color:var(--red);font-style:italic"' : ''}>${value ? escapeHtml(value) : (missing ? 'missing' : '—')}</td>`;
            });
            html += '</tr>';
        });
        html += '</tbody></table>';
        document.getElementById('guestFilePreviewTable').innerHTML = html;
    }

    async function executeGuestFileImport() {
        const {
            API,
            apiPost,
            apiPut,
            closeModal,
            generateId,
            getAlloggiatiLuoghi,
            getGuests,
            hideLoading,
            lookupAlloggiatiLuogo,
            openGuestsList,
            renderDashboard,
            setGuests,
            showLoading,
            showToast,
            t
        } = requireDeps();
        const reservationId = document.getElementById('fileImportReservationId').value;
        const toImport = guestFileParsedRows.filter((guest) => guest.firstName || guest.lastName);
        if (toImport.length === 0) {
            showToast(t('toast.noValidGuests'), 'error');
            return;
        }
        if (!confirm(t('confirm.importGuests', { n: toImport.length }))) return;
        showLoading(`Importazione ospiti (0 / ${toImport.length})...`);
        let success = 0;
        let errors = 0;
        const importedGuests = [...getGuests()];
        for (const data of toImport) {
            let birthComune = data.birthComune || '';
            let birthProvince = data.birthProvince || '';
            if (birthComune && getAlloggiatiLuoghi()) {
                const entry = lookupAlloggiatiLuogo(birthComune);
                if (entry) {
                    birthComune = entry.code;
                    if (!birthProvince) birthProvince = entry.prov;
                }
            }
            const newGuest = { id: generateId(), reservationId, ...data, birthComune, birthProvince, roomId: '' };
            try {
                await apiPost(API.guests, newGuest);
                importedGuests.push(newGuest);
                success++;
            } catch (error) {
                console.error('Guest import error:', error);
                errors++;
            }
            document.getElementById('loadingMessage').textContent = `Importazione ospiti (${success + errors} / ${toImport.length})...`;
        }
        setGuests(importedGuests);
        closeModal('fileImportModal');
        showToast(`Imported ${success} guest(s)${errors ? ', ' + errors + ' failed' : ''}`);

        const reservationGuests = importedGuests.filter((guest) => guest.reservationId === reservationId);
        const isGroup = reservationGuests.some((guest) => guest.guestType === '17' || guest.guestType === '18');
        if (isGroup || reservationGuests.length > 1) {
            let leaderAssigned = false;
            for (const guest of reservationGuests) {
                if (!leaderAssigned && (guest.guestType === '18' || guest.guestType === '16')) {
                    guest.guestType = '18';
                    leaderAssigned = true;
                } else {
                    guest.guestType = '20';
                }
            }
            try {
                await Promise.all(reservationGuests.map((guest) => apiPut(API.guests, guest)));
            } catch (error) {
                console.error('Guest type normalization error:', error);
            }
        }

        hideLoading();
        openGuestsList(reservationId);
        renderDashboard();
    }

    global.GroupStayGuestImport = {
        init(nextDeps) {
            deps = nextDeps;
        },
        executeGuestFileImport,
        handleGuestFileImport,
        openFileImportModal
    };
})(window);
