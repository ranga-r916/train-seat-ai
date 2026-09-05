import axios from 'axios';

const api = axios.create({
  baseURL: '', // Proxied through Vite server configuration
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  }
});

// Request Interceptor: Attach JWT token if logged in
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Response Interceptor: Catch auth errors (e.g. expired tokens)
api.interceptors.response.use((response) => {
  return response;
}, (error) => {
  if (error.response && error.response.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    if (!window.location.pathname.includes('/login') && !window.location.pathname.includes('/register')) {
      window.location.href = '/login';
    }
  }
  return Promise.reject(error);
});

export default api;
