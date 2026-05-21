import * as React from "react"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

const Checkbox = React.forwardRef(({ className, onCheckedChange, ...props }, ref) => {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={props.checked}
      data-state={props.checked ? "checked" : "unchecked"}
      onClick={(e) => {
        e.stopPropagation();
        if (onCheckedChange) {
          onCheckedChange(!props.checked);
        }
      }}
      className={cn(
        "h-4 w-4 shrink-0 rounded-sm border-2 border-slate-400",
        "focus:outline-none focus:ring-0",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "data-[state=checked]:bg-slate-900 data-[state=checked]:border-slate-900",
        "flex items-center justify-center",
        className
      )}
      disabled={props.disabled}
      ref={ref}
    >
      {props.checked && <Check className="h-3 w-3 text-white" />}
    </button>
  );
})
Checkbox.displayName = "Checkbox"

export { Checkbox }