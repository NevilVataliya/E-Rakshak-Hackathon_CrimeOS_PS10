import axios from 'axios';

const getBaseUrl = () => {
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return `${window.location.protocol}//${window.location.hostname}:4000`;
  }
  return 'http://localhost:4000';
};

const api = axios.create({
  baseURL: getBaseUrl(),
  timeout: 300000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  try {
    let token: string | null = null;
    const authState = localStorage.getItem('crime-os-3-auth-storage');
    if (authState) {
      const parsed = JSON.parse(authState);
      token = parsed?.state?.token;
    }
    if (token && !token.startsWith('mock-jwt-')) {
      config.headers.Authorization = `Bearer ${token}`;
    } else if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (err) {
    // Ignore error if localStorage parsing fails
  }
  return config;
});

export default api;
