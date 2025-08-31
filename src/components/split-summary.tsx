import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Receipt, DollarSign } from "lucide-react";
import { type SharedSplitData } from "@/lib/split-sharing";
import { formatCurrency } from "@/lib/receipt-utils";
import { generateVenmoLink } from "@/lib/venmo-utils";
import Image from "next/image";

interface SplitSummaryProps {
  splitData: SharedSplitData;
  phoneNumber?: string;
}

export function SplitSummary({ splitData, phoneNumber }: SplitSummaryProps) {
  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      // Check if the date is valid
      if (isNaN(date.getTime())) {
        return dateString; // Fallback to original string if invalid
      }
      return date.toLocaleDateString("en-US", {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateString; // Fallback to original string if parsing fails
    }
  };

  return (
    <Card className="w-full transition-all duration-300 hover:shadow-lg">
      <CardHeader>
        <CardTitle className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 text-xl sm:text-2xl text-center sm:text-left">
          <div className="flex items-center justify-start gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Receipt className="h-6 w-6 text-primary" />
            </div>
            <span>Split from </span>
          </div>
          <span className="px-3 py-1 bg-primary/10 rounded-lg border border-primary/20 text-primary font-medium">
            {splitData.note}
          </span>
          {splitData.date && (
            <>
              <span className="text-muted-foreground">on</span>
              <span className="px-3 py-1 bg-primary/10 rounded-lg border border-primary/20 text-primary font-medium">
                {formatDate(splitData.date)}
              </span>
            </>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex justify-center">
          <div className="w-full max-w-sm sm:max-w-md md:w-auto md:max-w-none">
            <div className="flex md:inline-flex w-full md:w-auto flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 px-6 py-5 bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl border border-primary/20 shadow-inner transition-all duration-200 hover:border-primary/30">
              <div className="h-9 w-9 rounded-full bg-primary/15 ring-1 ring-primary/20 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-primary" />
              </div>
              <div className="text-center">
                <p className="text-xs tracking-wide uppercase text-muted-foreground">
                  Total Bill
                </p>
                <p className="font-extrabold text-2xl sm:text-3xl text-primary mt-1">
                  {formatCurrency(splitData.total)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Individual Breakdown */}
        <div className="space-y-4">
          <div className="space-y-3">
            {splitData.names.map((name, index) => (
              <div
                key={`${name}-${index}`}
                className="flex justify-between items-center py-4 px-4 bg-gradient-to-r from-muted/40 to-muted/20 rounded-xl"
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-sm font-semibold text-primary">
                      {name[0]}
                    </span>
                  </div>
                  <span className="font-semibold text-base">{name}</span>
                </div>
                <div className="flex items-center gap-3">
                  {phoneNumber && (
                    <Button
                      onClick={() => {
                        const note = `${splitData.note} - ${name}`;
                        const venmoLink = generateVenmoLink(
                          phoneNumber,
                          splitData.amounts[index],
                          note
                        );
                        if (venmoLink) {
                          window.open(
                            venmoLink,
                            "_blank",
                            "noopener,noreferrer"
                          );
                        }
                      }}
                      size="sm"
                      className="h-8 px-3 text-xs font-medium transition-all duration-200 hover:shadow-md active:scale-95"
                    >
                      <Image
                        src="/venmo.png"
                        alt="Venmo"
                        width={12}
                        height={12}
                        className="mr-1"
                      />
                      {formatCurrency(splitData.amounts[index])}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
