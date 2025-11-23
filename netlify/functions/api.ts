import serverless from "serverless-http";
import { app } from "../../server/app";
import { registerRoutes } from "../../server/routes";

// Initialize routes
registerRoutes(app);

export const handler = serverless(app);
