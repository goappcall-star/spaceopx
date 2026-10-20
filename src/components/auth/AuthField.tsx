import { useState, type ComponentProps } from "react";
import { Eye, EyeOff, type LucideIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type AuthFieldProps = ComponentProps<typeof Input> & { label: string; icon: LucideIcon };

export function AuthField({ label, icon: Icon, type, id, className, ...props }: AuthFieldProps) {
  const [visible, setVisible] = useState(false);
  const password = type === "password";
  return (
    <div className="auth-field">
      <Label htmlFor={id} className="sr-only">
        {label}
      </Label>
      <Icon className="auth-field-icon" size={18} strokeWidth={1.6} aria-hidden="true" />
      <Input
        {...props}
        id={id}
        type={password && visible ? "text" : type}
        className={cn("auth-field-input", password && "auth-field-password", className)}
      />
      {password && (
        <button
          type="button"
          className="auth-password-toggle"
          aria-label={`${visible ? "Ocultar" : "Mostrar"} ${label.toLowerCase()}`}
          aria-pressed={visible}
          onClick={() => setVisible((value) => !value)}
        >
          {visible ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
        </button>
      )}
    </div>
  );
}
