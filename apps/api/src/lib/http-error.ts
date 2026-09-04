/** Application error with an HTTP status. Thrown from controllers/services and
 *  rendered by the error middleware into a consistent JSON envelope. */
export class HttpError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, message: string, code?: string, details?: unknown) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code ?? defaultCode(status);
    this.details = details;
  }

  static badRequest(msg = "Bad request", details?: unknown) {
    return new HttpError(400, msg, "BAD_REQUEST", details);
  }
  static unauthorized(msg = "Not authenticated") {
    return new HttpError(401, msg, "UNAUTHORIZED");
  }
  static forbidden(msg = "Not allowed") {
    return new HttpError(403, msg, "FORBIDDEN");
  }
  static notFound(msg = "Not found") {
    return new HttpError(404, msg, "NOT_FOUND");
  }
  static conflict(msg = "Conflict") {
    return new HttpError(409, msg, "CONFLICT");
  }
}

function defaultCode(status: number): string {
  const map: Record<number, string> = {
    400: "BAD_REQUEST",
    401: "UNAUTHORIZED",
    403: "FORBIDDEN",
    404: "NOT_FOUND",
    409: "CONFLICT",
    422: "UNPROCESSABLE_ENTITY",
    500: "INTERNAL_ERROR",
  };
  return map[status] ?? "ERROR";
}
