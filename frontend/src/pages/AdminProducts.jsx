import { useState, useEffect, useRef } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { UtensilsCrossed, Plus, Pencil, Trash2, X, Save, Upload, Image } from 'lucide-react';

export default function AdminProducts() {
  const { user, selectedSucursal } = useAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [form, setForm] = useState({ nombre: '', precio: '', categoria: 'Otros', emoji: '', prep_duration: 15, descripcion: '', sucursal_id: 1 });
  const [uploadingImage, setUploadingImage] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const fileInputRef = useRef(null);

  const CATEGORIAS = ['🍔 Combos', '🍟 Extras', '🥤 Bebidas', '🍰 Postres', 'Otros'];
  const SUCURSALES = [{ id: 1, nombre: 'David' }, { id: 2, nombre: 'Boquete' }];

  useEffect(() => { loadProducts(); }, []);

  const loadProducts = async () => {
    try {
      const res = await api.get('/products');
      setProducts(res.data.data || []);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditingProduct(null);
    setForm({ nombre: '', precio: '', categoria: '🍔 Combos', emoji: '🍔', prep_duration: 15, descripcion: '', sucursal_id: selectedSucursal || 1 });
    setSelectedImage(null);
    setPreviewUrl(null);
    setShowModal(true);
  };

  const openEdit = (product) => {
    setEditingProduct(product);
    setForm({
      nombre: product.nombre,
      precio: product.precio,
      categoria: product.categoria || 'Otros',
      emoji: product.emoji || '',
      prep_duration: product.prep_duration || 15,
      descripcion: product.descripcion || '',
      sucursal_id: product.sucursal_id || 1
    });
    setSelectedImage(null);
    setPreviewUrl(product.imagen_url ? `/api/images/${product.imagen_url}` : null);
    setShowModal(true);
  };

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('La imagen no puede superar 5MB');
      return;
    }
    setSelectedImage(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const removeImage = () => {
    setSelectedImage(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const uploadImage = async (productId) => {
    if (!selectedImage) return;
    const formData = new FormData();
    formData.append('image', selectedImage);
    try {
      await api.post(`/products/${productId}/image`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
    } catch (err) {
      console.error('Error uploading image:', err);
    }
  };

  const deleteImage = async (productId) => {
    try {
      await api.delete(`/products/${productId}/image`);
    } catch (err) {
      console.error('Error deleting image:', err);
    }
  };

  const save = async () => {
    try {
      if (!form.nombre || !form.precio) return alert('Nombre y precio son requeridos');
      let productId;
      if (editingProduct) {
        await api.put(`/products/${editingProduct.id}`, form);
        productId = editingProduct.id;
        if (previewUrl === null && editingProduct.imagen_url) {
          await deleteImage(editingProduct.id);
        }
      } else {
        const res = await api.post('/products', form);
        productId = res.data.id;
      }
      if (selectedImage && productId) {
        await uploadImage(productId);
      }
      setShowModal(false);
      loadProducts();
    } catch (err) {
      alert(err.response?.data?.message || 'Error al guardar');
    }
  };

  const deleteProduct = async (id) => {
    if (!confirm('¿Eliminar este producto?')) return;
    try {
      await api.delete(`/products/${id}`);
      loadProducts();
    } catch (err) {
      alert('Error al eliminar');
    }
  };

  const toggleAvailability = async (product) => {
    try {
      await api.put(`/products/${product.id}`, {
        ...product,
        disponible: product.disponible ? 0 : 1
      });
      loadProducts();
    } catch (err) {
      alert('Error al actualizar');
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-pikta-info">Cargando...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <UtensilsCrossed className="text-pikta-accent" size={28} />
          <h1 className="text-2xl font-bold text-white">GESTIÓN DE PRODUCTOS</h1>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-pikta-ok text-white rounded-lg font-medium hover:bg-green-600 transition">
          <Plus size={18} /> Nuevo Producto
        </button>
      </div>

      <div className="bg-pikta-panel rounded-xl overflow-hidden">
        <div className="overflow-x-auto max-h-[70vh]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-700">
              <tr className="text-gray-400">
                <th className="text-left px-4 py-3">Imagen</th>
                <th className="text-left px-4 py-3">Nombre</th>
                <th className="text-left px-4 py-3">Sucursal</th>
                <th className="text-left px-4 py-3">Categoría</th>
                <th className="text-left px-4 py-3">Precio</th>
                <th className="text-left px-4 py-3">Tiempo Prep.</th>
                <th className="text-left px-4 py-3">Estado</th>
                <th className="text-right px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {products.map(p => (
                <tr key={p.id} className="border-t border-gray-700/50 hover:bg-gray-700/30">
                  <td className="px-4 py-3">
                    {p.imagen_url ? (
                      <img src={`/api/images/${p.imagen_url}`} alt={p.nombre} className="w-12 h-12 rounded-lg object-cover" />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-gray-700 flex items-center justify-center text-2xl">
                        {p.emoji || '🍽'}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-white font-medium">{p.nombre}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${p.sucursal_id === 2 ? 'bg-blue-900 text-blue-300' : 'bg-green-900 text-green-300'}`}>
                      {SUCURSALES.find(s => s.id === p.sucursal_id)?.nombre || 'David'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-300">{p.categoria}</td>
                  <td className="px-4 py-3 text-pikta-accent font-semibold">${p.precio?.toFixed(2)}</td>
                  <td className="px-4 py-3 text-gray-300">{p.prep_duration} min</td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggleAvailability(p)} className={`px-2 py-1 rounded-full text-xs font-medium transition ${p.disponible ? 'bg-green-900 text-green-300 hover:bg-green-800' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}>
                      {p.disponible ? 'Disponible' : 'Agotado'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openEdit(p)} className="text-pikta-info hover:text-blue-400 mr-3"><Pencil size={16} /></button>
                    <button onClick={() => deleteProduct(p.id)} className="text-pikta-err hover:text-red-400"><Trash2 size={16} /></button>
                  </td>
                </tr>
              ))}
              {products.length === 0 && (
                <tr><td colSpan="8" className="px-4 py-8 text-center text-gray-500">No hay productos</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-pikta-panel rounded-xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">{editingProduct ? 'Editar Producto' : 'Nuevo Producto'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
            </div>

            <div className="space-y-4">
              {/* Image Upload */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">Imagen del Producto</label>
                <div className="flex items-center gap-4">
                  {previewUrl ? (
                    <div className="relative">
                      <img src={previewUrl} alt="Preview" className="w-24 h-24 rounded-xl object-cover border-2 border-gray-600" />
                      <button onClick={removeImage} className="absolute -top-2 -right-2 w-6 h-6 bg-pikta-err rounded-full flex items-center justify-center text-white text-xs">
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <div className="w-24 h-24 rounded-xl bg-gray-700 flex items-center justify-center text-4xl border-2 border-dashed border-gray-600">
                      {form.emoji || '🍽'}
                    </div>
                  )}
                  <div className="flex-1">
                    <input ref={fileInputRef} type="file" accept=".png,.jpg,.jpeg,.webp,.gif" onChange={handleImageSelect}
                      className="hidden" id="image-upload" />
                    <label htmlFor="image-upload" className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-gray-300 rounded-lg cursor-pointer hover:bg-gray-600 transition w-fit">
                      <Upload size={16} /> Seleccionar imagen
                    </label>
                    <p className="text-xs text-gray-500 mt-1">PNG, JPG, WEBP, GIF - Max 5MB</p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Nombre</label>
                <input value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Precio ($)</label>
                  <input type="number" step="0.01" value={form.precio} onChange={e => setForm({...form, precio: e.target.value})}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Tiempo Preparación (min)</label>
                  <input type="number" value={form.prep_duration} onChange={e => setForm({...form, prep_duration: parseInt(e.target.value) || 15})}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Categoría</label>
                  <select value={form.categoria} onChange={e => setForm({...form, categoria: e.target.value})}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white">
                    {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Emoji</label>
                  <input value={form.emoji} onChange={e => setForm({...form, emoji: e.target.value})}
                    placeholder="🍔" className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white" />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Descripción</label>
                <textarea value={form.descripcion} onChange={e => setForm({...form, descripcion: e.target.value})}
                  rows={2} className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white resize-none" />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Sucursal</label>
                <select value={form.sucursal_id} onChange={e => setForm({...form, sucursal_id: parseInt(e.target.value)})}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white">
                  {SUCURSALES.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
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
