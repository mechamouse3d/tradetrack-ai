import { User } from '../types';

const DB_USERS_KEY = 'trade_track_users_db';
const DELAY_MS = 800; // Simulate network latency

// Helper to simulate API delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const authService = {
  async login(email: string, password: string): Promise<User> {
    await delay(DELAY_MS);
    
    const users = JSON.parse(localStorage.getItem(DB_USERS_KEY) || '[]');
    const user = users.find((u: any) => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
    
    if (!user) {
      throw new Error('Invalid email or password');
    }
    
    // Return user without password
    const { password: _, ...safeUser } = user;
    return safeUser;
  },

  async register(name: string, email: string, password: string): Promise<User> {
    await delay(DELAY_MS);
    
    const users = JSON.parse(localStorage.getItem(DB_USERS_KEY) || '[]');
    
    if (users.find((u: any) => u.email.toLowerCase() === email.toLowerCase())) {
      throw new Error('Account with this email already exists');
    }

    const newUser = {
      id: Math.random().toString(36).substr(2, 9),
      name,
      email,
      password, // In a real app, never store plain text passwords!
      photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&color=fff`
    };

    users.push(newUser);
    localStorage.setItem(DB_USERS_KEY, JSON.stringify(users));

    // Return user without password
    const { password: _, ...safeUser } = newUser;
    return safeUser;
  },

  async loginWithGoogle(): Promise<User> {
    await delay(DELAY_MS);
    // Mock Google User
    return {
      id: 'google_user_12345',
      name: 'Demo User',
      email: 'user@example.com',
      photoURL: 'https://ui-avatars.com/api/?name=Demo+User&background=0D8ABC&color=fff&rounded=true'
    };
  }
};