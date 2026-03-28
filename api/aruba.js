export default async function handler(req, res) {
  const { action } = req.query;
  const AUTH_URL = 'https://auth.fatturazioneelettronica.aruba.it';
  const WS_URL = 'https://ws.fatturazioneelettronica.aruba.it';

  try {
    if (action === 'login' && req.method === 'POST') {
      const { username, password } = req.body;
      const response = await fetch(`${AUTH_URL}/auth/signin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=password&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`
      });
      const data = await response.json();
      if (!response.ok) return res.status(response.status).json(data);
      return res.status(200).json(data);
    }

    if (action === 'refresh' && req.method === 'POST') {
      const { refresh_token } = req.body;
      const response = await fetch(`${AUTH_URL}/auth/signin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refresh_token)}`
      });
      const data = await response.json();
      if (!response.ok) return res.status(response.status).json(data);
      return res.status(200).json(data);
    }

    if (action === 'invoices-received' && req.method === 'GET') {
      const { username, token, page, pageSize } = req.query;
      const params = new URLSearchParams({ username, page: page || '0', pageSize: pageSize || '100' });
      const response = await fetch(`${WS_URL}/services/invoice/in/findByUsername?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok) return res.status(response.status).json(data);
      return res.status(200).json(data);
    }

    if (action === 'invoices-sent' && req.method === 'GET') {
      const { username, token, page, pageSize } = req.query;
      const params = new URLSearchParams({ username, page: page || '0', pageSize: pageSize || '100' });
      const response = await fetch(`${WS_URL}/services/invoice/out/findByUsername?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok) return res.status(response.status).json(data);
      return res.status(200).json(data);
    }

    if (action === 'user-info' && req.method === 'GET') {
      const { token } = req.query;
      const response = await fetch(`${AUTH_URL}/auth/userInfo`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok) return res.status(response.status).json(data);
      return res.status(200).json(data);
    }

    return res.status(400).json({ error: 'Invalid action' });
  } catch (err) {
    console.error('Aruba API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
