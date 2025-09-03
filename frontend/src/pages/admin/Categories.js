import React, { useState } from 'react';
import * as CAT from '../../constants/categories';
import { servicesAPI, categoriesAPI } from '../../services/api';
const {
  CATEGORIES,
  ICON_MAP,
  HOME_CLEANING_OPTIONS,
  LAUNDRY_OPTIONS,
  DISHWASHING_OPTIONS,
  COOKING_OPTIONS,
  GARDENING_OPTIONS,
  BABYSITTING_OPTIONS,
  MAINTENANCE_OPTIONS,
  CLOUD_KITCHEN_OPTIONS,
} = CAT;

const AdminCategories = () => {
  const [categoryList, setCategoryList] = useState(CATEGORIES || []);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newServiceName, setNewServiceName] = useState('');
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryServices, setNewCategoryServices] = useState('');

  const OPTIONS_MAP = {
    'Home Cleaning': HOME_CLEANING_OPTIONS,
    'Laundry': LAUNDRY_OPTIONS,
    'Dishwashing': DISHWASHING_OPTIONS,
    'Cooking': COOKING_OPTIONS,
    'Gardening': GARDENING_OPTIONS,
    'Baby Sitting': BABYSITTING_OPTIONS,
    'Maintenance': MAINTENANCE_OPTIONS,
    'Cloud Kitchen': CLOUD_KITCHEN_OPTIONS,
  };

  const toConstName = (categoryName) =>
    (categoryName || '')
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_') + '_OPTIONS';

  const getOptionsForCategory = (name) => {
    if (OPTIONS_MAP[name]) return OPTIONS_MAP[name];
    // Look for dynamically created OPTIONS export
    const constName = toConstName(name);
    return CAT[constName] || [];
  };

  const handleDeleteService = async (name) => {
    if (!selectedCategory || !name) return;
    try {
      setLoading(true);
      await categoriesAPI.deleteService(selectedCategory, name);
      setServices((prev) => prev.filter((s) => (s.label || s.__name || s._id || s.name) !== name));
    } catch (e) {
      setError(e.message || 'Failed to delete service');
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryClick = async (name) => {
    setSelectedCategory(name);
    setLoading(true);
    setError(null);
    try {
      // Always fetch aggregated services to compute counts
      const all = await servicesAPI.getAllServices();
      const inCategory = (all || []).filter(s => s.category === name);
      const countMap = new Map();
      inCategory.forEach((s) => {
        const key = s._id || s.name; // backend groups by services.name into _id
        if (!key) return;
        countMap.set(key, (s.workerCount ?? 0));
      });

      const predefined = getOptionsForCategory(name);
      if (predefined && predefined.length) {
        const merged = predefined.map((label) => ({
          label,
          workerCount: countMap.get(label) ?? 0,
        }));
        setServices(merged);
      } else {
        const mapped = inCategory.map((s) => ({
          label: s._id || s.name,
          workerCount: s.workerCount ?? 0,
        }));
        setServices(mapped);
      }
    } catch (e) {
      setError(e.message || 'Failed to load services');
      setServices([]);
    } finally {
      setLoading(false);
    }
  };

  const clearSelection = () => {
    setSelectedCategory(null);
    setServices([]);
    setError(null);
    setShowAddForm(false);
    setNewServiceName('');
  };

  const submitAddService = async () => {
    if (!selectedCategory) return;
    const name = newServiceName.trim();
    if (!name) return;
    try {
      setLoading(true);
      await categoriesAPI.addService(selectedCategory, name);
      // Update local list: add if not present
      setServices((prev) => {
        const exists = prev.some((s) => (s.label || s.__name || s._id || s.name) === name);
        if (exists) return prev;
        return [...prev, { label: name, workerCount: 0 }];
      });
      setShowAddForm(false);
      setNewServiceName('');
    } catch (e) {
      setError(e.message || 'Failed to add service');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-800">Service Categories</h1>
          <button
            type="button"
            className="inline-flex items-center rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2"
            onClick={() => setShowCategoryModal(true)}
          >
            Add Category
          </button>
        </div>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
          {categoryList.map((name) => {
            const Icon = ICON_MAP[name];
            return (
              <div
                key={name}
                className={`group rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-transform duration-300 ease-in-out hover:scale-[1.02] transition-shadow hover:shadow-[0_10px_28px_rgba(251,146,60,0.45)] ${selectedCategory === name ? 'ring-2 ring-amber-300' : ''}`}
                role="button"
                tabIndex={0}
                onClick={() => handleCategoryClick(name)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleCategoryClick(name); }}
              >
                <div className="flex items-start gap-4">
                  <div className="rounded-lg p-3 bg-amber-50 text-amber-600 ring-1 ring-amber-100">
                    {Icon ? <Icon className="h-6 w-6" /> : <div className="h-6 w-6" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-lg font-medium text-gray-900">{name}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {selectedCategory && (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xl font-semibold text-gray-800">Services in {selectedCategory}</h2>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="inline-flex items-center rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 disabled:opacity-50"
                  disabled={!selectedCategory || loading}
                  onClick={() => setShowAddForm((v) => !v)}
                >
                  Add Service
                </button>
                <button
                  className="text-sm text-amber-600 hover:text-amber-700 font-medium"
                  onClick={clearSelection}
                >
                  Clear selection
                </button>
              </div>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              {showAddForm && (
                <div className="mb-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <input
                    type="text"
                    className="w-full sm:w-80 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                    placeholder={`New service in ${selectedCategory}`}
                    value={newServiceName}
                    onChange={(e) => setNewServiceName(e.target.value)}
                    disabled={loading}
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="inline-flex items-center rounded-md bg-amber-500 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-amber-600 disabled:opacity-50"
                      onClick={submitAddService}
                      disabled={loading || !newServiceName.trim()}
                    >
                      Add
                    </button>
                    <button
                      type="button"
                      className="text-sm text-gray-600 hover:text-gray-800"
                      onClick={() => { setShowAddForm(false); setNewServiceName(''); }}
                      disabled={loading}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              {loading ? (
                <div className="text-gray-600 text-sm">Loading services…</div>
              ) : error ? (
                <div className="text-red-600 text-sm">{error}</div>
              ) : services.length === 0 ? (
                <div className="text-gray-600 text-sm">No services found in this category.</div>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {services.map((s, idx) => {
                    const label = s.label || s.__name || s._id || s.name || `Service ${idx + 1}`;
                    const count = s.workerCount ?? '-';
                    return (
                      <li key={label} className="py-3 flex items-center justify-between">
                        <div className="font-medium text-gray-800">{label}</div>
                        <div className="flex items-center gap-4">
                          <div className="text-sm text-gray-500">Workers: {count}</div>
                          <button
                            type="button"
                            style={{ color: 'red', cursor: 'pointer', background: 'transparent', border: 'none', padding: 0 }}
                            onClick={() => handleDeleteService(label)}
                            disabled={loading}
                          >
                            Delete
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
    {showCategoryModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/30" onClick={() => setShowCategoryModal(false)} />
        {/* Modal */}
        <div className="relative z-10 w-full max-w-lg rounded-xl bg-white p-5 shadow-xl">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-800">Add New Category</h3>
            <p className="text-sm text-gray-500">Create a category and add its services (comma-separated)</p>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category Name</label>
              <input
                type="text"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                placeholder="e.g., Housekeeping"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Services List (comma-separated)</label>
              <textarea
                rows={4}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                placeholder="Service A, Service B, Service C"
                value={newCategoryServices}
                onChange={(e) => setNewCategoryServices(e.target.value)}
              />
            </div>
          </div>
          <div className="mt-5 flex items-center justify-end gap-3">
            <button
              type="button"
              className="text-sm font-medium text-gray-600 hover:text-gray-800"
              onClick={() => { setShowCategoryModal(false); setNewCategoryName(''); setNewCategoryServices(''); }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="inline-flex items-center rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-amber-600 disabled:opacity-50"
              onClick={async () => {
                const name = newCategoryName.trim();
                if (!name) return;
                const services = newCategoryServices
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean);
                try {
                  setLoading(true);
                  await categoriesAPI.addCategory(name, services);
                  // Update categories locally so card appears immediately
                  setCategoryList((prev) => (prev.includes(name) ? prev : [...prev, name]));
                  // If this category has services predefined, selecting it will show them
                  setShowCategoryModal(false);
                  setNewCategoryName('');
                  setNewCategoryServices('');
                } catch (e) {
                  setError(e.message || 'Failed to add category');
                } finally {
                  setLoading(false);
                }
              }}
              disabled={!newCategoryName.trim() || loading}
            >
              Add
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
};

export default AdminCategories;
