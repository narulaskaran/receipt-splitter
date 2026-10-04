import { TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface StepTriggerProps {
  value: string;
  step: number;
  label: string;
  complete?: boolean;
  disabled?: boolean;
}

/** Keep step numbers visible; expose completion separately to assistive technology. */
export function StepTrigger({
  value,
  step,
  label,
  complete = false,
  disabled = false,
}: StepTriggerProps) {
  return (
    <TabsTrigger
      value={value}
      disabled={disabled}
      aria-description={complete ? "Complete" : undefined}
      className="group min-h-[64px] flex-col gap-1.5 rounded-lg px-1 py-2 text-xs text-muted-foreground disabled:opacity-70 data-[state=active]:bg-card data-[state=active]:text-primary sm:min-h-[56px] sm:flex-row sm:gap-2 sm:text-sm dark:data-[state=active]:bg-card"
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold tabular-nums transition-colors",
          "group-data-[state=active]:border-primary group-data-[state=active]:bg-primary group-data-[state=active]:text-primary-foreground",
          complete && "border-primary/30 bg-primary/10 text-primary"
        )}
      >
        {step}
      </span>
      {label}
    </TabsTrigger>
  );
}

interface StepHeaderProps {
  title: string;
  description?: string;
}

export function StepHeader({ title, description }: StepHeaderProps) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        {title}
      </h2>
      {description && (
        <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">{description}</p>
      )}
    </div>
  );
}
