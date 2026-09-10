import { useState, useEffect } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { ShoppingCart, Trash2, Plus, Minus, CreditCard, Banknote, Smartphone } from 'lucide-react';

export default function POS() {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cashSession, setCashSession] = useState(null);
  const [showPayModal, setShowPayModal] = useState(false);
  const [orderChannel, setOrderChannel] = useState('CAJA');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [prodRes, catRes, cashRes] = await Promise.all([
        api.get('/products'),
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

  const openCash = async () => {
    const monto = prompt('Monto inicial en caja:');
    if (monto === null) return;
    try {
      const res = await api.post('/cash/open', { usuario_id: user.id, monto_inicial: parseFloat(monto) || 0 });
      if (res.data.sesion_id) {
        setCashSession({ id: res.data.sesion_id });
        alert('Caja abierta exitosamente');
      }
    } catch (err) {
      alert('Error al abrir caja');
    }
  };

  const processOrder = async (metodoPago) => {
    if (cart.length === 0) return alert('El carrito está vacío');

    try {
      const items = cart.map(item => ({
        id: item.id, nombre: item.nombre, precio: item.precio, qty: item.qty
      }));

      if (orderChannel === 'CAJA') {
        // Direct sale - create and pay
        await api.post('/orders', {
          items, total, canal: 'CAJA', mesa: 'VENTA DIRECTA',
          usuario_id: user.id, sesion_id: cashSession?.id
        });
        // Get the latest order and pay it
        const ordersRes = await api.get('/orders');
        const latest = ordersRes.data.data?.[0];
        if (latest) {
          await api.post(`/orders/${latest.id}/pay`, { metodo_pago: metodoPago, sesion_id: cashSession?.id });
        }
      } else {
        // Llevar - create order without paying
        await api.post('/orders', {
          items, total, canal: 'LLEVAR', mesa: 'PARA LLEVAR',
          usuario_id: user.id, sesion_id: cashSession?.id
        });
      }

      setCart([]);
      setShowPayModal(false);
      alert('Pedido procesado correctamente');
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
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 overflow-y-auto flex-1 pr-2">
            {filteredProducts.map(product => (
              <div key={product.id} className="bg-pikta-panel rounded-xl p-4 flex flex-col items-center text-center hover:ring-2 hover:ring-pikta-info transition cursor-pointer" onClick={() => addToCart(product)}>
                <div className="text-4xl mb-2">{product.emoji || '🍽'}</div>
                <p className="text-white text-sm font-semibold mb-1 leading-tight">{product.nombre}</p>
                <p className="text-pikta-accent font-bold">${product.precio.toFixed(2)}</p>
                <button className="mt-2 w-full py-1.5 bg-pikta-info text-white rounded-lg text-xs font-medium hover:bg-blue-600 transition">
                  Agregar
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Cart Panel */}
        <div className="w-96 bg-pikta-panel rounded-xl flex flex-col">
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
                onClick={() => processOrder('EFECTIVO')}
                disabled={cart.length === 0}
                className="py-3 bg-pikta-ok text-white rounded-lg font-medium hover:bg-green-600 transition disabled:opacity-50 flex flex-col items-center gap-1"
              >
                <Banknote size={20} />
                <span className="text-xs">Efectivo</span>
              </button>
              <button
                onClick={() => processOrder('YAPPY')}
                disabled={cart.length === 0}
                className="py-3 bg-pikta-info text-white rounded-lg font-medium hover:bg-blue-600 transition disabled:opacity-50 flex flex-col items-center gap-1"
              >
                <Smartphone size={20} />
                <span className="text-xs">Yappy</span>
              </button>
              <button
                onClick={() => processOrder('TARJETA')}
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
    </div>
  );
}
