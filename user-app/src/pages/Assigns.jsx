import { useEffect, useState } from "react";
import api from "../api";
import { useAuth } from "../context/AuthContext";

export default function AssignsPage() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);

  useEffect(() => {
    if (!user) return;

    const loadBookings = async () => {
      const response = await api.get("/api/bookings", {
        params: { userId: user.uid }
      });
      setBookings(response.data);
    };

    loadBookings().catch(() => setBookings([]));
  }, [user]);

  return (
    <div className="card">
      <h2 className="mb-4 text-2xl font-bold">Assigns</h2>
      {bookings.length === 0 ? (
        <p className="text-sm text-slate-600">No assignments yet. Place a booking from Home.</p>
      ) : (
        <div className="space-y-3">
          {bookings.map((booking) => (
            <div key={booking.id} className="rounded-lg border border-slate-200 p-4">
              <p className="font-semibold">{booking.category}</p>
              <p className="text-sm text-slate-600">
                {booking.date} at {booking.time}
              </p>
              <p className="text-xs uppercase tracking-wide text-brand-700">Status: {booking.status}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}