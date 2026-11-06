import * as React from "react";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "secondary" | "outline" | "success" | "warning" | "destructive";
}

/**
 * Human-crafted Badge Primitive
 * Clean, subtle, high contrast typography without noisy AI glows.
 */
export function Badge({
  className = "",
  variant = "default",
  children,
  ...props
}: BadgeProps) {
  const baseStyles =
    "inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold rounded-full select-none transition-colors";

  const variantStyles: Record<NonNullable<BadgeProps["variant"]>, string> = {
    default: "bg-primary-soft text-primary border border-primary/20",
    secondary: "bg-surface-low text-muted border border-outline/30",
    outline: "bg-transparent text-foreground border border-outline/60",
    success: "bg-green-soft text-green border border-green/20",
    warning: "bg-gold-soft text-gold border border-gold/20",
    destructive: "bg-error-soft text-error border border-error/20",
  };

  const combinedClassName = [baseStyles, variantStyles[variant], className]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={combinedClassName} {...props}>
      {children}
    </span>
  );
}

