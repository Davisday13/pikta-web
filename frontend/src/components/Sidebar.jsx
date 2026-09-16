import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, ShoppingCart, ChefHat, UtensilsCrossed, Users, Package, BarChart3, LogOut, UtensilsCrossed as Utensils, FileText } from 'lucide-react';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', roles: null },
  { to: '/pos', icon: ShoppingCart, label: 'POS (Caja)', roles: ['Administrador', 'Supervisor', 'Cajera'] },
  { to: '/kds', icon: ChefHat, label: 'Cocina (KDS)', roles: ['Administrador', 'Supervisor', 'Cocina'] },
  { to: '/mesero', icon: UtensilsCrossed, label: 'Mesero', roles: ['Administrador', 'Supervisor', 'Mesero'] },
  { to: '/admin/products', icon: Utensils, label: 'Productos', roles: ['Administrador'] },
  { to: '/admin/users', icon: Users, label: 'Usuarios', roles: ['Administrador'] },
  { to: '/admin/inventory', icon: Package, label: 'Inventario', roles: ['Administrador', 'Supervisor'] },
  { to: '/admin/cierre-z', icon: FileText, label: 'Cierre Z', roles: ['Administrador', 'Supervisor'] },
  { to: '/reports', icon: BarChart3, label: 'Reportes', roles: ['Administrador', 'Supervisor'] },
];

export default function Sidebar() {
  const { user, logout, selectedSucursal, setSelectedSucursal, sucursales } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const visibleItems = navItems.filter(item => !item.roles || item.roles.includes(user?.rol));

  const isAdminOrSupervisor = user?.rol === 'Administrador' || user?.rol === 'Supervisor';

  const getSucursalName = (id) => {
    if (!id) return 'Todas las sucursales';
    const found = sucursales.find(s => s.id === id);
    return found ? found.nombre : `Sucursal ${id}`;
  };

  return (
    <aside className="w-64 bg-pikta-panel h-screen flex flex-col fixed left-0 top-0 z-40">
      <div className="p-4 border-b border-gray-600">
        <h1 className="text-2xl font-bold text-pikta-accent">PIK'TA</h1>
        <p className="text-sm text-gray-400">POS Web v1.0</p>
        {isAdminOrSupervisor ? (
          <select
            value={selectedSucursal ?? ''}
            onChange={(e) => setSelectedSucursal(e.target.value === '' ? null : Number(e.target.value))}
            className="mt-2 w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-pikta-accent"
          >
            <option value="">Todas las sucursales</option>
            {sucursales.map(s => (
              <option key={s.id} value={s.id}>{s.nombre}</option>
            ))}
          </select>
        ) : (
          <p className="mt-2 text-sm text-pikta-accent font-medium">{getSucursalName(user?.sucursal_id)}</p>
        )}
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {visibleItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-pikta-accent text-white'
                  : 'text-gray-300 hover:bg-gray-600 hover:text-white'
              }`
            }
          >
            <item.icon size={18} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="p-3 border-t border-gray-600">
        <div className="text-sm text-gray-400 mb-2">
          <span className="font-semibold text-white">{user?.nombre_completo}</span>
          <br />
          <span className="text-xs">{user?.rol}</span>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm font-medium text-pikta-err hover:bg-red-900/30 transition-colors"
        >
          <LogOut size={18} />
          Cerrar Sesión
        </button>
      </div>
    </aside>
  );
}
