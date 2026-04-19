"use client"

import * as React from "react"
import { Progress as RadixProgress } from "@radix-ui/react-progress"
import { cn } from "@/lib/utils"

const Progress = React.forwardRef<
  React.ElementRef<typeof RadixProgress>,
  React.ComponentPropsWithoutRef<typeof RadixProgress>
>(({ className, value, ...props }, ref) => (
  <RadixProgress
    ref={ref}
    value={value}
    className={cn(
      "relative h-4 w-full overflow-hidden rounded-full bg-secondary",
      className
    )}
    {...props}
  >
    <div
      className="h-full bg-primary transition-all"
      style={{ width: `${value ?? 0}%` }}
    />
  </RadixProgress>
))

Progress.displayName = "Progress"

export { Progress }
