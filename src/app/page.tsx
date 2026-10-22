import { businessConfig } from "@/config/business.config";

export default function DashboardPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <header className="mb-8 border-b border-zinc-800 pb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              {businessConfig.brand.name} Social Connect
            </h1>
            <p className="mt-1 text-sm text-zinc-400">
              Multi-tenant comment-to-DM automation for Instagram creators.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400 ring-1 ring-inset ring-emerald-500/20">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
              SKIP LOCKED Queue Active
            </span>
          </div>
        </div>
      </header>

      {/* Notice Banner */}
      <div className="mb-8 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
        <div className="flex items-start gap-3">
          <span className="text-lg">ℹ️</span>
          <div>
            <strong className="font-semibold">Meta Policy Notice:</strong> Commenters who do not
            already follow your Instagram account will receive automated private replies inside
            their <em>Message Requests</em> folder rather than their primary inbox.
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Left Column: Accounts & Automations */}
        <section className="space-y-6 lg:col-span-2">
          {/* Connected Accounts Card */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
            <h2 className="text-lg font-semibold text-white">Connected Channel Accounts</h2>
            <p className="mt-1 text-xs text-zinc-400">
              Instagram accounts authorized via Instagram Login (AES-256-GCM encrypted tokens).
            </p>

            <div className="mt-4 divide-y divide-zinc-800">
              <div className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 text-white font-bold text-sm">
                    IG
                  </div>
                  <div>
                    <div className="font-medium text-zinc-200">@anozik_creator</div>
                    <div className="text-xs text-zinc-400">Cap: 600 DMs/hr • Auto-refresh on</div>
                  </div>
                </div>
                <span className="rounded-md bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-400 ring-1 ring-emerald-500/20">
                  Connected
                </span>
              </div>
            </div>
          </div>

          {/* Active Automations Card */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
            <h2 className="text-lg font-semibold text-white">Active Automation Rules</h2>
            <p className="mt-1 text-xs text-zinc-400">
              Rules evaluated in memory with strict priority and match hierarchy.
            </p>

            <div className="mt-4 space-y-3">
              <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-zinc-200">Portfolio Delivery DM</span>
                  <span className="text-xs text-zinc-400">Priority 1 • Whole Word</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">
                    portfolio
                  </span>
                  <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">
                    पोर्टफोलियो
                  </span>
                  <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">
                    design
                  </span>
                </div>
                <p className="mt-2 text-xs text-zinc-400">
                  Target: <code>https://{businessConfig.brand.domain}/u/nitin</code>
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Right Column: Queue Monitor & Safety Controls */}
        <section className="space-y-6">
          {/* Emergency Kill Switch */}
          <div className="rounded-xl border border-red-500/30 bg-red-950/20 p-6">
            <h2 className="text-lg font-semibold text-red-200">Emergency Safety Controls</h2>
            <p className="mt-1 text-xs text-red-300/80">
              Immediately halts all outgoing DMs across the workspace.
            </p>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-sm font-medium text-zinc-300">Kill Switch</span>
              <span className="rounded bg-zinc-800 px-2.5 py-1 text-xs font-semibold text-zinc-400">
                INACTIVE (Normal Operation)
              </span>
            </div>
          </div>

          {/* Honest Queue Health */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
            <h2 className="text-lg font-semibold text-white">Honest Queue Telemetry</h2>
            <p className="mt-1 text-xs text-zinc-400">
              Live status states. Queued items are never falsely displayed as sent.
            </p>

            <dl className="mt-4 grid grid-cols-2 gap-4">
              <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
                <dt className="text-xs text-zinc-400">Pending Lease</dt>
                <dd className="mt-1 text-xl font-semibold text-zinc-200">0</dd>
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
                <dt className="text-xs text-zinc-400">Sending Active</dt>
                <dd className="mt-1 text-xl font-semibold text-amber-400">0</dd>
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
                <dt className="text-xs text-zinc-400">Sent Today</dt>
                <dd className="mt-1 text-xl font-semibold text-emerald-400">0</dd>
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
                <dt className="text-xs text-zinc-400">Unknown Delivery</dt>
                <dd className="mt-1 text-xl font-semibold text-purple-400">0</dd>
              </div>
            </dl>
          </div>
        </section>
      </div>
    </main>
  );
}
