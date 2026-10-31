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
        Effective {PRIVACY_EFFECTIVE_DATE}. Receipt Splitter has no accounts.
        This page covers the website and the iPhone app.
      </p>

      <LegalSection id="what-we-process" title="What we process">
        <p>When you ask the app to read a receipt, the server receives:</p>
        <ul className="list-disc pl-5">
          <li>The receipt image or PDF you choose, or a link you paste.</li>
          <li>
            A session id. The first time you send a receipt, the device creates
            a random id and stores it. Later attempts from that same install
            send the same id, so operator notifications from that install can
            be matched. It is not an account and not an advertising identifier.
            New Split does not erase it. Deleting the iPhone app, or clearing
            the website&apos;s stored data, does.
          </li>
          <li>
            Which client sent the request (the website or the iPhone app) and,
            for the iPhone app, the app version.
          </li>
          <li>
            Approximate location derived from the IP address of the request,
            using Vercel&apos;s request headers (city, region, country, and
            coordinates). This is not GPS. The iPhone app does not ask for
            location permission, and editing a split offline does not send a
            location. Vercel, which hosts the API, sees the IP address, and
            its firewall uses that address to rate-limit parse requests. The
            raw IP is not copied into operator notifications.
          </li>
        </ul>
        <p>
          A share link puts the split in the URL query string: people&apos;s
          names, what each person owes, the total, the currency, a note (the
          receipt name, or &quot;Receipt Split&quot; if it has none), the
          receipt date when there is one, and, if you add one, a US phone
          number for Venmo. When the split covers more than one receipt, the
          link can also include each receipt&apos;s label and the per-person
          amounts. It does not include which items were assigned. Anyone with
          the link can read that, including chat apps, email scanners, and
          Slack when they preview a link. Opening the link sends the same
          query string to the website host, which may keep it in request logs.
        </p>
      </LegalSection>

      <LegalSection id="processors" title="Who processes it">
        <ul className="list-disc pl-5">
          <li>
            Anthropic reads the receipt by default (the image, or a screenshot
            of a pasted link). If the operator configures OpenAI or OpenRouter
            instead, that provider reads it. OpenRouter forwards the image to
            the upstream model it routes to.
          </li>
          <li>
            Firecrawl takes a screenshot of a pasted receipt link. The link is
            sent to our server and to Firecrawl. Firecrawl fetches the page;
            our server does not open it. We download the screenshot and send
            that image to the AI provider. Pages that require a login do not
            work. The pasted address can also be included in an operator
            notification.
          </li>
          <li>
            UploadThing stores a copy of the receipt file when file storage is
            configured. The stored file has a public web address: anyone who
            has that address can open the file. The address is included in the
            operator notification. It is not shown to the other people in your
            split. If storage is not configured, parsing still runs and no
            server copy of the file is kept.
          </li>
          <li>
            Vercel hosts the website and the API. Vercel Web Analytics and Speed
            Insights run on the website. They are not part of the iPhone app
            bundle.
          </li>
          <li>
            Slack or another webhook receives operator notifications only when
            the operator turns that on. A successful read can include the
            merchant, date, line items (name, price, and quantity), subtotal,
            tax, fees when the receipt has them, tip, total, the file name and
            type, the file address, the session id, the AI provider and model,
            the pasted link when you used one, the client type and version, and
            the approximate location. A JSON notification includes the
            coordinates. A Slack notification shows city, region, and country.
            If reading fails, the notification does not include the parsed line
            items. It can still include the file address (the image or PDF),
            the pasted link, the session id, the location, the model that was
            tried, the file name, the client type and version, and a short
            error description. These notifications go to the operator. They are
            not sent to the other people in your split.
          </li>
          <li>
            Apple processes optional tips in the iPhone app through StoreKit.
            Apple handles the payment. We do not receive your card number or
            billing address. A tip does not unlock features. The iPhone app
            does not show a Ko-fi link or any other outside payment link.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="retention" title="How long we keep it">
        <p>
          Receipt copies in file storage are deleted by a daily cleanup job
          once they are older than 90 days. One run pages through storage and
          can stop early if it runs long or hits its page limit. Files that run
          did not reach stay until a later run reaches them, so a very large
          bucket may not finish on day 90. Operator notification messages stay
          in the recipient workspace (for example Slack) and follow that
          workspace&apos;s own retention. The cleanup job does not delete them.
        </p>
        <p>
          The current split, people, assignments, and receipt thumbnails stay
          on the device. On the website they are in the browser&apos;s local
          storage. The iPhone app also copies that split data into the
          app&apos;s own storage, and it does not import data from Safari. New
          Split removes the current split and the receipt thumbnails. It does
          not remove the session id or the record that you agreed to send a
          receipt. Deleting the app, or clearing the website&apos;s stored
          data, removes those as well. We cannot clear the on-device copy from
          our servers because we do not have it.
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
          offline, and you can share that split without a connection. The
          person you send the link to needs a connection to open it. You can
          share without a Venmo phone number. Tips are optional.
        </p>
      </LegalSection>

      <LegalSection id="deletion" title="Deletion requests">
        <p>
          Email <SupportContact /> and we will delete receipt copies we still
          hold within {DELETION_REQUEST_WINDOW}. We will also ask the operator
          to delete notification messages that include the receipt. A share link
          that was already sent cannot be pulled back, because the names,
          amounts, note, date, currency, and any phone number are inside the
          link itself. Remove the on-device split with New Split. Delete the
          app, or clear the website&apos;s stored data, to also remove the
          session id and the consent record.
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
