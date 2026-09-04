import { Router } from "express";
import { asyncHandler } from "../lib/async-handler.js";
import { validateBody } from "../middleware/validate.js";
import { requireAuth } from "../middleware/auth.js";
import { loginSchema } from "../validators/auth.schema.js";
import * as auth from "../controllers/auth.controller.js";

export const authRouter = Router();

authRouter.post("/login", validateBody(loginSchema), asyncHandler(auth.login));
authRouter.post("/refresh", asyncHandler(auth.refresh));
authRouter.post("/logout", asyncHandler(auth.logout));
authRouter.post("/logout-all", requireAuth, asyncHandler(auth.logoutAll));
authRouter.get("/me", requireAuth, asyncHandler(auth.me));
