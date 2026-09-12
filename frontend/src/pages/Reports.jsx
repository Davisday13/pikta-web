import { useState, useEffect } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { BarChart3, Search, Calendar, DollarSign, ShoppingCart, TrendingUp } from 'lucide-react';

export default function Reports() {
  const { selectedSucursal, sucursales } = useAuth();
  const [sales, setSales] = useState(null);
  const [cashHistory, setCashHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);
  const [tab, setTab] = useState('sales');
  const [selectedClosure, setSelectedClosure] = useState(null);

  useEffect(() => { loadData(); }, [dateFilter, selectedSucursal]);

  const loadData = async () => {
    setLoading(true);
    try {
      const params = { fecha: dateFilter };
      if (selectedSucursal) params.sucursal_id = selectedSucursal;

      const [salesRes, cashRes] = await Promise.all([
        api.get('/reports/sales', { params }),
        api.get('/cash/history', { params: selectedSucursal ? { sucursal_id: selectedSucursal } : {} })
      ]);
      setSales(salesRes.data.data);
      setCashHistory(cashRes.data.data || []);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const viewClosureDetail = async (id) => {
    try {
      const res = await api.get(`/cash/history/${id}`);
      setSelectedClosure(res.data);
    } catch (err) {
      alert('Error al cargar detalle');
    }
  };

  const getSucursalLabel = () => {
    if (!selectedSucursal) return 'Todas las sucursales';
    const found = sucursales.find(s => s.id === selectedSucursal);
    return found ? found.nombre : `Sucursal ${selectedSucursal}`;
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-pikta-info">Cargando reportes...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BarChart3 className="text-pikta-accent" size={28} />
          <h1 className="text-2xl font-bold text-white">REPORTES Y CIERRES</h1>
          <span className="text-pikta-accent text-sm font-medium bg-pikta-accent/10 px-2 py-1 rounded">{getSucursalLabel()}</span>
        </div>
        <div className="flex items-center gap-3">
          <Calendar className="text-gray-400" size={18} />
          <input
            type="date"
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value)}
            className="px-3 py-2 bg-pikta-panel border border-gray-600 rounded-lg text-white"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-3">
        <button onClick={() => setTab('sales')} className={`px-4 py-2 rounded-lg font-medium transition ${tab === 'sales' ? 'bg-pikta-accent text-white' : 'bg-pikta-panel text-gray-300 hover:bg-gray-600'}`}>
          <DollarSign size={16} className="inline mr-1" /> Ventas
        </button>
        <button onClick={() => setTab('closures')} className={`px-4 py-2 rounded-lg font-medium transition ${tab === 'closures' ? 'bg-pikta-accent text-white' : 'bg-pikta-panel text-gray-300 hover:bg-gray-600'}`}>
          <ShoppingCart size={16} className="inline mr-1" /> Cierres de Caja
        </button>
      </div>

      {tab === 'sales' && sales && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-pikta-panel rounded-xl p-5 border-l-4 border-pikta-accent">
              <p className="text-gray-400 text-sm">Total Ventas</p>
              <p className="text-2xl font-bold text-white">${sales.total_ventas?.toFixed(2)}</p>
            </div>
            <div className="bg-pikta-panel rounded-xl p-5 border-l-4 border-pikta-ok">
              <p className="text-gray-400 text-sm">Efectivo</p>
              <p className="text-2xl font-bold text-white">${sales.efectivo?.toFixed(2)}</p>
            </div>
            <div className="bg-pikta-panel rounded-xl p-5 border-l-4 border-pikta-info">
              <p className="text-gray-400 text-sm">Otros Medios</p>
              <p className="text-2xl font-bold text-white">${sales.otros?.toFixed(2)}</p>
            </div>
            <div className="bg-pikta-panel rounded-xl p-5 border-l-4 border-pikta-warn">
              <p className="text-gray-400 text-sm">Total Tickets</p>
              <p className="text-2xl font-bold text-white">{sales.total_tickets}</p>
            </div>
          </div>

          {/* Orders Table */}
          <div className="bg-pikta-panel rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-600">
              <h3 className="font-semibold text-white">Detalle de Ventas - {dateFilter}</h3>
            </div>
            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-700">
                  <tr className="text-gray-400">
                    <th className="text-left px-4 py-2">Número</th>
                    <th className="text-left px-4 py-2">Fecha</th>
                    <th className="text-left px-4 py-2">Mesa</th>
                    <th className="text-left px-4 py-2">Método</th>
                    <th className="text-right px-4 py-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.pedidos?.map(order => (
                    <tr key={order.id} className="border-t border-gray-700/50 hover:bg-gray-700/30">
                      <td className="px-4 py-2 text-white font-mono text-xs">{order.numero}</td>
                      <td className="px-4 py-2 text-gray-300 text-xs">{order.created_at ? new Date(order.created_at).toLocaleString('es-PA') : 'N/A'}</td>
                      <td className="px-4 py-2 text-gray-300">{order.mesa || 'N/A'}</td>
                      <td className="px-4 py-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          order.metodo_pago === 'EFECTIVO' ? 'bg-green-900 text-green-300' :
                          order.metodo_pago === 'YAPPY' ? 'bg-blue-900 text-blue-300' :
                          'bg-indigo-900 text-indigo-300'
                        }`}>
                          {order.metodo_pago || 'N/A'}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right text-white font-semibold">${order.total?.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === 'closures' && (
        <div className="bg-pikta-panel rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-700/50 text-gray-400">
                <th className="text-left px-4 py-3">ID</th>
                <th className="text-left px-4 py-3">Inicio</th>
                <th className="text-left px-4 py-3">Cierre</th>
                <th className="text-left px-4 py-3">Estado</th>
                <th className="text-left px-4 py-3">Monto Inicial</th>
                <th className="text-left px-4 py-3">Total Cierre</th>
                <th className="text-right px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cashHistory.map(s => (
                <tr key={s.id} className="border-t border-gray-700/50 hover:bg-gray-700/30">
                  <td className="px-4 py-3 text-gray-400">{s.id}</td>
                  <td className="px-4 py-3 text-gray-300 text-xs">{s.inicio ? new Date(s.inicio).toLocaleString('es-PA') : 'N/A'}</td>
                  <td className="px-4 py-3 text-gray-300 text-xs">{s.cierre_at ? new Date(s.cierre_at).toLocaleString('es-PA') : 'N/A'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${s.estado === 'ABIERTO' ? 'bg-green-900 text-green-300' : 'bg-gray-700 text-gray-300'}`}>
                      {s.estado}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-300">${(s.inicial || s.monto_apertura || 0).toFixed(2)}</td>
                  <td className="px-4 py-3 text-white font-semibold">${(s.cierre_total || 0).toFixed(2)}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => viewClosureDetail(s.id)} className="text-pikta-info hover:text-blue-400 text-sm">Ver Detalle</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Closure Detail Modal */}
      {selectedClosure && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-pikta-panel rounded-xl p-6 w-full max-w-lg shadow-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">Detalle del Cierre #{selectedClosure.sesion?.id}</h2>
              <button onClick={() => setSelectedClosure(null)} className="text-gray-400 hover:text-white text-xl">&times;</button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-800/50 rounded-lg p-3">
                  <p className="text-xs text-gray-400">Monto Inicial</p>
                  <p className="text-white font-bold">${(selectedClosure.sesion?.inicial || 0).toFixed(2)}</p>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-3">
                  <p className="text-xs text-gray-400">Total Ventas</p>
                  <p className="text-white font-bold">${(selectedClosure.sesion?.cierre_total || 0).toFixed(2)}</p>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-3">
                  <p className="text-xs text-gray-400">Efectivo</p>
                  <p className="text-green-400 font-bold">${(selectedClosure.sesion?.ingresos_efectivo || 0).toFixed(2)}</p>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-3">
                  <p className="text-xs text-gray-400">Otros Medios</p>
                  <p className="text-blue-400 font-bold">${(selectedClosure.sesion?.ingresos_otros || 0).toFixed(2)}</p>
                </div>
              </div>

              {selectedClosure.tickets?.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-400 mt-4 mb-2">Tickets ({selectedClosure.tickets.length})</h3>
                  <div className="space-y-1">
                    {selectedClosure.tickets.map((t, i) => (
                      <div key={i} className="flex justify-between bg-gray-800/30 rounded px-3 py-2 text-sm">
                        <span className="text-gray-300 font-mono">{t.numero}</span>
                        <span className="text-gray-400">{t.metodo_pago}</span>
                        <span className="text-white font-semibold">${t.total?.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
