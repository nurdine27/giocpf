const configured = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
export const API_BASE = `${configured.replace(/\/$/, '')}/api/v1`;
