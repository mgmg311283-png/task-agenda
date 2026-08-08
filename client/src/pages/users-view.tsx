import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, KeyRound, UserPlus } from "lucide-react";

interface AppUser {
  id: number;
  username: string;
  displayName: string;
  role: "admin" | "supervisor" | "operario";
  supervisorId: number | null;
  active: boolean;
  lastLoginAt: string | null;
  lockedUntil: string | null;
}

const ROLE_LABEL: Record<string, string> = {
  admin: "Administrador",
  supervisor: "Supervisor",
  operario: "Operario",
};

export function UsersView() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: users = [], isLoading, error } = useQuery<AppUser[]>({
    queryKey: ["/api/users"],
    retry: false,
  });

  // Ruta protegida en el servidor (403 para quien no sea admin); esto solo
  // evita mostrar una pantalla en blanco si alguien la abre por URL directa.
  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 px-4">
        <p className="text-sm text-muted-foreground">No tenés permiso para ver esta página.</p>
        <Link href="/">
          <Button variant="outline" size="sm" className="gap-1">
            <ArrowLeft className="w-4 h-4" /> Volver
          </Button>
        </Link>
      </div>
    );
  }

  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({
    username: "", displayName: "", pin: "", role: "operario", supervisorId: "",
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["/api/users"] });

  const createUser = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/users", {
        username: form.username,
        displayName: form.displayName,
        pin: form.pin,
        role: form.role,
        supervisorId: form.supervisorId ? Number(form.supervisorId) : null,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Usuario creado" });
      setForm({ username: "", displayName: "", pin: "", role: "operario", supervisorId: "" });
      setShowNew(false);
      invalidate();
    },
    onError: (e: any) =>
      toast({ title: "No se pudo crear", description: String(e.message || e), variant: "destructive" }),
  });

  const patchUser = useMutation({
    mutationFn: async ({ id, body }: { id: number; body: any }) => {
      const res = await apiRequest("PATCH", `/api/users/${id}`, body);
      return res.json();
    },
    onSuccess: () => { toast({ title: "Actualizado" }); invalidate(); },
    onError: (e: any) =>
      toast({ title: "No se pudo actualizar", description: String(e.message || e), variant: "destructive" }),
  });

  const supervisors = users.filter((u) => u.role === "supervisor" || u.role === "admin");

  const resetPin = (u: AppUser) => {
    const pin = window.prompt(`Nuevo PIN para ${u.displayName} (4 a 6 dígitos):`);
    if (!pin) return;
    if (!/^\d{4,6}$/.test(pin)) {
      toast({ title: "PIN inválido", description: "Deben ser 4 a 6 dígitos", variant: "destructive" });
      return;
    }
    patchUser.mutate({ id: u.id, body: { pin } });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-4 py-3 flex items-center gap-3">
        <Link href="/">
          <Button variant="ghost" size="sm" className="gap-1" data-testid="link-back">
            <ArrowLeft className="w-4 h-4" /> Volver
          </Button>
        </Link>
        <h1 className="font-bold text-sm tracking-wider">USUARIOS</h1>
        <Button
          size="sm"
          className="ml-auto gap-1"
          onClick={() => setShowNew((v) => !v)}
          data-testid="button-toggle-new-user"
        >
          <UserPlus className="w-4 h-4" /> Nuevo
        </Button>
      </header>

      <main className="p-4 space-y-4 max-w-3xl">
        {showNew && (
          <div className="border border-border rounded-md p-4 space-y-3" data-testid="form-new-user">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="u-user">Usuario (para entrar)</Label>
                <Input
                  id="u-user"
                  value={form.username}
                  placeholder="marcos"
                  autoCapitalize="none"
                  onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase() })}
                  data-testid="input-new-username"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="u-name">Nombre</Label>
                <Input
                  id="u-name"
                  value={form.displayName}
                  placeholder="Marcos"
                  onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                  data-testid="input-new-displayname"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="u-pin">PIN inicial</Label>
                <Input
                  id="u-pin"
                  inputMode="numeric"
                  maxLength={6}
                  value={form.pin}
                  placeholder="1234"
                  onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, "") })}
                  data-testid="input-new-pin"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="u-role">Rol</Label>
                <select
                  id="u-role"
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  data-testid="select-new-role"
                >
                  <option value="operario">Operario</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
              {form.role === "operario" && supervisors.length > 0 && (
                <div className="space-y-1 sm:col-span-2">
                  <Label htmlFor="u-sup">Supervisor a cargo (opcional)</Label>
                  <select
                    id="u-sup"
                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                    value={form.supervisorId}
                    onChange={(e) => setForm({ ...form, supervisorId: e.target.value })}
                    data-testid="select-new-supervisor"
                  >
                    <option value="">— sin supervisor —</option>
                    {supervisors.map((s) => (
                      <option key={s.id} value={s.id}>{s.displayName}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <Button
              onClick={() => createUser.mutate()}
              disabled={createUser.isPending || !form.username || !form.displayName || form.pin.length < 4}
              data-testid="button-create-user"
            >
              Crear usuario
            </Button>
          </div>
        )}

        {isLoading && <p className="text-sm text-muted-foreground">Cargando...</p>}

        <div className="space-y-2">
          {users.map((u) => (
            <div
              key={u.id}
              className="border border-border rounded-md p-3 flex items-center gap-3 flex-wrap"
              data-testid={`row-user-${u.id}`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">
                  {u.displayName}{" "}
                  <span className="text-muted-foreground font-mono text-xs">@{u.username}</span>
                  {!u.active && (
                    <span className="ml-2 text-[10px] border border-border rounded px-1">INACTIVO</span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {ROLE_LABEL[u.role]}
                  {u.supervisorId
                    ? ` · a cargo de ${users.find((x) => x.id === u.supervisorId)?.displayName ?? "?"}`
                    : ""}
                  {u.lastLoginAt
                    ? ` · último ingreso ${new Date(u.lastLoginAt).toLocaleDateString("es-AR")}`
                    : " · nunca entró"}
                </p>
              </div>

              <select
                className="h-9 px-2 rounded-md border border-input bg-background text-xs"
                value={u.role}
                onChange={(e) => patchUser.mutate({ id: u.id, body: { role: e.target.value } })}
                data-testid={`select-role-${u.id}`}
              >
                <option value="operario">Operario</option>
                <option value="supervisor">Supervisor</option>
                <option value="admin">Administrador</option>
              </select>

              {/* Solo aplica a operarios — mismo criterio que en el alta.
                  El servidor ya aceptaba supervisorId en el PATCH, faltaba
                  este control para poder cambiarlo despues de creado. */}
              {u.role === "operario" && (
                <select
                  className="h-9 px-2 rounded-md border border-input bg-background text-xs"
                  value={u.supervisorId ?? ""}
                  onChange={(e) =>
                    patchUser.mutate({
                      id: u.id,
                      body: { supervisorId: e.target.value ? Number(e.target.value) : null },
                    })
                  }
                  data-testid={`select-supervisor-${u.id}`}
                >
                  <option value="">— sin supervisor —</option>
                  {supervisors.map((s) => (
                    <option key={s.id} value={s.id}>{s.displayName}</option>
                  ))}
                </select>
              )}

              <Button
                size="sm"
                variant="outline"
                className="gap-1"
                onClick={() => resetPin(u)}
                data-testid={`button-resetpin-${u.id}`}
              >
                <KeyRound className="w-3 h-3" /> PIN
              </Button>

              <Button
                size="sm"
                variant={u.active ? "outline" : "default"}
                onClick={() => patchUser.mutate({ id: u.id, body: { active: !u.active } })}
                data-testid={`button-toggle-active-${u.id}`}
              >
                {u.active ? "Desactivar" : "Activar"}
              </Button>
            </div>
          ))}
        </div>

        <p className="text-xs text-muted-foreground">
          Los usuarios se desactivan, no se borran: así sus tareas y su historial
          no quedan huérfanos.
        </p>
      </main>
    </div>
  );
}
