import { useMemo, useState } from "react";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { Link, useNavigate } from "react-router-dom";
import { auth } from "../firebase";
import { api } from "../api";
import BrandLogo from "../components/landing/BrandLogo";
import LineIcon from "../components/landing/LineIcon";
import { categoryQuestionBank, workerCategories } from "../data/workerAssessment";

const flowSteps = ["Profile Details", "Service Category", "Skill Assessment"];

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
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const selectedQuestions = useMemo(
    () => (selectedCategory ? categoryQuestionBank[selectedCategory] || [] : []),
    [selectedCategory]
  );

  const completedAnswerCount = useMemo(
    () => selectedQuestions.filter((question) => Number.isInteger(answers[question.id])).length,
    [answers, selectedQuestions]
  );

  const validateStepOne = () => {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedMobile = mobile.trim();
    const mobilePattern = /^\d{10}$/;

    if (!trimmedName) return "Name is required.";
    if (!mobilePattern.test(trimmedMobile)) return "Enter a valid 10-digit mobile number.";
    if (!trimmedEmail) return "Email is required.";
    if (password.length < 6) return "Password must be at least 6 characters.";
    if (password !== confirmPassword) return "Password and confirm password must match.";

    return "";
  };

  const goToNextStep = () => {
    setError("");

    if (step === 0) {
      const stepError = validateStepOne();
      if (stepError) {
        setError(stepError);
        return;
      }
    }

    if (step === 1 && !selectedCategory) {
      setError("Please select one service category to continue.");
      return;
    }

    setStep((current) => Math.min(current + 1, flowSteps.length - 1));
  };

  const goToPrevStep = () => {
    setError("");
    setStep((current) => Math.max(current - 1, 0));
  };

  const submitAssessment = async () => {
    const totalQuestions = selectedQuestions.length;

    if (totalQuestions === 0) {
      setError("Question set is unavailable for the selected category.");
      return;
    }

    if (completedAnswerCount !== totalQuestions) {
      setError("Please answer all assessment questions before submitting.");
      return;
    }

    setError("");
    setSubmitting(true);

    const trimmedName = name.trim();
    const trimmedMobile = mobile.trim();
    const trimmedEmail = email.trim().toLowerCase();

    const score = selectedQuestions.reduce((total, question) => {
      return answers[question.id] === question.answerIndex ? total + 1 : total;
    }, 0);

    const percentage = Math.round((score / totalQuestions) * 100);
    const passed = percentage >= 60;

    try {
      const credential = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
      await updateProfile(credential.user, { displayName: trimmedName });

      const response = await api.post("/api/workers/register", {
        firebaseUid: credential.user.uid,
        name: trimmedName,
        mobile: trimmedMobile,
        email: trimmedEmail,
        categories: [selectedCategory],
        assessment: {
          category: selectedCategory,
          totalQuestions,
          score,
          percentage,
          passed,
          answers: selectedQuestions.map((question) => {
            const selectedOptionIndex = answers[question.id];
            return {
              questionId: question.id,
              question: question.prompt,
              options: question.options,
              selectedOptionIndex,
              selectedOption: question.options[selectedOptionIndex],
              correctOptionIndex: question.answerIndex,
              correctOption: question.options[question.answerIndex],
              isCorrect: selectedOptionIndex === question.answerIndex
            };
          }),
          submittedAt: new Date().toISOString()
        }
      });

      const idToken = await credential.user.getIdToken();
      await api.post("/api/auth/validate", { idToken, expectedRole: "worker" });

      localStorage.setItem("tasko_worker_id", response.data.workerId);
      navigate("/waiting");
    } catch (submitError) {
      setError(submitError.response?.data?.message || getFirebaseAuthErrorMessage(submitError));
    } finally {
      setSubmitting(false);
    }
  };

  const renderStepContent = () => {
    if (step === 0) {
      return (
        <div className="auth-fields">
          <label className="auth-field">
            <span>Full Name</span>
            <input
              className="auth-input"
              placeholder="Enter your full name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="name"
              required
            />
          </label>

          <label className="auth-field">
            <span>Mobile Number</span>
            <input
              className="auth-input"
              placeholder="10-digit mobile number"
              value={mobile}
              onChange={(event) => setMobile(event.target.value.replace(/\D/g, "").slice(0, 10))}
              autoComplete="tel"
              inputMode="numeric"
              required
            />
          </label>

          <label className="auth-field">
            <span>Email ID</span>
            <input
              type="email"
              className="auth-input"
              placeholder="name@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />
          </label>

          <label className="auth-field">
            <span>Password</span>
            <input
              type="password"
              className="auth-input"
              placeholder="At least 6 characters"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              required
            />
          </label>

          <label className="auth-field">
            <span>Confirm Password</span>
            <input
              type="password"
              className="auth-input"
              placeholder="Re-enter your password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              required
            />
          </label>
        </div>
      );
    }

    if (step === 1) {
      return (
        <div className="category-grid">
          {workerCategories.map((category) => {
            const isSelected = selectedCategory === category.value;

            return (
              <button
                key={category.value}
                type="button"
                className={`category-option ${isSelected ? "is-selected" : ""}`}
                onClick={() => {
                  setSelectedCategory(category.value);
                  setAnswers({});
                  setError("");
                }}
              >
                <span className="icon-shell" aria-hidden="true">
                  <LineIcon name={category.icon} />
                </span>
                <span>{category.value}</span>
              </button>
            );
          })}
        </div>
      );
    }

    return (
      <div className="assessment-panel">
        <div className="assessment-header">
          <p>
            Category: <strong>{selectedCategory}</strong>
          </p>
          <p>
            Answered {completedAnswerCount}/{selectedQuestions.length}
          </p>
        </div>

        <div className="assessment-list">
          {selectedQuestions.map((question, index) => (
            <article key={question.id} className="question-card">
              <p className="question-title">
                {index + 1}. {question.prompt}
              </p>
              <div className="question-options">
                {question.options.map((option, optionIndex) => {
                  const checked = answers[question.id] === optionIndex;
                  return (
                    <label key={option} className={`question-option ${checked ? "is-checked" : ""}`}>
                      <input
                        type="radio"
                        name={question.id}
                        checked={checked}
                        onChange={() => setAnswers((current) => ({ ...current, [question.id]: optionIndex }))}
                      />
                      <span>{option}</span>
                    </label>
                  );
                })}
              </div>
            </article>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="auth-page">
      <div className="worker-shell auth-shell">
        <aside className="auth-aside glass-card">
          <Link to="/" className="auth-home-link" aria-label="Back to home">
            <BrandLogo compact />
          </Link>
          <p className="auth-eyebrow">Worker Onboarding</p>
          <h1>Become a Verified Tasko Professional</h1>
          <p>
            Complete your profile, choose your category, and pass a skill assessment. Once submitted, your application
            is sent to admin review.
          </p>

          <ol className="auth-step-list">
            {flowSteps.map((label, index) => (
              <li key={label} className={index <= step ? "is-active" : ""}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <p>{label}</p>
              </li>
            ))}
          </ol>
        </aside>

        <section className="auth-card glass-card">
          <header className="auth-card-head">
            <p className="section-eyebrow">Step {step + 1}</p>
            <h2>{flowSteps[step]}</h2>
          </header>

          {renderStepContent()}

          {error ? <p className="auth-error">{error}</p> : null}

          <div className="auth-actions-row">
            {step > 0 ? (
              <button type="button" className="btn-luxury-secondary" onClick={goToPrevStep} disabled={submitting}>
                Back
              </button>
            ) : (
              <span />
            )}

            {step < flowSteps.length - 1 ? (
              <button type="button" className="btn-luxury-primary btn-glow" onClick={goToNextStep}>
                Continue
              </button>
            ) : (
              <button
                type="button"
                className="btn-luxury-primary btn-glow"
                onClick={submitAssessment}
                disabled={submitting}
              >
                {submitting ? "Submitting..." : "Submit for Admin Review"}
              </button>
            )}
          </div>

          <p className="auth-footnote">
            Already registered?{" "}
            <Link to="/login" className="auth-inline-link">
              Login as worker
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}
