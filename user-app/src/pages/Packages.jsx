import { useEffect, useState } from "react";
import api from "../api";

export default function PackagesPage() {
  const [packages, setPackages] = useState([]);

  useEffect(() => {
    const loadPackages = async () => {
      const response = await api.get("/api/packages");
      setPackages(response.data);
    };

    loadPackages().catch(() => {
      setPackages([
        { id: "starter", name: "Starter", price: "$29", description: "Single booking support" },
        { id: "plus", name: "Plus", price: "$79", description: "Priority scheduling" },
        { id: "pro", name: "Pro", price: "$149", description: "Monthly home care plan" }
      ]);
    });
  }, []);

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Packages</h2>
      <div className="grid gap-4 md:grid-cols-3">
        {packages.map((pkg) => (
          <div key={pkg.id} className="card">
            <p className="text-lg font-semibold">{pkg.name}</p>
            <p className="my-2 text-brand-700">{pkg.price || "Contact us"}</p>
            <p className="text-sm text-slate-600">{pkg.description || "Customized service package"}</p>
          </div>
        ))}
      </div>
    </div>
  );
}