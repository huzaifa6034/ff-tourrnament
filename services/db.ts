
import { User } from '../types';

// Ye Service production app ka dil hoti hai. 
// Abhi ye data browser me save kar rahi hai, 
// lekin iska structure bilkul Supabase/Firebase jaisa hai.

const DB_NAME = 'BattleHubDB';
const USERS_KEY = 'bh_users';

export const AuthService = {
  // Simulate network delay for real "Production" feel
  delay: (ms: number) => new Promise(res => setTimeout(res, ms)),

  async signUp(userData: Partial<User>): Promise<{ user?: User; error?: string }> {
    await this.delay(1200);
    const users: User[] = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
    
    if (users.find(u => u.email === userData.email)) {
      return { error: 'Ye email pehle se register hai!' };
    }

    const newUser: User = {
      uid: Math.random().toString(36).substr(2, 9),
      username: userData.username || 'Gamer',
      email: userData.email,
      password: userData.password, // Real prod me hash hoga
      balance: 100,
      matchesPlayed: 0,
      totalEarnings: 0
    };

    users.push(newUser);
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
    return { user: newUser };
  },

  async signIn(email: string, pass: string): Promise<{ user?: User; error?: string }> {
    await this.delay(1000);
    const users: User[] = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
    const user = users.find(u => u.email === email && u.password === pass);

    if (!user) {
      return { error: 'Invalid email or password!' };
    }

    return { user };
  },

  async updateBalance(uid: string, newBalance: number): Promise<boolean> {
    const users: User[] = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
    const index = users.findIndex(u => u.uid === uid);
    if (index !== -1) {
      users[index].balance = newBalance;
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
      return true;
    }
    return false;
  }
};
