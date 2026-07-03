import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { api, ApiError, setUnauthorizedHandler } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [connectionError, setConnectionError] = useState(false);

  const logout = useCallback(() => {
    localStorage.removeItem('access_token');
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
  }, [logout]);

  const verify = useCallback(() => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      setReady(true);
      return;
    }
    // Mark not-ready for the duration of the check (rather than eagerly
    // clearing connectionError up front) so ProtectedRoute's "!ready -> render
    // nothing" branch covers this whole window. Otherwise there's a brief gap
    // — old connectionError cleared, new user/error not set yet — where
    // ProtectedRoute sees "ready, no error, no user" and wrongly redirects to
    // login before this request even resolves (hit this exact race on retry).
    setReady(false);
    api.get('/api/admin/me')
      .then((u) => { setUser(u); setConnectionError(false); })
      .catch((err) => {
        // A real 401 already ran the global onUnauthorized handler (logout()),
        // which cleared the token. Any other failure — network down, 500, etc.
        // — means we simply couldn't verify the token, so don't discard a
        // possibly-still-valid session; just surface a retry screen instead.
        if (!(err instanceof ApiError && err.status === 401)) {
          setConnectionError(true);
        }
      })
      .finally(() => setReady(true));
  }, []);

  useEffect(() => { verify(); }, [verify]);

  const login = useCallback(async (username, password) => {
    const data = await api.login(username, password);
    localStorage.setItem('access_token', data.access_token);
    setUser(data.user);
    return data.user;
  }, []);

  const isSuperOwner = user?.role === 'SUPER_OWNER';

  return (
    <AuthContext.Provider value={{ user, ready, connectionError, retry: verify, login, logout, isSuperOwner }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
