import type { Metadata } from "next";
import Link from "next/link";
import {
  LegalDocument,
  LegalSection,
  SupportContact,
} from "@/components/legal-document";

export const metadata: Metadata = {
  title: { absolute: "Privacy Policy · Receipt Splitter" },
  description:
    "What Receipt Splitter processes, who receives it, how long it is kept, and how to ask for deletion.",
};

export const PRIVACY_EFFECTIVE_DATE = "October 31, 2026";
export const DELETION_REQUEST_WINDOW = "30 days";

export default function PrivacyPage() {
  return (
    <LegalDocument kicker="Receipt Splitter" title="Privacy Policy">
      <p>
        Effective {PRIVACY_EFFECTIVE_DATE}. This covers the website and the
        iPhone app. There are no accounts and no ads, and we do not track you
        across other companies&apos; apps or websites.
      </p>

      <LegalSection id="what-we-process" title="What we process">
        <ul className="list-disc pl-5">
          <li>
            When you ask the app to read a receipt, the image, PDF, or pasted
            link goes to our server, and from there to third-party service
            providers that read it (an AI provider and, for pasted links, a
            screenshot service). We may change providers.
          </li>
          <li>
            A copy of the receipt file may be kept with a file-storage
            provider. A daily cleanup deletes it once it is 90 days old. Anyone
            who has the file&apos;s web address can open it.
          </li>
          <li>
            The server also receives a random session id (not an account),
            whether the request came from the website or the iPhone app, and an
            approximate location from your photo&apos;s location metadata when
            the photo includes it (rounded to about 1 km), otherwise from your IP
            address. Our hosting provider sees your IP address. The website uses
            basic analytics; the iPhone app does not.
          </li>
          <li>
            We may send the site owner a notification with what was read from the
            receipt, including that approximate location when available. It is not
            sent to the people in your split.
          </li>
          <li>
            A share link holds the split (names, amounts, a note, the date, and
            a Venmo phone number if you add one) inside the link. Anyone with
            the link can read it.
          </li>
          <li>
            Optional tips in the iPhone app go through Apple. We do not receive
            your card details.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="on-device" title="On your device">
        <p>
          Your current split stays on your device. New Split clears it.
          Deleting the app, or clearing the website&apos;s stored data, removes
          everything else we store there, including the session id.
        </p>
      </LegalSection>

      <LegalSection id="choices" title="Your choices and deletion">
        <p>
          The app asks before it sends a receipt. If you decline, nothing is
          sent. To have receipt copies we still hold deleted, email{" "}
          <SupportContact />; we will act within {DELETION_REQUEST_WINDOW}. A
          share link that was already sent cannot be pulled back. For anything
          else, see the{" "}
          <Link className="underline underline-offset-4" href="/support">
            support page
          </Link>
          .
        </p>
      </LegalSection>
    </LegalDocument>
  );
}
