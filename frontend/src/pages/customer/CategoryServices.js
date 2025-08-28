import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { servicesAPI, usersAPI } from '../../services/api';
import { ArrowLeft, Search } from 'lucide-react';

// Helper: convert slug to readable title
const unslugify = (slug) => slug.replace(/-/g, ' ').replace(/\s+/g, ' ').trim().replace(/\b\w/g, (m) => m.toUpperCase());

const CategoryServices = () => {
  const navigate = useNavigate();
  const { categoryName } = useParams();
  const readableCategory = useMemo(() => unslugify(categoryName || ''), [categoryName]);

  const [services, setServices] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch services by category
        const svcData = await servicesAPI.getServicesByCategory(readableCategory);
        const normalizedServices = (Array.isArray(svcData?.services) ? svcData.services : Array.isArray(svcData) ? svcData : [])
          .map((s, idx) => ({
            id: s._id || s.id || `svc-${idx}`,
            name: s.name || s.category || 'Service',
            description: s.description || '',
            category: s.category || readableCategory,
          }));
        setServices(normalizedServices);

        // Fetch workers (used to compute how many offer each service)
        // Backend commonly returns services per worker in usersAPI.getWorkerById; for list, we expect similar shape
        const workersResp = await usersAPI.getWorkers();
        const normalizedWorkers = (Array.isArray(workersResp?.workers) ? workersResp.workers : Array.isArray(workersResp) ? workersResp : [])
          .map((w, idx) => ({
            id: w._id || w.id || `w-${idx}`,
            name: `${w.firstName || ''} ${w.lastName || ''}`.trim() || 'Worker',
            services: Array.isArray(w.services) ? w.services.map((sv, sidx) => ({
              id: sv._id || sv.id || `w-svc-${sidx}`,
              name: sv.name || sv.category || '',
              category: sv.category || '',
            })) : [],
          }));
        setWorkers(normalizedWorkers);
      } catch (e) {
        console.error('Error loading category services:', e);
        setError(e.message || 'Failed to load services');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [readableCategory]);

  const workerCountForService = (service) => {
    const sid = String(service.id);
    const sname = (service.name || '').toLowerCase();
    return workers.reduce((acc, w) => (
      w.services?.some((sv) => String(sv.id) === sid || (sv.name || '').toLowerCase() === sname) ? acc + 1 : acc
    ), 0);
  };

  const getAnyWorkerForService = (service) => {
    const sid = String(service.id);
    const sname = (service.name || '').toLowerCase();
    const found = workers.find((w) => w.services?.some((sv) => String(sv.id) === sid || (sv.name || '').toLowerCase() === sname));
    return found?.id;
  };

  const handleBook = (service) => {
    const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';
    const userType = localStorage.getItem('userType');

    const workerId = getAnyWorkerForService(service);
    const target = `/customer/bookings/${service.id}`;

    if (!isAuthenticated || userType !== 'customer') {
      navigate('/login', { state: { redirectTo: target } });
      return;
    }

    if (!workerId) {
      // Fallback: navigate to search filtered by category
      navigate('/customer/search', { state: { category: service.category, serviceName: service.name } });
      return;
    }

    navigate(target, {
      state: {
        prefill: {
          serviceId: service.id,
          serviceName: service.name,
          workerId,
        }
      }
    });
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading services...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-red-600 mb-4">{error}</p>
          <button onClick={() => navigate(-1)} className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors mr-3">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{readableCategory}</h1>
            <p className="text-gray-600 text-sm sm:text-base">Browse services in this category</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
        {/* Search filter placeholder */}
        <div className="mb-6 sm:mb-8">
          <div className="flex items-center bg-white border border-gray-200 rounded-lg px-3 py-2 sm:px-4 sm:py-3 shadow-sm">
            <Search className="h-4 w-4 sm:h-5 w-5 text-gray-400 mr-2" />
            <input
              type="text"
              placeholder={`Search within ${readableCategory}`}
              className="flex-1 outline-none text-sm sm:text-base"
              onChange={() => {}}
            />
          </div>
        </div>

        {services.length === 0 ? (
          <p className="text-gray-600">No services found in this category.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {services.map((svc) => {
              const count = workerCountForService(svc);
              return (
                <div
                  key={svc.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleBook(svc)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleBook(svc); } }}
                  className="border border-gray-200 rounded-lg p-4 sm:p-5 bg-white shadow-sm cursor-pointer hover:shadow-md hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">{svc.name}</h3>
                  </div>
                  {svc.description ? (
                    <p className="mt-2 text-sm text-gray-700 line-clamp-3">{svc.description}</p>
                  ) : (
                    <p className="mt-2 text-sm text-gray-500">No description provided.</p>
                  )}
                  <div className="mt-3 text-sm text-gray-600">
                    Available workers: <span className="font-medium text-gray-900">{count}</span>
                  </div>
                  <div className="mt-4">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleBook(svc); }}
                      className="w-full px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
                    >
                      Book Now
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default CategoryServices;
