import * as React from "react";
import { Loader2 } from "lucide-react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "secondary" | "outline" | "ghost" | "destructive" | "success";
  size?: "sm" | "md" | "lg" | "icon";
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

/**
 * Human-crafted Button Primitive complying with the 8-state interactive discipline:
 * 1. Default (Idle)
 * 2. Hover (light elevation & color shift)
 * 3. Focus-visible (high contrast 2px ring)
 * 4. Active (physical scale 0.98 tactile press)
 * 5. Disabled (opacity 0.5, cursor not-allowed)
 * 6. Loading (retains layout width, shows spinner)
 * 7. Error (styled via variant)
 * 8. Success (styled via variant)
 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className = "",
      variant = "default",
      size = "md",
      isLoading = false,
      leftIcon,
      rightIcon,
      disabled,
      children,
      ...props
    },
    ref,
  ) => {
    const baseStyles =
      "inline-flex items-center justify-center font-semibold transition-all duration-150 select-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2";

    const variantStyles: Record<NonNullable<ButtonProps["variant"]>, string> = {
      default: "bg-primary text-white hover:opacity-95 shadow-sm focus-visible:ring-primary",
      secondary: "bg-surface-low text-foreground hover:bg-surface-high border border-outline/30 focus-visible:ring-outline",
      outline: "border border-outline/60 bg-transparent text-foreground hover:bg-surface-low focus-visible:ring-primary",
      ghost: "bg-transparent text-foreground hover:bg-surface-low focus-visible:ring-outline",
      destructive: "bg-error text-white hover:opacity-95 focus-visible:ring-error",
      success: "bg-green text-white hover:opacity-95 focus-visible:ring-green",
    };

    const sizeStyles: Record<NonNullable<ButtonProps["size"]>, string> = {
      sm: "h-8 px-3 text-xs rounded-lg gap-1.5",
      md: "h-10 px-4 text-sm rounded-xl gap-2",
      lg: "h-12 px-6 text-base rounded-xl gap-2.5",
      icon: "h-10 w-10 p-0 rounded-xl",
    };

    const combinedClassName = [
      baseStyles,
      variantStyles[variant],
      sizeStyles[size],
      className,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        aria-busy={isLoading}
        className={combinedClassName}
        {...props}
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden="true" />
            <span className="sr-only">Đang xử lý…</span>
          </>
        ) : (
          leftIcon
        )}
        {children}
        {!isLoading && rightIcon}
      </button>
    );
  },
);

Button.displayName = "Button";
