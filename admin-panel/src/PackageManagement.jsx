import { useEffect, useMemo, useState } from "react";
import api from "./api";

const defaultCategories = ["Home Care", "Cleaning", "Vehicle Care", "Grooming", "Garden", "Deep Cleaning"];
const visitFrequencyOptions = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "every_2_days", label: "Every 2 Days" },
  { value: "monthly", label: "Monthly" }
];
const tagOptions = ["", "Most Popular", "Recommended"];

function createEmptyDraft() {
  return {
    name: "",
    category: defaultCategories[0],
    price: "",
    duration_days: "30",
    visit_frequency: "weekly",
    description: "",
    servicesIncluded: [""],
    package_tag: "",
    display_order: "1",
    status: "active"
  };
}

function normalizeStatus(value) {
  if (typeof value === "boolean") {
    return value ? "active" : "disabled";
  }

  const normalized = String(value || "").trim().toLowerCase();
  if (["disabled", "inactive", "false", "0", "hidden"].includes(normalized)) {
    return "disabled";
  }
  return "active";
}

function normalizeServices(input, details) {
  const fromInput = Array.isArray(input)
    ? input.map((entry) => String(entry || "").trim()).filter(Boolean)
    : [];
  if (fromInput.length > 0) {
    return Array.from(new Set(fromInput));
  }

  return Array.isArray(details)
    ? Array.from(
        new Set(
          details
            .map((entry) => String(entry?.sub_category_name || "").trim())
            .filter(Boolean)
        )
      )
    : [];
}

function normalizePackage(record, index) {
  const serviceDetails = Array.isArray(record?.service_details) ? record.service_details : [];
  const servicesIncluded = normalizeServices(
    record?.servicesIncluded || record?.services_included || record?.services,
    serviceDetails
  );
  const durationDays = Number(record?.duration_days ?? record?.duration);
  const displayOrder = Number(record?.displayOrder ?? record?.display_order ?? index + 1);

  return {
    id: String(record?.id || record?.package_id || index + 1),
    package_id: Number(record?.package_id || record?.id || index + 1),
    name: String(record?.name || record?.package_name || `Tasko Package ${index + 1}`).trim(),
    category: String(record?.category || serviceDetails?.[0]?.category_name || "General").trim(),
    price: Number.isFinite(Number(record?.price)) ? Number(record.price) : 0,
    duration_days: Number.isFinite(durationDays) && durationDays > 0 ? Math.trunc(durationDays) : 30,
    visit_frequency: String(record?.visitFrequency || record?.visit_frequency || "weekly").trim(),
    description: String(
      record?.description || "Tasko recurring service package with verified professionals."
    ).trim(),
    servicesIncluded,
    package_tag: String(record?.packageTag || record?.package_tag || "").trim(),
    display_order: Number.isFinite(displayOrder) && displayOrder >= 0 ? Math.trunc(displayOrder) : index + 1,
    status: normalizeStatus(record?.status ?? record?.enabled ?? record?.isActive),
    created_at: String(record?.createdAt || record?.created_at || "").trim(),
    updated_at: String(record?.updatedAt || record?.updated_at || "").trim(),
    service_details: serviceDetails
  };
}

function formatMoney(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(Number.isFinite(Number(value)) ? Number(value) : 0);
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

function formatFrequency(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "every_2_days") return "Every 2 Days";
  if (normalized === "daily") return "Daily";
  if (normalized === "weekly") return "Weekly";
  if (normalized === "monthly") return "Monthly";
  return "Flexible";
}

