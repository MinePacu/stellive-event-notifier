# Backend API Scaling Design

## Goal

Increase public read API capacity on a four-core host by running two to four Node API processes without multiplying scheduler loops or external platform API calls.

## Architecture

The API remains a single Fastify application image, but production deployments run static `api-1` through `api-4` services. Static service names support both deployment modes without relying on Docker DNS behavior for dynamically scaled services.

- Docker Nginx mode: an Nginx container publishes port 4000 and balances requests across the selected API services on the Compose network.
- Host Nginx mode: API services publish only loopback ports 4001 through 4004; an existing host Nginx balances those ports.
- PM2 and systemd remain documented VM alternatives.

Scheduler containers remain singletons and call `http://api-1:4000` inside Docker. The protected endpoint may be served by any API instance, but only one scheduler loop issues routine calls. Music synchronization additionally uses a Redis compare-and-delete lock across processes. A process-local lock remains a development fallback and emits a production warning.

## Application Changes

`/health` reports PID, hostname, uptime, environment, and package version so balancing can be observed. The process entrypoint installs idempotent SIGTERM and SIGINT handling, closes Fastify, disconnects an initialized Prisma client, and exits with a failure status only when shutdown fails.

The music lock contract becomes asynchronous so it can support Redis `SET NX PX`. Release uses a Lua value comparison to prevent one worker from deleting another worker's renewed lock. The Redis client is closed through Fastify's shutdown lifecycle.

## Stateful Boundaries

Production scaling requires Prisma-backed Hub Events and PostgreSQL. Public read routes are the scaling target. Development/mock routes, process-local preferences and delivery attempts, and the current process-local SSE stream are explicitly excluded. Notification draining and external API polling remain singleton worker responsibilities.

## Verification

Tests cover health metadata, graceful shutdown idempotence, Prisma disconnect behavior, Redis lock acquisition/release ownership, and async lock consumers. Configuration is validated with Docker Compose where available. Final verification runs the backend build and full test suite, followed by focused diffs and whitespace checks.

