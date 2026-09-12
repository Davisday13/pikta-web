import { useState, useEffect } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { Users, Plus, Pencil, Trash2, X, Save } from 'lucide-react';

const ROLES = ['Administrador', 'Supervisor', 'Cajera', 'Cocina', 'Mesero'];

export default function AdminUsers() {
  const { sucursales } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form, setForm] = useState({ username: '', password: '', rol: 'Mesero', nombre_completo: '', sucursal_id: '' });

  useEffect(() => { loadUsers(); }, []);

  const loadUsers = async () => {
    try {
      const res = await api.get('/users');
      setUsers(res.data.data || []);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditingUser(null);
    setForm({ username: '', password: '', rol: 'Mesero', nombre_completo: '', sucursal_id: sucursales.length > 0 ? sucursales[0].id : '' });
    setShowModal(true);
  };

  const openEdit = (u) => {
    setEditingUser(u);
    setForm({ username: u.username, password: '', rol: u.rol, nombre_completo: u.nombre_completo, sucursal_id: u.sucursal_id || '' });
    setShowModal(true);
  };

  const save = async () => {
    try {
      if (editingUser) {
        const data = { rol: form.rol, nombre_completo: form.nombre_completo, sucursal_id: form.sucursal_id || null };
        if (form.password) data.password = form.password;
        await api.put(`/users/${editingUser.id}`, data);
      } else {
        if (!form.username || !form.password) return alert('Usuario y contraseña requeridos');
        await api.post('/users', form);
      }
      setShowModal(false);
      loadUsers();
    } catch (err) {
      alert(err.response?.data?.message || 'Error al guardar');
    }
  };

  const deleteUser = async (id) => {
    if (!confirm('¿Eliminar este usuario?')) return;
    try {
      await api.delete(`/users/${id}`);
      loadUsers();
    } catch (err) {
      alert('Error al eliminar');
    }
  };

  const getSucursalName = (id) => {
    if (!id) return 'Sin asignar';
    const found = sucursales.find(s => s.id === id);
    return found ? found.nombre : `Sucursal ${id}`;
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-pikta-info">Cargando...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="text-pikta-accent" size={28} />
          <h1 className="text-2xl font-bold text-white">GESTIÓN DE USUARIOS</h1>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-pikta-ok text-white rounded-lg font-medium hover:bg-green-600 transition">
          <Plus size={18} /> Nuevo Usuario
        </button>
      </div>

      <div className="bg-pikta-panel rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-700/50 text-gray-400">
              <th className="text-left px-4 py-3">ID</th>
              <th className="text-left px-4 py-3">Usuario</th>
              <th className="text-left px-4 py-3">Nombre Completo</th>
              <th className="text-left px-4 py-3">Rol</th>
              <th className="text-left px-4 py-3">Sucursal</th>
              <th className="text-right px-4 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="border-t border-gray-700/50 hover:bg-gray-700/30">
                <td className="px-4 py-3 text-gray-400">{u.id}</td>
                <td className="px-4 py-3 text-white font-medium">{u.username}</td>
                <td className="px-4 py-3 text-gray-300">{u.nombre_completo}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    u.rol === 'Administrador' ? 'bg-red-900 text-red-300' :
                    u.rol === 'Supervisor' ? 'bg-purple-900 text-purple-300' :
                    u.rol === 'Cajera' ? 'bg-green-900 text-green-300' :
                    u.rol === 'Cocina' ? 'bg-blue-900 text-blue-300' :
                    'bg-gray-700 text-gray-300'
                  }`}>
                    {u.rol}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-300 text-xs">{getSucursalName(u.sucursal_id)}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => openEdit(u)} className="text-pikta-info hover:text-blue-400 mr-3"><Pencil size={16} /></button>
                  <button onClick={() => deleteUser(u.id)} className="text-pikta-err hover:text-red-400"><Trash2 size={16} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-pikta-panel rounded-xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">{editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Usuario</label>
                <input value={form.username} onChange={e => setForm({...form, username: e.target.value})} disabled={!!editingUser}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white disabled:opacity-50" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">{editingUser ? 'Nueva Contraseña (dejar vacío para no cambiar)' : 'Contraseña'}</label>
                <input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Nombre Completo</label>
                <input value={form.nombre_completo} onChange={e => setForm({...form, nombre_completo: e.target.value})}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Rol</label>
                <select value={form.rol} onChange={e => setForm({...form, rol: e.target.value})}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white">
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Sucursal</label>
                <select value={form.sucursal_id} onChange={e => setForm({...form, sucursal_id: e.target.value ? Number(e.target.value) : ''})}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white">
                  <option value="">Sin asignar</option>
                  {sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500 transition">Cancelar</button>
              <button onClick={save} className="flex-1 py-2 bg-pikta-ok text-white rounded-lg hover:bg-green-600 transition flex items-center justify-center gap-2"><Save size={16} /> Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
