import { AlertTriangle } from "lucide-react";
import { type ReceiptValidationError, formatCurrency } from "@/lib/receipt-utils";

interface ValidationErrorsProps {
  errors: ReceiptValidationError[];
  currencyCode?: string;
  className?: string;
}

export function ValidationErrors({ errors, currencyCode, className = "" }: ValidationErrorsProps) {
  if (errors.length === 0) {
    return null;
  }

  // Group errors by type for better organization
  const negativeErrors = errors.filter((e) =>
    e.type.startsWith("NEGATIVE_")
  );
  const mismatchErrors = errors.filter(
    (e) => e.type.includes("MISMATCH")
  );

  const hint =
    negativeErrors.length > 0
      ? "Some amounts are negative. Check the receipt details for typos."
      : "Check that every item is fully assigned and the receipt subtotal matches its items.";

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`flex gap-3 rounded-xl border border-amber-300/70 bg-amber-50 p-4 text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-100 ${className}`}
    >
      <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
      <div className="flex min-w-0 flex-col gap-2">
        <p className="font-medium">
          {mismatchErrors.length > 0
            ? "These totals don't add up yet"
            : "Some amounts look wrong"}
        </p>
        <ul className="flex flex-col gap-1 text-sm">
          {[...mismatchErrors, ...negativeErrors].map((error, index) => (
            <li key={index}>
              {error.message}
              {error.type.startsWith("NEGATIVE_") && error.actual !== undefined && (
                <span className="text-amber-800/80 dark:text-amber-200/80">
                  {` (${formatCurrency(error.actual, currencyCode)})`}
                </span>
              )}
              {!error.type.startsWith("NEGATIVE_") && error.diff !== undefined && (
                <span className="text-amber-800/80 dark:text-amber-200/80">
                  {` — off by ${formatCurrency(Math.abs(error.diff), currencyCode)}`}
                </span>
              )}
            </li>
          ))}
        </ul>
        <p className="text-xs text-amber-800/80 dark:text-amber-200/80">
          {hint} Small rounding differences are fine.
        </p>
      </div>
    </div>
  );
}