export default function PackageManagement({ pushToast, onSessionExpired }) {
  const [packages, setPackages] = useState([]);
  const [categories, setCategories] = useState(defaultCategories);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [togglingId, setTogglingId] = useState("");
  const [editingPackageId, setEditingPackageId] = useState("");
  const [draft, setDraft] = useState(createEmptyDraft);
  const [searchText, setSearchText] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [detailPackage, setDetailPackage] = useState(null);

  const loadPackages = async () => {
    setLoading(true);
    try {
      const response = await api.get("/api/admin/packages");
      const nextPackages = Array.isArray(response.data?.packages)
        ? response.data.packages.map((item, index) => normalizePackage(item, index))
        : [];
      const nextCategories = Array.isArray(response.data?.categories)
        ? response.data.categories.map((item) => String(item || "").trim()).filter(Boolean)
        : [];
      setPackages(nextPackages);
      setCategories(Array.from(new Set([...defaultCategories, ...nextCategories])).sort((left, right) => left.localeCompare(right)));
    } catch (error) {
      if (error?.response?.status === 401) {
        await onSessionExpired?.();
        return;
      }
      pushToast?.("error", error?.response?.data?.message || "Failed to load packages.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPackages().catch(() => {});
  }, []);

  const filteredPackages = useMemo(() => {
    const query = String(searchText || "").trim().toLowerCase();
    return packages.filter((pkg) => {
      if (categoryFilter !== "all" && pkg.category !== categoryFilter) {
        return false;
      }
      if (statusFilter !== "all" && pkg.status !== statusFilter) {
        return false;
      }
      if (!query) {
        return true;
      }

      const haystack = [pkg.name, pkg.category, pkg.description, pkg.package_tag, ...pkg.servicesIncluded]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [packages, searchText, categoryFilter, statusFilter]);

  const summary = useMemo(
    () => ({
      total: packages.length,
      active: packages.filter((pkg) => pkg.status === "active").length,
      disabled: packages.filter((pkg) => pkg.status === "disabled").length
    }),
    [packages]
  );

  const resetDraft = () => {
    setDraft(createEmptyDraft());
    setEditingPackageId("");
  };

  const handleDraftChange = (field, value) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const updateServiceItem = (index, value) => {
    setDraft((current) => ({
      ...current,
      servicesIncluded: current.servicesIncluded.map((item, itemIndex) => (itemIndex === index ? value : item))
    }));
  };

  const addServiceItem = () => {
    setDraft((current) => ({
      ...current,
      servicesIncluded: [...current.servicesIncluded, ""]
    }));
  };

  const removeServiceItem = (index) => {
    setDraft((current) => ({
      ...current,
      servicesIncluded:
        current.servicesIncluded.length <= 1
          ? [""]
          : current.servicesIncluded.filter((_, itemIndex) => itemIndex !== index)
    }));
  };

  const handleEdit = (pkg) => {
    setEditingPackageId(pkg.id);
    setDraft({
      name: pkg.name,
      category: pkg.category,
      price: String(pkg.price),
      duration_days: String(pkg.duration_days),
      visit_frequency: pkg.visit_frequency,
      description: pkg.description,
      servicesIncluded: pkg.servicesIncluded.length > 0 ? pkg.servicesIncluded : [""],
      package_tag: pkg.package_tag,
      display_order: String(pkg.display_order || 1),
      status: pkg.status
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);

    try {
      const payload = {
        name: draft.name,
        category: draft.category,
        price: Number(draft.price || 0),
        duration_days: Number(draft.duration_days || 0),
        visit_frequency: draft.visit_frequency,
        description: draft.description,
        servicesIncluded: draft.servicesIncluded.map((item) => item.trim()).filter(Boolean),
        package_tag: draft.package_tag,
        display_order: Number(draft.display_order || 0),
        status: draft.status
      };

      if (editingPackageId) {
        await api.patch(`/api/admin/packages/${editingPackageId}`, payload);
        pushToast?.("success", "Package updated successfully.");
      } else {
        await api.post("/api/admin/packages", payload);
        pushToast?.("success", "Package created successfully.");
      }

      resetDraft();
      await loadPackages();
    } catch (error) {
      if (error?.response?.status === 401) {
        await onSessionExpired?.();
        return;
      }
      pushToast?.("error", error?.response?.data?.message || "Failed to save package.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (pkg) => {
    if (!window.confirm(`Delete "${pkg.name}"? This will remove it from the user packages page.`)) {
      return;
    }

    setDeletingId(pkg.id);
    try {
      await api.delete(`/api/admin/packages/${pkg.id}`);
      if (editingPackageId === pkg.id) {
        resetDraft();
      }
      if (detailPackage?.id === pkg.id) {
        setDetailPackage(null);
      }
      pushToast?.("success", "Package deleted successfully.");
      await loadPackages();
    } catch (error) {
      if (error?.response?.status === 401) {
        await onSessionExpired?.();
        return;
      }
      pushToast?.("error", error?.response?.data?.message || "Failed to delete package.");
    } finally {
      setDeletingId("");
    }
  };

  const handleToggleStatus = async (pkg) => {
    setTogglingId(pkg.id);
    try {
      const nextStatus = pkg.status === "active" ? "disabled" : "active";
      await api.patch(`/api/admin/packages/${pkg.id}/status`, { status: nextStatus });
      if (detailPackage?.id === pkg.id) {
        setDetailPackage((current) => (current ? { ...current, status: nextStatus } : current));
      }
      pushToast?.("success", nextStatus === "active" ? "Package enabled successfully." : "Package disabled successfully.");
      await loadPackages();
    } catch (error) {
      if (error?.response?.status === 401) {
        await onSessionExpired?.();
        return;
      }
      pushToast?.("error", error?.response?.data?.message || "Failed to update package status.");
    } finally {
      setTogglingId("");
    }
  };

  return (
    <section className="space-y-4">
      <div className="erp-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="erp-eyebrow">Catalog Control</p>
            <h2 className="text-xl font-semibold text-slate-900">Package Management</h2>
            <p className="mt-1 text-sm text-slate-500">
              Create, edit, disable, and reorder recurring service packages shown to users.
            </p>
          </div>
          <button type="button" className="erp-btn erp-btn-primary" onClick={resetDraft}>
            + Add New Package
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="erp-card p-4">
          <p className="erp-eyebrow">Total Packages</p>
          <h3 className="mt-1 text-2xl font-bold text-slate-900">{summary.total}</h3>
        </div>
        <div className="erp-card p-4">
          <p className="erp-eyebrow">Active</p>
          <h3 className="mt-1 text-2xl font-bold text-emerald-700">{summary.active}</h3>
        </div>
        <div className="erp-card p-4">
          <p className="erp-eyebrow">Disabled</p>
          <h3 className="mt-1 text-2xl font-bold text-amber-700">{summary.disabled}</h3>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(360px,0.95fr)]">
        <div className="space-y-4">
          <div className="erp-card p-5">
            <div className="grid gap-3 md:grid-cols-3">
              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Search Packages</span>
                <input
                  type="text"
                  className="erp-input"
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder="Name, category, service, tag"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Filter Category</span>
                <select className="erp-select" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
                  <option value="all">All Categories</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Filter Status</span>
                <select className="erp-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="disabled">Disabled</option>
                </select>
              </label>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {filteredPackages.length === 0 ? (
              <div className="erp-card p-6 lg:col-span-2">
                <p className="text-sm text-slate-500">{loading ? "Loading packages..." : "No packages match the current filters."}</p>
              </div>
            ) : (
              filteredPackages.map((pkg) => (
                <article key={pkg.id} className="erp-card p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold text-slate-900">{pkg.name}</h3>
                        {pkg.package_tag ? <span className="erp-badge">{pkg.package_tag}</span> : null}
                      </div>
                      <p className="mt-1 text-sm text-slate-500">{pkg.description}</p>
                    </div>
                    <button
                      type="button"
                      className={`inline-flex h-7 min-w-[74px] items-center justify-center rounded-full border px-3 text-[11px] font-semibold ${
                        pkg.status === "active"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-amber-200 bg-amber-50 text-amber-700"
                      }`}
                      onClick={() => handleToggleStatus(pkg)}
                      disabled={togglingId === pkg.id}
                    >
                      {togglingId === pkg.id ? "Saving..." : pkg.status === "active" ? "Active" : "Disabled"}
                    </button>
                  </div>

                  <div className="mt-4 grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-500">Price</p>
                      <p className="mt-1 font-semibold text-slate-900">{formatMoney(pkg.price)}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-500">Duration</p>
                      <p className="mt-1 font-semibold text-slate-900">{pkg.duration_days} days</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-500">Visit Frequency</p>
                      <p className="mt-1 font-semibold text-slate-900">{formatFrequency(pkg.visit_frequency)}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-500">Category</p>
                      <p className="mt-1 font-semibold text-slate-900">{pkg.category}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-500">Display Order</p>
                      <p className="mt-1 font-semibold text-slate-900">{pkg.display_order}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-500">Created Date</p>
                      <p className="mt-1 font-semibold text-slate-900">{formatDate(pkg.created_at)}</p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Services Included</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {pkg.servicesIncluded.length > 0 ? (
                        pkg.servicesIncluded.map((service) => (
                          <span key={`${pkg.id}-${service}`} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
                            {service}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-slate-500">No services added.</span>
                      )}
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    <button type="button" className="erp-btn erp-btn-soft" onClick={() => handleEdit(pkg)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className="erp-btn erp-btn-danger"
                      onClick={() => handleDelete(pkg)}
                      disabled={deletingId === pkg.id}
                    >
                      {deletingId === pkg.id ? "Deleting..." : "Delete"}
                    </button>
                    <button type="button" className="erp-btn erp-btn-soft" onClick={() => handleToggleStatus(pkg)}>
                      {pkg.status === "active" ? "Disable" : "Enable"}
                    </button>
                    <button type="button" className="erp-btn erp-btn-soft" onClick={() => setDetailPackage(pkg)}>
                      View Details
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
        <aside className="erp-card self-start p-5 xl:sticky xl:top-6">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">{editingPackageId ? "Edit Package" : "Add Package"}</h3>
              <p className="text-sm text-slate-500">
                Configure how the package appears on the user packages page.
              </p>
            </div>
            {editingPackageId ? (
              <button type="button" className="erp-btn erp-btn-soft" onClick={resetDraft}>
                Cancel Edit
              </button>
            ) : null}
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <label className="block">
              <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Package Name</span>
              <input
                type="text"
                className="erp-input"
                value={draft.name}
                onChange={(event) => handleDraftChange("name", event.target.value)}
                placeholder="Basic Home Care"
                required
              />
            </label>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Category</span>
                <select
                  className="erp-select"
                  value={draft.category}
                  onChange={(event) => handleDraftChange("category", event.target.value)}
                >
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Visit Frequency</span>
                <select
                  className="erp-select"
                  value={draft.visit_frequency}
                  onChange={(event) => handleDraftChange("visit_frequency", event.target.value)}
                >
                  {visitFrequencyOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Price</span>
                <input
                  type="number"
                  min="0"
                  className="erp-input"
                  value={draft.price}
                  onChange={(event) => handleDraftChange("price", event.target.value)}
                  required
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Duration (Days)</span>
                <input
                  type="number"
                  min="1"
                  className="erp-input"
                  value={draft.duration_days}
                  onChange={(event) => handleDraftChange("duration_days", event.target.value)}
                  required
                />
              </label>
            </div>

            <label className="block">
              <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Short Description</span>
              <textarea
                className="erp-input min-h-[110px] resize-y py-3"
                value={draft.description}
                onChange={(event) => handleDraftChange("description", event.target.value)}
                placeholder="Describe the package value and coverage."
                required
              />
            </label>

            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Services Included</p>
                  <p className="text-xs text-slate-500">Add or remove service items shown to users.</p>
                </div>
                <button type="button" className="erp-btn erp-btn-soft" onClick={addServiceItem}>
                  Add Service
                </button>
              </div>

              <div className="space-y-2">
                {draft.servicesIncluded.map((service, index) => (
                  <div key={`service-item-${index}`} className="flex items-center gap-2">
                    <input
                      type="text"
                      className="erp-input"
                      value={service}
                      onChange={(event) => updateServiceItem(index, event.target.value)}
                      placeholder="Floor Cleaning"
                      required
                    />
                    <button
                      type="button"
                      className="erp-btn erp-btn-danger"
                      onClick={() => removeServiceItem(index)}
                      disabled={draft.servicesIncluded.length <= 1}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Package Tag</span>
                <select
                  className="erp-select"
                  value={draft.package_tag}
                  onChange={(event) => handleDraftChange("package_tag", event.target.value)}
                >
                  {tagOptions.map((tag) => (
                    <option key={tag || "none"} value={tag}>
                      {tag || "No Tag"}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Display Order</span>
                <input
                  type="number"
                  min="0"
                  className="erp-input"
                  value={draft.display_order}
                  onChange={(event) => handleDraftChange("display_order", event.target.value)}
                />
              </label>
            </div>

            <label className="block">
              <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Package Status</span>
              <select className="erp-select" value={draft.status} onChange={(event) => handleDraftChange("status", event.target.value)}>
                <option value="active">Active</option>
                <option value="disabled">Disabled</option>
              </select>
            </label>

            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <button type="button" className="erp-btn erp-btn-soft" onClick={resetDraft}>
                Cancel
              </button>
              <button type="submit" className="erp-btn erp-btn-primary" disabled={saving}>
                {saving ? "Saving..." : "Save Package"}
              </button>
            </div>
          </form>
        </aside>
      </div>

      {detailPackage ? (
        <div className="erp-drawer-overlay" onClick={() => setDetailPackage(null)}>
          <aside className="erp-drawer !max-w-3xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{detailPackage.name}</h3>
                <p className="text-sm text-slate-500">{detailPackage.category}</p>
              </div>
              <button type="button" className="erp-icon-btn" onClick={() => setDetailPackage(null)}>
                X
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Status</p>
                <p className="mt-1 font-semibold text-slate-900">{detailPackage.status === "active" ? "Active" : "Disabled"}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Price</p>
                <p className="mt-1 font-semibold text-slate-900">{formatMoney(detailPackage.price)}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Duration</p>
                <p className="mt-1 font-semibold text-slate-900">{detailPackage.duration_days} days</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Visit Frequency</p>
                <p className="mt-1 font-semibold text-slate-900">{formatFrequency(detailPackage.visit_frequency)}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Display Order</p>
                <p className="mt-1 font-semibold text-slate-900">{detailPackage.display_order}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Tag</p>
                <p className="mt-1 font-semibold text-slate-900">{detailPackage.package_tag || "No tag"}</p>
              </div>
            </div>

            <div className="mt-4 rounded-xl bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Description</p>
              <p className="mt-2 text-sm text-slate-700">{detailPackage.description}</p>
            </div>

            <div className="mt-4 rounded-xl bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Services Included</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {detailPackage.servicesIncluded.map((service) => (
                  <span key={`${detailPackage.id}-${service}`} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700">
                    {service}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Created</p>
                <p className="mt-1 font-semibold text-slate-900">{formatDate(detailPackage.created_at)}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Last Updated</p>
                <p className="mt-1 font-semibold text-slate-900">{formatDate(detailPackage.updated_at)}</p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                className="erp-btn erp-btn-soft"
                onClick={() => {
                  handleEdit(detailPackage);
                  setDetailPackage(null);
                }}
              >
                Edit
              </button>
              <button type="button" className="erp-btn erp-btn-soft" onClick={() => handleToggleStatus(detailPackage)}>
                {detailPackage.status === "active" ? "Disable" : "Enable"}
              </button>
              <button type="button" className="erp-btn erp-btn-danger" onClick={() => handleDelete(detailPackage)}>
                Delete
              </button>
            </div>
          </aside>
        </div>
      ) : null}
    </section>
  );
}
