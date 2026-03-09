import { useEffect, useMemo, useState } from "react";
import api from "./api";

const pricingTypeOptions = [
  { value: "tiered", label: "Tiered" },
  { value: "fixed", label: "Fixed" },
  { value: "starting_at", label: "Starting At" },
  { value: "per_hour", label: "Per Hour" },
  { value: "per_unit", label: "Per Unit" }
];

function createEmptyServiceDraft() {
  return {
    name: "",
    category: "",
    slug: "",
    description: "",
    basePrice: "",
    pricingType: "tiered",
    duration: "",
    image: "",
    rating: "4.5",
    reviewCount: "0",
    status: "active",
    includedServicesText: "",
    notIncludedServicesText: ""
  };
}

function createEmptyPricingDraft() {
  return { title: "", description: "", price: "", order: "1" };
}

function createEmptyAddonDraft() {
  return { title: "", description: "", price: "" };
}

function listToText(list) {
  return Array.isArray(list) ? list.join("\n") : "";
}

function textToList(value) {
  return String(value || "")
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizeDetail(entry) {
  const service = entry?.service || {};
  return {
    service: {
      id: String(service?.id || "").trim(),
      name: String(service?.name || "").trim(),
      category: String(service?.category || "").trim(),
      slug: String(service?.slug || "").trim(),
      description: String(service?.description || "").trim(),
      basePrice: Number(service?.basePrice || 0),
      pricingType: String(service?.pricingType || "tiered").trim() || "tiered",
      duration: String(service?.duration || "").trim(),
      image: String(service?.image || "").trim(),
      rating: Number(service?.rating || 4.5),
      reviewCount: Number(service?.reviewCount || 0),
      status: String(service?.status || "active").trim() || "active",
      includedServices: Array.isArray(service?.includedServices) ? service.includedServices : [],
      notIncludedServices: Array.isArray(service?.notIncludedServices) ? service.notIncludedServices : []
    },
    pricingOptions: Array.isArray(entry?.pricingOptions) ? entry.pricingOptions : [],
    addons: Array.isArray(entry?.addons) ? entry.addons : []
  };
}

async function fileToPayload(file) {
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.readAsDataURL(file);
  });

  return {
    name: file.name,
    type: file.type,
    dataUrl
  };
}

