import { AlertTriangle, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type ReceiptValidationError } from "@/lib/receipt-utils";
import { formatCurrency } from "@/lib/receipt-utils";

interface ValidationErrorsProps {
  errors: ReceiptValidationError[];
  className?: string;
}

export function ValidationErrors({ errors, className = "" }: ValidationErrorsProps) {
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

  return (
    <Card className={`border-yellow-500/50 bg-yellow-50 dark:bg-yellow-900/10 ${className}`}>
      <CardHeader className="pb-3">
        <CardTitle 
          className="text-lg flex items-center gap-2 text-yellow-800 dark:text-yellow-300"
          role="alert"
          aria-live="polite"
        >
          <AlertTriangle className="h-5 w-5" />
          Split Validation Issues ({errors.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary message */}
        <div className="text-sm text-yellow-700 dark:text-yellow-400">
          {mismatchErrors.length > 0 && (
            <p className="mb-2">
              ⚠️ The split doesn&apos;t add up correctly. Please review the issues below.
            </p>
          )}
          {negativeErrors.length > 0 && (
            <p>
              ⚠️ Some amounts are negative. Please check your receipt data.
            </p>
          )}
        </div>

        {/* Mismatch errors */}
        {mismatchErrors.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-semibold text-sm text-yellow-800 dark:text-yellow-300">
              Amount Mismatches:
            </h4>
            <ul className="space-y-2">
              {mismatchErrors.map((error, index) => (
                <li
                  key={index}
                  className="text-sm bg-white dark:bg-gray-800 rounded-md p-3 border border-yellow-200 dark:border-yellow-800"
                >
                  <div className="font-medium text-gray-900 dark:text-gray-100">
                    {error.message}
                  </div>
                  {error.diff !== undefined && error.tolerance !== undefined && (
                    <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      Off by {formatCurrency(Math.abs(error.diff))}
                      {error.expected !== undefined && error.actual !== undefined && (
                        <>
                          {" "}(expected: {formatCurrency(error.expected)},
                          actual: {formatCurrency(error.actual)})
                        </>
                      )}
                      <div className="flex items-center gap-1 mt-1 text-gray-500 dark:text-gray-500">
                        <Info className="h-3 w-3" />
                        Allowed tolerance: ±{formatCurrency(error.tolerance)}
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Negative value errors */}
        {negativeErrors.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-semibold text-sm text-yellow-800 dark:text-yellow-300">
              Negative Values:
            </h4>
            <ul className="space-y-2">
              {negativeErrors.map((error, index) => (
                <li
                  key={index}
                  className="text-sm bg-white dark:bg-gray-800 rounded-md p-3 border border-yellow-200 dark:border-yellow-800"
                >
                  <div className="font-medium text-gray-900 dark:text-gray-100">
                    {error.message}
                  </div>
                  {error.actual !== undefined && (
                    <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      Current value: {formatCurrency(error.actual)}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Help text */}
        <div className="text-xs text-gray-600 dark:text-gray-400 pt-2 border-t border-yellow-200 dark:border-yellow-800">
          <strong>How to fix:</strong>
          <ul className="list-disc list-inside mt-1 space-y-1">
            {negativeErrors.length > 0 && (
              <li>Check for data entry errors in receipt amounts (negative values are not allowed).</li>
            )}
            {mismatchErrors.length > 0 && (
              <li>Verify all items are assigned to exactly 100% and that receipt subtotal matches item prices.</li>
            )}
          </ul>
          <div className="mt-1 italic">
            Small rounding differences are automatically tolerated.
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
