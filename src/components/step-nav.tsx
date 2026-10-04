import { Check } from "lucide-react";
import { TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface StepTriggerProps {
  value: string;
  step: number;
  label: string;
  complete?: boolean;
  disabled?: boolean;
}

/** Numbered step in the top stepper; shows a check once the step is done. */
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
      className="group min-h-[52px] flex-col gap-1 rounded-lg px-1 py-1.5 text-xs text-muted-foreground data-[state=active]:bg-card data-[state=active]:text-foreground sm:min-h-[44px] sm:flex-row sm:gap-2 sm:text-sm dark:data-[state=active]:bg-card"
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold tabular-nums transition-colors",
          "group-data-[state=active]:border-primary group-data-[state=active]:bg-primary group-data-[state=active]:text-primary-foreground",
          complete && "border-primary/30 bg-primary/10 text-primary"
        )}
      >
        {complete ? <Check className="size-3" strokeWidth={3} /> : step}
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
    <div className="flex flex-col gap-1">
      <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
        {title}
      </h2>
      {description && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}
    </div>
  );
}
