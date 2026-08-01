import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '../types';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  login: (username: string) => void;
  logout: () => void;
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
    (set) => ({
      user: mockUsers['io_patel'],
      isAuthenticated: true,

      login: (username: string) => {
        const found = mockUsers[username] || {
          username,
          full_name: 'PSI Inspector V. K. Patel',
          role: 'IO',
          police_station: 'Surat Cyber Crime HQ'
        };
        set({ user: found, isAuthenticated: true });
      },

      logout: () => {
        set({ user: null, isAuthenticated: false });
      }
    }),
    {
      name: 'crime-os-auth-storage'
    }
  )
);
