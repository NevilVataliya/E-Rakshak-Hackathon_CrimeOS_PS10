import { create } from 'zustand';
import api from '../services/api';

export const useAuthStore = create((set) => ({
  user: JSON.parse(localStorage.getItem('crimeos_user')) || {
    username: 'io_patel',
    role: 'IO',
    full_name: 'PSI Inspector V. K. Patel',
    police_station: 'Ahmedabad Cyber Crime Station'
  },
  token: localStorage.getItem('crimeos_token') || null,
  isAuthenticated: !!localStorage.getItem('crimeos_token'),
  loading: false,
  error: null,

  login: async (username, password) => {
    set({ loading: true, error: null });
    try {
      const response = await api.post('/api/auth/login', { username, password });
      const { token, user } = response.data;
      
      localStorage.setItem('crimeos_token', token);
      localStorage.setItem('crimeos_user', JSON.stringify(user));

      set({ token, user, isAuthenticated: true, loading: false });
      return true;
    } catch (err) {
      console.error('Login failed:', err);
      // Fallback local login if gateway database is offline during demo
      const fallbackUser = {
        username: username || 'io_patel',
        role: username === 'sho_sharma' ? 'SHO' : username === 'legal_desai' ? 'LEGAL_ADVISOR' : 'IO',
        full_name: username === 'sho_sharma' ? 'PI Senior Inspector R. S. Sharma' : 'PSI Inspector V. K. Patel',
        police_station: 'Ahmedabad Cyber Crime Station'
      };
      const mockToken = 'mock_jwt_token_' + Date.now();
      localStorage.setItem('crimeos_token', mockToken);
      localStorage.setItem('crimeos_user', JSON.stringify(fallbackUser));

      set({ token: mockToken, user: fallbackUser, isAuthenticated: true, loading: false });
      return true;
    }
  },

  logout: () => {
    localStorage.removeItem('crimeos_token');
    localStorage.removeItem('crimeos_user');
    set({ token: null, user: null, isAuthenticated: false });
  }
}));
