import { cn } from "@/lib/utils";

interface PersonAvatarProps {
  name: string;
  className?: string;
}

/** Neutral initial badge, matching the shared /split page rows. */
export function PersonAvatar({ name, className }: PersonAvatarProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium",
        className
      )}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}
