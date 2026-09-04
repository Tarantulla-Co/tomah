import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.js";
import { apiRouter } from "./routes/index.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";
import { localUploadDir, storage } from "./lib/storage/index.js";

export function createApp() {
  const app = express();

  app.set("trust proxy", 1);
  // Allow <img> tags on the admin (and storefront) origin to load uploaded
  // assets served from this origin.
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(
    cors({
      origin: env.corsOrigins,
      credentials: true,
    }),
  );
  app.use(
    express.json({
      limit: "1mb",
      // Keep the raw bytes so the Stripe webhook route can verify its signature.
      verify: (req, _res, buf) => {
        (req as express.Request).rawBody = buf;
      },
    }),
  );
  app.use(cookieParser());
  if (!env.isProd) app.use(morgan("dev"));

  // Serve locally-stored uploads. When a real object store / CDN is configured
  // (STORAGE_ADAPTER != local) this mount is inert and files are served by it.
  if (storage.name === "local") {
    app.use(
      "/uploads",
      express.static(localUploadDir, { fallthrough: true, maxAge: env.isProd ? "7d" : 0 }),
    );
  }

  app.use("/api/v1", apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
