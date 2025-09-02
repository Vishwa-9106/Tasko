import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usersAPI } from '../../services/api';

const Stat = ({ label, value }) => (
  <div className="rounded-lg border border-gray-200 p-4 bg-white">
    <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
    <div className="mt-1 text-xl font-semibold text-gray-900">{value}</div>
  </div>
);

const WorkerDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [worker, setWorker] = useState(null);
  const [reviews, setReviews] = useState({ reviews: [], totalReviews: 0, averageRating: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const fallbackAvatar = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="100%" height="100%" fill="%23e5e7eb"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%239ca3af" font-size="40" font-family="Arial">👤</text></svg>';

  useEffect(() => {
    let isMounted = true;
    const fetchAll = async () => {
      setLoading(true);
      setError(null);
      try {
        // Try admin endpoint first (includes blocked workers). Fallback to public if needed.
        let workerResp;
        try {
          workerResp = await usersAPI.getAdminWorkerById(id);
        } catch (e) {
          workerResp = await usersAPI.getWorkerById(id);
        }

        const r = await usersAPI.getWorkerReviews(id);
        if (!isMounted) return;
        setWorker(workerResp);
        setReviews(r);
      } catch (err) {
        if (!isMounted) return;
        setError(err.message || 'Failed to load worker');
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchAll();
    return () => { isMounted = false; };
  }, [id]);

  if (loading) {
    return <div className="min-h-screen bg-gray-50 p-6"><div className="max-w-5xl mx-auto text-gray-600">Loading…</div></div>;
  }
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-5xl mx-auto">
          <div className="rounded-md border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>
          <button onClick={() => navigate(-1)} className="mt-4 rounded-md border px-3 py-1.5 text-sm">Go back</button>
        </div>
      </div>
    );
  }
  if (!worker) return null;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        <button onClick={() => navigate(-1)} className="text-sm text-indigo-600 hover:underline">← Back</button>
        <div className="mt-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row gap-6">
            <img src={worker.profileImage || fallbackAvatar} onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = fallbackAvatar; }} alt="avatar" className="h-24 w-24 sm:h-28 sm:w-28 rounded-full object-cover border" />
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-4">
                <h1 className="text-2xl font-semibold text-gray-900 truncate">{worker.firstName} {worker.lastName}</h1>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${worker.isActive ? 'bg-green-50 text-green-700 ring-1 ring-green-200' : 'bg-red-50 text-red-700 ring-1 ring-red-200'}`}>
                    {worker.isActive ? 'Active' : 'Blocked'}
                  </span>
                  {worker.isActive && (
                    <button
                      disabled={actionLoading}
                      onClick={async () => {
                        if (!window.confirm('Are you sure you want to block this user?')) return;
                        setActionLoading(true);
                        setError(null);
                        try {
                          const resp = await usersAPI.blockUser(id);
                          setWorker(prev => ({ ...prev, isActive: false }));
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
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1 text-sm text-gray-700">
                <div><span className="text-gray-500">Email:</span> {worker.email}</div>
                <div><span className="text-gray-500">Phone:</span> {worker.phone}</div>
                <div><span className="text-gray-500">Location:</span> {worker.location || '-'}</div>
                <div><span className="text-gray-500">Status:</span> {worker.isActive ? 'Active' : 'Blocked'}</div>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="Completed" value={worker.completedJobs ?? 0} />
            <Stat label="Rating" value={`${(worker.rating ?? 0).toFixed(1)} / 5`} />
            <Stat label="Reviews" value={worker.reviewCount ?? 0} />
            <Stat label="Services" value={Array.isArray(worker.services) ? worker.services.length : 0} />
          </div>
        </div>

        {/* Services */}
        <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Categories & Services</h2>
          {Array.isArray(worker.services) && worker.services.length > 0 ? (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {worker.services.map((s, idx) => (
                <div key={idx} className="rounded-lg border border-gray-200 p-4">
                  <div className="font-medium text-gray-900">{s.name}</div>
                  <div className="text-sm text-gray-600">Category: {s.category || '-'}</div>
                  {s.price != null && (
                    <div className="text-sm text-gray-700 mt-1">Price: ₹{s.price}</div>
                  )}
                  {s.duration != null && (
                    <div className="text-sm text-gray-700">Duration: {s.duration} min</div>
                  )}
                  {s.description && (
                    <div className="text-sm text-gray-500 mt-2">{s.description}</div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-gray-600">No services listed.</p>
          )}
        </div>

        {/* Reviews */}
        <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Reviews & Ratings</h2>
            <div className="text-sm text-gray-600">Average: {(reviews.averageRating ?? 0).toFixed(1)} • Total: {reviews.totalReviews}</div>
          </div>
          {Array.isArray(reviews.reviews) && reviews.reviews.length > 0 ? (
            <div className="mt-4 space-y-4">
              {reviews.reviews.map((rv, idx) => (
                <div key={idx} className="rounded-lg border border-gray-200 p-4">
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-gray-900">{rv.customerName || 'Customer'}</div>
                    <div className="text-sm text-gray-700">{rv.rating} / 5</div>
                  </div>
                  <div className="text-sm text-gray-500">{new Date(rv.createdAt).toLocaleString()}</div>
                  {rv.comment && <div className="mt-2 text-gray-700">{rv.comment}</div>}
                  {rv.serviceName && <div className="mt-1 text-xs text-gray-500">Service: {rv.serviceName}</div>}
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-gray-600">No reviews yet.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default WorkerDetails;
