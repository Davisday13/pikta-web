import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await login(username, password);
    setLoading(false);

    if (result.success) {
      navigate('/');
    } else {
      setError(result.message || 'Credenciales incorrectas');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pikta-bg via-gray-900 to-pikta-bg">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-pikta-accent mb-2">PIK'TA</h1>
          <p className="text-gray-400">Sistema POS de Restaurante</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-pikta-panel rounded-2xl shadow-2xl p-8 space-y-6">
          <h2 className="text-xl font-semibold text-center text-white">Iniciar Sesión</h2>

          {error && (
            <div className="bg-red-900/40 border border-red-500 text-red-300 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Usuario</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-pikta-info focus:ring-1 focus:ring-pikta-info transition"
              placeholder="Ingrese su usuario"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-pikta-info focus:ring-1 focus:ring-pikta-info transition"
              placeholder="Ingrese su contraseña"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-pikta-accent hover:bg-orange-600 text-white font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>

          <div className="text-center text-xs text-gray-500 mt-4">
            <p>Usuarios de prueba:</p>
            <p>admin / admin | Davis / 1234 | cocina / 1234 | mesero / 1234</p>
          </div>
        </form>
      </div>
    </div>
  );
}
