import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usersAPI } from '../../services/api';

const AdminCustomers = () => {
  const fallbackAvatar = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="100%" height="100%" fill="%23e5e7eb"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%239ca3af" font-size="24" font-family="Arial">👤</text></svg>';

  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [search, setSearch] = useState('');
  const [pagination, setPagination] = useState({ current: 1, pages: 1, total: 0 });

  const params = useMemo(() => ({ page, limit, search }), [page, limit, search]);

  useEffect(() => {
    let isMounted = true;
    const fetchCustomers = async () => {
      setLoading(true);
      setError(null);
      try {
        // Admin endpoint returns all customers (active + blocked)
        let data;
        try {
          data = await usersAPI.getAdminCustomers(params);
        } catch (e) {
          // Fallback: if admin route not found, use public endpoint
          if (e?.message && e.message.toLowerCase().includes('route not found')) {
            data = await usersAPI.getCustomers(params);
          } else {
            throw e;
          }
        }
        if (!isMounted) return;
        setCustomers(data.customers || []);
        setPagination(data.pagination || { current: 1, pages: 1, total: 0 });
      } catch (err) {
        if (!isMounted) return;
        setError(err.message || 'Failed to load customers');
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchCustomers();
    return () => { isMounted = false; };
  }, [params]);

  return (
    <div className="min-h-screen bg-gray-50 p-3 sm:p-4 lg:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-800">Cookie Customers</h1>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <input
              value={search}
              onChange={(e) => { setPage(1); setSearch(e.target.value); }}
              placeholder="Search name, email, phone, location"
              className="w-full sm:w-80 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-red-700 text-sm">{error}</div>
        )}

        {/* Responsive card grid */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
          {loading ? (
            <div className="col-span-1 sm:col-span-2 lg:col-span-3 2xl:col-span-4 rounded-lg border border-gray-200 bg-white p-4">Loading…</div>
          ) : customers.length === 0 ? (
            <div className="col-span-1 sm:col-span-2 lg:col-span-3 2xl:col-span-4 rounded-lg border border-gray-200 bg-white p-4 text-gray-600">No customers found</div>
          ) : (
            customers.map((c) => (
              <div
                key={c._id}
                className={`rounded-lg border border-gray-200 bg-white p-4 sm:p-5 shadow-sm transform transition-transform duration-300 ease-in-out hover:scale-105 transition-shadow ${c.isActive === false ? 'opacity-60' : ''} hover:shadow-[0_8px_24px_rgba(52,211,153,0.35)]`}
              >
                <div className="flex items-start gap-3 sm:gap-4">
                  <img
                    src={c.profileImage || fallbackAvatar}
                    onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = fallbackAvatar; }}
                    alt="avatar"
                    className="h-12 w-12 sm:h-14 sm:w-14 rounded-full object-cover border flex-shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium text-gray-900 text-sm sm:text-base">{c.firstName} {c.lastName}</span>
                      {c.isActive === false && (
                        <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[10px] sm:text-xs font-medium text-red-700 border border-red-200">Blocked</span>
                      )}
                    </div>
                    <div className="mt-0.5 text-xs sm:text-sm text-gray-600 truncate">{c.email}</div>
                    <div className="mt-0.5 text-[11px] sm:text-xs text-gray-500 truncate">{c.location || '-'} • {c.phone}</div>
                  </div>
                </div>
                <div className="mt-3 sm:mt-4 grid grid-cols-2 gap-2 text-xs sm:text-sm text-gray-700">
                  <div className="rounded-md bg-gray-50 px-2 py-1">Works booked: <strong>{c.worksBooked ?? 0}</strong></div>
                  <div className="col-span-2 flex justify-end">
                    <button
                      onClick={() => navigate(`/admin/customers/${c._id}`)}
                      className="inline-flex items-center rounded-md border px-3 py-1.5 text-xs sm:text-sm hover:bg-gray-50"
                    >View</button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        <div className="mt-6 flex items-center justify-between">
          <div className="text-sm text-gray-600">Total: {pagination.total}</div>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-50"
            >Prev</button>
            <span className="text-sm text-gray-700">Page {pagination.current} of {pagination.pages}</span>
            <button
              disabled={page >= pagination.pages || loading}
              onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
              className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-50"
            >Next</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminCustomers;
