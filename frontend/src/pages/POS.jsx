import { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { ShoppingCart, Trash2, Plus, Minus, CreditCard, Banknote, Smartphone, Delete } from 'lucide-react';
import ReceiptModal from '../components/ReceiptModal';

export default function POS() {
  const { user, selectedSucursal } = useAuth();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cashSession, setCashSession] = useState(null);
  const [orderChannel, setOrderChannel] = useState('CAJA');
  const [metodoPago, setMetodoPago] = useState('EFECTIVO');
  const [montoRecibido, setMontoRecibido] = useState('');
  const [receiptData, setReceiptData] = useState(null);

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
  const cambio = montoRecibido && parseFloat(montoRecibido) >= total
    ? parseFloat(montoRecibido) - total : 0;

  const handleNumpad = useCallback((value) => {
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
  }, []);

  const processOrder = useCallback(async () => {
    if (cart.length === 0) return alert('Agrega productos a la orden');
    if (!cashSession) return alert('Abre la caja primero');
    if (metodoPago === 'EFECTIVO' && (!montoRecibido || parseFloat(montoRecibido) < total)) {
      return alert('El monto recibido debe ser mayor o igual al total');
    }

    try {
      const items = cart.map(item => ({
        id: item.id, nombre: item.nombre, precio: item.precio, qty: item.qty,
        cantidad: item.qty, precio_unitario: item.precio
      }));

      let orderId = null;
      if (orderChannel === 'CAJA') {
        await api.post('/orders', {
          items, total, canal: 'CAJA', mesa: 'VENTA DIRECTA',
          usuario_id: user.id, sesion_id: cashSession?.id,
          sucursal_id: effectiveSucursalId
        });
        const ordersRes = await api.get('/orders');
        const latest = ordersRes.data.data?.[0];
        if (latest) {
          orderId = latest.id;
          await api.post(`/orders/${latest.id}/pay`, { metodo_pago: metodoPago, sesion_id: cashSession?.id });
        }
      } else {
        const res = await api.post('/orders', {
          items, total, canal: 'LLEVAR', mesa: 'PARA LLEVAR',
          usuario_id: user.id, sesion_id: cashSession?.id,
          sucursal_id: effectiveSucursalId
        });
        orderId = res.data?.order_id;
      }

      // Auto-print kitchen ticket
      try {
        await api.post('/print/kitchen', {
          order_id: orderId || `POS-${Date.now()}`,
          canal: orderChannel === 'LLEVAR' ? 'LLEVAR' : 'CAJA',
          items, total
        });
      } catch (printErr) {
        console.warn('Print server no disponible:', printErr.message);
      }

      // Auto-print receipt for cash payments
      if (metodoPago === 'EFECTIVO') {
        try {
          await api.post('/print/receipt', {
            order_id: orderId || `POS-${Date.now()}`,
            canal: orderChannel,
            items, total, metodo_pago: metodoPago,
            monto_recibido: parseFloat(montoRecibido),
            cambio
          });
        } catch (printErr) {
          console.warn('Print server no disponible:', printErr.message);
        }
      }

      // Show receipt modal
      setReceiptData({
        order_id: orderId || `POS-${Date.now()}`,
        canal: orderChannel,
        items, total, metodo_pago: metodoPago,
        monto_recibido: metodoPago === 'EFECTIVO' ? parseFloat(montoRecibido) : total,
        cambio: metodoPago === 'EFECTIVO' ? cambio : 0,
        created_at: new Date().toISOString()
      });

      setCart([]);
      setMontoRecibido('');
    } catch (err) {
      alert('Error al procesar pedido');
      console.error(err);
    }
  }, [cart, total, metodoPago, montoRecibido, orderChannel, cashSession, effectiveSucursalId, user, cambio]);

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

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handleNumpad(e.key);
      } else if (e.key === '.') {
        e.preventDefault();
        handleNumpad('.');
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleNumpad('B');
      } else if (e.key === 'Escape') {
        handleNumpad('C');
      } else if (e.key === 'Enter') {
        e.preventDefault();
        processOrder();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNumpad, processOrder]);

  if (loading) return <div className="flex items-center justify-center h-64 text-pikta-info">Cargando...</div>;

  return (
    <div className="h-[calc(100vh-3rem)] flex flex-col">
      <div className="flex flex-1 gap-2 min-h-0">

        {/* LEFT SIDE: Order Detail */}
        <div className="w-[45%] bg-pikta-panel rounded-xl flex flex-col">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-600 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart className="text-pikta-accent" size={18} />
              <h2 className="text-sm font-bold text-white">ORDEN ACTUAL</h2>
            </div>
            <div className="flex gap-1.5">
              <button onClick={() => setOrderChannel('CAJA')} className={`px-3 py-1 rounded text-xs font-medium transition ${orderChannel === 'CAJA' ? 'bg-pikta-info text-white' : 'bg-gray-600 text-gray-300'}`}>
                Local
              </button>
              <button onClick={() => setOrderChannel('LLEVAR')} className={`px-3 py-1 rounded text-xs font-medium transition ${orderChannel === 'LLEVAR' ? 'bg-pikta-accent text-white' : 'bg-gray-600 text-gray-300'}`}>
                Llevar
              </button>
              {!cashSession ? (
                <button onClick={openCash} className="px-3 py-1 bg-pikta-ok text-white rounded text-xs font-medium">Abrir Caja</button>
              ) : (
                <button onClick={closeCash} className="px-3 py-1 bg-pikta-err text-white rounded text-xs font-medium">Cerrar Caja</button>
              )}
            </div>
          </div>

          {/* Table Header */}
          <div className="grid grid-cols-[1fr_60px_80px_70px_30px] gap-1 px-4 py-2 bg-gray-800 text-xs font-bold text-gray-400">
            <span>Producto</span>
            <span className="text-center">Cant.</span>
            <span className="text-right">Precio</span>
            <span className="text-right">Subtotal</span>
            <span></span>
          </div>

          {/* Table Body */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {cart.length === 0 ? (
              <p className="text-gray-500 text-center py-12 text-sm">Agrega productos</p>
            ) : (
              cart.map((item, idx) => (
                <div key={item.id} className={`grid grid-cols-[1fr_60px_80px_70px_30px] gap-1 px-4 py-2.5 items-center text-sm border-b border-gray-700/50 ${idx % 2 === 0 ? 'bg-gray-800/30' : ''}`}>
                  <span className="text-white font-medium truncate">{item.nombre}</span>
                  <div className="flex items-center justify-center gap-1">
                    <button onClick={() => updateQty(item.id, -1)} className="w-5 h-5 rounded bg-gray-600 text-white flex items-center justify-center hover:bg-gray-500 text-[10px]">
                      <Minus size={10} />
                    </button>
                    <span className="text-white font-bold w-4 text-center">{item.qty}</span>
                    <button onClick={() => updateQty(item.id, 1)} className="w-5 h-5 rounded bg-gray-600 text-white flex items-center justify-center hover:bg-gray-500 text-[10px]">
                      <Plus size={10} />
                    </button>
                  </div>
                  <span className="text-gray-300 text-right">${item.precio.toFixed(2)}</span>
                  <span className="text-pikta-accent font-bold text-right">${(item.precio * item.qty).toFixed(2)}</span>
                  <button onClick={() => removeFromCart(item.id)} className="text-pikta-err hover:text-red-400 flex justify-center">
                    <Trash2 size={12} />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Total + Payment buttons */}
          <div className="px-4 py-3 border-t border-gray-600">
            <div className="flex justify-between items-center mb-3">
              <span className="text-lg font-bold text-white">TOTAL:</span>
              <span className="text-2xl font-bold text-pikta-accent">${total.toFixed(2)}</span>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-3">
              <button onClick={() => setMetodoPago('EFECTIVO')} className={`py-2.5 rounded-lg text-xs font-medium transition flex items-center justify-center gap-1 ${metodoPago === 'EFECTIVO' ? 'bg-pikta-ok text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}>
                <Banknote size={14} /> Efectivo
              </button>
              <button onClick={() => setMetodoPago('YAPPY')} className={`py-2.5 rounded-lg text-xs font-medium transition flex items-center justify-center gap-1 ${metodoPago === 'YAPPY' ? 'bg-pikta-info text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}>
                <Smartphone size={14} /> Yappy
              </button>
              <button onClick={() => setMetodoPago('TARJETA')} className={`py-2.5 rounded-lg text-xs font-medium transition flex items-center justify-center gap-1 ${metodoPago === 'TARJETA' ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}>
                <CreditCard size={14} /> Tarjeta
              </button>
            </div>

            <button
              onClick={processOrder}
              disabled={cart.length === 0 || !cashSession || (metodoPago === 'EFECTIVO' && (!montoRecibido || parseFloat(montoRecibido) < total))}
              className="w-full py-3 bg-pikta-ok text-white rounded-lg font-bold text-lg hover:bg-green-600 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {metodoPago === 'EFECTIVO' ? `COBRAR $${total.toFixed(2)}` : 'CONFIRMAR PAGO'}
            </button>
          </div>
        </div>

        {/* RIGHT SIDE: Products + Numpad */}
        <div className="flex-1 flex flex-col gap-2 min-h-0">
          {/* Category Tabs */}
          <div className="flex gap-2 flex-wrap">
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
          <div className="grid grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 overflow-y-auto flex-1 items-start">
            {filteredProducts.map(product => (
              <div key={product.id} className="bg-pikta-panel rounded-xl p-3 flex flex-col items-center text-center hover:ring-2 hover:ring-pikta-info transition cursor-pointer" onClick={() => addToCart(product)}>
                {product.imagen_url ? (
                  <img src={product.imagen_url} alt={product.nombre} className="w-16 h-16 rounded-xl object-cover mb-2" />
                ) : (
                  <div className="text-3xl mb-2">{product.emoji || '🍽'}</div>
                )}
                <p className="text-white text-xs font-semibold leading-tight truncate w-full">{product.nombre}</p>
                <p className="text-pikta-accent text-sm font-bold mt-1">${product.precio.toFixed(2)}</p>
              </div>
            ))}
          </div>

          {/* Numpad Bar at bottom */}
          <div className="bg-pikta-panel rounded-xl p-3">
            {metodoPago === 'EFECTIVO' ? (
              <div className="flex gap-3 items-stretch">
                {/* Recibido / Cambio */}
                <div className="bg-gray-800 rounded-xl p-3 flex flex-col justify-center min-w-[120px]">
                  <div className="mb-1">
                    <p className="text-[10px] text-gray-400">RECIBIDO</p>
                    <p className="text-lg font-bold text-white">${montoRecibido || '0.00'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400">CAMBIO</p>
                    <p className={`text-lg font-bold ${cambio > 0 ? 'text-pikta-ok' : 'text-gray-500'}`}>${cambio.toFixed(2)}</p>
                  </div>
                </div>

                {/* Numpad */}
                <div className="flex-1 grid grid-cols-4 gap-1.5">
                  {[7,8,9].map(n => (
                    <button key={n} onClick={() => handleNumpad(String(n))} className="h-11 rounded-lg text-lg font-bold bg-gray-700 text-white hover:bg-gray-600 active:scale-95 transition">{n}</button>
                  ))}
                  <button onClick={() => handleNumpad('B')} className="h-11 rounded-lg bg-pikta-err/20 text-pikta-err hover:bg-pikta-err/30 active:scale-95 transition flex items-center justify-center"><Delete size={16} /></button>

                  {[4,5,6].map(n => (
                    <button key={n} onClick={() => handleNumpad(String(n))} className="h-11 rounded-lg text-lg font-bold bg-gray-700 text-white hover:bg-gray-600 active:scale-95 transition">{n}</button>
                  ))}
                  <button onClick={() => handleNumpad('C')} className="h-11 rounded-lg text-xs font-bold bg-gray-600 text-gray-300 hover:bg-gray-500 active:scale-95 transition">CE</button>

                  {[1,2,3].map(n => (
                    <button key={n} onClick={() => handleNumpad(String(n))} className="h-11 rounded-lg text-lg font-bold bg-gray-700 text-white hover:bg-gray-600 active:scale-95 transition">{n}</button>
                  ))}
                  <div />

                  <button onClick={() => handleNumpad('0')} className="h-11 rounded-lg text-lg font-bold bg-gray-700 text-white hover:bg-gray-600 active:scale-95 transition col-span-2">0</button>
                  <button onClick={() => handleNumpad('.')} className="h-11 rounded-lg text-lg font-bold bg-gray-700 text-white hover:bg-gray-600 active:scale-95 transition">.</button>
                  <div />
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between px-4">
                <p className="text-gray-400 text-sm">El cliente paga exactamente:</p>
                <p className="text-2xl font-bold text-pikta-accent">${total.toFixed(2)}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {receiptData && (
        <ReceiptModal order={receiptData} onClose={() => setReceiptData(null)} />
      )}
    </div>
  );
}
