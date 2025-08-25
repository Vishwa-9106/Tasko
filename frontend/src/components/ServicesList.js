import React, { useState, useEffect } from 'react';
import { servicesAPI } from '../services/api';

const ServicesList = () => {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchServices = async () => {
      try {
        const data = await servicesAPI.getAllServices();
        setServices(data);
      } catch (err) {
        setError('Failed to load services');
        console.error('Error fetching services:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchServices();
  }, []);

  if (loading) return <div>Loading services...</div>;
  if (error) return <div className="error-message">{error}</div>;

  return (
    <div className="services-container">
      <h2>Available Services</h2>
      {services.length === 0 ? (
        <p>No services available at the moment.</p>
      ) : (
        <div className="services-grid">
          {services.map((service) => (
            <div key={service._id} className="service-card">
              <h3>{service._id}</h3>
              <p>Category: {service.category}</p>
              <p>Average Price: ₹{service.avgPrice?.toFixed(2)}</p>
              <p>Available Workers: {service.workerCount}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ServicesList;
