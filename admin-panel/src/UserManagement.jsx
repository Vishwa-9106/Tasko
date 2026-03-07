import { useMemo, useState } from "react";

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function formatDate(value) {
  const parsed = new Date(value || "");
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(Number.isFinite(Number(value)) ? Number(value) : 0);
}

function statusLabel(value) {
  const normalized = String(value || "").trim();
  if (!normalized) return "-";
  return normalized
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
}

export default function UserManagement({ users }) {
  const [searchText, setSearchText] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");

  const normalizedUsers = useMemo(() => (Array.isArray(users) ? users : []), [users]);

  const filteredUsers = useMemo(() => {
    const query = normalizeText(searchText);
    if (!query) return normalizedUsers;

    return normalizedUsers.filter((user) => {
      const fields = [
        user?.name,
        user?.email,
        user?.phone,
        user?.address,
        ...(Array.isArray(user?.packageNames) ? user.packageNames : [])
      ];
      return fields.some((field) => normalizeText(field).includes(query));
    });
  }, [normalizedUsers, searchText]);

  const selectedUser = useMemo(
    () => normalizedUsers.find((user) => String(user?.uid || user?.id || "") === selectedUserId) || null,
    [normalizedUsers, selectedUserId]
  );

  const summary = useMemo(
    () => ({
      users: normalizedUsers.length,
      orders: normalizedUsers.reduce((sum, user) => sum + (Number(user?.orderCount) || 0), 0),
      packages: normalizedUsers.reduce((sum, user) => sum + (Number(user?.packageCount) || 0), 0)
    }),
    [normalizedUsers]
  );

  return (
    <section className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="erp-card p-4">
          <p className="erp-eyebrow">Users</p>
          <h2 className="text-2xl font-bold text-slate-900">{summary.users}</h2>
        </div>
        <div className="erp-card p-4">
          <p className="erp-eyebrow">Orders</p>
          <h2 className="text-2xl font-bold text-slate-900">{summary.orders}</h2>
        </div>
        <div className="erp-card p-4">
          <p className="erp-eyebrow">Packages</p>
          <h2 className="text-2xl font-bold text-slate-900">{summary.packages}</h2>
        </div>
      </div>

      <div className="erp-card p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">User Management</h2>
            <p className="mt-1 text-sm text-slate-500">
              Review user details, addresses, contact information, orders, and package activity.
            </p>
          </div>

          <label className="block min-w-[260px]">
            <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Search</span>
            <input
              type="text"
              className="erp-input"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Name, email, phone, address, package"
            />
          </label>
        </div>
      </div>

      <div className="erp-card overflow-x-auto p-5">
        <table className="erp-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Address</th>
              <th>Orders</th>
              <th>Packages</th>
              <th>Last Activity</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center text-slate-500">
                  No users found.
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => (
                <tr key={user.uid || user.id}>
                  <td>{user.name || "-"}</td>
                  <td>{user.email || "-"}</td>
                  <td>{user.phone || "-"}</td>
                  <td className="max-w-[240px] whitespace-normal">{user.address || "-"}</td>
                  <td>{user.orderCount || 0}</td>
                  <td>
                    {user.packageCount ? (
                      <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">
                        {user.packageCount}
                      </span>
                    ) : (
                      0
                    )}
                  </td>
                  <td>{formatDate(user.latestActivityAt || user.updatedAt || user.createdAt)}</td>
                  <td>
                    <button
                      type="button"
                      className="erp-btn erp-btn-soft"
                      onClick={() => setSelectedUserId(String(user.uid || user.id || ""))}
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selectedUser ? (
        <div className="erp-drawer-overlay" onClick={() => setSelectedUserId("")}>
          <aside className="erp-drawer !max-w-3xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">User Details</h3>
                <p className="text-sm text-slate-500">{selectedUser.name || selectedUser.email || selectedUser.uid}</p>
              </div>
              <button type="button" className="erp-icon-btn" onClick={() => setSelectedUserId("")}>
                X
              </button>
            </div>

            <div className="space-y-4 text-sm text-slate-700">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Contact</p>
                  <p className="mt-1 font-medium text-slate-900">{selectedUser.name || "-"}</p>
                  <p>Email: {selectedUser.email || "-"}</p>
                  <p>Phone: {selectedUser.phone || "-"}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Address</p>
                  <p className="mt-1 text-slate-900">{selectedUser.address || "No address saved."}</p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-4">
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Total Orders</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">{selectedUser.orderCount || 0}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Service Bookings</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">{selectedUser.serviceBookingCount || 0}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">TaskoMart Orders</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">{selectedUser.taskoMartOrderCount || 0}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Packages</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">{selectedUser.packageCount || 0}</p>
                </div>
              </div>

              <div className="rounded-xl bg-slate-50 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Packages</p>
                  <span className="erp-badge">{selectedUser.packageCount || 0}</span>
                </div>
                {selectedUser.packages?.length ? (
                  <div className="space-y-2">
                    {selectedUser.packages.map((pkg) => (
                      <div key={`${pkg.packageId}-${pkg.packageName}`} className="rounded-xl border border-slate-200 bg-white p-3">
                        <p className="font-medium text-slate-900">{pkg.packageName || `Package ${pkg.packageId}`}</p>
                        <p className="text-xs text-slate-500">
                          Bookings: {pkg.bookingCount || 0} | Last booked: {formatDate(pkg.lastBookedAt)}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-500">No package activity found.</p>
                )}
              </div>

              <div className="rounded-xl bg-slate-50 p-3">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Service Bookings</p>
                  <span className="erp-badge">{selectedUser.serviceBookingCount || 0}</span>
                </div>
                {selectedUser.serviceBookings?.length ? (
                  <div className="overflow-x-auto">
                    <table className="erp-table">
                      <thead>
                        <tr>
                          <th>Booking ID</th>
                          <th>Category</th>
                          <th>Type</th>
                          <th>Status</th>
                          <th>Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedUser.serviceBookings.map((booking) => (
                          <tr key={booking.bookingId || `${booking.category}-${booking.serviceDate}`}>
                            <td>{booking.bookingId || "-"}</td>
                            <td>{booking.subCategory || booking.category || "-"}</td>
                            <td>{statusLabel(booking.bookingType)}</td>
                            <td>{statusLabel(booking.status)}</td>
                            <td>{formatDate(booking.serviceDate)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-slate-500">No service bookings found.</p>
                )}
              </div>

              <div className="rounded-xl bg-slate-50 p-3">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="text-xs uppercase tracking-wide text-slate-500">TaskoMart Orders</p>
                  <span className="erp-badge">{selectedUser.taskoMartOrderCount || 0}</span>
                </div>
                {selectedUser.taskoMartOrders?.length ? (
                  <div className="overflow-x-auto">
                    <table className="erp-table">
                      <thead>
                        <tr>
                          <th>Order ID</th>
                          <th>Total</th>
                          <th>Status</th>
                          <th>Payment</th>
                          <th>Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedUser.taskoMartOrders.map((order) => (
                          <tr key={order.orderId || `${order.orderDate}-${order.totalAmount}`}>
                            <td>{order.orderId || "-"}</td>
                            <td>{formatCurrency(order.totalAmount)}</td>
                            <td>{statusLabel(order.orderStatus)}</td>
                            <td>{statusLabel(order.paymentStatus)}</td>
                            <td>{formatDate(order.orderDate)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-slate-500">No TaskoMart orders found.</p>
                )}
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </section>
  );
}
