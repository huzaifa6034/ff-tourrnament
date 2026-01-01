
import { User, Tournament } from '../types';

const API_BASE_URL = '/api';

export const CloudflareService = {
  getCurrentUser: (): User | null => {
    const saved = localStorage.getItem('bh_session');
    return saved ? JSON.parse(saved) : null;
  },

  async signUp(userData: any): Promise<User> {
    const response = await fetch(`${API_BASE_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData),
    });
    if (!response.ok) throw new Error('Signup failed');
    const data = await response.json();
    localStorage.setItem('bh_session', JSON.stringify(data.user));
    return data.user;
  },

  async signIn(email: string, pass: string): Promise<User> {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: pass }),
    });
    if (!response.ok) throw new Error('Invalid credentials');
    const data = await response.json();
    localStorage.setItem('bh_session', JSON.stringify(data.user));
    return data.user;
  },

  async logout() {
    localStorage.removeItem('bh_session');
  },

  async getBalance(uid: string): Promise<number> {
    const response = await fetch(`${API_BASE_URL}/user/balance?uid=${uid}`);
    const data = await response.json();
    return data.balance;
  },

  async getMyTournaments(uid: string): Promise<string[]> {
    const response = await fetch(`${API_BASE_URL}/user/my-tournaments?uid=${uid}`);
    if (!response.ok) return [];
    return await response.json();
  },

  async updateBalance(uid: string, amount: number): Promise<boolean> {
    const response = await fetch(`${API_BASE_URL}/user/update-balance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid, amount }),
    });
    return response.ok;
  },

  async joinTournament(uid: string, tournamentId: string, entryFee: number): Promise<boolean> {
    const response = await fetch(`${API_BASE_URL}/tournaments/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid, tournamentId, entryFee }),
    });
    return response.ok;
  },

  async getLeaderboard(): Promise<any[]> {
    const response = await fetch(`${API_BASE_URL}/user/leaderboard`);
    if (!response.ok) return [];
    return await response.json();
  },

  async getTournaments(): Promise<Tournament[]> {
    const response = await fetch(`${API_BASE_URL}/admin/tournaments`);
    if (!response.ok) return [];
    return await response.json();
  },

  async getTournamentParticipants(tournamentId: string): Promise<any[]> {
    const response = await fetch(`${API_BASE_URL}/admin/tournament-participants?tournamentId=${tournamentId}`);
    if (!response.ok) return [];
    return await response.json();
  },

  async adminAddTournament(tournament: Partial<Tournament>): Promise<boolean> {
    const response = await fetch(`${API_BASE_URL}/admin/tournaments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tournament),
    });
    return response.ok;
  },

  async adminDeleteTournament(id: string): Promise<boolean> {
    const response = await fetch(`${API_BASE_URL}/admin/delete-tournament`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    return response.ok;
  },

  async adminGetAllUsers(): Promise<User[]> {
    const response = await fetch(`${API_BASE_URL}/admin/users`);
    if (!response.ok) return [];
    return await response.json();
  },

  async adminUpdateUser(uid: string, data: Partial<User>): Promise<boolean> {
    const response = await fetch(`${API_BASE_URL}/admin/update-user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid, ...data }),
    });
    return response.ok;
  }
};
