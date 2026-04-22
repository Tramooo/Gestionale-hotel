import { requireAuth } from './_auth.js';
import { getSQL } from './_db.js';

const toDateStr = d => d ? new Date(d).toISOString().split('T')[0] : null;

export default async function handler(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return;
  const sql = getSQL();
  const { target } = req.query; // 'certs' or 'docs'

  try {
    // ---- CERTS ----
    if (target === 'certs') {
      if (req.method === 'GET') {
        const { id, includeFile } = req.query;
        if (id && includeFile === '1') {
          const rows = await sql`
            SELECT id, file_name, file_data
            FROM compliance_certs
            WHERE id = ${id} AND owner_user_id = ${user.id}
            LIMIT 1
          `;
          if (rows.length === 0) return res.status(404).json({ error: 'File not found' });
          return res.status(200).json({
            id: rows[0].id,
            fileData: rows[0].file_data || '',
            fileName: rows[0].file_name || ''
          });
        }

        const rows = await sql`
          SELECT id, employee_id, cert_type, issued_date, expiry_date, notes, file_name, created_at,
                 CASE WHEN COALESCE(file_data, '') <> '' THEN TRUE ELSE FALSE END AS has_file
          FROM compliance_certs
          WHERE owner_user_id = ${user.id}
          ORDER BY created_at DESC
        `;
        return res.status(200).json(rows.map(r => ({
          id: r.id,
          employeeId: r.employee_id,
          certType: r.cert_type,
          issuedDate: toDateStr(r.issued_date),
          expiryDate: toDateStr(r.expiry_date),
          notes: r.notes || '',
          fileName: r.file_name || '',
          hasFile: Boolean(r.has_file),
          createdAt: r.created_at
        })));
      }
      if (req.method === 'POST') {
        const c = req.body;
        await sql`
          INSERT INTO compliance_certs (id, owner_user_id, employee_id, cert_type, issued_date, expiry_date, notes, file_data, file_name, created_at)
          VALUES (${c.id}, ${user.id}, ${c.employeeId}, ${c.certType}, ${c.issuedDate || null}, ${c.expiryDate || null}, ${c.notes || ''}, ${c.fileData || ''}, ${c.fileName || ''}, ${c.createdAt})
        `;
        return res.status(201).json({ success: true });
      }
      if (req.method === 'PUT') {
        const c = req.body;
        if (Object.prototype.hasOwnProperty.call(c, 'fileData')) {
          await sql`
            UPDATE compliance_certs SET
              cert_type=${c.certType}, issued_date=${c.issuedDate || null}, expiry_date=${c.expiryDate || null},
              notes=${c.notes || ''}, file_data=${c.fileData || ''}, file_name=${c.fileName || ''}
            WHERE id=${c.id} AND owner_user_id = ${user.id}
          `;
        } else {
          await sql`
            UPDATE compliance_certs SET
              cert_type=${c.certType}, issued_date=${c.issuedDate || null}, expiry_date=${c.expiryDate || null},
              notes=${c.notes || ''}
            WHERE id=${c.id} AND owner_user_id = ${user.id}
          `;
        }
        return res.status(200).json({ success: true });
      }
      if (req.method === 'DELETE') {
        const { id } = req.query;
        await sql`DELETE FROM compliance_certs WHERE id=${id} AND owner_user_id = ${user.id}`;
        return res.status(200).json({ success: true });
      }
    }

    // ---- DOCS ----
    if (target === 'docs') {
      if (req.method === 'GET') {
        const { id, includeFile } = req.query;
        if (id && includeFile === '1') {
          const rows = await sql`
            SELECT id, file_name, file_data
            FROM compliance_docs
            WHERE id = ${id} AND owner_user_id = ${user.id}
            LIMIT 1
          `;
          if (rows.length === 0) return res.status(404).json({ error: 'File not found' });
          return res.status(200).json({
            id: rows[0].id,
            fileData: rows[0].file_data || '',
            fileName: rows[0].file_name || ''
          });
        }

        const rows = await sql`
          SELECT id, doc_type, issued_date, expiry_date, notes, file_name, created_at,
                 CASE WHEN COALESCE(file_data, '') <> '' THEN TRUE ELSE FALSE END AS has_file
          FROM compliance_docs
          WHERE owner_user_id = ${user.id}
          ORDER BY created_at DESC
        `;
        return res.status(200).json(rows.map(r => ({
          id: r.id,
          docType: r.doc_type,
          issuedDate: toDateStr(r.issued_date),
          expiryDate: toDateStr(r.expiry_date),
          notes: r.notes || '',
          fileName: r.file_name || '',
          hasFile: Boolean(r.has_file),
          createdAt: r.created_at
        })));
      }
      if (req.method === 'POST') {
        const d = req.body;
        await sql`
          INSERT INTO compliance_docs (id, owner_user_id, doc_type, issued_date, expiry_date, notes, file_data, file_name, created_at)
          VALUES (${d.id}, ${user.id}, ${d.docType}, ${d.issuedDate || null}, ${d.expiryDate || null}, ${d.notes || ''}, ${d.fileData || ''}, ${d.fileName || ''}, ${d.createdAt})
        `;
        return res.status(201).json({ success: true });
      }
      if (req.method === 'PUT') {
        const d = req.body;
        if (Object.prototype.hasOwnProperty.call(d, 'fileData')) {
          await sql`
            UPDATE compliance_docs SET
              doc_type=${d.docType}, issued_date=${d.issuedDate || null}, expiry_date=${d.expiryDate || null},
              notes=${d.notes || ''}, file_data=${d.fileData || ''}, file_name=${d.fileName || ''}
            WHERE id=${d.id} AND owner_user_id = ${user.id}
          `;
        } else {
          await sql`
            UPDATE compliance_docs SET
              doc_type=${d.docType}, issued_date=${d.issuedDate || null}, expiry_date=${d.expiryDate || null},
              notes=${d.notes || ''}
            WHERE id=${d.id} AND owner_user_id = ${user.id}
          `;
        }
        return res.status(200).json({ success: true });
      }
      if (req.method === 'DELETE') {
        const { id } = req.query;
        await sql`DELETE FROM compliance_docs WHERE id=${id} AND owner_user_id = ${user.id}`;
        return res.status(200).json({ success: true });
      }
    }

    return res.status(400).json({ error: 'target must be certs or docs' });
  } catch (err) {
    console.error('Compliance API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