export default function ServiceManagement({ pushToast, onSessionExpired }) {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [draft, setDraft] = useState(createEmptyServiceDraft);
  const [editingServiceId, setEditingServiceId] = useState("");
  const [pricingDraft, setPricingDraft] = useState(createEmptyPricingDraft);
  const [addonDraft, setAddonDraft] = useState(createEmptyAddonDraft);
  const [editingPricingId, setEditingPricingId] = useState("");
  const [editingAddonId, setEditingAddonId] = useState("");

  const currentServiceDetail = useMemo(
    () => services.find((entry) => entry.service.id === editingServiceId) || null,
    [editingServiceId, services]
  );

  const loadServices = async () => {
    setLoading(true);
    try {
      const response = await api.get("/api/admin/services");
      setServices((Array.isArray(response.data?.services) ? response.data.services : []).map(normalizeDetail));
    } catch (error) {
      if (error?.response?.status === 401) {
        await onSessionExpired?.();
        return;
      }
      pushToast?.("error", error?.response?.data?.message || "Failed to load services.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadServices().catch(() => {});
  }, []);

  const resetDraft = () => {
    setDraft(createEmptyServiceDraft());
    setEditingServiceId("");
    setPricingDraft(createEmptyPricingDraft());
    setAddonDraft(createEmptyAddonDraft());
    setEditingPricingId("");
    setEditingAddonId("");
  };

  const handleEditService = (detail) => {
    setEditingServiceId(detail.service.id);
    setDraft({
      name: detail.service.name,
      category: detail.service.category,
      slug: detail.service.slug,
      description: detail.service.description,
      basePrice: String(detail.service.basePrice || ""),
      pricingType: detail.service.pricingType,
      duration: detail.service.duration,
      image: detail.service.image,
      rating: String(detail.service.rating || 4.5),
      reviewCount: String(detail.service.reviewCount || 0),
      status: detail.service.status,
      includedServicesText: listToText(detail.service.includedServices),
      notIncludedServicesText: listToText(detail.service.notIncludedServices)
    });
    setPricingDraft(createEmptyPricingDraft());
    setAddonDraft(createEmptyAddonDraft());
    setEditingPricingId("");
    setEditingAddonId("");
  };

  const handleSubmitService = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: draft.name,
        category: draft.category,
        slug: draft.slug,
        description: draft.description,
        basePrice: Number(draft.basePrice || 0),
        pricingType: draft.pricingType,
        duration: draft.duration,
        image: draft.image,
        rating: Number(draft.rating || 4.5),
        reviewCount: Number(draft.reviewCount || 0),
        status: draft.status,
        includedServices: textToList(draft.includedServicesText),
        notIncludedServices: textToList(draft.notIncludedServicesText)
      };

      if (editingServiceId) {
        await api.patch(`/api/admin/services/${editingServiceId}`, payload);
        pushToast?.("success", "Service updated successfully.");
      } else {
        await api.post("/api/admin/services", {
          ...payload,
          pricingOptions: [],
          addons: []
        });
        pushToast?.("success", "Service created successfully.");
      }

      resetDraft();
      await loadServices();
    } catch (error) {
      if (error?.response?.status === 401) {
        await onSessionExpired?.();
        return;
      }
      pushToast?.("error", error?.response?.data?.message || "Failed to save service.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteService = async (serviceId) => {
    if (!window.confirm("Delete this service and all related pricing/add-ons?")) return;

    try {
      await api.delete(`/api/admin/services/${serviceId}`);
      if (editingServiceId === serviceId) {
        resetDraft();
      }
      pushToast?.("success", "Service deleted successfully.");
      await loadServices();
    } catch (error) {
      pushToast?.("error", error?.response?.data?.message || "Failed to delete service.");
    }
  };

  const handleUploadImage = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const payload = await fileToPayload(file);
      const response = await api.post("/api/admin/services/upload-image", { file: payload });
      setDraft((current) => ({ ...current, image: String(response.data?.imageUrl || "") }));
      pushToast?.("success", "Service image uploaded.");
    } catch (error) {
      pushToast?.("error", error?.response?.data?.message || "Failed to upload image.");
    } finally {
      setUploadingImage(false);
      event.target.value = "";
    }
  };

  const submitPricingOption = async (event) => {
    event.preventDefault();
    if (!editingServiceId) {
      pushToast?.("error", "Save the service first before managing pricing options.");
      return;
    }

    const payload = {
      title: pricingDraft.title,
      description: pricingDraft.description,
      price: Number(pricingDraft.price || 0),
      order: Number(pricingDraft.order || 1)
    };

    try {
      if (editingPricingId) {
        await api.patch(`/api/admin/services/${editingServiceId}/pricing-options/${editingPricingId}`, payload);
        pushToast?.("success", "Pricing option updated.");
      } else {
        await api.post(`/api/admin/services/${editingServiceId}/pricing-options`, payload);
        pushToast?.("success", "Pricing option added.");
      }
      setPricingDraft(createEmptyPricingDraft());
      setEditingPricingId("");
      await loadServices();
    } catch (error) {
      pushToast?.("error", error?.response?.data?.message || "Failed to save pricing option.");
    }
  };

  const submitAddon = async (event) => {
    event.preventDefault();
    if (!editingServiceId) {
      pushToast?.("error", "Save the service first before managing add-ons.");
      return;
    }

    const payload = {
      title: addonDraft.title,
      description: addonDraft.description,
      price: Number(addonDraft.price || 0)
    };

    try {
      if (editingAddonId) {
        await api.patch(`/api/admin/services/${editingServiceId}/addons/${editingAddonId}`, payload);
        pushToast?.("success", "Add-on updated.");
      } else {
        await api.post(`/api/admin/services/${editingServiceId}/addons`, payload);
        pushToast?.("success", "Add-on added.");
      }
      setAddonDraft(createEmptyAddonDraft());
      setEditingAddonId("");
      await loadServices();
    } catch (error) {
      pushToast?.("error", error?.response?.data?.message || "Failed to save add-on.");
    }
  };

  const deletePricingOption = async (pricingOptionId) => {
    try {
      await api.delete(`/api/admin/services/${editingServiceId}/pricing-options/${pricingOptionId}`);
      pushToast?.("success", "Pricing option deleted.");
      await loadServices();
    } catch (error) {
      pushToast?.("error", error?.response?.data?.message || "Failed to delete pricing option.");
    }
  };

  const deleteAddon = async (addonId) => {
    try {
      await api.delete(`/api/admin/services/${editingServiceId}/addons/${addonId}`);
      pushToast?.("success", "Add-on deleted.");
      await loadServices();
    } catch (error) {
      pushToast?.("error", error?.response?.data?.message || "Failed to delete add-on.");
    }
  };

  return (
    <section className="space-y-4">
      <div className="erp-card p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Service Management</h2>
            <p className="text-sm text-slate-500">Create services, manage pricing tiers, add-ons, images, and status.</p>
          </div>
          <button type="button" className="erp-btn erp-btn-soft" onClick={resetDraft}>
            {editingServiceId ? "Create New" : "Reset"}
          </button>
        </div>

        <form className="grid gap-3 md:grid-cols-2" onSubmit={handleSubmitService}>
          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Service Name</span>
            <input className="erp-input" value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Category</span>
            <input className="erp-input" value={draft.category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Slug</span>
            <input className="erp-input" value={draft.slug} onChange={(event) => setDraft((current) => ({ ...current, slug: event.target.value }))} placeholder="Optional, auto-generated if empty" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Duration</span>
            <input className="erp-input" value={draft.duration} onChange={(event) => setDraft((current) => ({ ...current, duration: event.target.value }))} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Base Price</span>
            <input type="number" min="0" className="erp-input" value={draft.basePrice} onChange={(event) => setDraft((current) => ({ ...current, basePrice: event.target.value }))} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Pricing Type</span>
            <select className="erp-select" value={draft.pricingType} onChange={(event) => setDraft((current) => ({ ...current, pricingType: event.target.value }))}>
              {pricingTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Rating</span>
            <input type="number" min="0" max="5" step="0.1" className="erp-input" value={draft.rating} onChange={(event) => setDraft((current) => ({ ...current, rating: event.target.value }))} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Review Count</span>
            <input type="number" min="0" className="erp-input" value={draft.reviewCount} onChange={(event) => setDraft((current) => ({ ...current, reviewCount: event.target.value }))} />
          </label>
          <label className="block md:col-span-2">
            <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Description</span>
            <textarea className="erp-input min-h-[110px] resize-y py-3" value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} />
          </label>
          <label className="block md:col-span-2">
            <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Image URL</span>
            <input className="erp-input" value={draft.image} onChange={(event) => setDraft((current) => ({ ...current, image: event.target.value }))} placeholder="/uploads/service-images/..." />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Upload Image</span>
            <input type="file" accept="image/png,image/jpeg,image/webp" className="erp-input" onChange={handleUploadImage} />
            <p className="mt-1 text-xs text-slate-500">{uploadingImage ? "Uploading..." : "PNG, JPG, WEBP up to 5MB"}</p>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Status</span>
            <select className="erp-select" value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value }))}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Included Services</span>
            <textarea className="erp-input min-h-[110px] resize-y py-3" value={draft.includedServicesText} onChange={(event) => setDraft((current) => ({ ...current, includedServicesText: event.target.value }))} placeholder="One item per line" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Not Included</span>
            <textarea className="erp-input min-h-[110px] resize-y py-3" value={draft.notIncludedServicesText} onChange={(event) => setDraft((current) => ({ ...current, notIncludedServicesText: event.target.value }))} placeholder="One item per line" />
          </label>
          <div className="md:col-span-2 flex gap-2">
            <button type="submit" className="erp-btn erp-btn-primary" disabled={saving}>{saving ? "Saving..." : editingServiceId ? "Update Service" : "Create Service"}</button>
          </div>
        </form>
      </div>

      {editingServiceId ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="erp-card p-5">
            <h3 className="text-base font-semibold text-slate-900">Pricing Tiers</h3>
            <form className="mt-4 grid gap-3" onSubmit={submitPricingOption}>
              <input className="erp-input" placeholder="Title" value={pricingDraft.title} onChange={(event) => setPricingDraft((current) => ({ ...current, title: event.target.value }))} />
              <input className="erp-input" placeholder="Description" value={pricingDraft.description} onChange={(event) => setPricingDraft((current) => ({ ...current, description: event.target.value }))} />
              <div className="grid gap-3 md:grid-cols-2">
                <input type="number" min="0" className="erp-input" placeholder="Price" value={pricingDraft.price} onChange={(event) => setPricingDraft((current) => ({ ...current, price: event.target.value }))} />
                <input type="number" min="1" className="erp-input" placeholder="Order" value={pricingDraft.order} onChange={(event) => setPricingDraft((current) => ({ ...current, order: event.target.value }))} />
              </div>
              <div className="flex gap-2">
                <button type="submit" className="erp-btn erp-btn-primary">{editingPricingId ? "Update Tier" : "Add Tier"}</button>
                {editingPricingId ? <button type="button" className="erp-btn erp-btn-soft" onClick={() => { setEditingPricingId(""); setPricingDraft(createEmptyPricingDraft()); }}>Cancel</button> : null}
              </div>
            </form>
            <div className="mt-4 space-y-3">
              {currentServiceDetail?.pricingOptions.map((option) => (
                <div key={option.id} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{option.title}</p>
                      <p className="text-sm text-slate-500">{option.description || "No description."}</p>
                      <p className="mt-1 text-sm text-slate-700">₹{Number(option.price || 0)}</p>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" className="erp-btn erp-btn-soft" onClick={() => { setEditingPricingId(option.id); setPricingDraft({ title: option.title || "", description: option.description || "", price: String(option.price || ""), order: String(option.order || 1) }); }}>Edit</button>
                      <button type="button" className="erp-btn erp-btn-danger" onClick={() => deletePricingOption(option.id)}>Delete</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="erp-card p-5">
            <h3 className="text-base font-semibold text-slate-900">Add-ons</h3>
            <form className="mt-4 grid gap-3" onSubmit={submitAddon}>
              <input className="erp-input" placeholder="Title" value={addonDraft.title} onChange={(event) => setAddonDraft((current) => ({ ...current, title: event.target.value }))} />
              <input className="erp-input" placeholder="Description" value={addonDraft.description} onChange={(event) => setAddonDraft((current) => ({ ...current, description: event.target.value }))} />
              <input type="number" min="0" className="erp-input" placeholder="Price" value={addonDraft.price} onChange={(event) => setAddonDraft((current) => ({ ...current, price: event.target.value }))} />
              <div className="flex gap-2">
                <button type="submit" className="erp-btn erp-btn-primary">{editingAddonId ? "Update Add-on" : "Add Add-on"}</button>
                {editingAddonId ? <button type="button" className="erp-btn erp-btn-soft" onClick={() => { setEditingAddonId(""); setAddonDraft(createEmptyAddonDraft()); }}>Cancel</button> : null}
              </div>
            </form>
            <div className="mt-4 space-y-3">
              {currentServiceDetail?.addons.map((addon) => (
                <div key={addon.id} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{addon.title}</p>
                      <p className="text-sm text-slate-500">{addon.description || "No description."}</p>
                      <p className="mt-1 text-sm text-slate-700">₹{Number(addon.price || 0)}</p>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" className="erp-btn erp-btn-soft" onClick={() => { setEditingAddonId(addon.id); setAddonDraft({ title: addon.title || "", description: addon.description || "", price: String(addon.price || "") }); }}>Edit</button>
                      <button type="button" className="erp-btn erp-btn-danger" onClick={() => deleteAddon(addon.id)}>Delete</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <div className="erp-card overflow-x-auto p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-slate-900">All Services</h3>
          <button type="button" className="erp-btn erp-btn-soft" onClick={() => loadServices().catch(() => {})}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
        <table className="erp-table">
          <thead>
            <tr>
              <th>Service</th>
              <th>Category</th>
              <th>Base Price</th>
              <th>Status</th>
              <th>Pricing Tiers</th>
              <th>Add-ons</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {services.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center text-slate-500">{loading ? "Loading services..." : "No services found."}</td>
              </tr>
            ) : (
              services.map((detail) => (
                <tr key={detail.service.id}>
                  <td>
                    <div className="font-medium text-slate-900">{detail.service.name}</div>
                    <div className="text-xs text-slate-500">{detail.service.duration || "Flexible duration"}</div>
                  </td>
                  <td>{detail.service.category}</td>
                  <td>₹{detail.service.basePrice}</td>
                  <td>
                    <span className={`erp-badge ${detail.service.status === "active" ? "erp-badge-positive" : "erp-badge-neutral"}`}>
                      {detail.service.status}
                    </span>
                  </td>
                  <td>{detail.pricingOptions.length}</td>
                  <td>{detail.addons.length}</td>
                  <td>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className="erp-btn erp-btn-soft" onClick={() => handleEditService(detail)}>Edit</button>
                      <button type="button" className="erp-btn erp-btn-danger" onClick={() => handleDeleteService(detail.service.id)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
