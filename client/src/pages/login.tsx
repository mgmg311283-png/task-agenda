import { useState, FormEvent } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      await login(username.trim(), pin);
    } catch (err: any) {
      setError(err?.message || "No se pudo iniciar sesión");
      setPin("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-6"
        data-testid="form-login"
      >
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">AGENDA</h1>
          <p className="text-sm text-muted-foreground">Ingresá con tu usuario y PIN</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="username">Usuario</Label>
          <Input
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="username"
            className="h-12 text-base"
            data-testid="input-username"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="pin">PIN</Label>
          <Input
            id="pin"
            type="password"
            // inputMode numeric: abre el teclado numerico en el celular
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            autoComplete="current-password"
            className="h-12 text-base tracking-[0.4em]"
            data-testid="input-pin"
            required
          />
        </div>

        {error && (
          <p
            className="text-sm text-destructive text-center"
            role="alert"
            data-testid="text-login-error"
          >
            {error}
          </p>
        )}

        <Button
          type="submit"
          className="w-full h-12 text-base"
          disabled={busy || !username || pin.length < 4}
          data-testid="button-login"
        >
          {busy ? "Entrando..." : "Entrar"}
        </Button>
      </form>
    </div>
  );
}
