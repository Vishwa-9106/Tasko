import { createDefaultPricingConfig, pricingModelOptions } from "./pricingModels";

function ListEditor({ title, items, onAdd, onRemove, renderItem }) {
  return (
    <div className="rounded-2xl border border-slate-200 p-3">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-slate-800">{title}</h4>
        <button type="button" className="erp-btn erp-btn-soft" onClick={onAdd}>
          Add
        </button>
      </div>
      <div className="space-y-3">
        {items.map((item, index) => (
          <div key={item.id || `${title}-${index}`} className="rounded-xl border border-slate-200 p-3">
            <div className="mb-2 flex justify-end">
              <button type="button" className="erp-btn erp-btn-danger" onClick={() => onRemove(index)}>
                Remove
              </button>
            </div>
            {renderItem(item, index)}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PricingModelEditor({ draft, onChange }) {
  const pricingModel = draft?.pricingModel || "fixed";
  const pricingConfig = draft?.pricingConfig || createDefaultPricingConfig(pricingModel);

  const updateConfig = (patch) => {
    onChange?.({
      ...draft,
      pricingConfig: {
        ...pricingConfig,
        ...patch
      }
    });
  };

  const updateListItem = (key, index, patch) => {
    const next = [...(pricingConfig[key] || [])];
    next[index] = { ...next[index], ...patch };
    updateConfig({ [key]: next });
  };

  const addListItem = (key, item) => {
    updateConfig({ [key]: [...(pricingConfig[key] || []), item] });
  };

  const removeListItem = (key, index) => {
    updateConfig({ [key]: (pricingConfig[key] || []).filter((_, itemIndex) => itemIndex !== index) });
  };

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Pricing Model</span>
        <select
          className="erp-input"
          value={pricingModel}
          onChange={(event) =>
            onChange?.({
              ...draft,
              pricingModel: event.target.value,
              pricingConfig: createDefaultPricingConfig(event.target.value)
            })
          }
        >
          {pricingModelOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      {pricingModel === "package" ? (
        <>
          <ListEditor
            title="Packages"
            items={pricingConfig.packages}
            onAdd={() =>
              addListItem("packages", {
                id: `package-${Date.now()}`,
                name: "",
                price: "",
                description: "",
                recommended: false,
                featuresText: ""
              })
            }
            onRemove={(index) => removeListItem("packages", index)}
            renderItem={(item, index) => (
              <div className="grid gap-3 md:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Package Name</span>
                  <input
                    className="erp-input"
                    value={item.name}
                    onChange={(event) => updateListItem("packages", index, { name: event.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Price</span>
                  <input
                    type="number"
                    min="0"
                    className="erp-input"
                    value={item.price}
                    onChange={(event) => updateListItem("packages", index, { price: event.target.value })}
                  />
                </label>
                <label className="block md:col-span-2">
                  <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Description</span>
                  <input
                    className="erp-input"
                    value={item.description}
                    onChange={(event) => updateListItem("packages", index, { description: event.target.value })}
                  />
                </label>
                <label className="block md:col-span-2">
                  <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Features</span>
                  <textarea
                    className="erp-input min-h-24"
                    value={item.featuresText}
                    onChange={(event) => updateListItem("packages", index, { featuresText: event.target.value })}
                  />
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={Boolean(item.recommended)}
                    onChange={(event) => updateListItem("packages", index, { recommended: event.target.checked })}
                  />
                  Recommended package
                </label>
              </div>
            )}
          />

          <ListEditor
            title="Add-ons"
            items={pricingConfig.addons}
            onAdd={() => addListItem("addons", { id: `addon-${Date.now()}`, name: "", price: "" })}
            onRemove={(index) => removeListItem("addons", index)}
            renderItem={(item, index) => (
              <div className="grid gap-3 md:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Add-on Name</span>
                  <input
                    className="erp-input"
                    value={item.name}
                    onChange={(event) => updateListItem("addons", index, { name: event.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Price</span>
                  <input
                    type="number"
                    min="0"
                    className="erp-input"
                    value={item.price}
                    onChange={(event) => updateListItem("addons", index, { price: event.target.value })}
                  />
                </label>
              </div>
            )}
          />
        </>
      ) : null}

      {pricingModel === "per_unit" ? (
        <div className="grid gap-3 md:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Unit Price</span>
            <input
              type="number"
              min="0"
              className="erp-input"
              value={pricingConfig.unitPrice}
              onChange={(event) => updateConfig({ unitPrice: event.target.value })}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Unit Label</span>
            <input
              className="erp-input"
              value={pricingConfig.unitLabel}
              onChange={(event) => updateConfig({ unitLabel: event.target.value })}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Minimum Units</span>
            <input
              type="number"
              min="1"
              className="erp-input"
              value={pricingConfig.minUnits}
              onChange={(event) => updateConfig({ minUnits: event.target.value })}
            />
          </label>
        </div>
      ) : null}

      {pricingModel === "fixed" ? (
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Fixed Price</span>
            <input
              type="number"
              min="0"
              className="erp-input"
              value={pricingConfig.fixedPrice}
              onChange={(event) => updateConfig({ fixedPrice: event.target.value })}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Service Description</span>
            <input
              className="erp-input"
              value={pricingConfig.serviceDescription}
              onChange={(event) => updateConfig({ serviceDescription: event.target.value })}
            />
          </label>
        </div>
      ) : null}

      {pricingModel === "time_based" ? (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Hourly Rate</span>
              <input
                type="number"
                min="0"
                className="erp-input"
                value={pricingConfig.hourlyRate}
                onChange={(event) => updateConfig({ hourlyRate: event.target.value })}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Day Rate</span>
              <input
                type="number"
                min="0"
                className="erp-input"
                value={pricingConfig.dayRate}
                onChange={(event) => updateConfig({ dayRate: event.target.value })}
              />
            </label>
          </div>

          <ListEditor
            title="Available Shifts"
            items={pricingConfig.availableShifts}
            onAdd={() =>
              addListItem("availableShifts", {
                id: `shift-${Date.now()}`,
                name: "",
                hours: "",
                label: ""
              })
            }
            onRemove={(index) => removeListItem("availableShifts", index)}
            renderItem={(item, index) => (
              <div className="grid gap-3 md:grid-cols-3">
                <label className="block">
                  <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Shift Name</span>
                  <input
                    className="erp-input"
                    value={item.name}
                    onChange={(event) => updateListItem("availableShifts", index, { name: event.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Hours</span>
                  <input
                    type="number"
                    min="1"
                    className="erp-input"
                    value={item.hours}
                    onChange={(event) => updateListItem("availableShifts", index, { hours: event.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Label</span>
                  <input
                    className="erp-input"
                    value={item.label}
                    onChange={(event) => updateListItem("availableShifts", index, { label: event.target.value })}
                  />
                </label>
              </div>
            )}
          />
        </>
      ) : null}

      {pricingModel === "inspection" ? (
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Visit Charge</span>
            <input
              type="number"
              min="0"
              className="erp-input"
              value={pricingConfig.visitCharge}
              onChange={(event) => updateConfig({ visitCharge: event.target.value })}
            />
          </label>
          <label className="flex items-center gap-2 pt-6 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={Boolean(pricingConfig.requiresApproval)}
              onChange={(event) => updateConfig({ requiresApproval: event.target.checked })}
            />
            Requires user approval after estimate
          </label>
        </div>
      ) : null}

      {pricingModel === "meal_based" ? (
        <ListEditor
          title="Meal Options"
          items={pricingConfig.mealOptions}
          onAdd={() =>
            addListItem("mealOptions", {
              id: `meal-${Date.now()}`,
              name: "",
              price: "",
              description: ""
            })
          }
          onRemove={(index) => removeListItem("mealOptions", index)}
          renderItem={(item, index) => (
            <div className="grid gap-3 md:grid-cols-3">
              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Meal Name</span>
                <input
                  className="erp-input"
                  value={item.name}
                  onChange={(event) => updateListItem("mealOptions", index, { name: event.target.value })}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Price</span>
                <input
                  type="number"
                  min="0"
                  className="erp-input"
                  value={item.price}
                  onChange={(event) => updateListItem("mealOptions", index, { price: event.target.value })}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Description</span>
                <input
                  className="erp-input"
                  value={item.description}
                  onChange={(event) => updateListItem("mealOptions", index, { description: event.target.value })}
                />
              </label>
            </div>
          )}
        />
      ) : null}
    </div>
  );
}
