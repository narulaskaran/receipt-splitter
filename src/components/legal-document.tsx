import type { ReactNode } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import {
  SUPPORT_EMAIL,
  isSupportEmailAddress,
} from "@/lib/support-email";

export function LegalDocument({
  kicker,
  title,
  children,
}: {
  kicker: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-background px-4 py-10 text-foreground">
      <article className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <Card>
          <CardHeader className="gap-2">
            <p className="text-sm text-muted-foreground">{kicker}</p>
            <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
          </CardHeader>
          <CardContent className="flex flex-col gap-8 text-sm leading-6">
            {children}
          </CardContent>
        </Card>
        <p>
          <Link className="underline underline-offset-4" href="/">
            Back to Receipt Splitter
          </Link>
        </p>
      </article>
    </main>
  );
}

export function LegalSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <h2 id={id} className="text-lg font-semibold">
        {title}
      </h2>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}

export function SupportContact() {
  if (isSupportEmailAddress(SUPPORT_EMAIL)) {
    return (
      <a className="underline underline-offset-4" href={`mailto:${SUPPORT_EMAIL}`}>
        {SUPPORT_EMAIL}
      </a>
    );
  }
  return <span>{SUPPORT_EMAIL}</span>;
}
