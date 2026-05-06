import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router";
import {
  Cpu,
  Pencil,
  Plus,
  RefreshCcw,
  Search,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import {
  deleteTeacher,
  listTeachers,
  registerTeacher,
  updateTeacher,
  type AuthUserResponse,
  type RegisterTeacherInput,
  type TeacherUpdateInput,
} from "@/api/client";
import {
  fetchMyDevices,
  type HardwareDeviceSummary,
} from "@/api/hardware";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ConfirmationPopover } from "@/components/ui/confirmation-popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/features/auth/useAuth";
import { cn } from "@/lib/utils";

interface TeacherFormState {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  isic_identifier: string;
}

const EMPTY_FORM: TeacherFormState = {
  email: "",
  password: "",
  first_name: "",
  last_name: "",
  isic_identifier: "",
};

function validateTeacherForm(
  form: TeacherFormState,
  requirePassword: boolean,
): string | null {
  if (!form.first_name.trim()) {
    return "Meno je povinne.";
  }
  if (!form.last_name.trim()) {
    return "Priezvisko je povinne.";
  }
  if (!form.email.trim()) {
    return "Email je povinny.";
  }
  if (requirePassword && !form.password) {
    return "Heslo je povinne.";
  }
  if (!form.isic_identifier.trim()) {
    return "ISIC cislo je povinne.";
  }
  return null;
}

function buildCreatePayload(form: TeacherFormState): RegisterTeacherInput {
  return {
    email: form.email.trim(),
    password: form.password,
    first_name: form.first_name.trim(),
    last_name: form.last_name.trim(),
    isic_identifier: form.isic_identifier.trim(),
    role: "teacher",
  };
}

function buildUpdatePayload(
  form: TeacherFormState,
  original: AuthUserResponse,
): TeacherUpdateInput {
  const payload: TeacherUpdateInput = {};
  const email = form.email.trim();
  if (email !== original.email) {
    payload.email = email;
  }
  if (form.password) {
    payload.password = form.password;
  }
  const firstName = form.first_name.trim();
  if (firstName !== original.first_name) {
    payload.first_name = firstName;
  }
  const lastName = form.last_name.trim();
  if (lastName !== original.last_name) {
    payload.last_name = lastName;
  }
  const isic = form.isic_identifier.trim();
  if (isic !== (original.isic_identifier ?? "")) {
    payload.isic_identifier = isic;
  }
  return payload;
}

