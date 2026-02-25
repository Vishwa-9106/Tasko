import { useState } from "react";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { auth } from "../firebase";
import { api } from "../api";

const categoryOptions = ["Cleaning", "Plumbing", "Electrician", "Carpentry", "Painter"];

function getFirebaseAuthErrorMessage(error) {
  const code = error?.code || "";
  const fallback = error?.message || "Registration failed";

  if (code === "auth/operation-not-allowed") {
    return "Email/Password sign-in is disabled in Firebase Console.";
  }
  if (code === "auth/configuration-not-found") {
    return "Firebase Authentication is not initialized for this project. Open Firebase Console > Authentication and click Get started.";
  }
  if (code === "auth/weak-password") {
    return "Password must be at least 6 characters.";
  }
  if (code === "auth/email-already-in-use") {
    return "This email is already in use.";
  }
  if (code === "auth/invalid-email") {
    return "Please enter a valid email address.";
  }
  if (code === "auth/network-request-failed") {
    return "Network error. Check your connection and retry.";
  }

  return fallback;
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [error, setError] = useState("");

  const toggleCategory = (category) => {
    setSelectedCategories((current) =>
      current.includes(category) ? current.filter((item) => item !== category) : [...current, category]
    );
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setError("");
    const trimmedEmail = email.trim();

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    try {
      const credential = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
      await updateProfile(credential.user, { displayName: name });

      const response = await api.post("/api/workers/register", {
        firebaseUid: credential.user.uid,
        name,
        email: trimmedEmail,
        categories: selectedCategories
      });

      const idToken = await credential.user.getIdToken();
      await api.post("/api/auth/sync-role", {
        idToken,
        role: "worker",
        name
      });
      await api.post("/api/auth/validate", { idToken, expectedRole: "worker" });

      localStorage.setItem("tasko_worker_id", response.data.workerId);
      navigate("/waiting");
    } catch (submitError) {
      setError(submitError.response?.data?.message || getFirebaseAuthErrorMessage(submitError));
    }
  };

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <div className="card">
        <h2 className="mb-4 text-2xl font-bold">Worker Registration</h2>
        <form className="space-y-3" onSubmit={onSubmit}>
          <input className="input" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} required />
          <input type="email" className="input" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input
            type="password"
            className="input"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <div>
            <p className="mb-2 text-sm font-semibold">Service Categories</p>
            <div className="grid grid-cols-2 gap-2">
              {categoryOptions.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => toggleCategory(category)}
                  className={`rounded-lg border px-3 py-2 text-sm ${
                    selectedCategories.includes(category)
                      ? "border-accent-500 bg-orange-100 text-accent-700"
                      : "border-orange-200 bg-white"
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <button type="submit" className="btn btn-primary w-full">
            Register
          </button>
        </form>
      </div>
    </div>
  );
}
