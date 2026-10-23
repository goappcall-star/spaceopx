import { useRef, useState, type FormEvent } from "react";
import { Eye, EyeOff, LockKeyhole, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  passwordChangeError,
  validatePasswordChange,
  type PasswordChange,
} from "@/lib/account-password";
import "./account-settings.css";
const empty = { current: "", next: "", confirm: "" };
export function AccountPasswordEditor({
  enabled = true,
  onSubmit,
}: {
  enabled?: boolean;
  onSubmit: (value: PasswordChange) => Promise<void>;
}) {
  const [open, setOpen] = useState(false),
    [values, setValues] = useState(empty),
    [visible, setVisible] = useState({ current: false, next: false, confirm: false });
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  const submitting = useRef(false);
  function close(next: boolean) {
    if (submitting.current) return;
    setOpen(next);
    setValues(empty);
    setVisible({ current: false, next: false, confirm: false });
    setError("");
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting.current) return;
    try {
      validatePasswordChange(values);
    } catch (error) {
      setError((error as Error).message);
      return;
    }
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      await onSubmit(values);
      setValues(empty);
      setVisible({ current: false, next: false, confirm: false });
      setOpen(false);
      setSuccess("Senha alterada com sucesso.");
    } catch (error) {
      setError(passwordChangeError(error));
      setValues((v) => ({ ...v, current: "" }));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="account-section account-password-section">
      <div className="account-password-row">
        <span className="account-heading-icon">
          <LockKeyhole size={21} />
        </span>
        <div>
          <h2>Senha</h2>
          <p>
            {enabled
              ? "Atualize sua senha de acesso ao LobbyX."
              : "A senha desta conta é gerenciada pelo seu provedor de login."}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={!enabled}
          onClick={() => {
            setSuccess("");
            close(true);
          }}
        >
          <Pencil size={15} />
          Editar
        </Button>
      </div>
      {success && (
        <p role="status" className="account-password-success">
          {success}
        </p>
      )}
      <Dialog open={open} onOpenChange={close}>
        <DialogContent
          className="account-password-dialog"
          onEscapeKeyDown={(e) => {
            if (busy) e.preventDefault();
          }}
          onPointerDownOutside={(e) => {
            if (busy) e.preventDefault();
          }}
        >
          <DialogHeader>
            <DialogTitle>Atualize sua senha</DialogTitle>
            <DialogDescription>Informe sua senha atual e escolha uma nova senha.</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void submit(e)} className="account-password-form">
            {(
              [
                { key: "current", label: "Senha atual", auto: "current-password" },
                { key: "next", label: "Nova senha", auto: "new-password" },
                { key: "confirm", label: "Confirmar nova senha", auto: "new-password" },
              ] as const
            ).map((field) => (
              <div key={field.key}>
                <Label htmlFor={"account-password-" + field.key}>
                  {field.label} <span aria-hidden="true">*</span>
                </Label>
                <div className="account-password-input">
                  <Input
                    id={"account-password-" + field.key}
                    type={visible[field.key] ? "text" : "password"}
                    autoComplete={field.auto}
                    required
                    minLength={field.key === "current" ? 1 : 8}
                    maxLength={128}
                    value={values[field.key]}
                    disabled={busy}
                    onChange={(e) => {
                      setValues((v) => ({ ...v, [field.key]: e.target.value }));
                      setError("");
                    }}
                  />
                  <button
                    type="button"
                    aria-label={
                      (visible[field.key] ? "Ocultar " : "Mostrar ") + field.label.toLowerCase()
                    }
                    aria-pressed={visible[field.key]}
                    disabled={busy}
                    onClick={() => setVisible((v) => ({ ...v, [field.key]: !v[field.key] }))}
                  >
                    {visible[field.key] ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>
            ))}
            <p className="account-password-help">Use entre 8 e 128 caracteres para a nova senha.</p>
            {error && (
              <p role="alert" className="account-password-error">
                {error}
              </p>
            )}
            <div className="account-password-actions">
              <Button type="button" variant="outline" disabled={busy} onClick={() => close(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "Salvando…" : "Salvar senha"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
