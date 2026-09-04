import multer from "multer";
import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";
import { HttpError } from "../lib/http-error.js";
import { ACCEPTED_IMAGE_TYPES } from "../lib/storage/index.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (ACCEPTED_IMAGE_TYPES.includes(file.mimetype)) return cb(null, true);
    cb(new HttpError(415, `Unsupported image type: ${file.mimetype}`, "UNSUPPORTED_MEDIA_TYPE"));
  },
});

/** Accept a single `file` field, translating multer errors into HttpError. */
export function singleImage(req: Request, res: Response, next: NextFunction) {
  upload.single("file")(req, res, (err: unknown) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return next(HttpError.badRequest(`File exceeds the ${env.MAX_UPLOAD_MB}MB limit`));
      }
      return next(HttpError.badRequest(err.message));
    }
    next(err);
  });
}
