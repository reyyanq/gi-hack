import { createRouter } from "@tanstack/react-router";
import { Route as rootRoute } from "./routes/__root";
import { Route as indexRoute } from "./routes/index";
import { Route as graphLazyRoute } from "./routes/graph.lazy";
import { Route as chatLazyRoute } from "./routes/chat.lazy";

const routeTree = rootRoute.addChildren([
  indexRoute,
  graphLazyRoute,
  chatLazyRoute,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
