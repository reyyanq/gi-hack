import { Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

export function RootLayout() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <nav className="border-b border-gray-800 px-6 py-3 flex items-center gap-6">
        <a href="/" className="font-bold text-lg text-cyan-400">
          LeadGraph
        </a>
        <a href="/leads" className="text-gray-400 hover:text-white transition-colors">
          Leads
        </a>
        <a href="/pipeline" className="text-gray-400 hover:text-white transition-colors">
          Pipeline
        </a>
        <a href="/graph" className="text-gray-400 hover:text-white transition-colors">
          Graph
        </a>
        <a href="/chat" className="text-gray-400 hover:text-white transition-colors">
          Chat
        </a>
        <a href="/admin" className="text-gray-400 hover:text-white transition-colors">
          Admin
        </a>
      </nav>
      <main className="max-w-6xl mx-auto p-6">
        <Outlet />
      </main>
      <TanStackRouterDevtools />
    </div>
  );
}
