import React, { useEffect, useMemo, useState } from 'react';
import { productsAPI } from '../../services/api';

const CATEGORIES = [
  { label: 'fruits', value: 'fruits' },
  { label: 'vegtable', value: 'vegtable' },
  { label: 'Grocery', value: 'Grocery' },
];

const BACKEND_BASE = (process.env.REACT_APP_API_URL || 'http://localhost:5000/api').replace(/\/?api\/?$/, '');

const emptyForm = {
  name: '',
  description: '',
  price: '',
  stock: '',
  category: CATEGORIES[0].value,
  image: null,
};

const ProductModal = ({ open, mode = 'add', initialValues = emptyForm, onClose, onSubmit, submitting }) => {
  const [form, setForm] = useState(initialValues);
  const [error, setError] = useState('');

  useEffect(() => {
    setForm(initialValues);
    setError('');
  }, [initialValues, open]);

  const handleChange = (e) => {
    const { name, value, files } = e.target;
    if (name === 'image') {
      setForm((f) => ({ ...f, image: files && files[0] ? files[0] : null }));
    } else {
      setForm((f) => ({ ...f, [name]: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.name || form.price === '' || form.stock === '' || !form.category) {
      setError('Please fill all required fields');
      return;
    }
    try {
      await onSubmit(form);
    } catch (err) {
      setError(err.message || 'Action failed');
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-xl rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h3 className="text-lg font-semibold text-gray-800">{mode === 'edit' ? 'Edit Product' : 'Add Product'}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {error && <div className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-700">Product Name</label>
            <input name="name" type="text" value={form.name} onChange={handleChange} className="mt-1 w-full rounded border px-3 py-2 focus:outline-none focus:ring" placeholder="e.g., Apple" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Description</label>
            <textarea name="description" value={form.description} onChange={handleChange} className="mt-1 w-full rounded border px-3 py-2 focus:outline-none focus:ring" rows={3} placeholder="Optional details" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-gray-700">Price</label>
              <input name="price" type="number" min="0" step="0.01" value={form.price} onChange={handleChange} className="mt-1 w-full rounded border px-3 py-2 focus:outline-none focus:ring" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Stock</label>
              <input name="stock" type="number" min="0" step="1" value={form.stock} onChange={handleChange} className="mt-1 w-full rounded border px-3 py-2 focus:outline-none focus:ring" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Category</label>
              <select name="category" value={form.category} onChange={handleChange} className="mt-1 w-full rounded border px-3 py-2 focus:outline-none focus:ring">
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Image</label>
            <input name="image" type="file" accept="image/*" onChange={handleChange} className="mt-1 w-full rounded border px-3 py-2 focus:outline-none focus:ring" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="rounded border px-4 py-2 text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={submitting} className="rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-60">
              {submitting ? 'Saving...' : (mode === 'edit' ? 'Save' : 'Add')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const AdminProducts = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // 'add' | 'edit'
  const [editing, setEditing] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await productsAPI.list();
      setProducts(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message || 'Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openAdd = () => {
    setModalMode('add');
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (p) => {
    setModalMode('edit');
    setEditing(p);
    setModalOpen(true);
  };

  const handleSubmit = async (form) => {
    setSubmitting(true);
    try {
      if (modalMode === 'add') {
        await productsAPI.create({
          name: form.name,
          description: form.description,
          price: Number(form.price),
          stock: Number(form.stock),
          category: form.category,
          image: form.image,
        });
      } else if (modalMode === 'edit' && editing) {
        await productsAPI.update(editing._id, {
          name: form.name,
          description: form.description,
          price: form.price === '' ? undefined : Number(form.price),
          stock: form.stock === '' ? undefined : Number(form.stock),
          category: form.category,
          image: form.image,
        });
      }
      await load();
      setModalOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this product?')) return;
    try {
      await productsAPI.remove(id);
      await load();
    } catch (e) {
      alert(e.message || 'Delete failed');
    }
  };

  const cards = useMemo(() => products, [products]);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">Cookie's Products</h1>
          <p className="text-gray-500">Manage groceries and produce.</p>
        </div>
        <button onClick={openAdd} className="rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700">Add Product</button>
      </div>

      {error && <div className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {loading ? (
        <div className="text-gray-500">Loading...</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-600">Image</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-600">Product Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-600">Description</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-600">Price</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-600">Stock</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-600">Category</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {cards.map((p) => (
                <tr key={p._id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-4 py-3">
                    {p.imageUrl ? (
                      <img src={`${BACKEND_BASE}${p.imageUrl}`} alt={p.name} className="h-14 w-14 rounded object-cover" />
                    ) : (
                      <div className="flex h-14 w-14 items-center justify-center rounded bg-gray-100 text-xs text-gray-400">No Image</div>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-gray-900">{p.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600"><span className="line-clamp-2 block max-w-xs sm:max-w-md">{p.description || '-'}</span></td>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-900">₹{Number(p.price).toFixed(2)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                    {Number(p.stock) === 0 ? (
                      <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">Out of Stock</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span>{p.stock}</span>
                        {Number(p.stock) > 0 && Number(p.stock) < 5 && (
                          <span className="inline-flex items-center rounded-full bg-yellow-50 px-2 py-0.5 text-[10px] font-medium text-yellow-800">Low</span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-700">{p.category}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => openEdit(p)} className="rounded border px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">Edit</button>
                      <button onClick={() => handleDelete(p._id)} className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
              {cards.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-gray-500">No products yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <ProductModal
        open={modalOpen}
        mode={modalMode}
        initialValues={modalMode === 'edit' && editing ? {
          name: editing.name || '',
          description: editing.description || '',
          price: editing.price ?? '',
          stock: editing.stock ?? '',
          category: editing.category || CATEGORIES[0].value,
          image: null,
        } : emptyForm}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        submitting={submitting}
      />
    </div>
  );
};

export default AdminProducts;
