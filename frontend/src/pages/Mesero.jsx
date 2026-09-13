import { useState, useEffect } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { UtensilsCrossed, Plus, Minus, Trash2, Send } from 'lucide-react';

const TABLES = ['Mesa 1', 'Mesa 2', 'Mesa 3', 'Mesa 4', 'Mesa 5', 'Mesa 6', 'Mesa 7', 'Mesa 8', 'Mesa 9', 'Mesa 10'];

export default function Mesero() {
  const { user, selectedSucursal } = useAuth();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [cart, setCart] = useState([]);
  const [selectedTable, setSelectedTable] = useState('Mesa 1');
  const [loading, setLoading] = useState(true);
  const [activeOrders, setActiveOrders] = useState([]);

  const effectiveSucursalId = user?.rol === 'Administrador' || user?.rol === 'Supervisor'
    ? (selectedSucursal || user?.sucursal_id)
    : user?.sucursal_id;

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const params = {};
      if (effectiveSucursalId) params.sucursal_id = effectiveSucursalId;

      const [prodRes, catRes, ordersRes] = await Promise.all([
        api.get('/products', { params }),
        api.get('/products/categories'),
        api.get('/orders', { params })
      ]);
      setProducts(prodRes.data.data || []);
      setCategories(catRes.data.data || []);
      if (catRes.data.data?.length) setSelectedCategory(catRes.data.data[0]);
      setActiveOrders(ordersRes.data.data || []);
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

  const sendOrder = async () => {
    if (cart.length === 0) return alert('El carrito está vacío');

    try {
      const items = cart.map(item => ({
        id: item.id, nombre: item.nombre, precio: item.precio, qty: item.qty
      }));

      await api.post('/orders', {
        items, total, canal: 'MESERO', mesa: selectedTable,
        usuario_id: user.id,
        sucursal_id: effectiveSucursalId
      });

      setCart([]);
      alert(`Pedido enviado a cocina para ${selectedTable}`);
      loadData();
    } catch (err) {
      alert('Error al enviar pedido');
      console.error(err);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-pikta-info">Cargando...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-4">
        <UtensilsCrossed className="text-pikta-accent" size={28} />
        <h1 className="text-2xl font-bold text-white">PEDIDOS DE MESERO</h1>
      </div>

      {/* Table Selector */}
      <div className="bg-pikta-panel rounded-xl p-4">
        <h2 className="text-sm font-semibold text-gray-400 mb-3">Seleccionar Mesa</h2>
        <div className="flex gap-2 flex-wrap">
          {TABLES.map(table => (
            <button
              key={table}
              onClick={() => setSelectedTable(table)}
              className={`px-4 py-2.5 rounded-lg font-medium text-sm transition ${
                selectedTable === table
                  ? 'bg-pikta-accent text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {table}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-4 h-[calc(100vh-16rem)]">
        {/* Products */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex gap-2 mb-3 flex-wrap">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${selectedCategory === cat ? 'bg-pikta-info text-white' : 'bg-pikta-panel text-gray-300 hover:bg-gray-600'}`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 overflow-y-auto flex-1 pr-2">
            {filteredProducts.map(product => (
              <div key={product.id} onClick={() => addToCart(product)} className="bg-pikta-panel rounded-xl p-3 flex flex-col items-center text-center hover:ring-2 hover:ring-pikta-info transition cursor-pointer">
                {product.imagen_url ? (
                  <img src={product.imagen_url} alt={product.nombre} className="w-16 h-16 rounded-lg object-cover mb-1" />
                ) : (
                  <div className="text-3xl mb-1">{product.emoji || '🍽'}</div>
                )}
                <p className="text-white text-xs font-semibold leading-tight">{product.nombre}</p>
                <p className="text-pikta-accent font-bold text-sm mt-1">${product.precio.toFixed(2)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Cart */}
        <div className="w-80 bg-pikta-panel rounded-xl flex flex-col">
          <div className="p-3 border-b border-gray-600">
            <h2 className="font-bold text-white">{selectedTable}</h2>
            <p className="text-xs text-gray-400">{cart.length} productos en el pedido</p>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {cart.length === 0 ? (
              <p className="text-gray-500 text-center py-6 text-sm">Agregue productos</p>
            ) : (
              cart.map(item => (
                <div key={item.id} className="bg-gray-700/50 rounded-lg p-2.5 flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-xs font-medium truncate">{item.nombre}</p>
                    <p className="text-pikta-accent text-xs">${item.precio.toFixed(2)}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => updateQty(item.id, -1)} className="w-6 h-6 rounded bg-gray-600 text-white flex items-center justify-center hover:bg-gray-500 text-xs">
                      <Minus size={12} />
                    </button>
                    <span className="text-white text-xs font-bold w-4 text-center">{item.qty}</span>
                    <button onClick={() => updateQty(item.id, 1)} className="w-6 h-6 rounded bg-gray-600 text-white flex items-center justify-center hover:bg-gray-500 text-xs">
                      <Plus size={12} />
                    </button>
                  </div>
                  <button onClick={() => removeFromCart(item.id)} className="text-pikta-err hover:text-red-400">
                    <Trash2 size={12} />
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="p-3 border-t border-gray-600">
            <div className="flex justify-between items-center mb-3">
              <span className="font-bold text-white">TOTAL:</span>
              <span className="text-xl font-bold text-pikta-accent">${total.toFixed(2)}</span>
            </div>
            <button
              onClick={sendOrder}
              disabled={cart.length === 0}
              className="w-full py-3 bg-pikta-ok hover:bg-green-600 text-white font-bold rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Send size={18} /> ENVIAR A COCINA
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
