import { createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { RootLayout } from "./routes/__root";
import { DashboardPage } from "./routes/index";
import { AdminPage } from "./routes/admin";
import { LeadsPage } from "./routes/leads";
import { GraphPage } from "./routes/graph.lazy";
import { ChatPage } from "./routes/chat.lazy";

const rootRoute = createRootRoute({
  component: RootLayout,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: DashboardPage,
});

const adminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin",
  component: AdminPage,
});

const leadsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/leads",
  component: LeadsPage,
});

const graphRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/graph",
  component: GraphPage,
});

const chatRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/chat",
  component: ChatPage,
});

const routeTree = rootRoute.addChildren([indexRoute, adminRoute, leadsRoute, graphRoute, chatRoute]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
