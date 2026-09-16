import { useState, useEffect } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { ChefHat, Clock, CheckCircle, Play, Bell, Printer, Plus } from 'lucide-react';

export default function KDS() {
  const { selectedSucursal } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    loadOrders();
    const interval = setInterval(loadOrders, 5000);
    return () => clearInterval(interval);
  }, [selectedSucursal]);

  const loadOrders = async () => {
    try {
      const params = {};
      if (selectedSucursal) params.sucursal_id = selectedSucursal;
      const res = await api.get('/orders', { params });
      setOrders(res.data.data || []);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (orderId, newStatus) => {
    try {
      await api.put(`/orders/${orderId}`, { estado: newStatus });
      loadOrders();
    } catch (err) {
      alert('Error al actualizar pedido');
    }
  };

  const updateExtraStatus = async (extraId, newStatus) => {
    try {
      await api.put(`/orders/extras/${extraId}`, { estado: newStatus });
      loadOrders();
    } catch (err) {
      alert('Error al actualizar extra');
    }
  };

  const getElapsedTime = (startTime) => {
    if (!startTime) return '--:--';
    const start = new Date(startTime);
    const now = new Date();
    const diff = Math.floor((now - start) / 1000);
    const mins = Math.floor(diff / 60);
    const secs = diff % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const reprintTicket = async (order) => {
    try {
      const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
      await api.post('/print/kitchen', {
        order_id: order.numero || order.id,
        canal: order.canal,
        items, total: order.total
      });
      alert('Ticket reimpreso');
    } catch (err) {
      alert('Error al imprimir: ' + (err.response?.data?.message || err.message));
    }
  };

  const getStatusColor = (status, prepStart) => {
    if (status === 'RECIBIDO') return 'border-l-yellow-500 bg-yellow-900/20';
    if (status === 'PREPARANDO') {
      if (prepStart) {
        const elapsed = (Date.now() - new Date(prepStart).getTime()) / 60000;
        if (elapsed > 15) return 'border-l-red-500 bg-red-900/20';
        if (elapsed > 10) return 'border-l-orange-500 bg-orange-900/20';
      }
      return 'border-l-blue-500 bg-blue-900/20';
    }
    if (status === 'LISTO') return 'border-l-green-500 bg-green-900/20';
    return 'border-l-gray-500 bg-pikta-panel';
  };

  const getFoodItems = (items) => {
    if (!items) return [];
    const arr = Array.isArray(items) ? items : [];
    return arr.filter(item => (item.tipo || 'COMIDA') === 'COMIDA');
  };

  const getAllExtras = (orders) => {
    const result = [];
    for (const order of orders) {
      if (order.extras) {
        for (const extra of order.extras) {
          if (extra.estado !== 'ENTREGADO') {
            result.push({ ...extra, order_numero: order.numero, order_mesa: order.mesa, order_canal: order.canal });
          }
        }
      }
    }
    return result;
  };

  const filteredOrders = orders.filter(o => {
    if (filter === 'all') return true;
    return o.estado === filter;
  });

  const ordersWithFood = filteredOrders.filter(o => {
    const foodItems = getFoodItems(o.items);
    return foodItems.length > 0;
  });

  const allExtras = getAllExtras(orders);
  const pendingExtras = allExtras.filter(e => e.estado !== 'ENTREGADO');

  const countByStatus = {
    RECIBIDO: orders.filter(o => o.estado === 'RECIBIDO').length,
    PREPARANDO: orders.filter(o => o.estado === 'PREPARANDO').length,
    LISTO: orders.filter(o => o.estado === 'LISTO').length,
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-pikta-info">Cargando pedidos...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ChefHat className="text-pikta-accent" size={28} />
          <h1 className="text-2xl font-bold text-white">MONITOR DE COCINA</h1>
        </div>

        <div className="flex gap-3">
          {[
            { key: 'all', label: 'Todos', count: ordersWithFood.length + pendingExtras.length },
            { key: 'RECIBIDO', label: 'Recibidos', count: countByStatus.RECIBIDO },
            { key: 'PREPARANDO', label: 'Preparando', count: countByStatus.PREPARANDO },
            { key: 'LISTO', label: 'Listos', count: countByStatus.LISTO },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition ${
                filter === f.key ? 'bg-pikta-accent text-white' : 'bg-pikta-panel text-gray-300 hover:bg-gray-600'
              }`}
            >
              {f.label} ({f.count})
            </button>
          ))}
        </div>
      </div>

      {/* Extras Section */}
      {pendingExtras.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Plus className="text-pikta-warn" size={20} />
            <h2 className="text-sm font-bold text-pikta-warn">EXTRAS PENDIENTES</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {pendingExtras.map(extra => (
              <div key={extra.id} className={`rounded-xl p-3 border-l-4 ${getStatusColor(extra.estado)} shadow-lg`}>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="text-xs font-bold text-pikta-accent">EXTRA</span>
                    <h3 className="text-sm font-bold text-white font-mono">{extra.order_numero}</h3>
                    <p className="text-xs text-gray-400">{extra.order_mesa}</p>
                  </div>
                </div>
                <div className="space-y-1 mb-3">
                  {(extra.items || []).map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-black/20 rounded-lg px-2 py-1">
                      <div className="flex items-center gap-1">
                        <span className="text-pikta-accent font-bold text-xs">{item.qty || item.cantidad}x</span>
                        <span className="text-white text-xs">{item.nombre}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-1">
                  {extra.estado === 'RECIBIDO' && (
                    <button onClick={() => updateExtraStatus(extra.id, 'PREPARANDO')}
                      className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs flex items-center justify-center gap-1 transition">
                      <Play size={10} /> Iniciar
                    </button>
                  )}
                  {extra.estado === 'PREPARANDO' && (
                    <button onClick={() => updateExtraStatus(extra.id, 'LISTO')}
                      className="flex-1 py-1.5 bg-pikta-ok hover:bg-green-600 text-white rounded-lg text-xs flex items-center justify-center gap-1 transition">
                      <CheckCircle size={10} /> Listo
                    </button>
                  )}
                  {extra.estado === 'LISTO' && (
                    <span className="flex-1 py-1.5 bg-green-800/50 text-green-300 rounded-lg text-xs text-center">
                      ✓ Despachado
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Orders Section */}
      {ordersWithFood.length === 0 && pendingExtras.length === 0 ? (
        <div className="bg-pikta-panel rounded-xl p-12 text-center">
          <ChefHat className="mx-auto text-gray-600 mb-4" size={64} />
          <p className="text-gray-400 text-lg">No hay pedidos {filter !== 'all' ? `con estado "${filter}"` : ''}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {ordersWithFood.map(order => {
            const foodItems = getFoodItems(order.items);
            return (
              <div key={order.id} className={`rounded-xl p-4 border-l-4 ${getStatusColor(order.estado, order.preparacion_inicio)} shadow-lg`}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-lg font-bold text-white font-mono">{order.numero}</h3>
                    <p className="text-sm text-gray-400">{order.mesa || 'N/A'} • {order.canal}</p>
                  </div>
                  {order.preparacion_inicio && order.estado === 'PREPARANDO' && (
                    <div className="flex items-center gap-1 text-pikta-warn">
                      <Clock size={16} />
                      <span className="font-mono text-sm font-bold">{getElapsedTime(order.preparacion_inicio)}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5 mb-4">
                  {foodItems.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-black/20 rounded-lg px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="text-pikta-accent font-bold text-sm">{item.qty || item.cantidad}x</span>
                        <span className="text-white text-sm">{item.nombre}</span>
                      </div>
                      {item.nota && <span className="text-xs text-yellow-400 italic">{item.nota}</span>}
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => reprintTicket(order)}
                    className="py-2 px-3 bg-gray-600 hover:bg-gray-500 text-white rounded-lg font-medium text-sm flex items-center justify-center gap-1 transition"
                    title="Re-imprimir ticket"
                  >
                    <Printer size={14} />
                  </button>
                  {order.estado === 'RECIBIDO' && (
                    <button
                      onClick={() => updateStatus(order.id, 'PREPARANDO')}
                      className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm flex items-center justify-center gap-1 transition"
                    >
                      <Play size={14} /> Iniciar
                    </button>
                  )}
                  {order.estado === 'PREPARANDO' && (
                    <button
                      onClick={() => updateStatus(order.id, 'LISTO')}
                      className="flex-1 py-2 bg-pikta-ok hover:bg-green-600 text-white rounded-lg font-medium text-sm flex items-center justify-center gap-1 transition"
                    >
                      <CheckCircle size={14} /> Listo
                    </button>
                  )}
                  {order.estado === 'LISTO' && (
                    <span className="flex-1 py-2 bg-green-800/50 text-green-300 rounded-lg font-medium text-sm text-center">
                      ✓ Despachado
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
