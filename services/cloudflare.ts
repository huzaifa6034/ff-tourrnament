
import { User } from '../types';

/**
 * Cloudflare D1 Service
 * NOTE: Cloudflare D1 ko directly browser se access nahi kiya jata.
 * Aapko ek Cloudflare Worker banana hoga jo backend ka kaam karega.
 * Ye service us Worker ke API endpoints ko call karegi.
 */

const API_BASE_URL = '/api'; // Aapke Cloudflare Worker ka route

export const CloudflareService = {
  // Check if session exists in LocalStorage (Cloudflare doesn't have built-in Auth SDK)
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

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Signup failed');
    }

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

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Invalid credentials');
    }

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

  async updateBalance(uid: string, amount: number): Promise<boolean> {
    const response = await fetch(`${API_BASE_URL}/user/update-balance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid, amount }),
    });
    return response.ok;
  }
};
