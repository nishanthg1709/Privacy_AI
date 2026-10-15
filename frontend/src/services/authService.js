/**
 * PrivacyGuard AI - Authentication Service (Demo Implementation)
 *
 * NOTE: This is an explicitly labeled local demo authentication service.
 * It simulates user registration, login validation, session persistence,
 * and profile retrieval. It is architected so that Supabase Auth, Auth0,
 * or a custom FastAPI/Express backend can replace these methods directly.
 */

const STORAGE_KEY = 'pg_auth_session';
const USERS_STORE_KEY = 'pg_registered_users';

// Demo initial user for testing
const DEMO_DEFAULT_USER = {
  id: 'usr_demo_01',
  name: 'Alex Morgan',
  email: 'alex.morgan@privacyguard.ai',
  organization: 'Cyberdyne Systems (Demo)',
  role: 'Chief Privacy Officer',
  joinedDate: '2026-10-15',
  isDemoAccount: true,
};

class AuthService {
  /**
   * Retrieve currently active user session
   */
  getCurrentUser() {
    try {
      const session = localStorage.getItem(STORAGE_KEY) || sessionStorage.getItem(STORAGE_KEY);
      if (!session) return null;
      return JSON.parse(session);
    } catch {
      return null;
    }
  }

  /**
   * Check if a session exists
   */
  isAuthenticated() {
    return Boolean(this.getCurrentUser());
  }

  /**
   * Authenticate a user with email and password
   */
  async login({ email, password, rememberMe = true }) {
    // Simulate network latency (250ms)
    await new Promise((resolve) => setTimeout(resolve, 250));

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !password) {
      throw new Error('Please provide both your email and password.');
    }

    // Check stored demo users
    const registeredUsers = this._getRegisteredUsers();
    let matchedUser = registeredUsers.find((u) => u.email.toLowerCase() === cleanEmail);

    // If not found in custom registered users, accept demo user or create session for demo email
    if (!matchedUser) {
      if (cleanEmail === DEMO_DEFAULT_USER.email.toLowerCase()) {
        matchedUser = DEMO_DEFAULT_USER;
      } else {
        // In local demo mode, create user object on the fly for ease of review
        matchedUser = {
          id: `usr_${Date.now()}`,
          name: cleanEmail.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
          email: cleanEmail,
          organization: 'Enterprise Workspace (Demo)',
          role: 'Security Engineer',
          joinedDate: new Date().toISOString().split('T')[0],
          isDemoAccount: true,
        };
      }
    }

    this._saveSession(matchedUser, rememberMe);
    return matchedUser;
  }

  /**
   * Register a new user in local demo store
   */
  async signup({ name, email, password, rememberMe = true }) {
    await new Promise((resolve) => setTimeout(resolve, 300));

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();

    if (!cleanName) throw new Error('Please enter your full name.');
    if (!cleanEmail || !cleanEmail.includes('@')) throw new Error('Please enter a valid work email.');
    if (!password || password.length < 8) {
      throw new Error('Password must be at least 8 characters in length.');
    }

    const newUser = {
      id: `usr_${Date.now()}`,
      name: cleanName,
      email: cleanEmail,
      organization: 'Enterprise Workspace (Demo)',
      role: 'Privacy Administrator',
      joinedDate: new Date().toISOString().split('T')[0],
      isDemoAccount: true,
    };

    // Store in registered users list
    const users = this._getRegisteredUsers();
    users.push(newUser);
    try {
      localStorage.setItem(USERS_STORE_KEY, JSON.stringify(users));
    } catch {
      // storage unavailable
    }

    this._saveSession(newUser, rememberMe);
    return newUser;
  }

  /**
   * One-click demo sign in
   */
  async demoLogin() {
    await new Promise((resolve) => setTimeout(resolve, 150));
    this._saveSession(DEMO_DEFAULT_USER, true);
    return DEMO_DEFAULT_USER;
  }

  /**
   * Log out and clear active session
   */
  logout() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // noop
    }
  }

  // --- Private Helpers ---

  _saveSession(user, rememberMe) {
    const data = JSON.stringify(user);
    if (rememberMe) {
      localStorage.setItem(STORAGE_KEY, data);
    } else {
      sessionStorage.setItem(STORAGE_KEY, data);
    }
  }

  _getRegisteredUsers() {
    try {
      const data = localStorage.getItem(USERS_STORE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }
}

export const authService = new AuthService();
export default authService;
