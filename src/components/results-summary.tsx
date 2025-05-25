import { Share } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { type Person } from "@/types";
import { formatCurrency } from "@/lib/receipt-utils";
import { useState } from "react";

interface ResultsSummaryProps {
  people: Person[];
  receiptName: string | null;
  receiptDate: string | null;
}

export function ResultsSummary({
  people,
  receiptName,
  receiptDate,
}: ResultsSummaryProps) {
  const [phoneNumber, setPhoneNumber] = useState("");
  // Sort people by final total (highest first)
  const sortedPeople = [...people].sort((a, b) => b.finalTotal - a.finalTotal);

  // Create a shareable text summary
  const createShareText = (): string => {
    let text = "";

    // Add receipt info
    if (receiptName) {
      text += `Receipt for ${receiptName}\n`;
    }

    if (receiptDate) {
      text += `Date: ${new Date(receiptDate).toLocaleDateString()}\n`;
    }

    text += "\nAmount owed by each person:\n";

    // Add each person's total
    sortedPeople.forEach((person) => {
      text += `${person.name}: ${formatCurrency(person.finalTotal)}\n`;
    });

    return text;
  };

  // Share results via native sharing API or fallback to clipboard
  const shareResults = async () => {
    const text = createShareText();

    if (navigator.share) {
      try {
        await navigator.share({
          title: "Receipt Split Results",
          text: text,
        });
      } catch (error) {
        console.error("Error sharing results:", error);
        copyToClipboard(text);
      }
    } else {
      copyToClipboard(text);
    }
  };

  // Fallback to clipboard
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      alert("Results copied to clipboard!");
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
      alert("Failed to copy results. Please try again.");
    }
  };

  // Helper to generate Venmo payment link
  const getVenmoLink = (amount: number, note: string) => {
    // Remove non-digits from phone number
    const phone = phoneNumber.replace(/\D/g, "");
    // Venmo expects amount in decimal, note as string
    // https://venmo.com/paymentlinks/
    // Example: https://venmo.com/?txn=pay&recipients=PHONE&amount=10.00&note=Restaurant
    return `https://venmo.com/?txn=pay&recipients=${phone}&amount=${amount.toFixed(
      2
    )}&note=${encodeURIComponent(note)}`;
  };

  // Share or open Venmo link
  const handleVenmoClick = (person: Person) => {
    const note = receiptName || "Receipt Split";
    const link = getVenmoLink(person.finalTotal, note);
    if (navigator.share) {
      navigator.share({
        title: `Pay ${person.name} via Venmo`,
        url: link,
      });
    } else {
      window.open(link, "_blank");
    }
  };

  if (people.length === 0) {
    return null;
  }

  return (
    <div className="w-full flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row items-center gap-2 mb-2">
        <label htmlFor="venmo-phone" className="font-medium">
          Your Phone Number (for Venmo):
        </label>
        <input
          id="venmo-phone"
          type="tel"
          placeholder="e.g. 555-123-4567"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          className="w-full sm:w-64 border rounded px-3 py-1"
        />
      </div>
      <Card className="w-full">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-xl">Results Summary</CardTitle>
          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-1"
            onClick={shareResults}
          >
            <Share className="h-4 w-4" />
            <span>Share</span>
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Person</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
                <TableHead className="text-right">Tax</TableHead>
                <TableHead className="text-right">Tip</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Venmo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedPeople.map((person) => (
                <TableRow key={person.id}>
                  <TableCell className="font-medium">{person.name}</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(person.totalBeforeTax)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(person.tax)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(person.tip)}
                  </TableCell>
                  <TableCell className="text-right font-bold">
                    {formatCurrency(person.finalTotal)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!phoneNumber.replace(/\D/g, "")}
                      onClick={() => handleVenmoClick(person)}
                    >
                      Venmo Link
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
