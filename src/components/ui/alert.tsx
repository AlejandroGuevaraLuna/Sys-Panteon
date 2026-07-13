import * as React from "react";
import { cn } from "@/lib/utils";
import { AlertCircle, CheckCircle2, Info, AlertTriangle } from "lucide-react";

interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "destructive" | "success" | "warning" | "info";
}

export function Alert({ className, variant = "default", children, ...props }: AlertProps) {
  const styles = {
    default: "bg-background text-foreground border-border",
    destructive: "border-destructive/50 bg-destructive/10 text-destructive [&>svg]:text-destructive",
    success: "border-emerald-500/50 bg-emerald-50 text-emerald-800 [&>svg]:text-emerald-600 dark:bg-emerald-950 dark:text-emerald-200",
    warning: "border-amber-500/50 bg-amber-50 text-amber-800 [&>svg]:text-amber-600 dark:bg-amber-950 dark:text-amber-200",
    info: "border-blue-500/50 bg-blue-50 text-blue-800 [&>svg]:text-blue-600 dark:bg-blue-950 dark:text-blue-200",
  };
  return (
    <div role="alert" className={cn("relative w-full rounded-lg border p-4 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4", styles[variant], className)} {...props}>
      {variant === "destructive" && <AlertCircle className="h-4 w-4" />}
      {variant === "success" && <CheckCircle2 className="h-4 w-4" />}
      {variant === "warning" && <AlertTriangle className="h-4 w-4" />}
      {variant === "info" && <Info className="h-4 w-4" />}
      {children}
    </div>
  );
}
export function AlertTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h5 className={cn("mb-1 font-medium leading-none tracking-tight", className)} {...props} />;
}
export function AlertDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <div className={cn("text-sm [&_p]:leading-relaxed", className)} {...props} />;
}