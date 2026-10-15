import { createContext } from 'react';

/**
 * React Context definition for Authentication
 * Kept in a dedicated file so Fast Refresh only sees components in .jsx files.
 */
export const AuthContext = createContext(null);

export default AuthContext;
