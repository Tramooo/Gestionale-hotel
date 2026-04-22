(function initComplianceFeature(global) {
    let deps = null;
    let compCertFileData = '';
    let compCertFileName = '';
    let compDocFileData = '';
    let compDocFileName = '';
    let complianceLoaded = false;
    const filePreviewMap = {};

    function requireDeps() {
        if (!deps) throw new Error('GroupStayCompliance not initialized');
        return deps;
    }

    function certStatus(expiryDate) {
        if (!expiryDate) return 'no-expiry';
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const exp = new Date(expiryDate);
        exp.setHours(0, 0, 0, 0);
        const diff = Math.ceil((exp - today) / (1000 * 60 * 60 * 24));
        if (diff < 0) return 'expired';
        if (diff <= 30) return 'expiring';
        return 'valid';
    }

    function certStatusLabel(status) {
        return {
            expired: 'Scaduto',
            expiring: 'In Scadenza',
            valid: 'Valido',
            'no-expiry': 'Permanente'
        }[status] || '';
    }

    async function ensureComplianceLoaded() {
        const {
            API,
            apiGet,
            setComplianceCerts,
            setComplianceDocs,
            showToast
        } = requireDeps();
        if (complianceLoaded) return;
        try {
            const [certs, docs] = await Promise.all([
                apiGet(API.compliance + '?target=certs').catch(() => []),
                apiGet(API.compliance + '?target=docs').catch(() => [])
            ]);
            setComplianceCerts(certs);
            setComplianceDocs(docs);
            complianceLoaded = true;
        } catch (error) {
            showToast('Errore caricamento compliance', 'error');
        }
    }

    function renderCompliance() {
        ensureComplianceLoaded().then(() => {
            renderComplianceSummary();
            renderComplianceEmpGrid();
            renderComplianceDocList();
        });
    }

    function renderComplianceNow() {
        renderComplianceSummary();
        renderComplianceEmpGrid();
        renderComplianceDocList();
    }

    function renderComplianceSummary() {
        const { getComplianceCerts, getComplianceDocs, getEmployees } = requireDeps();
        let expired = 0;
        let expiring = 0;
        let valid = 0;
        [...getComplianceCerts(), ...getComplianceDocs()].forEach((item) => {
            const status = certStatus(item.expiryDate);
            if (status === 'expired') expired++;
            else if (status === 'expiring') expiring++;
            else if (status === 'valid') valid++;
        });
        document.getElementById('complianceSummary').innerHTML = `
            <div class="compliance-stats">
                <div class="comp-stat-card">
                    <div class="comp-stat-value">${getEmployees().length}</div>
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

    function switchComplianceTab(tab, trigger) {
        document.querySelectorAll('.comp-tab').forEach((button) => button.classList.remove('active'));
        if (trigger) trigger.classList.add('active');
        document.getElementById('compTabDipendenti').style.display = tab === 'dipendenti' ? '' : 'none';
        document.getElementById('compTabStruttura').style.display = tab === 'struttura' ? '' : 'none';
    }

    function renderComplianceEmpGrid() {
        const {
            CERT_TYPES,
            escapeHtml,
            getComplianceCerts,
            getEmployees,
            formatDateDisplay
        } = requireDeps();
        const container = document.getElementById('complianceEmpGrid');
        if (!container) return;
        const employees = getEmployees();
        if (employees.length === 0) {
            container.innerHTML = '<div class="comp-empty">Nessun dipendente trovato. Aggiungi dipendenti dalla sezione Gestione.</div>';
            return;
        }

        let html = '';
        employees.forEach((emp) => {
            const empCerts = getComplianceCerts().filter((cert) => cert.employeeId === emp.id);
            const empName = `${emp.firstName} ${emp.lastName}`;
            const hasAlert = empCerts.some((cert) => {
                const status = certStatus(cert.expiryDate);
                return status === 'expired' || status === 'expiring';
            });

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
                empCerts.forEach((cert) => {
                    const status = certStatus(cert.expiryDate);
                    const label = certStatusLabel(status);
                    const expStr = cert.expiryDate ? formatDateDisplay(cert.expiryDate) : '—';
                    const issuedStr = cert.issuedDate ? formatDateDisplay(cert.issuedDate) : '—';
                    html += `<div class="comp-cert-row">
                        <div class="comp-cert-info">
                            <span class="comp-cert-name">${escapeHtml(CERT_TYPES[cert.certType] || cert.certType)}</span>
                            <span class="comp-cert-dates">Rilascio: ${issuedStr} · Scadenza: ${expStr}</span>
                            ${cert.notes ? `<span class="comp-cert-notes">${escapeHtml(cert.notes)}</span>` : ''}
                        </div>
                        <div class="comp-cert-actions">
                            <span class="comp-cert-badge comp-badge-${status}">${label}</span>
                            ${cert.hasFile ? `<button class="btn btn-ghost btn-sm" title="Anteprima documento" onclick="openFilePreview('certs','${cert.id}')"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>` : ''}
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
        const {
            DOC_TYPES,
            escapeHtml,
            formatDateDisplay,
            getComplianceDocs,
        } = requireDeps();
        const container = document.getElementById('complianceDocList');
        if (!container) return;
        const complianceDocs = getComplianceDocs();
        if (complianceDocs.length === 0) {
            container.innerHTML = '<div class="comp-empty">Nessun documento di struttura registrato.</div>';
            return;
        }
        let html = '<div class="comp-doc-list">';
        complianceDocs.forEach((doc) => {
            const status = certStatus(doc.expiryDate);
            const label = certStatusLabel(status);
            const expStr = doc.expiryDate ? formatDateDisplay(doc.expiryDate) : '—';
            const issuedStr = doc.issuedDate ? formatDateDisplay(doc.issuedDate) : '—';
            html += `<div class="comp-doc-row">
                <div class="comp-cert-info">
                    <span class="comp-cert-name">${escapeHtml(DOC_TYPES[doc.docType] || doc.docType)}</span>
                    <span class="comp-cert-dates">Rilascio: ${issuedStr} · Scadenza: ${expStr}</span>
                    ${doc.notes ? `<span class="comp-cert-notes">${escapeHtml(doc.notes)}</span>` : ''}
                </div>
                <div class="comp-cert-actions">
                    <span class="comp-cert-badge comp-badge-${status}">${label}</span>
                    ${doc.hasFile ? `<button class="btn btn-ghost btn-sm" title="Anteprima documento" onclick="openFilePreview('docs','${doc.id}')"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>` : ''}
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

    function openCompCertModal(certId, employeeId) {
        const { getComplianceCerts, openModal, setDateFieldValue } = requireDeps();
        compCertFileData = '';
        compCertFileName = '';
        const form = document.getElementById('compCertForm');
        form.reset();
        document.getElementById('compCertFileName').textContent = '';

        if (certId) {
            const cert = getComplianceCerts().find((entry) => entry.id === certId);
            if (!cert) return;
            document.getElementById('compCertModalTitle').textContent = 'Modifica Certificato';
            document.getElementById('compCertId').value = cert.id;
            document.getElementById('compCertEmployeeId').value = cert.employeeId;
            document.getElementById('compCertType').value = cert.certType;
            if (cert.issuedDate) setDateFieldValue('compCertIssued', cert.issuedDate);
            if (cert.expiryDate) setDateFieldValue('compCertExpiry', cert.expiryDate);
            document.getElementById('compCertNotes').value = cert.notes || '';
            compCertFileData = undefined;
            compCertFileName = cert.fileName || '';
            if (cert.fileName) document.getElementById('compCertFileName').textContent = cert.fileName;
        } else {
            document.getElementById('compCertModalTitle').textContent = 'Aggiungi Certificato';
            document.getElementById('compCertId').value = '';
            document.getElementById('compCertEmployeeId').value = employeeId;
        }

        openModal('compCertModal');
    }

    function handleCompCertFile(input) {
        const { showToast } = requireDeps();
        const file = input.files[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
            showToast('File troppo grande (max 5MB)', 'error');
            return;
        }
        const reader = new FileReader();
        reader.onload = (event) => {
            compCertFileData = event.target.result;
            compCertFileName = file.name;
            document.getElementById('compCertFileName').textContent = file.name;
        };
        reader.readAsDataURL(file);
    }

    async function saveCompCert(event) {
        const {
            API,
            apiPost,
            apiPut,
            closeModal,
            generateId,
            getComplianceCerts,
            renderCompliance,
            setComplianceCerts,
            showToast
        } = requireDeps();
        event.preventDefault();
        const id = document.getElementById('compCertId').value;
        const data = {
            employeeId: document.getElementById('compCertEmployeeId').value,
            certType: document.getElementById('compCertType').value,
            issuedDate: document.getElementById('compCertIssued').value || null,
            expiryDate: document.getElementById('compCertExpiry').value || null,
            notes: document.getElementById('compCertNotes').value.trim(),
            fileData: compCertFileData,
            fileName: compCertFileName
        };
        try {
            if (id) {
                await apiPut(API.compliance + '?target=certs', { ...data, id });
                const nextCerts = [...getComplianceCerts()];
                const idx = nextCerts.findIndex((cert) => cert.id === id);
                if (idx !== -1) nextCerts[idx] = { ...nextCerts[idx], ...data, hasFile: nextCerts[idx].hasFile || Boolean(compCertFileName) };
                setComplianceCerts(nextCerts);
            } else {
                const newCert = { id: generateId(), ...data, hasFile: Boolean(compCertFileName), createdAt: new Date().toISOString() };
                await apiPost(API.compliance + '?target=certs', newCert);
                setComplianceCerts([...getComplianceCerts(), newCert]);
            }
            closeModal('compCertModal');
            renderComplianceNow();
            showToast('Certificato salvato');
        } catch (error) {
            showToast('Errore salvataggio certificato', 'error');
        }
    }

    async function deleteCompCert(id) {
        const { API, apiDelete, getComplianceCerts, renderCompliance, setComplianceCerts, showConfirmDialog, showToast } = requireDeps();
        if (!await showConfirmDialog('Eliminare questo certificato?', {
            title: 'Conferma',
            confirmLabel: 'Elimina',
            cancelLabel: 'Annulla',
            intent: 'danger'
        })) return;
        await apiDelete(API.compliance + '?target=certs', id);
        setComplianceCerts(getComplianceCerts().filter((cert) => cert.id !== id));
        renderComplianceNow();
        showToast('Certificato eliminato');
    }

    function openCompDocModal(docId) {
        const { getComplianceDocs, openModal, setDateFieldValue } = requireDeps();
        compDocFileData = '';
        compDocFileName = '';
        const form = document.getElementById('compDocForm');
        form.reset();
        document.getElementById('compDocFileName').textContent = '';

        if (docId) {
            const doc = getComplianceDocs().find((entry) => entry.id === docId);
            if (!doc) return;
            document.getElementById('compDocModalTitle').textContent = 'Modifica Documento';
            document.getElementById('compDocId').value = doc.id;
            document.getElementById('compDocType').value = doc.docType;
            if (doc.issuedDate) setDateFieldValue('compDocIssued', doc.issuedDate);
            if (doc.expiryDate) setDateFieldValue('compDocExpiry', doc.expiryDate);
            document.getElementById('compDocNotes').value = doc.notes || '';
            compDocFileData = undefined;
            compDocFileName = doc.fileName || '';
            if (doc.fileName) document.getElementById('compDocFileName').textContent = doc.fileName;
        } else {
            document.getElementById('compDocModalTitle').textContent = 'Aggiungi Documento';
            document.getElementById('compDocId').value = '';
        }

        openModal('compDocModal');
    }

    function handleCompDocFile(input) {
        const { showToast } = requireDeps();
        const file = input.files[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
            showToast('File troppo grande (max 5MB)', 'error');
            return;
        }
        const reader = new FileReader();
        reader.onload = (event) => {
            compDocFileData = event.target.result;
            compDocFileName = file.name;
            document.getElementById('compDocFileName').textContent = file.name;
        };
        reader.readAsDataURL(file);
    }

    async function saveCompDoc(event) {
        const {
            API,
            apiPost,
            apiPut,
            closeModal,
            generateId,
            getComplianceDocs,
            renderCompliance,
            setComplianceDocs,
            showToast
        } = requireDeps();
        event.preventDefault();
        const id = document.getElementById('compDocId').value;
        const data = {
            docType: document.getElementById('compDocType').value,
            issuedDate: document.getElementById('compDocIssued').value || null,
            expiryDate: document.getElementById('compDocExpiry').value || null,
            notes: document.getElementById('compDocNotes').value.trim(),
            fileData: compDocFileData,
            fileName: compDocFileName
        };
        try {
            if (id) {
                await apiPut(API.compliance + '?target=docs', { ...data, id });
                const nextDocs = [...getComplianceDocs()];
                const idx = nextDocs.findIndex((doc) => doc.id === id);
                if (idx !== -1) nextDocs[idx] = { ...nextDocs[idx], ...data, hasFile: nextDocs[idx].hasFile || Boolean(compDocFileName) };
                setComplianceDocs(nextDocs);
            } else {
                const newDoc = { id: generateId(), ...data, hasFile: Boolean(compDocFileName), createdAt: new Date().toISOString() };
                await apiPost(API.compliance + '?target=docs', newDoc);
                setComplianceDocs([...getComplianceDocs(), newDoc]);
            }
            closeModal('compDocModal');
            renderComplianceNow();
            showToast('Documento salvato');
        } catch (error) {
            showToast('Errore salvataggio documento', 'error');
        }
    }

    async function deleteCompDoc(id) {
        const { API, apiDelete, getComplianceDocs, renderCompliance, setComplianceDocs, showConfirmDialog, showToast } = requireDeps();
        if (!await showConfirmDialog('Eliminare questo documento?', {
            title: 'Conferma',
            confirmLabel: 'Elimina',
            cancelLabel: 'Annulla',
            intent: 'danger'
        })) return;
        await apiDelete(API.compliance + '?target=docs', id);
        setComplianceDocs(getComplianceDocs().filter((doc) => doc.id !== id));
        renderComplianceNow();
        showToast('Documento eliminato');
    }

    async function openFilePreview(target, key) {
        const { API, apiGet, escapeHtml, showToast } = requireDeps();
        let file = filePreviewMap[`${target}:${key}`];
        if (!file?.fileData) {
            try {
                file = await apiGet(`${API.compliance}?target=${target}&id=${key}&includeFile=1`);
                filePreviewMap[`${target}:${key}`] = file;
            } catch (error) {
                showToast('Errore caricamento file', 'error');
                return;
            }
        }
        const { fileData, fileName } = file || {};
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
        window.GroupStayUI?.syncModalState?.();
    }

    function closeFilePreview() {
        document.getElementById('filePreviewOverlay').style.display = 'none';
        document.getElementById('filePreviewContent').innerHTML = '';
        window.GroupStayUI?.syncModalState?.();
    }

    function exportCompliancePDF() {
        const {
            CERT_TYPES,
            DOC_TYPES,
            escapeHtml,
            formatDate,
            getComplianceCerts,
            getComplianceDocs,
            getEmployees
        } = requireDeps();
        const today = new Date().toLocaleDateString('it-IT');

        const statusBadge = (status) => ({
            expired: '<span style="color:#c0392b;font-weight:700">● Scaduto</span>',
            expiring: '<span style="color:#e67e22;font-weight:700">● In Scadenza</span>',
            valid: '<span style="color:#27ae60;font-weight:700">● Valido</span>',
            'no-expiry': '<span style="color:#555">● Permanente</span>'
        }[status] || '');

        let empRows = '';
        getEmployees().forEach((employee) => {
            const empCerts = getComplianceCerts().filter((cert) => cert.employeeId === employee.id);
            if (empCerts.length === 0) {
                empRows += `<tr><td>${escapeHtml(employee.lastName)} ${escapeHtml(employee.firstName)}</td><td>${escapeHtml(employee.role || '')}</td><td colspan="4" style="color:#aaa;font-style:italic">Nessun certificato registrato</td></tr>`;
            } else {
                empCerts.forEach((cert, index) => {
                    const status = certStatus(cert.expiryDate);
                    empRows += `<tr>
                        ${index === 0 ? `<td rowspan="${empCerts.length}">${escapeHtml(employee.lastName)} ${escapeHtml(employee.firstName)}</td><td rowspan="${empCerts.length}">${escapeHtml(employee.role || '')}</td>` : ''}
                        <td>${escapeHtml(CERT_TYPES[cert.certType] || cert.certType)}</td>
                        <td>${cert.issuedDate ? new Date(cert.issuedDate).toLocaleDateString('it-IT') : '—'}</td>
                        <td>${cert.expiryDate ? new Date(cert.expiryDate).toLocaleDateString('it-IT') : '—'}</td>
                        <td>${statusBadge(status)}</td>
                    </tr>`;
                });
            }
        });

        const docRows = getComplianceDocs().map((doc) => {
            const status = certStatus(doc.expiryDate);
            return `<tr>
                <td>${escapeHtml(DOC_TYPES[doc.docType] || doc.docType)}</td>
                <td>${doc.issuedDate ? new Date(doc.issuedDate).toLocaleDateString('it-IT') : '—'}</td>
                <td>${doc.expiryDate ? new Date(doc.expiryDate).toLocaleDateString('it-IT') : '—'}</td>
                <td>${statusBadge(status)}</td>
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

    global.GroupStayCompliance = {
        certStatus,
        certStatusLabel,
        closeFilePreview,
        deleteCompCert,
        deleteCompDoc,
        exportCompliancePDF,
        handleCompCertFile,
        handleCompDocFile,
        init(nextDeps) {
            deps = nextDeps;
        },
        openFilePreview,
        openCompCertModal,
        openCompDocModal,
        renderCompliance,
        renderComplianceNow,
        renderComplianceDocList,
        renderComplianceEmpGrid,
        renderComplianceSummary,
        saveCompCert,
        saveCompDoc,
        switchComplianceTab
    };
})(window);
