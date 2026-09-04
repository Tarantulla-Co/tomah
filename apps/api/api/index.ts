/**
 * Vercel serverless entry for the Tomah admin API.
 *
 * The whole Express application (see ../src/app.ts) is exported as the default
 * request handler. `vercel.json` rewrites every path to this function, so
 * Express keeps doing its own routing — including the `/api/v1` mount and its
 * 404 handler — exactly as it does when run as a standalone server locally.
 *
 * There is deliberately no `app.listen()` here; Vercel invokes the handler
 * per-request.
 */
import { createApp } from "../src/app.js";

const app = createApp();

export default app;
