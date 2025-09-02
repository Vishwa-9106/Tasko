import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usersAPI } from '../../services/api';

const AdminWorkers = () => {
  const fallbackAvatar = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="100%" height="100%" fill="%23e5e7eb"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%239ca3af" font-size="24" font-family="Arial">👤</text></svg>';
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [search, setSearch] = useState('');
  const [pagination, setPagination] = useState({ current: 1, pages: 1, total: 0 });

  const params = useMemo(() => ({ page, limit, search }), [page, limit, search]);

  useEffect(() => {
    let isMounted = true;
    const fetchWorkers = async () => {
      setLoading(true);
      setError(null);
      try {
        // Admin endpoint returns all workers (active + blocked)
        const data = await usersAPI.getAdminWorkers(params);
        if (!isMounted) return;
        setWorkers(data.workers || []);
        setPagination(data.pagination || { current: 1, pages: 1, total: 0 });
      } catch (err) {
        if (!isMounted) return;
        setError(err.message || 'Failed to load workers');
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchWorkers();
    return () => {
      isMounted = false;
    };
  }, [params]);

  const navigate = useNavigate();

  const onSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h1 className="text-2xl font-semibold text-gray-800">Cookie Workers</h1>
          <form onSubmit={onSearchSubmit} className="flex gap-2 w-full sm:w-auto">
            <input
              type="text"
              placeholder="Search by name, service, or location"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full sm:w-72 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button type="submit" className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
              Search
            </button>
          </form>
        </div>

        {/* Status */}
        {loading && (
          <div className="mt-6 text-gray-500">Loading workers…</div>
        )}
        {error && (
          <div className="mt-6 rounded-md bg-red-50 p-3 text-red-700 border border-red-200">{error}</div>
        )}

        {!loading && !error && (
          <>
            {/* Responsive card grid */}
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
              {workers.map((w) => (
                <div
                  key={w._id}
                  className={`rounded-lg border border-gray-200 bg-white p-4 sm:p-5 transform transition-transform duration-300 ease-in-out hover:scale-105 ${w.isActive ? '' : 'opacity-60'}`}
                  style={{ boxShadow: '0 8px 20px rgba(59, 130, 246, 0.25)' }}
                >
                  <div className="flex items-start gap-3 sm:gap-4">
                    <img
                      src={w.profileImage || fallbackAvatar}
                      onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = fallbackAvatar; }}
                      alt="avatar"
                      className="h-12 w-12 sm:h-14 sm:w-14 rounded-full object-cover border flex-shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium text-gray-900 text-sm sm:text-base">{w.firstName} {w.lastName}</span>
                        {!w.isActive && (
                          <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[10px] sm:text-xs font-medium text-red-700 border border-red-200">Blocked</span>
                        )}
                      </div>
                      <div className="mt-0.5 text-xs sm:text-sm text-gray-600 truncate">{w.email}</div>
                      <div className="mt-0.5 text-[11px] sm:text-xs text-gray-500 truncate">{w.location || '-'} • {w.phone}</div>
                    </div>
                  </div>
                  <div className="mt-3 sm:mt-4 grid grid-cols-2 gap-2 text-xs sm:text-sm text-gray-700">
                    <div className="rounded-md bg-gray-50 px-2 py-1">Completed: <strong>{w.completedJobs ?? 0}</strong></div>
                    <div className="rounded-md bg-gray-50 px-2 py-1">Rating: <strong>{w.rating?.toFixed?.(1) || '0.0'}</strong> ({w.reviewCount || 0})</div>
                    <div className="rounded-md bg-gray-50 px-2 py-1 col-span-2">Services: <strong>{Array.isArray(w.services) ? w.services.length : 0}</strong></div>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <button
                      onClick={() => navigate(`/admin/workers/${w._id}`)}
                      className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-1.5 text-xs sm:text-sm font-medium text-white hover:bg-indigo-700"
                    >View</button>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            <div className="mt-6 flex items-center justify-between">
              <div className="text-sm text-gray-600">Total: {pagination.total}</div>
              <div className="flex items-center gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-700">Page {pagination.current} of {pagination.pages}</span>
                <button
                  disabled={page >= pagination.pages}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AdminWorkers;
