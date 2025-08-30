import { Share, Link2, Check } from "lucide-react";
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
import { generateVenmoLink, shareVenmoPayment } from "@/lib/venmo-utils";
import { generateShareableUrl, validateSerializationInput } from "@/lib/split-sharing";
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
  const [shareStatus, setShareStatus] = useState<'idle' | 'copying' | 'success' | 'error'>('idle');
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

  // Share or open Venmo link using consolidated venmo-utils
  const handleVenmoClick = async (person: Person) => {
    const note = receiptName || "Receipt Split";
    const cleanPhone = phoneNumber.replace(/\D/g, "");
    
    if (!cleanPhone) {
      alert('Please enter a phone number to generate Venmo payment links.');
      return;
    }

    try {
      await shareVenmoPayment(cleanPhone, person.finalTotal, note, person.name);
    } catch (error) {
      console.error('Venmo payment error:', error);
      // Fallback: try to generate link directly
      const link = generateVenmoLink(cleanPhone, person.finalTotal, note);
      if (link) {
        window.open(link, "_blank");
      } else {
        alert('Failed to generate Venmo payment link. Please check the phone number.');
      }
    }
  };

  // Share split functionality
  const shareSplit = async () => {
    const note = receiptName || 'Receipt Split';
    const cleanPhone = phoneNumber.replace(/\D/g, "");
    
    setShareStatus('copying');

    try {
      // Validate that we have required data to share
      if (!cleanPhone) {
        setShareStatus('error');
        alert('Phone number is required to share splits with Venmo payment functionality.');
        setTimeout(() => setShareStatus('idle'), 2000);
        return;
      }

      const validation = validateSerializationInput(people, note, cleanPhone, receiptDate);
      if (!validation.isValid) {
        setShareStatus('error');
        alert(`Cannot share split: ${validation.errorMessages.join(', ')}`);
        setTimeout(() => setShareStatus('idle'), 2000);
        return;
      }

      // Generate shareable URL
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://receipt-splitter.app';
      const shareableUrl = generateShareableUrl(
        baseUrl,
        people,
        note,
        cleanPhone,
        receiptDate
      );

      // Copy to clipboard
      await navigator.clipboard.writeText(shareableUrl);
      setShareStatus('success');
      
      setTimeout(() => setShareStatus('idle'), 3000);
    } catch (error) {
      console.error('Error sharing split:', error);
      setShareStatus('error');
      alert('Failed to copy share link. Please try again.');
      setTimeout(() => setShareStatus('idle'), 2000);
    }
  };

  // Check if split is ready to share
  const canShareSplit = people.length > 0 && people.every(person => person.finalTotal > 0) && phoneNumber.replace(/\D/g, "").length >= 10;

  if (people.length === 0) {
    return null;
  }

  return (
    <div className="w-full flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <label htmlFor="venmo-phone" className="font-medium text-sm sm:text-base">
          Your Phone Number (for Venmo):
        </label>
        <input
          id="venmo-phone"
          type="tel"
          placeholder="e.g. 555-123-4567"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ""))}
          className="w-full h-11 sm:h-9 border rounded-lg px-4 py-2 text-base sm:text-sm transition-all duration-200 focus:ring-2 focus:ring-primary/20 focus:border-primary"
        />
      </div>
      
      {/* Sharing instructions */}
      <div className="text-sm text-muted-foreground mb-4 p-4 bg-blue-50/80 dark:bg-blue-950/30 rounded-xl border border-blue-200/50 dark:border-blue-800/50 transition-all duration-200">
        <p className="font-medium text-blue-700 dark:text-blue-300 mb-2 flex items-center gap-2">
          💡 Sharing Options
        </p>
        <ul className="text-blue-600 dark:text-blue-400 space-y-2">
          <li className="flex items-start gap-2">
            <span className="font-semibold">•</span>
            <span><strong>Share Text:</strong> Copy a text summary to send manually</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-semibold">•</span>
            <span><strong>Share Split:</strong> Create a link where everyone can pay their own amount directly</span>
          </li>
          {phoneNumber && (
            <li className="flex items-start gap-2">
              <span className="font-semibold">•</span>
              <span><strong>Venmo Links:</strong> Individual payment links for each person</span>
            </li>
          )}
        </ul>
        {!canShareSplit && phoneNumber.length > 0 && phoneNumber.replace(/\D/g, "").length < 10 && (
          <p className="text-amber-600 dark:text-amber-400 text-xs mt-2">⚠️ Enter a valid phone number to enable split sharing</p>
        )}
      </div>
      
      <Card className="w-full">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <CardTitle className="text-xl sm:text-2xl">Results Summary</CardTitle>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
            <Button
              variant="outline"
              className="flex items-center justify-center gap-2 h-11 sm:h-9 text-base sm:text-sm font-medium transition-all duration-200 hover:bg-muted active:scale-95"
              onClick={shareResults}
            >
              <Share className="h-5 w-5 sm:h-4 sm:w-4" />
              <span>Share Text</span>
            </Button>
            
            <Button
              variant={shareStatus === 'success' ? 'default' : 'outline'}
              className="flex items-center justify-center gap-2 h-11 sm:h-9 text-base sm:text-sm font-medium transition-all duration-200 hover:shadow-md active:scale-95"
              onClick={shareSplit}
              disabled={!canShareSplit || shareStatus === 'copying'}
            >
              {shareStatus === 'copying' && <div className="h-5 w-5 sm:h-4 sm:w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
              {shareStatus === 'success' && <Check className="h-5 w-5 sm:h-4 sm:w-4" />}
              {shareStatus === 'idle' && <Link2 className="h-5 w-5 sm:h-4 sm:w-4" />}
              {shareStatus === 'error' && <Link2 className="h-5 w-5 sm:h-4 sm:w-4" />}
              <span>
                {shareStatus === 'copying' && 'Copying...'}
                {shareStatus === 'success' && 'Copied!'}
                {(shareStatus === 'idle' || shareStatus === 'error') && 'Share Split'}
              </span>
            </Button>
          </div>
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
