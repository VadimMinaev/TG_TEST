"use client";

import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";

import { cn } from "./utils";

function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer inline-flex h-10 w-[4.5rem] shrink-0 items-center rounded-full border border-transparent bg-[#273d63] p-1 transition-all outline-none data-[state=checked]:bg-[#2f6ce5] focus-visible:ring-4 focus-visible:ring-[#2f6ce5]/35 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block size-8 rounded-full bg-white shadow-sm ring-0 transition-transform data-[state=checked]:translate-x-8 data-[state=unchecked]:translate-x-0",
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
