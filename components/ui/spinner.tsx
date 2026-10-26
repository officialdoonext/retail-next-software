import * as React from "react";
import { cn } from "@/lib/utils";
import { LoaderIcon } from "lucide-react";

export function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <LoaderIcon
      role="status"
      aria-label="Loading"
      className={cn("size-4 animate-spin text-[#5e2b9d]", className)}
      {...props}
    />
  );
}

export function SpinnerCustom() {
  return (
    <div className="flex items-center gap-4">
      <Spinner />
    </div>
  );
}

export default Spinner;
