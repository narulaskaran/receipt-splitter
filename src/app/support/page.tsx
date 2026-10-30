import type { Metadata } from "next";
import Link from "next/link";
import {
  LegalDocument,
  LegalSection,
  SupportContact,
} from "@/components/legal-document";

export const metadata: Metadata = {
  title: { absolute: "Support · Receipt Splitter" },
  description:
    "How to capture a receipt, split it, share it, and what to try when the camera or the server does not cooperate.",
};

export default function SupportPage() {
  return (
    <LegalDocument kicker="Receipt Splitter" title="Support">
      <LegalSection id="how-to" title="Capture, split, and share">
        <ol className="list-decimal pl-5">
          <li>
            Capture a receipt with the camera or your photo library, import a
            PDF, or paste a public receipt link.
          </li>
          <li>
            Check the items, tax, and tip. Add the people who shared the meal,
            then assign each item.
          </li>
          <li>
            Share a link. Each person opens it and sees what they owe. You can
            include a US Venmo phone number on a US-dollar split, or share
            without one. Amounts in other currencies are shown as text. Venmo
            is optional.
          </li>
        </ol>
      </LegalSection>

      <LegalSection id="offline" title="Offline editing">
        <p>
          After a receipt has been read, the split stays on the device. You can
          change people, assignments, tax, and tip without a connection, then
          share when you are back online. Reading a new photo, PDF, or pasted
          link needs the server. The app cannot parse a receipt on the device.
        </p>
      </LegalSection>

      <LegalSection id="tips" title="Tips on iPhone">
        <p>
          Tips in the iPhone app are optional StoreKit purchases. They do not
          unlock features, and splitting stays free. The website uses Ko-fi
          instead of StoreKit. Apple handles the payment.
        </p>
      </LegalSection>

      <LegalSection id="troubleshooting" title="Troubleshooting">
        <h3 className="font-semibold">Camera or photos permission</h3>
        <p>
          iOS asks the first time you take a photo or choose one. If you deny
          or cancel, that path stops. You can allow it later in Settings, under
          Receipt Splitter. A PDF import or a pasted link does not use the
          camera or photo library.
        </p>
        <h3 className="font-semibold">Can&apos;t reach the server</h3>
        <p>
          Parsing needs a network connection to the Receipt Splitter API. If
          the request fails, check that the phone is online and try again. A
          split that is already on the device can still be edited offline.
        </p>
        <h3 className="font-semibold">A receipt link failed</h3>
        <p>
          The link has to be a public page. A page that needs a login, a very
          tall page, or a temporary problem with the screenshot service will
          fail. Upload a screenshot of the receipt instead.
        </p>
      </LegalSection>

      <LegalSection id="contact" title="Contact">
        <p>
          Email <SupportContact />. For what the app sends and how long it is
          kept, read the{" "}
          <Link className="underline underline-offset-4" href="/privacy">
            privacy policy
          </Link>
          .
        </p>
      </LegalSection>
    </LegalDocument>
  );
}
