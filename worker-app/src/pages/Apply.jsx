import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import TaskoBrandMark from "../components/TaskoBrandMark";

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
  const [categoryApplied, setCategoryApplied] = useState([]);
  const [idProofFile, setIdProofFile] = useState(null);
  const [addressProofFile, setAddressProofFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const toggleCategory = (category) => {
    setCategoryApplied((previous) =>
      previous.includes(category)
        ? previous.filter((value) => value !== category)
        : [...previous, category]
    );
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccessMessage("");

    if (!fullName.trim() || !phone.trim() || !email.trim() || !address.trim() || categoryApplied.length === 0) {
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
        categoryApplied: categoryApplied.join(", "),
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
      setCategoryApplied([]);
      setIdProofFile(null);
      setAddressProofFile(null);
    } catch (submitError) {
      setError(submitError?.response?.data?.message || "Failed to submit application.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page worker-auth-page">
      <header className="auth-nav">
        <div className="auth-shell auth-nav-row">
          <Link className="auth-brand" to="/" aria-label="Tasko worker home">
            <TaskoBrandMark className="auth-brand-mark auth-brand-mark-image" />
            <span className="auth-brand-text">TASKO</span>
          </Link>
          <nav className="auth-nav-links" aria-label="Worker navigation">
            <a href="/#categories">CATEGORIES</a>
            <a href="/#benefits">BENEFITS</a>
            <a href="/#standards">STANDARDS</a>
            <a href="/#stories">STORIES</a>
          </nav>
          <Link to="/login" className="auth-nav-cta">
            EMPLOYEE LOGIN
          </Link>
        </div>
      </header>

      <section className="auth-section">
        <div className="auth-shell auth-grid worker-auth-grid-wide">
          <div className="auth-copy">
            <p className="auth-copy-eyebrow">TASKO HIRING APPLICATION</p>
            <h1>
              APPLY TO JOIN
              <span>THE TASKO TEAM.</span>
            </h1>
            <p>Submit your details and proofs for review. Approved workers receive credentials directly from Tasko admin.</p>
            <ul className="auth-copy-points">
              <li>DOCUMENT-BASED VERIFICATION</li>
              <li>ROLE-SPECIFIC HIRING REVIEW</li>
              <li>NO SELF-CREATED EMPLOYEE ACCOUNT</li>
            </ul>
          </div>

          <div className="auth-panel worker-auth-panel">
            <p className="auth-panel-eyebrow">APPLICATION FORM</p>
            <h2>START YOUR ONBOARDING</h2>
            <form className="auth-form worker-auth-form" onSubmit={onSubmit}>
              <input
                className="auth-input"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Full name"
                autoComplete="name"
                required
              />
              <input
                className="auth-input"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="Mobile number"
                autoComplete="tel"
                required
              />
              <input
                type="email"
                className="auth-input"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Email address"
                autoComplete="email"
                required
              />
              <textarea
                className="auth-input worker-auth-textarea"
                rows={4}
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                placeholder="Full residential address"
                required
              />

              <div className="worker-auth-fieldset">
                <p className="worker-auth-field-label">SERVICE CATEGORIES</p>
                <div className="worker-auth-category-grid" role="group" aria-label="Service categories">
                  {serviceCategories.map((category) => {
                    const selected = categoryApplied.includes(category);
                    return (
                      <button
                        key={category}
                        type="button"
                        className={`worker-auth-category-btn${selected ? " is-selected" : ""}`}
                        aria-pressed={selected}
                        onClick={() => toggleCategory(category)}
                      >
                        {category}
                      </button>
                    );
                  })}
                </div>
                <p className="worker-auth-help">Select one or more categories that match your skills.</p>
              </div>

              <label className="worker-auth-upload">
                <span>ID PROOF</span>
                <input
                  type="file"
                  className="auth-input worker-auth-file"
                  accept=".pdf,image/*"
                  onChange={(event) => setIdProofFile(event.target.files?.[0] || null)}
                  required
                />
              </label>

              <label className="worker-auth-upload">
                <span>ADDRESS PROOF</span>
                <input
                  type="file"
                  className="auth-input worker-auth-file"
                  accept=".pdf,image/*"
                  onChange={(event) => setAddressProofFile(event.target.files?.[0] || null)}
                  required
                />
              </label>

              {error ? <p className="auth-error">{error}</p> : null}
              {successMessage ? <p className="worker-auth-success">{successMessage}</p> : null}

              <button type="submit" className="auth-primary-btn" disabled={submitting}>
                {submitting ? "SUBMITTING..." : "SUBMIT APPLICATION"}
              </button>
            </form>

            <div className="auth-divider-wrap">
              <span />
              <p>ACCESS</p>
              <span />
            </div>
            <div className="worker-auth-support">
              <p>Already have credentials from Tasko admin?</p>
              <Link to="/login" className="auth-social-btn worker-auth-link-btn">
                EMPLOYEE LOGIN
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
