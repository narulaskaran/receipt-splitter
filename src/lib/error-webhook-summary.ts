import { type ZodError } from "zod";

/** Safe summary for Zod validation failures (paths and issue kinds only). */
export function summarizeZodValidationForWebhook(error: ZodError): string {
  const parts = error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
    return `${path} [${issue.code}]`;
  });
  return `Zod validation failed (${error.issues.length} issue(s)): ${parts.join("; ")}`;
}
