export function AuthSplitLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-teal-500 via-cyan-600 to-blue-700 p-10 text-white lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, white 0, transparent 40%), radial-gradient(circle at 80% 70%, white 0, transparent 35%)"
          }}
        />
        <div className="relative text-lg font-semibold tracking-tight">Enlace Ai</div>
        <div className="relative space-y-4">
          <h1 className="text-3xl font-semibold leading-tight text-balance">AI support that actually resolves conversations.</h1>
          <p className="max-w-sm text-white/80">
            Answer instantly from your knowledge base, call your tools, and escalate to a human only when it matters.
          </p>
        </div>
        <div className="relative text-sm text-white/60">Enlace Ai — built for teams who'd rather ship than staff a help desk.</div>
      </div>
      <div className="flex items-center justify-center bg-muted/40 p-6 sm:p-10 lg:bg-background">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
