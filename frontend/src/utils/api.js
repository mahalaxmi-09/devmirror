import axios from 'axios';

const RENDER_API_URL = 'https://devmirror-7viq.onrender.com/api';

export function resolveApiBaseUrl() {
  const fromEnv = import.meta.env.VITE_API_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  // Local dev: Vite proxies /api -> http://localhost:5005
  if (import.meta.env.DEV) return '/api';
  // Production: call Render directly (avoids Vercel 30s proxy timeout on cold start)
  return RENDER_API_URL;
}

const API_BASE_URL = resolveApiBaseUrl();

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 90000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === 'ECONNABORTED') {
      error.message = 'Request timed out. The backend may be waking up — wait 30 seconds and try again.';
    } else if (!error.response) {
      error.message = 'Cannot reach the backend. The Render server may be asleep — open the health URL to wake it, then retry.';
    }

    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (window.location.pathname !== '/auth' && window.location.pathname !== '/') {
        window.location.href = '/auth';
      }
    }
    return Promise.reject(error);
  }
);

export async function checkBackendHealth(timeoutMs = 15000) {
  try {
    const res = await api.get('/health', { timeout: timeoutMs });
    return res.data?.status === 'ok';
  } catch {
    return false;
  }
}

export default api;
