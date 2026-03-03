const API_URL = process.env.API_URL || 'http://localhost:4000';

export function healthAuthHeaders(): HeadersInit {
  const username = process.env.HEALTH_USERNAME || 'admin';
  const password = process.env.HEALTH_PASSWORD || '';
  if (!password) return {};
  const encoded = Buffer.from(`${username}:${password}`).toString('base64');
  return { Authorization: `Basic ${encoded}` };
}

export function apiHealthUrl(path: string): string {
  return `${API_URL}${path}`;
}
