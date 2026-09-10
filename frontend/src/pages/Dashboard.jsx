import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { ShoppingCart, ChefHat, UtensilsCrossed, DollarSign, AlertTriangle, TrendingUp } from 'lucide-react';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ ventas_hoy: 0, total_hoy: 0, pedidos_activos: 0, stock_bajo: 0 });
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [summaryRes, ordersRes] = await Promise.all([
        api.get('/reports/daily-summary'),
        api.get('/orders')
      ]);
      setStats(summaryRes.data.data);
      setRecentOrders(ordersRes.data.data?.slice(0, 5) || []);
    } catch (err) {
      console.error('Error loading dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const quickActions = [
    { label: 'POS (Caja)', icon: ShoppingCart, to: '/pos', color: 'bg-green-600 hover:bg-green-700', roles: ['Administrador', 'Supervisor', 'Cajera'] },
    { label: 'Cocina (KDS)', icon: ChefHat, to: '/kds', color: 'bg-blue-600 hover:bg-blue-700', roles: ['Administrador', 'Supervisor', 'Cocina'] },
    { label: 'Mesero', icon: UtensilsCrossed, to: '/mesero', color: 'bg-purple-600 hover:bg-purple-700', roles: ['Administrador', 'Supervisor', 'Mesero'] },
  ];

  const visibleActions = quickActions.filter(a => !a.roles || a.roles.includes(user?.rol));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-pikta-info animate-pulse text-lg">Cargando dashboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Dashboard</h1>
          <p className="text-gray-400">Bienvenido, {user?.nombre_completo}</p>
        </div>
        <div className="text-sm text-gray-500">
          {new Date().toLocaleDateString('es-PA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-pikta-panel rounded-xl p-5 border-l-4 border-pikta-ok">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Ventas Hoy</p>
              <p className="text-2xl font-bold text-white">{stats.ventas_hoy}</p>
            </div>
            <TrendingUp className="text-pikta-ok" size={32} />
          </div>
        </div>

        <div className="bg-pikta-panel rounded-xl p-5 border-l-4 border-pikta-accent">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Ingresos Hoy</p>
              <p className="text-2xl font-bold text-white">${stats.total_hoy?.toFixed(2)}</p>
            </div>
            <DollarSign className="text-pikta-accent" size={32} />
          </div>
        </div>

        <div className="bg-pikta-panel rounded-xl p-5 border-l-4 border-pikta-info">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Pedidos Activos</p>
              <p className="text-2xl font-bold text-white">{stats.pedidos_activos}</p>
            </div>
            <ChefHat className="text-pikta-info" size={32} />
          </div>
        </div>

        <div className="bg-pikta-panel rounded-xl p-5 border-l-4 border-pikta-err">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Stock Bajo</p>
              <p className="text-2xl font-bold text-white">{stats.stock_bajo}</p>
            </div>
            <AlertTriangle className="text-pikta-err" size={32} />
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-pikta-panel rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Accesos Rápidos</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {visibleActions.map((action) => (
            <button
              key={action.to}
              onClick={() => navigate(action.to)}
              className={`${action.color} text-white rounded-xl p-6 flex flex-col items-center gap-3 transition-colors`}
            >
              <action.icon size={40} />
              <span className="text-lg font-semibold">{action.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Recent Orders */}
      {recentOrders.length > 0 && (
        <div className="bg-pikta-panel rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Pedidos Recientes</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-600 text-gray-400">
                  <th className="text-left py-2">Número</th>
                  <th className="text-left py-2">Mesa</th>
                  <th className="text-left py-2">Estado</th>
                  <th className="text-right py-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => (
                  <tr key={order.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                    <td className="py-2 text-white font-mono">{order.numero}</td>
                    <td className="py-2 text-gray-300">{order.mesa || 'N/A'}</td>
                    <td className="py-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        order.estado === 'RECIBIDO' ? 'bg-yellow-900 text-yellow-300' :
                        order.estado === 'PREPARANDO' ? 'bg-blue-900 text-blue-300' :
                        order.estado === 'LISTO' ? 'bg-green-900 text-green-300' :
                        'bg-gray-700 text-gray-300'
                      }`}>
                        {order.estado}
                      </span>
                    </td>
                    <td className="py-2 text-right text-white font-semibold">${order.total?.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
