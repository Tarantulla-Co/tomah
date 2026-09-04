import type { UserRole } from "@tomah/db";

declare global {
  namespace Express {
    interface Request {
      /** Set by requireAuth. Present on every protected route. */
      auth?: {
        userId: string;
        role: UserRole;
        name: string;
        email: string;
      };
      /** Raw request bytes, captured by the JSON body parser's `verify` hook.
       *  Needed to verify the Stripe webhook signature. */
      rawBody?: Buffer;
    }
  }
}

export {};
