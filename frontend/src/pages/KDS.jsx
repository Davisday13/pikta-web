import { useState, useEffect } from 'react';
import api from '../api/axios';
import { ChefHat, Clock, CheckCircle, Play, Bell } from 'lucide-react';

export default function KDS() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    loadOrders();
    const interval = setInterval(loadOrders, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadOrders = async () => {
    try {
      const res = await api.get('/orders');
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

  const getElapsedTime = (startTime) => {
    if (!startTime) return '--:--';
    const start = new Date(startTime);
    const now = new Date();
    const diff = Math.floor((now - start) / 1000);
    const mins = Math.floor(diff / 60);
    const secs = diff % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
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

  const filteredOrders = orders.filter(o => {
    if (filter === 'all') return true;
    return o.estado === filter;
  });

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
            { key: 'all', label: 'Todos', count: orders.length },
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

      {filteredOrders.length === 0 ? (
        <div className="bg-pikta-panel rounded-xl p-12 text-center">
          <ChefHat className="mx-auto text-gray-600 mb-4" size={64} />
          <p className="text-gray-400 text-lg">No hay pedidos {filter !== 'all' ? `con estado "${filter}"` : ''}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredOrders.map(order => {
            const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
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
                  {items.map((item, idx) => (
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
