import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { ShoppingCart, Trash2, Plus, Minus, CreditCard, Banknote, Smartphone, Delete, ClipboardList, Send } from 'lucide-react';
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

  const [view, setView] = useState('venta');
  const [pendingOrders, setPendingOrders] = useState([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showExtraProducts, setShowExtraProducts] = useState(false);
  const [extraCategory, setExtraCategory] = useState('');
  const [extraCart, setExtraCart] = useState([]);

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
      if (catRes.data.data?.length) {
        setSelectedCategory(catRes.data.data[0]);
        setExtraCategory(catRes.data.data[0]);
      }
      if (cashRes.data.status === 'success') setCashSession(cashRes.data.data);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadPendingOrders = async () => {
    setLoadingPending(true);
    try {
      const params = {};
      if (effectiveSucursalId) params.sucursal_id = effectiveSucursalId;
      const res = await api.get('/orders/pending', { params });
      setPendingOrders(res.data.data || []);
      if (selectedOrder) {
        const updated = res.data.data?.find(o => o.id === selectedOrder.id);
        if (updated) setSelectedOrder(updated);
      }
    } catch (err) {
      console.error('Error loading pending orders:', err);
    } finally {
      setLoadingPending(false);
    }
  };

  useEffect(() => {
    if (view === 'pendientes') loadPendingOrders();
  }, [view]);

  useEffect(() => {
    if (view === 'pendientes') {
      const interval = setInterval(loadPendingOrders, 10000);
      return () => clearInterval(interval);
    }
  }, [view, effectiveSucursalId]);

  const filteredProducts = products.filter(p => p.categoria === selectedCategory && p.disponible);
  const filteredExtraProducts = products.filter(p => p.categoria === extraCategory && p.disponible);

  const addToCart = (product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) return prev.map(item => item.id === product.id ? { ...item, qty: item.qty + 1 } : item);
      return [...prev, { ...product, qty: 1 }];
    });
  };

  const addToExtraCart = (product) => {
    setExtraCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) return prev.map(item => item.id === product.id ? { ...item, qty: item.qty + 1 } : item);
      return [...prev, { ...product, qty: 1 }];
    });
  };

  const updateExtraQty = (id, delta) => {
    setExtraCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = item.qty + delta;
        return newQty > 0 ? { ...item, qty: newQty } : null;
      }
      return item;
    }).filter(Boolean));
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
  const cambio = montoRecibido && parseFloat(montoRecibido) >= total ? parseFloat(montoRecibido) - total : 0;

  const orderExtraTotal = extraCart.reduce((sum, item) => sum + item.precio * item.qty, 0);
  const selItems = (view === 'pendientes' && selectedOrder) ? (Array.isArray(selectedOrder.items) ? selectedOrder.items : []) : [];
  const selExtrasItems = (view === 'pendientes' && selectedOrder && Array.isArray(selectedOrder.extras)) ? selectedOrder.extras.flatMap(e => Array.isArray(e.items) ? e.items : []) : [];
  const computedOrderTotal = [...selItems, ...selExtrasItems].reduce((s, i) => s + (i.precio || i.precio_unitario || 0) * (i.qty || i.cantidad || 1), 0);
  const orderTotal = (view === 'pendientes' && selectedOrder) ? ((selectedOrder.total > 0 ? parseFloat(selectedOrder.total) : null) || computedOrderTotal) : 0;
  const orderCambio = montoRecibido && parseFloat(montoRecibido) >= orderTotal ? parseFloat(montoRecibido) - orderTotal : 0;

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

  const sendExtrasToKitchen = async () => {
    if (!selectedOrder || extraCart.length === 0) return;
    const items = extraCart.map(item => ({
      id: item.id, nombre: item.nombre, precio: item.precio,
      qty: item.qty, cantidad: item.qty, precio_unitario: item.precio,
      tipo: item.tipo || 'COMIDA'
    }));
    try {
      await api.post(`/orders/${selectedOrder.id}/extras`, { items, total: orderExtraTotal });
      setExtraCart([]);
      setShowExtraProducts(false);
      setMontoRecibido('');
      loadPendingOrders();
      alert('Extra enviado a cocina');
    } catch (err) {
      alert('Error al enviar extra');
    }
  };

  const activeTotal = view === 'pendientes' && selectedOrder ? orderTotal : total;
  const activeCambio = view === 'pendientes' && selectedOrder ? orderCambio : cambio;
  const activeItemsCount = view === 'pendientes' && selectedOrder
    ? Math.max(selItems.length + selExtrasItems.length, 1)
    : cart.length;

  const viewRef = useRef(view);
  const selectedOrderRef = useRef(selectedOrder);
  viewRef.current = view;
  selectedOrderRef.current = selectedOrder;

  const processOrder = useCallback(async (quickMethod) => {
    const payMethod = quickMethod || metodoPago;
    const curView = viewRef.current;
    const curOrder = selectedOrderRef.current;
    if (curView === 'pendientes' && curOrder) {
      if (!cashSession) return alert('Abre la caja primero');
      const curOrderItems = Array.isArray(curOrder.items) ? curOrder.items : [];
      const curExtrasItems = Array.isArray(curOrder.extras) ? curOrder.extras.flatMap(e => Array.isArray(e.items) ? e.items : []) : [];
      const curAllItems = [...curOrderItems, ...curExtrasItems];
      const curTotal = (curOrder.total > 0 ? parseFloat(curOrder.total) : null) || curAllItems.reduce((s, i) => s + (i.precio || i.precio_unitario || 0) * (i.qty || i.cantidad || 1), 0);
      if (payMethod === 'EFECTIVO' && (!montoRecibido || parseFloat(montoRecibido) < curTotal)) {
        return alert('El monto recibido debe ser mayor o igual al total');
      }
      try {
        await api.post(`/orders/${curOrder.id}/pay`, {
          metodo_pago: payMethod, sesion_id: cashSession?.id
        });
        try {
          await api.post('/print/receipt', {
            order_id: curOrder.numero || curOrder.id,
            canal: curOrder.canal,
            items: curAllItems, total: curTotal, metodo_pago: payMethod,
            monto_recibido: payMethod === 'EFECTIVO' ? parseFloat(montoRecibido) : curTotal,
            cambio: payMethod === 'EFECTIVO' ? (parseFloat(montoRecibido) - curTotal) : 0
          });
        } catch (e) { console.warn('Print no disponible'); }

        setReceiptData({
          order_id: curOrder.numero || curOrder.id,
          canal: curOrder.canal,
          items: curAllItems,
          total: curTotal, metodo_pago: payMethod,
          monto_recibido: payMethod === 'EFECTIVO' ? parseFloat(montoRecibido) : curTotal,
          cambio: payMethod === 'EFECTIVO' ? (parseFloat(montoRecibido) - curTotal) : 0,
          created_at: curOrder.created_at,
          cajero: user?.nombre || user?.email || 'CAJA'
        });

        setSelectedOrder(null);
        setMontoRecibido('');
        setMetodoPago('EFECTIVO');
        loadPendingOrders();
      } catch (err) {
        alert('Error al cobrar pedido');
      }
      return;
    }

    if (cart.length === 0) return alert('Agrega productos a la orden');
    if (!cashSession) return alert('Abre la caja primero');
    if (payMethod === 'EFECTIVO' && (!montoRecibido || parseFloat(montoRecibido) < total)) {
      return alert('El monto recibido debe ser mayor o igual al total');
    }
    try {
      const items = cart.map(item => ({
        id: item.id, nombre: item.nombre, precio: item.precio, qty: item.qty,
        cantidad: item.qty, precio_unitario: item.precio, tipo: item.tipo || 'COMIDA'
      }));

      let orderId = null;
      if (orderChannel === 'CAJA') {
        await api.post('/orders', {
          items, total, canal: 'CAJA', mesa: 'VENTA DIRECTA',
          usuario_id: user.id, sesion_id: cashSession?.id, sucursal_id: effectiveSucursalId
        });
        const ordersRes = await api.get('/orders');
        const latest = ordersRes.data.data?.[0];
        if (latest) { orderId = latest.id; await api.post(`/orders/${latest.id}/pay`, { metodo_pago: payMethod, sesion_id: cashSession?.id }); }
      } else {
        const res = await api.post('/orders', {
          items, total, canal: 'LLEVAR', mesa: 'PARA LLEVAR',
          usuario_id: user.id, sesion_id: cashSession?.id, sucursal_id: effectiveSucursalId
        });
        orderId = res.data?.order_id;
        await api.post(`/orders/${orderId}/pay`, { metodo_pago: payMethod, sesion_id: cashSession?.id });
      }

      try { await api.post('/print/kitchen', { order_id: orderId || `POS-${Date.now()}`, canal: orderChannel === 'LLEVAR' ? 'LLEVAR' : 'CAJA', items, total }); } catch (e) {}
      try { await api.post('/print/receipt', { order_id: orderId || `POS-${Date.now()}`, canal: orderChannel, items, total, metodo_pago: payMethod, monto_recibido: payMethod === 'EFECTIVO' ? parseFloat(montoRecibido) : total, cambio: payMethod === 'EFECTIVO' ? cambio : 0 }); } catch (e) {}

      setReceiptData({
        order_id: orderId || `POS-${Date.now()}`, canal: orderChannel, items, total, metodo_pago: payMethod,
        monto_recibido: payMethod === 'EFECTIVO' ? parseFloat(montoRecibido) : total,
        cambio: payMethod === 'EFECTIVO' ? cambio : 0, created_at: new Date().toISOString(),
        cajero: user?.nombre || user?.email || 'CAJA'
      });

      setCart([]);
      setMontoRecibido('');
      setMetodoPago('EFECTIVO');
    } catch (err) {
      alert('Error al procesar pedido');
    }
  }, [cart, total, metodoPago, montoRecibido, orderChannel, cashSession, effectiveSucursalId, user, cambio, montoRecibido]);

  const openCash = async () => {
    const monto = prompt('Monto inicial en caja:');
    if (monto === null) return;
    try {
      const res = await api.post('/cash/open', { usuario_id: user.id, monto_inicial: parseFloat(monto) || 0, sucursal_id: effectiveSucursalId });
      if (res.data.sesion_id) { setCashSession({ id: res.data.sesion_id }); alert('Caja abierta'); }
    } catch (err) { alert('Error al abrir caja'); }
  };

  const closeCash = async () => {
    if (!confirm('¿Cerrar caja?')) return;
    try {
      const res = await api.post('/cash/close', { sesion_id: cashSession?.id });
      const r = res.data.reporte;
      alert(`Caja cerrada\nTotal: $${r.total_ventas}\nEfectivo: $${r.efectivo}\nEn caja: $${r.total_en_caja}`);
      setCashSession(null);
    } catch (err) { alert('Error al cerrar caja'); }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key >= '0' && e.key <= '9') { e.preventDefault(); handleNumpad(e.key); }
      else if (e.key === '.') { e.preventDefault(); handleNumpad('.'); }
      else if (e.key === 'Backspace') { e.preventDefault(); handleNumpad('B'); }
      else if (e.key === 'Escape') { handleNumpad('C'); }
      else if (e.key === 'Enter') { e.preventDefault(); processOrder(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNumpad, processOrder]);

  if (loading) return <div className="flex items-center justify-center h-64 text-pikta-info">Cargando...</div>;

  const isCash = metodoPago === 'EFECTIVO';
  const canCharge = cashSession && activeItemsCount > 0 && (!isCash || (montoRecibido && parseFloat(montoRecibido) >= activeTotal));
  const chargeLabel = !cashSession ? 'ABRE LA CAJA PRIMERO'
    : isCash ? `COBRAR $${activeTotal.toFixed(2)}`
    : 'CONFIRMAR PAGO';

  return (
    <div className="h-[calc(100vh-3rem)] flex flex-col">
      <div className="flex flex-1 gap-2 min-h-0">

        {/* LEFT SIDE */}
        <div className="w-[45%] bg-pikta-panel rounded-xl flex flex-col">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-600 flex items-center justify-between">
            <div className="flex gap-1">
              <button onClick={() => { setView('venta'); setSelectedOrder(null); setExtraCart([]); setShowExtraProducts(false); setMontoRecibido(''); setMetodoPago('EFECTIVO'); }} className={`px-3 py-1 rounded text-xs font-bold transition ${view === 'venta' ? 'bg-pikta-info text-white' : 'bg-gray-600 text-gray-300 hover:bg-gray-500'}`}>
                <span className="flex items-center gap-1"><ShoppingCart size={12} /> Nueva Venta</span>
              </button>
              <button onClick={() => { setView('pendientes'); setExtraCart([]); setShowExtraProducts(false); setMontoRecibido(''); setMetodoPago('EFECTIVO'); }} className={`px-3 py-1 rounded text-xs font-bold transition ${view === 'pendientes' ? 'bg-pikta-warn text-white' : 'bg-gray-600 text-gray-300 hover:bg-gray-500'}`}>
                <span className="flex items-center gap-1"><ClipboardList size={12} /> Pedidos ({pendingOrders.length})</span>
              </button>
            </div>
            <div className="flex gap-1.5">
              {view === 'venta' && (
                <>
                  <button onClick={() => setOrderChannel('CAJA')} className={`px-3 py-1 rounded text-xs font-medium transition ${orderChannel === 'CAJA' ? 'bg-pikta-info text-white' : 'bg-gray-600 text-gray-300'}`}>Local</button>
                  <button onClick={() => setOrderChannel('LLEVAR')} className={`px-3 py-1 rounded text-xs font-medium transition ${orderChannel === 'LLEVAR' ? 'bg-pikta-accent text-white' : 'bg-gray-600 text-gray-300'}`}>Llevar</button>
                </>
              )}
              {!cashSession ? (
                <button onClick={openCash} className="px-3 py-1 bg-pikta-ok text-white rounded text-xs font-medium">Abrir Caja</button>
              ) : (
                <button onClick={closeCash} className="px-3 py-1 bg-pikta-err text-white rounded text-xs font-medium">Cerrar Caja</button>
              )}
            </div>
          </div>

          {/* MIDDLE: Content area */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {view === 'venta' ? (
              <>
                <div className="grid grid-cols-[1fr_50px_70px_30px] gap-1 px-4 py-2 bg-gray-800 text-xs font-bold text-gray-400">
                  <span>Producto</span>
                  <span className="text-center">Cant.</span>
                  <span className="text-right">Subtotal</span>
                  <span></span>
                </div>
                {cart.length === 0 ? (
                  <p className="text-gray-500 text-center py-12 text-sm">Agrega productos</p>
                ) : (
                  cart.map((item, idx) => (
                    <div key={item.id} className={`grid grid-cols-[1fr_50px_70px_30px] gap-1 px-4 py-2 items-center text-sm border-b border-gray-700/50 ${idx % 2 === 0 ? 'bg-gray-800/30' : ''}`}>
                      <span className="text-white font-medium truncate">{item.nombre}</span>
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => updateQty(item.id, -1)} className="w-5 h-5 rounded bg-gray-600 text-white flex items-center justify-center text-[10px]"><Minus size={10} /></button>
                        <span className="text-white font-bold w-4 text-center">{item.qty}</span>
                        <button onClick={() => updateQty(item.id, 1)} className="w-5 h-5 rounded bg-gray-600 text-white flex items-center justify-center text-[10px]"><Plus size={10} /></button>
                      </div>
                      <span className="text-pikta-accent font-bold text-right">${(item.precio * item.qty).toFixed(2)}</span>
                      <button onClick={() => removeFromCart(item.id)} className="text-pikta-err hover:text-red-400 flex justify-center"><Trash2 size={12} /></button>
                    </div>
                  ))
                )}
              </>
            ) : (
              <>
                {loadingPending ? (
                  <p className="text-gray-400 text-center py-12">Cargando pedidos...</p>
                ) : pendingOrders.length === 0 ? (
                  <div className="text-center py-12">
                    <ClipboardList className="mx-auto text-gray-600 mb-3" size={48} />
                    <p className="text-gray-400">No hay pedidos pendientes por cobrar</p>
                  </div>
                ) : (
                  pendingOrders.map(order => {
                    const items = Array.isArray(order.items) ? order.items : [];
                    const extras = Array.isArray(order.extras) ? order.extras : [];
                    const isExpanded = selectedOrder?.id === order.id;
                    const allExtrasItems = extras.flatMap(e => Array.isArray(e.items) ? e.items : []);
                    return (
                      <div key={order.id} className={`mx-3 mb-2 rounded-xl border transition cursor-pointer ${isExpanded ? 'border-pikta-accent bg-gray-700/30' : 'border-gray-700 hover:border-gray-500'}`}>
                        {/* Header */}
                        <div onClick={() => { if (isExpanded) { setSelectedOrder(null); setExtraCart([]); setShowExtraProducts(false); setMontoRecibido(''); setMetodoPago('EFECTIVO'); } else { setSelectedOrder(order); setExtraCart([]); setShowExtraProducts(false); setMontoRecibido(''); setMetodoPago('EFECTIVO'); } }} className="px-4 py-2.5 flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-white font-mono">{order.numero}</span>
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-600 text-gray-300">{order.canal}</span>
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-600 text-gray-300">{order.mesa}</span>
                            </div>
                            <p className="text-[11px] text-gray-400 mt-0.5">{order.created_at ? new Date(order.created_at).toLocaleTimeString('es-PA', { hour: '2-digit', minute: '2-digit' }) : ''}</p>
                          </div>
                          <span className="text-lg font-bold text-pikta-accent">${order.total?.toFixed(2)}</span>
                        </div>

                        {/* Items always visible */}
                        <div className="px-4 pb-2">
                          <div className="space-y-0.5">
                            {items.map((item, idx) => (
                              <div key={`o-${idx}`} className="flex justify-between items-center text-[13px]">
                                <span className="text-gray-300">{item.qty || item.cantidad}x {item.nombre}</span>
                                <span className="text-gray-400">${((item.precio || item.precio_unitario || 0) * (item.qty || item.cantidad || 1)).toFixed(2)}</span>
                              </div>
                            ))}
                            {allExtrasItems.map((item, idx) => (
                              <div key={`e-${idx}`} className="flex justify-between items-center text-[13px]">
                                <span className="text-pikta-warn">{item.qty || item.cantidad || 1}x {item.nombre} <span className="text-[10px]">(extra)</span></span>
                                <span className="text-pikta-warn">${((item.precio || item.precio_unitario || 0) * (item.qty || item.cantidad || 1)).toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Expanded: only extras section */}
                        {isExpanded && (
                          <div className="px-4 pb-3 border-t border-gray-700 pt-2">
                            <button onClick={(e) => { e.stopPropagation(); setShowExtraProducts(!showExtraProducts); }} className="w-full py-2 bg-pikta-accent/20 text-pikta-accent border border-pikta-accent/40 rounded-lg text-sm font-medium flex items-center justify-center gap-2 hover:bg-pikta-accent/30 transition">
                              <Plus size={14} /> {showExtraProducts ? 'Cerrar' : 'Agregar Producto Extra'}
                            </button>
                            {showExtraProducts && (
                              <div className="bg-gray-800 rounded-xl p-3 mt-2">
                                <div className="flex gap-1.5 flex-wrap mb-2">
                                  {categories.map(cat => (
                                    <button key={cat} onClick={(e) => { e.stopPropagation(); setExtraCategory(cat); }} className={`px-3 py-1 rounded text-[11px] font-medium transition ${extraCategory === cat ? 'bg-pikta-info text-white' : 'bg-gray-700 text-gray-400'}`}>{cat}</button>
                                  ))}
                                </div>
                                <div className="grid grid-cols-2 gap-1.5 max-h-[100px] overflow-y-auto">
                                  {filteredExtraProducts.map(p => (
                                    <button key={p.id} onClick={(e) => { e.stopPropagation(); addToExtraCart(p); }} className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 rounded-lg px-2 py-1.5 text-left transition">
                                      <span className="text-sm">{p.emoji || '🍽'}</span>
                                      <div className="min-w-0">
                                        <p className="text-white text-[11px] font-medium truncate">{p.nombre}</p>
                                        <p className="text-pikta-accent text-[10px] font-bold">${p.precio.toFixed(2)}</p>
                                      </div>
                                    </button>
                                  ))}
                                </div>
                                {extraCart.length > 0 && (
                                  <div className="mt-2 border-t border-gray-600 pt-2">
                                    {extraCart.map(item => (
                                      <div key={item.id} className="flex items-center justify-between py-1">
                                        <div className="flex items-center gap-2">
                                          <button onClick={(e) => { e.stopPropagation(); updateExtraQty(item.id, -1); }} className="w-5 h-5 rounded bg-gray-600 text-white flex items-center justify-center text-[10px]"><Minus size={10} /></button>
                                          <span className="text-white text-xs font-bold">{item.qty}</span>
                                          <button onClick={(e) => { e.stopPropagation(); updateExtraQty(item.id, 1); }} className="w-5 h-5 rounded bg-gray-600 text-white flex items-center justify-center text-[10px]"><Plus size={10} /></button>
                                          <span className="text-gray-300 text-xs">{item.nombre}</span>
                                        </div>
                                        <span className="text-pikta-accent text-xs font-bold">${(item.precio * item.qty).toFixed(2)}</span>
                                      </div>
                                    ))}
                                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-600">
                                      <span className="text-xs text-gray-400">Extra: <span className="text-pikta-accent font-bold">${extraTotal.toFixed(2)}</span></span>
                                      <button onClick={(e) => { e.stopPropagation(); sendExtrasToKitchen(); }} className="px-4 py-1.5 bg-pikta-accent text-white rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-pikta-accent/80 transition">
                                        <Send size={12} /> Enviar a Cocina
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </>
            )}
          </div>

          {/* BOTTOM: Payment Methods + Numpad + COBRAR */}
          <div className="border-t border-gray-600 px-4 py-3">
            {/* Total + Payment Methods */}
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-gray-400">TOTAL:</span>
              <span className="text-2xl font-bold text-pikta-accent">${activeTotal.toFixed(2)}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <button onClick={() => { setMetodoPago('EFECTIVO'); }} className={`py-2 rounded-lg text-xs font-medium transition flex items-center justify-center gap-1 ${metodoPago === 'EFECTIVO' ? 'bg-pikta-ok text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}>
                <Banknote size={14} /> Efectivo
              </button>
              <button onClick={() => { setMetodoPago('YAPPY'); processOrder('YAPPY'); }} className={`py-2 rounded-lg text-xs font-medium transition flex items-center justify-center gap-1 ${metodoPago === 'YAPPY' ? 'bg-pikta-info text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}>
                <Smartphone size={14} /> Yappy
              </button>
              <button onClick={() => { setMetodoPago('TARJETA'); processOrder('TARJETA'); }} className={`py-2 rounded-lg text-xs font-medium transition flex items-center justify-center gap-1 ${metodoPago === 'TARJETA' ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}>
                <CreditCard size={14} /> Tarjeta
              </button>
            </div>

            {/* Numpad always visible */}
            <div className="flex gap-3 items-stretch">
              <div className="bg-gray-800 rounded-xl p-3 flex flex-col justify-center min-w-[100px]">
                <div className="mb-1">
                  <p className="text-[10px] text-gray-400">RECIBIDO</p>
                  <p className="text-lg font-bold text-white">{isCash ? `$${montoRecibido || '0.00'}` : `$${activeTotal.toFixed(2)}`}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400">CAMBIO</p>
                  <p className={`text-lg font-bold ${activeCambio > 0 ? 'text-pikta-ok' : 'text-gray-500'}`}>{isCash ? `$${activeCambio.toFixed(2)}` : '$0.00'}</p>
                </div>
              </div>
              <div className="flex-1 grid grid-cols-4 gap-1.5">
                {[7,8,9].map(n => <button key={n} onClick={() => handleNumpad(String(n))} className="h-10 rounded-lg text-lg font-bold bg-gray-700 text-white hover:bg-gray-600 active:scale-95 transition">{n}</button>)}
                <button onClick={() => handleNumpad('B')} className="h-10 rounded-lg bg-pikta-err/20 text-pikta-err hover:bg-pikta-err/30 active:scale-95 transition flex items-center justify-center"><Delete size={16} /></button>
                {[4,5,6].map(n => <button key={n} onClick={() => handleNumpad(String(n))} className="h-10 rounded-lg text-lg font-bold bg-gray-700 text-white hover:bg-gray-600 active:scale-95 transition">{n}</button>)}
                <button onClick={() => handleNumpad('C')} className="h-10 rounded-lg text-xs font-bold bg-gray-600 text-gray-300 hover:bg-gray-500 active:scale-95 transition">CE</button>
                {[1,2,3].map(n => <button key={n} onClick={() => handleNumpad(String(n))} className="h-10 rounded-lg text-lg font-bold bg-gray-700 text-white hover:bg-gray-600 active:scale-95 transition">{n}</button>)}
                <div />
                <button onClick={() => handleNumpad('0')} className="h-10 rounded-lg text-lg font-bold bg-gray-700 text-white hover:bg-gray-600 active:scale-95 transition col-span-2">0</button>
                <button onClick={() => handleNumpad('.')} className="h-10 rounded-lg text-lg font-bold bg-gray-700 text-white hover:bg-gray-600 active:scale-95 transition">.</button>
                <div />
              </div>
            </div>

            {/* COBRAR Button */}
            <button onClick={processOrder} disabled={!canCharge}
              className="w-full mt-3 py-3 bg-pikta-ok text-white rounded-lg font-bold text-lg hover:bg-green-600 transition disabled:opacity-40 disabled:cursor-not-allowed">
              {chargeLabel}
            </button>
          </div>
        </div>

        {/* RIGHT SIDE: Products */}
        <div className="flex-1 flex flex-col gap-2 min-h-0">
          <div className="flex gap-2 flex-wrap">
            {categories.map(cat => (
              <button key={cat} onClick={() => setSelectedCategory(cat)} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${selectedCategory === cat ? 'bg-pikta-info text-white' : 'bg-pikta-panel text-gray-300 hover:bg-gray-600'}`}>{cat}</button>
            ))}
          </div>
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
        </div>
      </div>

      {receiptData && <ReceiptModal order={receiptData} onClose={() => setReceiptData(null)} />}
    </div>
  );
}
