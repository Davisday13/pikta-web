import { useState, useEffect } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { Package, Plus, Pencil, Trash2, X, Save, AlertTriangle } from 'lucide-react';

export default function AdminInventory() {
  const { selectedSucursal, sucursales } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState({ ingrediente: '', cantidad: 0, unidad: 'unidad', stock_minimo: 0, costo_unitario: 0 });
  const [showLowStock, setShowLowStock] = useState(false);

  useEffect(() => { loadItems(); }, [selectedSucursal]);

  const loadItems = async () => {
    setLoading(true);
    try {
      const params = {};
      if (selectedSucursal) params.sucursal_id = selectedSucursal;
      const res = await api.get('/inventory', { params });
      setItems(res.data.data || []);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditingItem(null);
    setForm({ ingrediente: '', cantidad: 0, unidad: 'unidad', stock_minimo: 0, costo_unitario: 0 });
    setShowModal(true);
  };

  const openEdit = (item) => {
    setEditingItem(item);
    setForm({ ingrediente: item.ingrediente, cantidad: item.cantidad, unidad: item.unidad, stock_minimo: item.stock_minimo, costo_unitario: item.costo_unitario || 0 });
    setShowModal(true);
  };

  const save = async () => {
    try {
      if (editingItem) {
        await api.put(`/inventory/${editingItem.id}`, form);
      } else {
        if (!form.ingrediente) return alert('Nombre del ingrediente requerido');
        await api.post('/inventory', form);
      }
      setShowModal(false);
      loadItems();
    } catch (err) {
      alert(err.response?.data?.message || 'Error al guardar');
    }
  };

  const deleteItem = async (id) => {
    if (!confirm('¿Eliminar este item del inventario?')) return;
    try {
      await api.delete(`/inventory/${id}`);
      loadItems();
    } catch (err) {
      alert('Error al eliminar');
    }
  };

  const lowStockItems = items.filter(i => i.stock_minimo > 0 && i.cantidad <= i.stock_minimo);

  const getSucursalLabel = () => {
    if (!selectedSucursal) return 'Todas las sucursales';
    const found = sucursales.find(s => s.id === selectedSucursal);
    return found ? found.nombre : `Sucursal ${selectedSucursal}`;
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-pikta-info">Cargando...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Package className="text-pikta-accent" size={28} />
          <h1 className="text-2xl font-bold text-white">INVENTARIO</h1>
          {lowStockItems.length > 0 && (
            <span className="bg-pikta-err text-white text-xs font-bold px-2 py-1 rounded-full animate-pulse">
              {lowStockItems.length} stock bajo
            </span>
          )}
          {selectedSucursal === null && (
            <span className="text-pikta-accent text-xs font-medium bg-pikta-accent/10 px-2 py-1 rounded">{getSucursalLabel()}</span>
          )}
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowLowStock(!showLowStock)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${showLowStock ? 'bg-pikta-err text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
          >
            <AlertTriangle size={18} /> Stock Bajo
          </button>
          <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-pikta-ok text-white rounded-lg font-medium hover:bg-green-600 transition">
            <Plus size={18} /> Nuevo Item
          </button>
        </div>
      </div>

      {/* Low Stock Alert */}
      {showLowStock && lowStockItems.length > 0 && (
        <div className="bg-red-900/30 border border-red-500 rounded-xl p-4">
          <h3 className="text-red-400 font-bold mb-2">⚠️ Items con Stock Bajo</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {lowStockItems.map(item => (
              <div key={item.id} className="bg-gray-800/50 rounded-lg p-3 flex justify-between">
                <span className="text-white text-sm">{item.ingrediente}</span>
                <span className="text-pikta-err font-bold text-sm">{item.cantidad} {item.unidad}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-pikta-panel rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-700/50 text-gray-400">
              <th className="text-left px-4 py-3">ID</th>
              <th className="text-left px-4 py-3">Ingrediente</th>
              <th className="text-left px-4 py-3">Cantidad</th>
              <th className="text-left px-4 py-3">Unidad</th>
              <th className="text-left px-4 py-3">Stock Mínimo</th>
              <th className="text-left px-4 py-3">Costo Unit.</th>
              <th className="text-right px-4 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => {
              const isLow = item.stock_minimo > 0 && item.cantidad <= item.stock_minimo;
              return (
                <tr key={item.id} className={`border-t border-gray-700/50 hover:bg-gray-700/30 ${isLow ? 'bg-red-900/20' : ''}`}>
                  <td className="px-4 py-3 text-gray-400">{item.id}</td>
                  <td className="px-4 py-3 text-white font-medium">
                    {item.ingrediente}
                    {isLow && <AlertTriangle size={14} className="inline ml-2 text-pikta-err" />}
                  </td>
                  <td className="px-4 py-3 text-gray-300">{item.cantidad}</td>
                  <td className="px-4 py-3 text-gray-300">{item.unidad}</td>
                  <td className="px-4 py-3 text-gray-300">{item.stock_minimo}</td>
                  <td className="px-4 py-3 text-gray-300">${(item.costo_unitario || 0).toFixed(2)}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openEdit(item)} className="text-pikta-info hover:text-blue-400 mr-3"><Pencil size={16} /></button>
                    <button onClick={() => deleteItem(item.id)} className="text-pikta-err hover:text-red-400"><Trash2 size={16} /></button>
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr><td colSpan="7" className="px-4 py-8 text-center text-gray-500">No hay items en el inventario</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-pikta-panel rounded-xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">{editingItem ? 'Editar Item' : 'Nuevo Item'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Ingrediente</label>
                <input value={form.ingrediente} onChange={e => setForm({...form, ingrediente: e.target.value})} disabled={!!editingItem}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white disabled:opacity-50" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Cantidad</label>
                  <input type="number" value={form.cantidad} onChange={e => setForm({...form, cantidad: parseFloat(e.target.value) || 0})}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Unidad</label>
                  <select value={form.unidad} onChange={e => setForm({...form, unidad: e.target.value})}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white">
                    <option value="unidad">Unidad</option>
                    <option value="kg">Kg</option>
                    <option value="litro">Litro</option>
                    <option value="g">Gramos</option>
                    <option value="ml">ml</option>
                    <option value="paquete">Paquete</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Stock Mínimo</label>
                  <input type="number" value={form.stock_minimo} onChange={e => setForm({...form, stock_minimo: parseFloat(e.target.value) || 0})}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Costo Unitario</label>
                  <input type="number" step="0.01" value={form.costo_unitario} onChange={e => setForm({...form, costo_unitario: parseFloat(e.target.value) || 0})}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white" />
                </div>
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
