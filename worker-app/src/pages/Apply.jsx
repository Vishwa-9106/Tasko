import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import BrandLogo from "../components/landing/BrandLogo";

const serviceCategories = [
  "Home Cleaning",
  "Plumbing",
  "Electrical",
  "Appliance Repair",
  "Carpentry",
  "Painting",
  "Driver Services",
  "Pest Control"
];

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("Failed to read uploaded file."));
    reader.readAsDataURL(file);
  });
}

async function toUploadPayload(file) {
  const dataUrl = await readFileAsDataUrl(file);
  return {
    name: file.name,
    type: file.type || "application/octet-stream",
    size: file.size,
    dataUrl
  };
}

export default function ApplyPage() {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [categoryApplied, setCategoryApplied] = useState(serviceCategories[0]);
  const [idProofFile, setIdProofFile] = useState(null);
  const [addressProofFile, setAddressProofFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const onSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccessMessage("");

    if (!fullName.trim() || !phone.trim() || !email.trim() || !address.trim() || !categoryApplied) {
      setError("Please fill all required fields.");
      return;
    }

    if (!idProofFile || !addressProofFile) {
      setError("Please upload both ID proof and address proof.");
      return;
    }

    setSubmitting(true);
    try {
      const [idProof, addressProof] = await Promise.all([
        toUploadPayload(idProofFile),
        toUploadPayload(addressProofFile)
      ]);

      const response = await api.post("/api/worker-applications", {
        fullName: fullName.trim(),
        phone: phone.replace(/\D/g, ""),
        email: email.trim().toLowerCase(),
        address: address.trim(),
        categoryApplied,
        idProof,
        addressProof
      });

      setSuccessMessage(
        response.data?.message ||
          "Your application has been submitted successfully. Our team will contact you after verification."
      );
      setFullName("");
      setPhone("");
      setEmail("");
      setAddress("");
      setCategoryApplied(serviceCategories[0]);
      setIdProofFile(null);
      setAddressProofFile(null);
    } catch (submitError) {
      setError(submitError?.response?.data?.message || "Failed to submit application.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="worker-shell auth-shell">
        <aside className="auth-aside glass-card">
          <Link to="/" className="auth-home-link" aria-label="Back to home">
            <BrandLogo compact />
          </Link>
          <p className="auth-eyebrow">Worker Hiring Application</p>
          <h1>Apply for a Tasko Employee Position</h1>
          <p>
            Submit your details and documents for verification. Our hiring team will review your application and
            contact you directly.
          </p>
          <ul className="auth-highlight-list">
            <li>No self account creation at this stage</li>
            <li>Document-based verification workflow</li>
            <li>Employee credentials issued by Tasko admin</li>
          </ul>
        </aside>

        <section className="auth-card glass-card auth-login-card">
          <header className="auth-card-head">
            <p className="section-eyebrow">Hiring Application</p>
            <h2>Apply Now</h2>
          </header>

          <form className="auth-fields" onSubmit={onSubmit}>
            <label className="auth-field">
              <span>Full Name</span>
              <input
                className="auth-input"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Enter your full name"
                autoComplete="name"
                required
              />
            </label>

            <label className="auth-field">
              <span>Mobile Number</span>
              <input
                className="auth-input"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="Enter your mobile number"
                autoComplete="tel"
                required
              />
            </label>

            <label className="auth-field">
              <span>Email Address</span>
              <input
                type="email"
                className="auth-input"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@example.com"
                autoComplete="email"
                required
              />
            </label>

            <label className="auth-field">
              <span>Full Residential Address</span>
              <textarea
                className="auth-input"
                rows={3}
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                placeholder="Enter complete residential address"
                required
              />
            </label>

            <label className="auth-field">
              <span>Service Category Applying For</span>
              <select
                className="auth-input"
                value={categoryApplied}
                onChange={(event) => setCategoryApplied(event.target.value)}
                required
              >
                {serviceCategories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>

            <label className="auth-field">
              <span>Upload ID Proof</span>
              <input
                type="file"
                className="auth-input"
                accept=".pdf,image/*"
                onChange={(event) => setIdProofFile(event.target.files?.[0] || null)}
                required
              />
            </label>

            <label className="auth-field">
              <span>Upload Address Proof</span>
              <input
                type="file"
                className="auth-input"
                accept=".pdf,image/*"
                onChange={(event) => setAddressProofFile(event.target.files?.[0] || null)}
                required
              />
            </label>

            {error ? <p className="auth-error">{error}</p> : null}
            {successMessage ? <p className="auth-success">{successMessage}</p> : null}

            <button type="submit" className="btn-luxury-primary btn-glow auth-submit-btn" disabled={submitting}>
              {submitting ? "Submitting..." : "Submit Application"}
            </button>
          </form>

          <p className="auth-footnote">
            Already have credentials?{" "}
            <Link to="/login" className="auth-inline-link">
              Employee Login
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}
