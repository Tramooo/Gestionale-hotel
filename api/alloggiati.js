import { neon } from '@neondatabase/serverless';

const SOAP_URL = 'https://alloggiatiweb.poliziadistato.it/service/service.asmx';
const NS = 'AlloggiatiService';

function soapEnvelope(body) {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:all="${NS}">
  <soap:Header/>
  <soap:Body>${body}</soap:Body>
</soap:Envelope>`;
}

async function soapCall(action, body) {
  const res = await fetch(SOAP_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/soap+xml; charset=utf-8',
      'SOAPAction': `${NS}/${action}`
    },
    body: soapEnvelope(body)
  });
  const text = await res.text();
  return text;
}

function extractTag(xml, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
  const m = xml.match(re);
  return m ? m[1].trim() : '';
}

function extractEsito(xml, resultTag) {
  const block = extractTag(xml, resultTag);
  return {
    esito: extractTag(block, 'esito') === 'true',
    errorCode: extractTag(block, 'ErroreCod'),
    errorDesc: extractTag(block, 'ErroreDes'),
    errorDetail: extractTag(block, 'ErroreDettaglio')
  };
}

function extractAllEsiti(xml) {
  const details = [];
  const re = /<EsitoOperazioneServizio>([\s\S]*?)<\/EsitoOperazioneServizio>/gi;
  let m;
  while ((m = re.exec(xml)) !== null) {
    details.push({
      esito: extractTag(m[1], 'esito') === 'true',
      errorCode: extractTag(m[1], 'ErroreCod'),
      errorDesc: extractTag(m[1], 'ErroreDes'),
      errorDetail: extractTag(m[1], 'ErroreDettaglio')
    });
  }
  return details;
}

// Build a 168-char fixed-width record from guest data
function buildRecord(guest, checkinDate, checkoutDate) {
  const pad = (val, len) => (val || '').toString().substring(0, len).padEnd(len, ' ');
  const padNum = (val, len) => (val || '').toString().substring(0, len).padStart(len, '0');

  // Calculate nights (max 30) — parse as UTC to avoid timezone issues
  const parseUTC = (s) => { const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? new Date(Date.UTC(m[1], m[2]-1, m[3])) : new Date(s); };
  const ci = parseUTC(checkinDate);
  const co = parseUTC(checkoutDate);
  let nights = Math.round((co - ci) / (1000 * 60 * 60 * 24));
  if (nights < 1) nights = 1;
  if (nights > 30) nights = 30;

  // Format dates as dd/mm/yyyy (parse without timezone shift)
  const fmtDate = (dateStr) => {
    if (!dateStr) return '          '; // 10 spaces
    const str = String(dateStr);
    // If it's already YYYY-MM-DD, just reformat
    const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return `${match[3]}/${match[2]}/${match[1]}`;
    // Otherwise parse as Date (UTC)
    const d = new Date(str);
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const yyyy = d.getUTCFullYear();
    return `${dd}/${mm}/${yyyy}`;
  };

  const arrivalDate = fmtDate(checkinDate);
  const birthDate = fmtDate(guest.birthDate);
  const guestType = guest.guestType || '16';
  const isFamily = guestType === '19' || guestType === '20';

  let record = '';
  record += padNum(guestType, 2);               // 0-1:   Tipo Alloggiato (2)
  record += arrivalDate;                          // 2-11:  Data Arrivo (10)
  record += padNum(nights, 2);                    // 12-13: Giorni Permanenza (2)
  record += pad(guest.lastName, 50);              // 14-63: Cognome (50)
  record += pad(guest.firstName, 30);             // 64-93: Nome (30)
  record += pad(guest.sex, 1);                    // 94:    Sesso (1)
  record += birthDate;                            // 95-104: Data Nascita (10)
  record += pad(guest.birthComune, 9);            // 105-113: Comune Nascita (9)
  record += pad(guest.birthProvince, 2);          // 114-115: Provincia Nascita (2)
  record += pad(guest.birthCountry, 9);           // 116-124: Stato Nascita (9)
  record += pad(guest.citizenship, 9);            // 125-133: Cittadinanza (9)

  if (isFamily) {
    record += pad('', 5);                         // 134-138: Tipo Documento (blank)
    record += pad('', 20);                        // 139-158: Numero Documento (blank)
    record += pad('', 9);                         // 159-167: Luogo Rilascio (blank)
  } else {
    record += pad(guest.docType, 5);              // 134-138: Tipo Documento (5)
    record += pad(guest.docNumber, 20);           // 139-158: Numero Documento (20)
    record += pad(guest.docIssuedPlace, 9);       // 159-167: Luogo Rilascio (9)
  }

  return record; // should be exactly 168 chars
}

export default async function handler(req, res) {
  const UTENTE = process.env.ALLOGGIATI_UTENTE;
  const PASSWORD = process.env.ALLOGGIATI_PASSWORD;
  const WSKEY = process.env.ALLOGGIATI_WSKEY;

  if (!UTENTE || !PASSWORD || !WSKEY) {
    return res.status(500).json({ error: 'Alloggiati credentials not configured. Set ALLOGGIATI_UTENTE, ALLOGGIATI_PASSWORD, ALLOGGIATI_WSKEY env vars.' });
  }

  try {
    const { action } = req.query;

    // ---- Generate Token ----
    if (action === 'token') {
      const xml = await soapCall('GenerateToken', `
        <all:GenerateToken>
          <all:Utente>${UTENTE}</all:Utente>
          <all:Password>${PASSWORD}</all:Password>
          <all:WsKey>${WSKEY}</all:WsKey>
        </all:GenerateToken>`);

      const esito = extractEsito(xml, 'result');
      if (!esito.esito) {
        return res.status(400).json({ error: 'Token generation failed', details: esito });
      }

      const tokenBlock = extractTag(xml, 'GenerateTokenResult');
      return res.status(200).json({
        token: extractTag(tokenBlock, 'token'),
        issued: extractTag(tokenBlock, 'issued'),
        expires: extractTag(tokenBlock, 'expires')
      });
    }

    // ---- Build records from reservation guests ----
    if (action === 'build' || action === 'test' || action === 'send') {
      const { reservationId, token } = req.method === 'POST' ? req.body : req.query;

      if (!reservationId) {
        return res.status(400).json({ error: 'reservationId is required' });
      }

      const sql = neon(process.env.DATABASE_URL);

      // Get reservation for dates
      const reservations = await sql`SELECT * FROM reservations WHERE id = ${reservationId}`;
      if (reservations.length === 0) {
        return res.status(404).json({ error: 'Reservation not found' });
      }
      const reservation = reservations[0];

      // Get guests for this reservation
      const guestRows = await sql`SELECT * FROM guests WHERE reservation_id = ${reservationId}`;
      if (guestRows.length === 0) {
        return res.status(400).json({ error: 'No guests found for this reservation' });
      }

      // Map DB rows to camelCase
      const guestsData = guestRows.map(g => ({
        id: g.id,
        firstName: g.first_name,
        lastName: g.last_name,
        sex: g.sex,
        birthDate: g.birth_date,
        birthComune: g.birth_comune,
        birthProvince: g.birth_province,
        birthCountry: g.birth_country,
        citizenship: g.citizenship,
        docType: g.doc_type,
        docNumber: g.doc_number,
        docIssuedPlace: g.doc_issued_place,
        guestType: g.guest_type || '16'
      }));

      // Build fixed-width records
      const records = guestsData.map(g =>
        buildRecord(g, reservation.checkin, reservation.checkout)
      );

      // If just building (preview), return the records
      if (action === 'build') {
        return res.status(200).json({
          records,
          debug: {
            checkinRaw: reservation.checkin,
            checkoutRaw: reservation.checkout,
            checkinType: typeof reservation.checkin,
            record0: records[0],
            recordLength: records[0] ? records[0].length : 0
          },
          guests: guestsData.map(g => ({
            id: g.id,
            name: `${g.firstName} ${g.lastName}`,
            guestType: g.guestType,
            recordLength: buildRecord(g, reservation.checkin, reservation.checkout).length
          }))
        });
      }

      // For test/send we need a token
      if (!token) {
        return res.status(400).json({ error: 'Token is required for test/send. Call ?action=token first.' });
      }

      const methodName = action === 'test' ? 'Test' : 'Send';
      const schedineXml = records.map(r => `<all:string>${r}</all:string>`).join('\n');

      const xml = await soapCall(methodName, `
        <all:${methodName}>
          <all:Utente>${UTENTE}</all:Utente>
          <all:token>${token}</all:token>
          <all:ElencoSchedine>
            ${schedineXml}
          </all:ElencoSchedine>
        </all:${methodName}>`);

      const resultTag = `${methodName}Result`;
      const esito = extractEsito(xml, resultTag);
      const validCount = extractTag(xml, 'SchedineValide');

      // Extract per-row details (skip the first one which is the overall result)
      const allEsiti = extractAllEsiti(xml);
      // The first EsitoOperazioneServizio is the overall result, the rest are per-row in Dettaglio
      const dettaglio = allEsiti.length > 1 ? allEsiti.slice(1) : allEsiti;

      return res.status(200).json({
        success: esito.esito,
        validCount: parseInt(validCount) || 0,
        totalCount: records.length,
        details: dettaglio.map((d, i) => ({
          guestName: guestsData[i] ? `${guestsData[i].firstName} ${guestsData[i].lastName}` : `Row ${i + 1}`,
          ...d
        })),
        overallResult: esito
      });
    }

    // ---- Download receipt ----
    if (action === 'ricevuta') {
      const { token, date } = req.method === 'POST' ? req.body : req.query;

      if (!token || !date) {
        return res.status(400).json({ error: 'token and date are required' });
      }

      const xml = await soapCall('Ricevuta', `
        <all:Ricevuta>
          <all:Utente>${UTENTE}</all:Utente>
          <all:token>${token}</all:token>
          <all:Data>${date}T00:00:00</all:Data>
        </all:Ricevuta>`);

      const esito = extractEsito(xml, 'RicevutaResult');
      if (!esito.esito) {
        return res.status(400).json({ error: 'Receipt download failed', details: esito });
      }

      const pdfBase64 = extractTag(xml, 'PDF');
      return res.status(200).json({
        success: true,
        pdf: pdfBase64
      });
    }

    // ---- Download reference table ----
    if (action === 'tabella') {
      const { token, tipo } = req.query;
      if (!token || !tipo) {
        return res.status(400).json({ error: 'token and tipo are required (Luoghi, Tipi_Documento, Tipi_Alloggiato, TipoErrore, ListaAppartamenti)' });
      }

      const xml = await soapCall('Tabella', `
        <all:Tabella>
          <all:Utente>${UTENTE}</all:Utente>
          <all:token>${token}</all:token>
          <all:tipo>${tipo}</all:tipo>
        </all:Tabella>`);

      const esito = extractEsito(xml, 'TabellaResult');
      if (!esito.esito) {
        return res.status(400).json({ error: 'Table download failed', details: esito });
      }

      const csv = extractTag(xml, 'CSV');
      return res.status(200).json({ success: true, csv });
    }

    return res.status(400).json({ error: 'Invalid action. Use: token, build, test, send, ricevuta, tabella' });

  } catch (err) {
    console.error('Alloggiati API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
