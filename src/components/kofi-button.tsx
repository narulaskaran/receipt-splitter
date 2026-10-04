import React from "react";
import { Coffee } from "lucide-react";

interface KofiButtonProps {
  className?: string;
}

export const KofiButton: React.FC<KofiButtonProps> = ({ className }) => {
  return (
    <div className={className}>
      <a
        href="https://ko-fi.com/Y8Y21CC8IA"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Coffee className="size-4" aria-hidden="true" />
        Enjoying it? Buy me a coffee
      </a>
    </div>
  );
};
