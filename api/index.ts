import { app } from "../server/app";
import { registerRoutes } from "../server/routes";

// Initialize routes
registerRoutes(app);

export default app;
