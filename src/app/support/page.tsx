import type { Metadata } from "next";
import Link from "next/link";
import {
  LegalDocument,
  LegalSection,
  SupportContact,
} from "@/components/legal-document";

export const metadata: Metadata = {
  title: { absolute: "Support · Receipt Splitter" },
  description: "How to contact Receipt Splitter.",
};

export default function SupportPage() {
  return (
    <LegalDocument kicker="Receipt Splitter" title="Support">
      <LegalSection id="contact" title="Contact">
        <p>
          Questions or problems? Email <SupportContact />.
        </p>
        <p>
          What the app sends and how long it is kept is in the{" "}
          <Link className="underline underline-offset-4" href="/privacy">
            privacy policy
          </Link>
          .
        </p>
      </LegalSection>
    </LegalDocument>
  );
}
