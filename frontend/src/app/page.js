export default function Home() {
  return (
    <div className="app-shell">
      <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center gap-14 px-6 py-20 lg:flex-row lg:items-center lg:gap-16">
        <section className="flex-1 space-y-6">
          <div className="app-badge">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Live crime monitoring platform
          </div>
          <h1 className="text-4xl font-semibold text-slate-900 sm:text-5xl">
            AI-assisted incident detection with real-time response.
          </h1>
          <p className="text-lg text-slate-600 max-w-xl">
            Coordinate operators, analyze activity, and respond faster with a unified
            dashboard designed for high-stakes environments.
          </p>
          <div className="flex flex-wrap gap-3">
            <a href="/login" className="app-button">
              Sign in to console
            </a>
            <a
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:text-slate-900"
            >
              Go to dashboard
            </a>
          </div>
          <div className="grid gap-4 pt-6 sm:grid-cols-3">
            {[
              { label: "Active cameras", value: "48" },
              { label: "Incidents today", value: "132" },
              { label: "Avg. response", value: "2m 12s" },
            ].map((item) => (
              <div key={item.label} className="app-card p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  {item.label}
                </p>
                <p className="text-2xl font-semibold text-slate-900">
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="flex-1">
          <div className="app-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Threat overview
                </p>
                <h2 className="text-2xl font-semibold text-slate-900">
                  Citywide pulse
                </h2>
              </div>
              <span className="app-badge">Updated 2m ago</span>
            </div>
            <div className="mt-6 grid gap-4">
              <div className="app-panel p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-600">Critical alerts</span>
                  <span className="text-sm font-semibold text-rose-600">8</span>
                </div>
                <div className="mt-3 h-2 w-full rounded-full bg-rose-100">
                  <div className="h-2 w-1/3 rounded-full bg-rose-500" />
                </div>
              </div>
              <div className="app-panel p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-600">Operator coverage</span>
                  <span className="text-sm font-semibold text-emerald-600">92%</span>
                </div>
                <div className="mt-3 h-2 w-full rounded-full bg-emerald-100">
                  <div className="h-2 w-[92%] rounded-full bg-emerald-500" />
                </div>
              </div>
              <div className="app-panel p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-600">AI confidence</span>
                  <span className="text-sm font-semibold text-cyan-700">High</span>
                </div>
                <p className="mt-2 text-sm text-slate-500">
                  Pose analysis is stable across multi-person scenes.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
