import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '../types';

import api from '../services/api';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (username: string, password?: string) => Promise<void>;
  logout: () => void;
  switchRole: (role: 'IO' | 'SHO' | 'LEGAL_ADVISOR' | 'ADMIN') => void;
}

const mockUsers: Record<string, User> = {
  io_patel: {
    username: 'io_patel',
    full_name: 'PSI Inspector V. K. Patel',
    role: 'IO',
    police_station: 'Surat Cyber Crime HQ'
  },
  sho_sharma: {
    username: 'sho_sharma',
    full_name: 'PI Senior Inspector R. S. Sharma',
    role: 'SHO',
    police_station: 'Surat Cyber Crime HQ'
  },
  legal_desai: {
    username: 'legal_desai',
    full_name: 'Adv. A. M. Desai',
    role: 'LEGAL_ADVISOR',
    police_station: 'State Legal Cell'
  },
  admin_crimeos: {
    username: 'admin_crimeos',
    full_name: 'System Administrator',
    role: 'ADMIN',
    police_station: 'State Cyber Command'
  }
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: mockUsers['io_patel'],
      token: 'mock-jwt-token-io-patel',
      isAuthenticated: true,

      login: async (username: string, password?: string) => {
        try {
          const res = await api.post('/api/auth/login', { username, password });
          if (res.data && res.data.token) {
            set({ token: res.data.token, user: res.data.user, isAuthenticated: true });
            return;
          }
        } catch (err) {
          console.warn('Backend login API fallback to mock user role');
        }
        const found = mockUsers[username] || {
          username,
          full_name: 'PSI Inspector V. K. Patel',
          role: 'IO',
          police_station: 'Surat Cyber Crime HQ'
        };
        set({ token: 'mock-jwt-token-io-patel', user: found, isAuthenticated: true });
      },

      switchRole: (role: 'IO' | 'SHO' | 'LEGAL_ADVISOR' | 'ADMIN') => {
        const userMap = {
          'IO': mockUsers['io_patel'],
          'SHO': mockUsers['sho_sharma'],
          'LEGAL_ADVISOR': mockUsers['legal_desai'],
          'ADMIN': mockUsers['admin_crimeos']
        };
        set({ user: userMap[role] || mockUsers['io_patel'] });
      },

      logout: () => {
        set({ user: null, token: null, isAuthenticated: false });
      }
    }),
    {
      name: 'crime-os-3-auth-storage'
    }
  )
);
