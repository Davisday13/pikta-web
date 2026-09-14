import { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { ShoppingCart, Trash2, Plus, Minus, CreditCard, Banknote, Smartphone, Delete, X } from 'lucide-react';

export default function POS() {
  const { user, selectedSucursal } = useAuth();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cashSession, setCashSession] = useState(null);
  const [orderChannel, setOrderChannel] = useState('CAJA');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [metodoPago, setMetodoPago] = useState('');
  const [montoRecibido, setMontoRecibido] = useState('');

  const effectiveSucursalId = user?.rol === 'Administrador' || user?.rol === 'Supervisor'
    ? (selectedSucursal || user?.sucursal_id)
    : user?.sucursal_id;

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const params = {};
      if (effectiveSucursalId) params.sucursal_id = effectiveSucursalId;

      const [prodRes, catRes, cashRes] = await Promise.all([
        api.get('/products', { params }),
        api.get('/products/categories'),
        api.get('/cash/active')
      ]);
      setProducts(prodRes.data.data || []);
      setCategories(catRes.data.data || []);
      if (catRes.data.data?.length) setSelectedCategory(catRes.data.data[0]);
      if (cashRes.data.status === 'success') setCashSession(cashRes.data.data);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(p => p.categoria === selectedCategory && p.disponible);

  const addToCart = (product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, qty: item.qty + 1 } : item);
      }
      return [...prev, { ...product, qty: 1 }];
    });
  };

  const updateQty = (id, delta) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = item.qty + delta;
        return newQty > 0 ? { ...item, qty: newQty } : item;
      }
      return item;
    }).filter(item => item.qty > 0));
  };

  const removeFromCart = (id) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const total = cart.reduce((sum, item) => sum + item.precio * item.qty, 0);

  const cambio = montoRecibido ? Math.max(0, parseFloat(montoRecibido) - total) : 0;

  const openCash = async () => {
    const monto = prompt('Monto inicial en caja:');
    if (monto === null) return;
    try {
      const res = await api.post('/cash/open', {
        usuario_id: user.id,
        monto_inicial: parseFloat(monto) || 0,
        sucursal_id: effectiveSucursalId
      });
      if (res.data.sesion_id) {
        setCashSession({ id: res.data.sesion_id });
        alert('Caja abierta exitosamente');
      }
    } catch (err) {
      alert('Error al abrir caja');
    }
  };

  const openPaymentModal = (metodo) => {
    if (cart.length === 0) return;
    setMetodoPago(metodo);
    setMontoRecibido(metodo === 'EFECTIVO' ? '' : total.toFixed(2));
    setShowPaymentModal(true);
  };

  const handleNumpad = (value) => {
    setMontoRecibido(prev => {
      if (value === 'C') return '';
      if (value === 'B') return prev.slice(0, -1);
      if (value === '.') {
        if (prev.includes('.')) return prev;
        return prev === '' ? '0.' : prev + '.';
      }
      if (prev.includes('.') && prev.split('.')[1].length >= 2) return prev;
      if (prev === '0' && value !== '.') return value;
      return prev + value;
    });
  };

  const processOrder = async () => {
    if (cart.length === 0) return;
    if (metodoPago === 'EFECTIVO' && (!montoRecibido || parseFloat(montoRecibido) < total)) {
      return alert('El monto recibido debe ser mayor o igual al total');
    }

    try {
      const items = cart.map(item => ({
        id: item.id, nombre: item.nombre, precio: item.precio, qty: item.qty
      }));

      if (orderChannel === 'CAJA') {
        await api.post('/orders', {
          items, total, canal: 'CAJA', mesa: 'VENTA DIRECTA',
          usuario_id: user.id, sesion_id: cashSession?.id,
          sucursal_id: effectiveSucursalId
        });
        const ordersRes = await api.get('/orders');
        const latest = ordersRes.data.data?.[0];
        if (latest) {
          await api.post(`/orders/${latest.id}/pay`, { metodo_pago: metodoPago, sesion_id: cashSession?.id });
        }
      } else {
        await api.post('/orders', {
          items, total, canal: 'LLEVAR', mesa: 'PARA LLEVAR',
          usuario_id: user.id, sesion_id: cashSession?.id,
          sucursal_id: effectiveSucursalId
        });
      }

      if (metodoPago === 'EFECTIVO') {
        alert(`Cobro exitoso\nTotal: $${total.toFixed(2)}\nRecibido: $${parseFloat(montoRecibido).toFixed(2)}\nCambio: $${cambio.toFixed(2)}`);
      }

      setCart([]);
      setShowPaymentModal(false);
      setMontoRecibido('');
    } catch (err) {
      alert('Error al procesar pedido');
      console.error(err);
    }
  };

  const closeCash = async () => {
    if (!confirm('¿Cerrar caja?')) return;
    try {
      const res = await api.post('/cash/close', { sesion_id: cashSession?.id });
      const r = res.data.reporte;
      alert(`Caja cerrada\nTotal ventas: $${r.total_ventas}\nEfectivo: $${r.efectivo}\nEn caja: $${r.total_en_caja}`);
      setCashSession(null);
    } catch (err) {
      alert('Error al cerrar caja');
    }
  };

  const handleKeyDown = useCallback((e) => {
    if (!showPaymentModal) return;

    if (e.key >= '0' && e.key <= '9') {
      handleNumpad(e.key);
    } else if (e.key === '.') {
      handleNumpad('.');
    } else if (e.key === 'Backspace') {
      handleNumpad('B');
    } else if (e.key === 'Escape') {
      setShowPaymentModal(false);
    } else if (e.key === 'Enter') {
      processOrder();
    }
  }, [showPaymentModal, montoRecibido, total, cart, metodoPago, orderChannel, cashSession, effectiveSucursalId, cambio]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (loading) return <div className="flex items-center justify-center h-64 text-pikta-info">Cargando...</div>;

  return (
    <div className="h-[calc(100vh-3rem)] flex flex-col">
      {/* Header */}
      <div className="bg-pikta-panel rounded-xl p-4 mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShoppingCart className="text-pikta-accent" size={28} />
          <h1 className="text-2xl font-bold text-white">PUNTO DE VENTA</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-2">
            <button onClick={() => setOrderChannel('CAJA')} className={`px-4 py-2 rounded-lg font-medium transition ${orderChannel === 'CAJA' ? 'bg-pikta-info text-white' : 'bg-gray-600 text-gray-300 hover:bg-gray-500'}`}>
              Consumo Local
            </button>
            <button onClick={() => setOrderChannel('LLEVAR')} className={`px-4 py-2 rounded-lg font-medium transition ${orderChannel === 'LLEVAR' ? 'bg-pikta-accent text-white' : 'bg-gray-600 text-gray-300 hover:bg-gray-500'}`}>
              Para Llevar
            </button>
          </div>
          {!cashSession ? (
            <button onClick={openCash} className="px-4 py-2 bg-pikta-ok text-white rounded-lg font-medium hover:bg-green-600 transition">
              Abrir Caja
            </button>
          ) : (
            <button onClick={closeCash} className="px-4 py-2 bg-pikta-err text-white rounded-lg font-medium hover:bg-red-600 transition">
              Cerrar Caja
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-1 gap-4 min-h-0">
        {/* Products Panel */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Category Tabs */}
          <div className="flex gap-2 mb-4 flex-wrap">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${selectedCategory === cat ? 'bg-pikta-info text-white' : 'bg-pikta-panel text-gray-300 hover:bg-gray-600'}`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Products Grid */}
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 overflow-y-auto flex-1 min-h-[200px] pr-2">
            {filteredProducts.map(product => (
              <div key={product.id} className="bg-pikta-panel rounded-lg p-1.5 flex flex-col items-center text-center hover:ring-2 hover:ring-pikta-info transition cursor-pointer min-h-[90px]" onClick={() => addToCart(product)}>
                {product.imagen_url ? (
                  <img src={product.imagen_url} alt={product.nombre} className="w-10 h-10 rounded object-cover mb-0.5" />
                ) : (
                  <div className="text-lg mb-0.5 leading-none">{product.emoji || '🍽'}</div>
                )}
                <p className="text-white text-[10px] font-semibold leading-tight truncate w-full">{product.nombre}</p>
                <p className="text-pikta-accent text-[10px] font-bold">${product.precio.toFixed(2)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Cart Panel */}
        <div className="w-72 bg-pikta-panel rounded-xl flex flex-col">
          <div className="p-4 border-b border-gray-600">
            <h2 className="text-lg font-bold text-white">ORDEN ACTUAL</h2>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {cart.length === 0 ? (
              <p className="text-gray-500 text-center py-8">Carrito vacío</p>
            ) : (
              cart.map(item => (
                <div key={item.id} className="bg-gray-700/50 rounded-lg p-3 flex items-center gap-3">
                  <div className="flex-1">
                    <p className="text-white text-sm font-medium">{item.nombre}</p>
                    <p className="text-pikta-accent text-sm">${item.precio.toFixed(2)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => updateQty(item.id, -1)} className="w-7 h-7 rounded bg-gray-600 text-white flex items-center justify-center hover:bg-gray-500">
                      <Minus size={14} />
                    </button>
                    <span className="text-white font-bold w-6 text-center">{item.qty}</span>
                    <button onClick={() => updateQty(item.id, 1)} className="w-7 h-7 rounded bg-gray-600 text-white flex items-center justify-center hover:bg-gray-500">
                      <Plus size={14} />
                    </button>
                  </div>
                  <p className="text-white font-semibold w-16 text-right">${(item.precio * item.qty).toFixed(2)}</p>
                  <button onClick={() => removeFromCart(item.id)} className="text-pikta-err hover:text-red-400">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="p-4 border-t border-gray-600">
            <div className="flex justify-between items-center mb-4">
              <span className="text-lg font-bold text-white">TOTAL:</span>
              <span className="text-2xl font-bold text-pikta-accent">${total.toFixed(2)}</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => openPaymentModal('EFECTIVO')}
                disabled={cart.length === 0}
                className="py-3 bg-pikta-ok text-white rounded-lg font-medium hover:bg-green-600 transition disabled:opacity-50 flex flex-col items-center gap-1"
              >
                <Banknote size={20} />
                <span className="text-xs">Efectivo</span>
              </button>
              <button
                onClick={() => openPaymentModal('YAPPY')}
                disabled={cart.length === 0}
                className="py-3 bg-pikta-info text-white rounded-lg font-medium hover:bg-blue-600 transition disabled:opacity-50 flex flex-col items-center gap-1"
              >
                <Smartphone size={20} />
                <span className="text-xs">Yappy</span>
              </button>
              <button
                onClick={() => openPaymentModal('TARJETA')}
                disabled={cart.length === 0}
                className="py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition disabled:opacity-50 flex flex-col items-center gap-1"
              >
                <CreditCard size={20} />
                <span className="text-xs">Tarjeta</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={() => setShowPaymentModal(false)}>
          <div className="bg-pikta-panel rounded-2xl p-6 w-[420px] shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-white">
                {metodoPago === 'EFECTIVO' ? 'COBRO EN EFECTIVO' : metodoPago === 'YAPPY' ? 'COBRO POR YAPPY' : 'COBRO CON TARJETA'}
              </h2>
              <button onClick={() => setShowPaymentModal(false)} className="text-gray-400 hover:text-white">
                <X size={24} />
              </button>
            </div>

            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-400">TOTAL:</span>
                <span className="text-2xl font-bold text-pikta-accent">${total.toFixed(2)}</span>
              </div>
            </div>

            {metodoPago === 'EFECTIVO' && (
              <>
                <div className="mb-4">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-gray-400">RECIBIDO:</span>
                    <span className="text-xl font-bold text-white">${montoRecibido || '0.00'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">CAMBIO:</span>
                    <span className={`text-xl font-bold ${cambio > 0 ? 'text-pikta-ok' : 'text-gray-400'}`}>${cambio.toFixed(2)}</span>
                  </div>
                </div>

                {/* On-screen Numpad */}
                <div className="grid grid-cols-4 gap-2 mb-4">
                  {[
                    { val: '7', label: '7' }, { val: '8', label: '8' }, { val: '9', label: '9' },
                    { val: 'B', label: '⌫', icon: <Delete size={18} /> },
                    { val: '4', label: '4' }, { val: '5', label: '5' }, { val: '6', label: '6' },
                    { val: '', label: '' },
                    { val: '1', label: '1' }, { val: '2', label: '2' }, { val: '3', label: '3' },
                    { val: '', label: '' },
                    { val: '0', label: '0' }, { val: '.', label: '.' }, { val: 'C', label: 'CE' },
                    { val: '', label: '' },
                  ].map((btn, i) => (
                    btn.val === '' ? <div key={i} /> : (
                      <button
                        key={i}
                        onClick={() => handleNumpad(btn.val)}
                        className={`h-12 rounded-lg text-lg font-bold transition active:scale-95 ${
                          btn.val === 'B' ? 'bg-pikta-err/20 text-pikta-err hover:bg-pikta-err/30' :
                          btn.val === 'C' ? 'bg-gray-600 text-gray-300 hover:bg-gray-500' :
                          'bg-gray-700 text-white hover:bg-gray-600'
                        }`}
                      >
                        {btn.icon || btn.label}
                      </button>
                    )
                  ))}
                </div>
              </>
            )}

            {metodoPago !== 'EFECTIVO' && (
              <div className="mb-4 text-center">
                <p className="text-gray-400 text-sm">El cliente debe pagar exactamente</p>
                <p className="text-3xl font-bold text-pikta-accent">${total.toFixed(2)}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowPaymentModal(false)}
                className="flex-1 py-3 bg-gray-600 text-white rounded-lg font-medium hover:bg-gray-500 transition"
              >
                CANCELAR
              </button>
              <button
                onClick={processOrder}
                disabled={metodoPago === 'EFECTIVO' && (!montoRecibido || parseFloat(montoRecibido) < total)}
                className="flex-1 py-3 bg-pikta-ok text-white rounded-lg font-bold text-lg hover:bg-green-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {metodoPago === 'EFECTIVO' ? `COBRAR $${cambio >= 0 && montoRecibido ? (parseFloat(montoRecibido)).toFixed(2) : '0.00'}` : 'CONFIRMAR'}
              </button>
            </div>

            {metodoPago === 'EFECTIVO' && (
              <p className="text-center text-gray-500 text-xs mt-2">Usa el teclado numérico de la PC o haz clic en los botones</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
