import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedSucursal, setSelectedSucursal] = useState(null);
  const [sucursales, setSucursales] = useState([]);

  useEffect(() => {
    const token = localStorage.getItem('pikta_token');
    const savedUser = localStorage.getItem('pikta_user');
    if (token && savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        setUser(parsed);
        setSelectedSucursal(parsed.sucursal_id || null);
        if (parsed.rol === 'Administrador' || parsed.rol === 'Supervisor') {
          loadSucursales();
        }
      } catch {
        localStorage.removeItem('pikta_token');
        localStorage.removeItem('pikta_user');
      }
    }
    setLoading(false);
  }, []);

  const loadSucursales = async () => {
    try {
      const res = await api.get('/users/sucursales');
      setSucursales(res.data.data || []);
    } catch (err) {
      console.error('Error loading sucursales:', err);
    }
  };

  const login = async (username, password) => {
    const res = await api.post('/login', { username, password });
    if (res.data.status === 'success') {
      localStorage.setItem('pikta_token', res.data.token);
      localStorage.setItem('pikta_user', JSON.stringify(res.data.user));
      setUser(res.data.user);
      setSelectedSucursal(res.data.user.sucursal_id || null);
      if (res.data.user.rol === 'Administrador' || res.data.user.rol === 'Supervisor') {
        loadSucursales();
      }
      return { success: true };
    }
    return { success: false, message: res.data.message };
  };

  const logout = () => {
    localStorage.removeItem('pikta_token');
    localStorage.removeItem('pikta_user');
    setUser(null);
    setSelectedSucursal(null);
    setSucursales([]);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, selectedSucursal, setSelectedSucursal, sucursales }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
