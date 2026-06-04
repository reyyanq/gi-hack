import { createRootRoute, Link, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

export const Route = createRootRoute({
  component: () => (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <nav className="border-b border-gray-800 px-6 py-3 flex items-center gap-6">
        <Link to="/" className="font-bold text-lg text-cyan-400">
          Gi-Hack
        </Link>
        <Link to="/graph" className="text-gray-400 hover:text-white transition-colors">
          Graph
        </Link>
        <Link to="/chat" className="text-gray-400 hover:text-white transition-colors">
          Chat
        </Link>
      </nav>
      <main className="max-w-6xl mx-auto p-6">
        <Outlet />
      </main>
      <TanStackRouterDevtools />
    </div>
  ),
});
