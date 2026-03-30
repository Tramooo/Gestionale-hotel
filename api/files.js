import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  const sql = neon(process.env.DATABASE_URL);

  try {
    if (req.method === 'GET') {
      const { reservationId } = req.query;
      if (!reservationId) return res.status(400).json({ error: 'reservationId required' });

      const files = await sql`
        SELECT id, reservation_id, file_name, file_type, file_size, uploaded_at
        FROM reservation_files WHERE reservation_id = ${reservationId}
        ORDER BY uploaded_at DESC
      `;
      return res.status(200).json(files.map(f => ({
        id: f.id,
        reservationId: f.reservation_id,
        fileName: f.file_name,
        fileType: f.file_type,
        fileSize: f.file_size,
        uploadedAt: f.uploaded_at
      })));
    }

    if (req.method === 'POST') {
      const { id, reservationId, fileName, fileType, fileSize, fileData } = req.body;
      if (!id || !reservationId || !fileName || !fileData) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
      // Limit ~3MB base64 (roughly 4MB encoded)
      if (fileData.length > 4 * 1024 * 1024) {
        return res.status(413).json({ error: 'File too large (max 3MB)' });
      }
      await sql`
        INSERT INTO reservation_files (id, reservation_id, file_name, file_type, file_size, file_data)
        VALUES (${id}, ${reservationId}, ${fileName}, ${fileType || null}, ${fileSize || 0}, ${fileData})
      `;
      return res.status(201).json({ success: true });
    }

    if (req.method === 'PUT') {
      // Download: return file data
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'id required' });
      const rows = await sql`SELECT file_name, file_type, file_data FROM reservation_files WHERE id = ${id}`;
      if (rows.length === 0) return res.status(404).json({ error: 'File not found' });
      return res.status(200).json({
        fileName: rows[0].file_name,
        fileType: rows[0].file_type,
        fileData: rows[0].file_data
      });
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'id required' });
      await sql`DELETE FROM reservation_files WHERE id = ${id}`;
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Files API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
