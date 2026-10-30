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

export const PRIVACY_EFFECTIVE_DATE = "October 30, 2026";
export const DELETION_REQUEST_WINDOW = "30 days";

export default function PrivacyPage() {
  return (
    <LegalDocument kicker="Receipt Splitter" title="Privacy Policy">
      <p>
        Effective {PRIVACY_EFFECTIVE_DATE}. Receipt Splitter has no accounts.
        This page covers the website and the iPhone app.
      </p>

      <LegalSection id="what-we-process" title="What we process">
        <p>When you ask the app to read a receipt, the server receives:</p>
        <ul className="list-disc pl-5">
          <li>The receipt image or PDF you choose, or a link you paste.</li>
          <li>
            A random session id sent with that request, so an operator
            notification can be matched to the attempt.
          </li>
          <li>
            Approximate location derived from the IP address of the request,
            using Vercel&apos;s request headers (city, region, country, and
            coordinates). This is not GPS. The iPhone app does not ask for
            location permission, and editing a split offline does not send a
            location.
          </li>
        </ul>
        <p>
          A share link puts the split in the URL query string: names, amounts,
          a note, and, if you add one, a US phone number for Venmo. Anyone with
          the link can read that. So can services that preview or forward links,
          such as chat apps, email scanners, and Slack.
        </p>
      </LegalSection>

      <LegalSection id="processors" title="Who processes it">
        <ul className="list-disc pl-5">
          <li>
            Anthropic reads the receipt by default. If the operator configures
            OpenAI or OpenRouter instead, that provider reads it. OpenRouter
            forwards the image to the upstream model it routes to.
          </li>
          <li>
            Firecrawl takes a screenshot of a pasted receipt link. The link is
            sent to our server and to Firecrawl. Pages that require a login do
            not work.
          </li>
          <li>
            UploadThing stores a copy of the receipt file when file storage is
            configured, so an operator notification can include it.
          </li>
          <li>
            Vercel hosts the website and the API. Vercel Web Analytics and Speed
            Insights run on the website. They are not part of the iPhone app
            bundle.
          </li>
          <li>
            Slack or another webhook receives operator notifications when the
            operator turns that on. A notification can include the receipt
            contents, the file link, the session id, and the approximate
            location.
          </li>
          <li>
            Apple processes optional tips in the iPhone app through StoreKit.
            Apple handles the payment. We do not receive your card number or
            billing address. A tip does not unlock features.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="retention" title="How long we keep it">
        <p>
          Receipt copies in file storage are deleted after 90 days by a daily
          cleanup job. Operator notification messages stay in the recipient
          workspace (for example Slack) and follow that workspace&apos;s own
          retention. We do not control that clock.
        </p>
        <p>
          The current split, people, assignments, and receipt thumbnails stay
          on the device. On the website they are in the browser&apos;s local
          storage. The iPhone app keeps its own copy and does not import data
          from Safari. &quot;Clear local data&quot; means New Split, which
          drops the on-device split, or deleting the app. We cannot clear that
          copy from our servers because we do not have it.
        </p>
      </LegalSection>

      <LegalSection id="tracking" title="Accounts, ads, and tracking">
        <p>
          There are no accounts and no ads. We do not track you across other
          companies&apos; apps or websites, and the iPhone app does not show an
          App Tracking Transparency prompt.
        </p>
      </LegalSection>

      <LegalSection id="choices" title="Your choices">
        <p>
          The app asks before it sends a receipt to be read. If you decline,
          that image, PDF, or link is not sent to our server or to an AI
          provider.
        </p>
        <p>
          Parsing needs the server. The app cannot turn a photo into items and
          prices on the device. You can still edit people, assignments, tax, and
          tip for a split that is already on the device, including while
          offline, and you can share that split. You can share without a Venmo
          phone number. Tips are optional.
        </p>
      </LegalSection>

      <LegalSection id="deletion" title="Deletion requests">
        <p>
          Email <SupportContact /> and we will delete receipt copies we still
          hold within {DELETION_REQUEST_WINDOW}. We will also ask the operator
          to delete notification messages that include the receipt. A share link
          that was already sent cannot be pulled back, because the names,
          amounts, note, and any phone number are inside the link itself. Clear
          the on-device copy with New Split or by deleting the app.
        </p>
      </LegalSection>

      <LegalSection id="contact" title="Contact">
        <p>
          Questions about this policy: <SupportContact />. Practical help is on
          the{" "}
          <Link className="underline underline-offset-4" href="/support">
            support page
          </Link>
          .
        </p>
        <p>
          If the companies that receive receipt data change, the iPhone app asks
          for permission again before sending another receipt.
        </p>
      </LegalSection>
    </LegalDocument>
  );
}