export function AdminPage() {
  const { user, logout } = useAuth();
  const [teachers, setTeachers] = useState<AuthUserResponse[]>([]);
  const [devices, setDevices] = useState<HardwareDeviceSummary[]>([]);
  const [teacherSearch, setTeacherSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<TeacherFormState>(EMPTY_FORM);
  const [isCreating, setIsCreating] = useState(false);

  const [editTarget, setEditTarget] = useState<AuthUserResponse | null>(null);
  const [editForm, setEditForm] = useState<TeacherFormState>(EMPTY_FORM);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const claimedCount = useMemo(
    () => devices.filter((device) => device.is_claimed).length,
    [devices],
  );
  const unclaimedCount = devices.length - claimedCount;
  const onlineCount = useMemo(
    () => devices.filter((device) => device.is_online).length,
    [devices],
  );
  const offlineCount = devices.length - onlineCount;

  const filteredTeachers = useMemo(() => {
    const query = teacherSearch.trim().toLowerCase();
    if (!query) {
      return teachers;
    }
    return teachers.filter((teacher) => {
      const haystack = [
        teacher.first_name,
        teacher.last_name,
        teacher.email,
        teacher.isic_identifier ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [teacherSearch, teachers]);

  async function loadTeachers() {
    const data = await listTeachers();
    setTeachers(data);
  }

  async function loadDevices() {
    const data = await fetchMyDevices();
    setDevices(data);
  }

  useEffect(() => {
    if (user?.role !== "admin") {
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const [teachersData, devicesData] = await Promise.all([
          listTeachers(),
          fetchMyDevices(),
        ]);
        if (!cancelled) {
          setTeachers(teachersData);
          setDevices(devicesData);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Nepodarilo sa nacitat admin panel",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.role]);

  if (user && user.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  async function handleRefresh() {
    setError(null);
    setNotice(null);
    setIsRefreshing(true);
    try {
      await Promise.all([loadTeachers(), loadDevices()]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Nepodarilo sa obnovit admin panel",
      );
    } finally {
      setIsRefreshing(false);
    }
  }

  function openCreate() {
    setCreateForm(EMPTY_FORM);
    setCreateOpen(true);
  }

  async function handleCreate() {
    setError(null);
    setNotice(null);

    const validationError = validateTeacherForm(createForm, true);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsCreating(true);
    try {
      const created = await registerTeacher(buildCreatePayload(createForm));
      setNotice(
        `Ucitel ${created.first_name} ${created.last_name} bol vytvoreny.`,
      );
      setCreateForm(EMPTY_FORM);
      setCreateOpen(false);
      await loadTeachers();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Nepodarilo sa vytvorit ucitela",
      );
    } finally {
      setIsCreating(false);
    }
  }

  function openEdit(teacher: AuthUserResponse) {
    setEditTarget(teacher);
    setEditForm({
      email: teacher.email,
      password: "",
      first_name: teacher.first_name,
      last_name: teacher.last_name,
      isic_identifier: teacher.isic_identifier ?? "",
    });
  }

  async function handleEditSave() {
    if (!editTarget) {
      return;
    }

    setError(null);
    setNotice(null);

    const validationError = validateTeacherForm(editForm, false);
    if (validationError) {
      setError(validationError);
      return;
    }

    const payload = buildUpdatePayload(editForm, editTarget);
    if (Object.keys(payload).length === 0) {
      setEditTarget(null);
      return;
    }

    setIsSavingEdit(true);
    try {
      const updated = await updateTeacher(editTarget.id, payload);
      setNotice(
        `Zmeny pre ${updated.first_name} ${updated.last_name} boli ulozene.`,
      );
      setEditTarget(null);
      await loadTeachers();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Nepodarilo sa ulozit zmeny",
      );
    } finally {
      setIsSavingEdit(false);
    }
  }

  async function handleDelete(target: AuthUserResponse) {
    setError(null);
    setNotice(null);
    setIsDeleting(true);
    try {
      await deleteTeacher(target.id);
      setNotice(
        `Ucitel ${target.first_name} ${target.last_name} bol odstraneny.`,
      );
      setDeleteTargetId(null);
      await loadTeachers();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Nepodarilo sa odstranit ucitela",
      );
    } finally {
      setIsDeleting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#edf4ff_0%,#f8fafc_45%,#ffffff_100%)]">
        <p className="text-text-secondary">Nacitavam admin panel...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#eaf2ff_0%,#f8fafc_42%,#ffffff_100%)]">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="rounded-[32px] border border-white/80 bg-white/90 p-6 shadow-[0_24px_80px_-38px_rgba(21,94,239,0.4)] backdrop-blur">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <Badge
                variant="outline"
                className="border-[#bfd3ff] bg-[#eef4ff] text-[#155eef]"
              >
                Admin console
              </Badge>
              <div className="space-y-2">
                <h1 className="font-heading text-3xl font-medium text-[#13213f] sm:text-4xl">
                  Sprava ucitelov a zariadeni
                </h1>
                <p className="max-w-3xl text-sm leading-6 text-[#52607a] sm:text-base">
                  Jeden panel pre teacherov a jeden spolocny hardware inventar.
                  ISIC je pri teacherovi povinny, zariadenia sa nesplietaju do
                  dvoch sekcii a live diagnostika ostava dostupna v hardware
                  konzole.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                to="/devices"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                <Cpu className="mr-1 h-4 w-4" />
                Hardware konzola
              </Link>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleRefresh()}
                disabled={isRefreshing}
              >
                <RefreshCcw className="mr-1 h-4 w-4" />
                {isRefreshing ? "Obnovujem..." : "Obnovit"}
              </Button>
              <Button variant="outline" size="sm" onClick={logout}>
                Odhlasit sa
              </Button>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl border border-[#f5b7b7] bg-[#fff1f1] px-4 py-3 text-sm text-[#9f1d1d]">
            {error}
          </div>
        )}

        {notice && (
          <div className="rounded-2xl border border-[#bfe3c7] bg-[#edf9f0] px-4 py-3 text-sm text-[#045d17]">
            {notice}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="border border-[#dbe7ff] bg-[#f9fbff]">
            <CardContent className="space-y-1 pt-4">
              <p className="text-xs uppercase tracking-[0.18em] text-[#7182a3]">
                Ucitelia
              </p>
              <p className="text-3xl font-medium text-[#13213f]">
                {teachers.length}
              </p>
              <p className="text-sm text-[#52607a]">
                Vsetci teacheri na jednom mieste
              </p>
            </CardContent>
          </Card>

          <Card className="border border-[#dbe7ff] bg-[#f9fbff]">
            <CardContent className="space-y-1 pt-4">
              <p className="text-xs uppercase tracking-[0.18em] text-[#7182a3]">
                Zariadenia
              </p>
              <p className="text-3xl font-medium text-[#13213f]">
                {devices.length}
              </p>
              <p className="text-sm text-[#52607a]">
                Cely hardware inventar admina
              </p>
            </CardContent>
          </Card>

          <Card className="border border-[#dbe7ff] bg-[#f9fbff]">
            <CardContent className="space-y-1 pt-4">
              <p className="text-xs uppercase tracking-[0.18em] text-[#7182a3]">
                Nepriradene
              </p>
              <p className="text-3xl font-medium text-[#13213f]">
                {unclaimedCount}
              </p>
              <p className="text-sm text-[#52607a]">
                Citacky bez vlastnika
              </p>
            </CardContent>
          </Card>

          <Card className="border border-[#dbe7ff] bg-[#f9fbff]">
            <CardContent className="space-y-1 pt-4">
              <p className="text-xs uppercase tracking-[0.18em] text-[#7182a3]">
                Online
              </p>
              <p className="text-3xl font-medium text-[#13213f]">
                {onlineCount}
              </p>
              <p className="text-sm text-[#52607a]">
                {offlineCount} offline mimo timeoutu
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <Card className="border border-[#dbe4f5] bg-white">
            <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-1.5">
                <CardTitle className="flex items-center gap-2 text-[#13213f]">
                  <Users className="h-4 w-4 text-[#155eef]" />
                  Teacheri
                </CardTitle>
                <CardDescription>
                  Kazdy teacher ma povinny ISIC pre pairing zariadenia.
                </CardDescription>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7182a3]" />
                  <Input
                    value={teacherSearch}
                    onChange={(event) => setTeacherSearch(event.target.value)}
                    placeholder="Hladat meno, email alebo ISIC"
                    className="pl-9 sm:w-72"
                  />
                </div>
                <Button onClick={openCreate}>
                  <Plus className="mr-1 h-4 w-4" />
                  Novy ucitel
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {filteredTeachers.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-[#dbe4f5] bg-[#fbfdff] px-4 py-8 text-center text-sm text-text-secondary">
                  {teachers.length === 0
                    ? "Zatial nie je vytvoreny ziadny teacher."
                    : "Filtru nezodpoveda ziadny teacher."}
                </p>
              ) : (
                filteredTeachers.map((teacher) => (
                  <Card
                    key={teacher.id}
                    size="sm"
                    className="border border-[#e6edf9] bg-[#fbfdff]"
                  >
                    <CardContent className="flex flex-col gap-4 pt-3 lg:flex-row lg:items-center lg:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-base font-medium text-[#13213f]">
                            {teacher.first_name} {teacher.last_name}
                          </p>
                          <Badge variant="outline">
                            {teacher.isic_identifier ?? "bez ISIC"}
                          </Badge>
                        </div>
                        <p className="text-sm text-[#52607a]">{teacher.email}</p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEdit(teacher)}
                        >
                          <Pencil className="mr-1 h-4 w-4" />
                          Upravit
                        </Button>
                        <ConfirmationPopover
                          open={deleteTargetId === teacher.id}
                          onOpenChange={(open) =>
                            setDeleteTargetId(open ? teacher.id : null)
                          }
                          title="Odstranit ucitela"
                          description={
                            <>
                              Naozaj chcete odstranit ucet{" "}
                              <strong>
                                {teacher.first_name} {teacher.last_name}
                              </strong>{" "}
                              ({teacher.email})?
                            </>
                          }
                          confirmLabel="Odstranit"
                          confirmingLabel="Odstranujem..."
                          onConfirm={() => void handleDelete(teacher)}
                          isConfirming={isDeleting && deleteTargetId === teacher.id}
                          trigger={<Button variant="destructive" size="sm" />}
                          triggerContent={
                            <>
                              <Trash2 className="mr-1 h-4 w-4" />
                              Odstranit
                            </>
                          }
                          align="end"
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="border border-[#dbe7ff] bg-[linear-gradient(145deg,#f9fbff_0%,#eef4ff_100%)]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-[#13213f]">
                  <UserPlus className="h-4 w-4 text-[#155eef]" />
                  Novy teacher
                </CardTitle>
                <CardDescription>
                  Formular vyzaduje meno, priezvisko, email, heslo aj ISIC.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm leading-6 text-[#52607a]">
                <p>
                  ISIC sa pouziva pri pairingu zariadeni. Bez neho nema zmysel
                  ucet vytvarat.
                </p>
                <Button onClick={openCreate}>
                  <Plus className="mr-1 h-4 w-4" />
                  Otvorit formular
                </Button>
              </CardContent>
            </Card>

            <Card className="border border-[#eadfff] bg-[linear-gradient(145deg,#ffffff_0%,#f7f3ff_100%)]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-[#13213f]">
                  <Cpu className="h-4 w-4 text-[#7c3aed]" />
                  Hardware konzola
                </CardTitle>
                <CardDescription>
                  Detail health, metrics a config requestov ostava v specialnej
                  hardware konzole.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm leading-6 text-[#574f6b]">
                <p>
                  Admin tu vidi cely inventar a z tohto panelu vie rychlo
                  uvolnit claim. Na live diagnostiku otvorte detailne zariadenia.
                </p>
                <Link
                  to="/devices"
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                >
                  Otvorit hardware konzolu
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="sm:max-w-[680px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-[#155eef]" />
                Novy ucitel
              </DialogTitle>
              <DialogDescription>
                Vsetky polia su povinne. ISIC cislo sa pouzije pri pairingu
                zariadenia.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="create-first">Meno</Label>
                <Input
                  id="create-first"
                  value={createForm.first_name}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      first_name: event.target.value,
                    }))
                  }
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="create-last">Priezvisko</Label>
                <Input
                  id="create-last"
                  value={createForm.last_name}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      last_name: event.target.value,
                    }))
                  }
                  required
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="create-email">Email</Label>
                <Input
                  id="create-email"
                  type="email"
                  value={createForm.email}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="create-password">Heslo</Label>
                <Input
                  id="create-password"
                  type="password"
                  value={createForm.password}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      password: event.target.value,
                    }))
                  }
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="create-isic">ISIC cislo</Label>
                <Input
                  id="create-isic"
                  value={createForm.isic_identifier}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      isic_identifier: event.target.value,
                    }))
                  }
                  placeholder="napr. 1234567890"
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setCreateOpen(false)}
                disabled={isCreating}
              >
                Zrusit
              </Button>
              <Button onClick={() => void handleCreate()} disabled={isCreating}>
                {isCreating ? "Vytvaram..." : "Vytvorit"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={editTarget !== null}
          onOpenChange={(open) => {
            if (!open) {
              setEditTarget(null);
            }
          }}
        >
          <DialogContent className="sm:max-w-[680px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Pencil className="h-4 w-4 text-[#155eef]" />
                Upravit ucitela
              </DialogTitle>
              <DialogDescription>
                Email, meno, priezvisko a ISIC ostavaju povinne. Heslo je pri
                uprave volitelne.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="edit-first">Meno</Label>
                <Input
                  id="edit-first"
                  value={editForm.first_name}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      first_name: event.target.value,
                    }))
                  }
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-last">Priezvisko</Label>
                <Input
                  id="edit-last"
                  value={editForm.last_name}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      last_name: event.target.value,
                    }))
                  }
                  required
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editForm.email}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-password">Nove heslo</Label>
                <Input
                  id="edit-password"
                  type="password"
                  placeholder="ponechat povodne"
                  value={editForm.password}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      password: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-isic">ISIC cislo</Label>
                <Input
                  id="edit-isic"
                  value={editForm.isic_identifier}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      isic_identifier: event.target.value,
                    }))
                  }
                  placeholder="napr. 1234567890"
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setEditTarget(null)}
                disabled={isSavingEdit}
              >
                Zrusit
              </Button>
              <Button
                onClick={() => void handleEditSave()}
                disabled={isSavingEdit}
              >
                {isSavingEdit ? "Ukladam..." : "Ulozit"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
