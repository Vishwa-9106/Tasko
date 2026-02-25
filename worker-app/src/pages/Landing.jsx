import { Link } from "react-router-dom";

export default function LandingPage() {
  const workerId = localStorage.getItem("tasko_worker_id");

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-10">
      <section className="rounded-2xl bg-gradient-to-r from-orange-100 to-amber-100 p-8">
        <p className="mb-2 text-xs font-bold uppercase tracking-widest text-orange-700">Tasko Worker</p>
        <h1 className="mb-3 text-4xl font-bold text-slate-900">Grow your service business with Tasko</h1>
        <p className="text-slate-700">Register, verify your category, pass test checks, and receive assignments.</p>
      </section>

      <div className="card flex flex-col gap-3 sm:flex-row">
        <Link to="/register" className="btn btn-primary text-center">
          Register as Worker
        </Link>
        <Link to="/test" className="btn btn-secondary text-center">
          Test Placeholder
        </Link>
        {workerId ? (
          <Link to="/waiting" className="btn btn-secondary text-center">
            Resume Session
          </Link>
        ) : null}
      </div>
    </div>
  );
}