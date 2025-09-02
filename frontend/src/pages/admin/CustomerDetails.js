import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usersAPI } from '../../services/api';

const CustomerDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const fallbackAvatar = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="100%" height="100%" fill="%23e5e7eb"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%239ca3af" font-size="28" font-family="Arial">👤</text></svg>';

  useEffect(() => {
    let isMounted = true;
    const fetchDetails = async () => {
      setLoading(true);
      setError(null);
      try {
        const resp = await usersAPI.getCustomerById(id);
        if (!isMounted) return;
        setData(resp);
      } catch (err) {
        if (!isMounted) return;
        setError(err.message || 'Failed to load customer details');
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchDetails();
    return () => { isMounted = false; };
  }, [id]);

  const fullName = useMemo(() => {
    if (!data) return '';
    return [data.firstName, data.lastName].filter(Boolean).join(' ');
  }, [data]);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-800">Customer Details</h1>
          <button onClick={() => navigate('/admin/customers')} className="rounded-md border px-3 py-1.5 text-sm">Back to Customers</button>
        </div>

        {loading && (
          <div className="mt-6 rounded-md border border-gray-200 bg-white p-4">Loading…</div>
        )}
        {error && (
          <div className="mt-6 rounded-md border border-red-200 bg-red-50 p-3 text-red-700 text-sm">{error}</div>
        )}
        {!loading && !error && data && (
          <div className="mt-6 space-y-6">
            {/* Header card */}
            <div className="rounded-lg border border-gray-200 bg-white p-4 sm:p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <img
                  src={data.profileImage || fallbackAvatar}
                  onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = fallbackAvatar; }}
                  alt="avatar"
                  className="h-20 w-20 rounded-full object-cover border"
                />
                <div className="flex-1">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900">{fullName || 'Unnamed Customer'}</h2>
                      <div className="mt-1 text-sm text-gray-600">{data.email}</div>
                      <div className="text-sm text-gray-600">{data.phone}</div>
                      <div className="text-sm text-gray-600">{data.location || '-'}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${data.isActive ? 'bg-green-50 text-green-700 ring-1 ring-green-200' : 'bg-red-50 text-red-700 ring-1 ring-red-200'}`}>
                        {data.isActive ? 'Active' : 'Blocked'}
                      </span>
                      {data.isActive && (
                        <button
                          disabled={actionLoading}
                          onClick={async () => {
                            if (!window.confirm('Are you sure you want to block this user?')) return;
                            setActionLoading(true);
                            setError(null);
                            try {
                              await usersAPI.blockUser(id);
                              setData(prev => ({ ...prev, isActive: false }));
                            } catch (err) {
                              setError(err.message || 'Failed to block user');
                            } finally {
                              setActionLoading(false);
                            }
                          }}
                          className="rounded-md bg-red-600 text-white px-3 py-1.5 text-xs hover:bg-red-700 disabled:opacity-60"
                        >
                          {actionLoading ? 'Blocking…' : 'Block'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="text-sm text-gray-500">Total Works Booked</div>
                <div className="mt-1 text-2xl font-semibold text-gray-900">{data.totalWorksBooked ?? 0}</div>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="text-sm text-gray-500">Distinct Services</div>
                <div className="mt-1 text-2xl font-semibold text-gray-900">{data.servicesBooked?.length ?? 0}</div>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="text-sm text-gray-500">Workers Booked</div>
                <div className="mt-1 text-2xl font-semibold text-gray-900">{data.workersBooked?.length ?? 0}</div>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="text-sm text-gray-500">Reviews Given</div>
                <div className="mt-1 text-2xl font-semibold text-gray-900">{data.reviews?.length ?? 0}</div>
              </div>
            </div>

            {/* Services booked */}
            <div className="rounded-lg border border-gray-200 bg-white p-4 sm:p-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-gray-900">Services Booked</h3>
              </div>
              {(!data.servicesBooked || data.servicesBooked.length === 0) ? (
                <div className="text-sm text-gray-600">No services found</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {data.servicesBooked.map((s, idx) => (
                    <span key={idx} className="inline-flex items-center rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 ring-1 ring-indigo-200">{s}</span>
                  ))}
                </div>
              )}
            </div>

            {/* Workers booked */}
            <div className="rounded-lg border border-gray-200 bg-white p-4 sm:p-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-gray-900">Workers Booked</h3>
              </div>
              {(!data.workersBooked || data.workersBooked.length === 0) ? (
                <div className="text-sm text-gray-600">No workers found</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {data.workersBooked.map((w) => (
                    <div key={w._id} className="flex items-center gap-3 rounded-md border border-gray-200 p-3">
                      <img src={w.profileImage || fallbackAvatar} onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = fallbackAvatar; }} alt="worker" className="h-10 w-10 rounded-full object-cover border" />
                      <div className="min-w-0">
                        <div className="font-medium text-gray-900 truncate">{w.firstName} {w.lastName}</div>
                        <div className="text-xs text-gray-600 truncate">{w.email}</div>
                        <div className="text-xs text-gray-600 truncate">{w.phone}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Reviews */}
            <div className="rounded-lg border border-gray-200 bg-white p-4 sm:p-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-gray-900">Reviews / Feedback</h3>
              </div>
              {(!data.reviews || data.reviews.length === 0) ? (
                <div className="text-sm text-gray-600">No reviews available</div>
              ) : (
                <div className="space-y-3">
                  {data.reviews.map((r, idx) => (
                    <div key={idx} className="rounded-md border border-gray-200 p-3">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center rounded-md bg-yellow-50 px-2 py-0.5 text-xs font-medium text-yellow-800 ring-1 ring-yellow-200">★ {r.rating}</span>
                          <span className="text-sm text-gray-700">{r.workerName}</span>
                          {r.service && <span className="text-xs text-gray-500">• {r.service}</span>}
                        </div>
                        {r.date && <div className="text-xs text-gray-500">{new Date(r.date).toLocaleDateString()}</div>}
                      </div>
                      {r.comment && <div className="mt-2 text-sm text-gray-700">{r.comment}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerDetails;
