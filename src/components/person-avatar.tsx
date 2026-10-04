import { cn } from "@/lib/utils";

interface PersonAvatarProps {
  name: string;
  className?: string;
}

/** Initial badge shared by people, totals, and payment rows. */
export function PersonAvatar({ name, className }: PersonAvatarProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-primary text-sm font-semibold",
        className
      )}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}
