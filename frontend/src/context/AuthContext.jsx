import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('pikta_token');
    const savedUser = localStorage.getItem('pikta_user');
    if (token && savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem('pikta_token');
        localStorage.removeItem('pikta_user');
      }
    }
    setLoading(false);
  }, []);

  const login = async (username, password) => {
    const res = await api.post('/login', { username, password });
    if (res.data.status === 'success') {
      localStorage.setItem('pikta_token', res.data.token);
      localStorage.setItem('pikta_user', JSON.stringify(res.data.user));
      setUser(res.data.user);
      return { success: true };
    }
    return { success: false, message: res.data.message };
  };

  const logout = () => {
    localStorage.removeItem('pikta_token');
    localStorage.removeItem('pikta_user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
