import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import Fastify from "fastify";
import { registerRoutes } from "./routes/routes.js";

export async function buildApp() {
  const app = Fastify({ logger: true });
  await app.register(cors);
  await app.register(sensible);
  await app.register(swagger, {
    openapi: {
      info: { title: "Stellive Notification Hub API", version: "0.1.0" }
    }
  });
  await app.register(swaggerUi, { routePrefix: "/docs" });
  await registerRoutes(app);
  return app;
}

