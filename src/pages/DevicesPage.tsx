import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import {
  Activity,
  ArrowLeft,
  Cpu,
  Gauge,
  RadioTower,
  RefreshCcw,
  ScanLine,
  Settings2,
  ShieldCheck,
  Unlink2,
  UserPlus,
  Users,
  Wifi,
} from "lucide-react";
import {
  CONFIG_SECTIONS,
  fetchDeviceDetail,
  fetchDevicePairing,
  fetchMyDevices,
  fetchUnclaimedDevices,
  publishDeviceConfig,
  publishDeviceConfigSection,
  releaseDeviceClaim,
  requestDeviceConfig,
  requestDeviceHealth,
  requestDeviceMetrics,
  startDevicePairing,
  type ConfigSection,
  type HardwareDeviceDetail,
  type HardwareDeviceSummary,
  type PairingSessionResponse,
} from "@/api/hardware";
import {
  registerTeacher,
  updateMyIsic,
  type RegisterTeacherInput,
} from "@/api/client";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/features/auth/useAuth";
import { cn } from "@/lib/utils";

type SnapshotKind = "health" | "metrics" | "config";
type ConfigScope = "full" | ConfigSection;

interface TeacherFormState {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  isic_identifier: string;
}

const EMPTY_CONFIG_EDITOR = "{\n  \n}";
const EMPTY_TEACHER_FORM: TeacherFormState = {
  email: "",
  password: "",
  first_name: "",
  last_name: "",
  isic_identifier: "",
};

function formatDateTime(value: string | null): string {
  if (!value) {
    return "Nedostupne";
  }

  return new Intl.DateTimeFormat("sk-SK", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(value));
}

function formatJson(value: unknown): string {
  if (value == null) {
    return "Ziadne data";
  }

  return JSON.stringify(value, null, 2);
}

function getConfigEditorValue(
  device: HardwareDeviceDetail | null,
  scope: ConfigScope,
): string {
  if (device?.config_payload == null) {
    return EMPTY_CONFIG_EDITOR;
  }

  if (scope === "full") {
    return formatJson(device.config_payload);
  }

  const sectionValue = device.config_payload[scope];
  return formatJson(sectionValue ?? {});
}

function statusVariant(
  status: string | null,
): "default" | "outline" | "secondary" | "destructive" {
  if (status === "ok" || status === "healthy" || status === "completed") {
    return "default";
  }
  if (status === "pending") {
    return "secondary";
  }
  if (status === "expired" || status === "cancelled") {
    return "destructive";
  }
  return "outline";
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}

function getSnapshotTimestamp(
  detail: HardwareDeviceDetail,
  kind: SnapshotKind,
): string | null {
  if (kind === "health") {
    return detail.last_health_at;
  }
  if (kind === "metrics") {
    return detail.last_metrics_at;
  }
  return detail.last_config_at;
}

function buildTeacherPayload(
  form: TeacherFormState,
): RegisterTeacherInput {
  return {
    email: form.email.trim(),
    password: form.password,
    first_name: form.first_name.trim(),
    last_name: form.last_name.trim(),
    isic_identifier: form.isic_identifier.trim() || null,
    role: "teacher",
  };
}

export function DevicesPage() {
  const { user, logout, refreshUser } = useAuth();
  const isAdmin = user?.role === "admin";
  const isTeacher = user?.role === "teacher";

  const [devices, setDevices] = useState<HardwareDeviceSummary[]>([]);
  const [unclaimedDevices, setUnclaimedDevices] = useState<
    HardwareDeviceSummary[]
  >([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [selectedDevice, setSelectedDevice] =
    useState<HardwareDeviceDetail | null>(null);
  const [pairingSessions, setPairingSessions] = useState<
    Record<string, PairingSessionResponse | null>
  >({});
  const [teacherIsic, setTeacherIsic] = useState(user?.isic_identifier ?? "");
  const [teacherForm, setTeacherForm] =
    useState<TeacherFormState>(EMPTY_TEACHER_FORM);
  const [configScope, setConfigScope] = useState<ConfigScope>("full");
  const [configEditor, setConfigEditor] = useState(EMPTY_CONFIG_EDITOR);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSavingIsic, setIsSavingIsic] = useState(false);
  const [isCreatingTeacher, setIsCreatingTeacher] = useState(false);
  const [isPublishingConfig, setIsPublishingConfig] = useState(false);
  const [activeCommand, setActiveCommand] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const claimedDevices = useMemo(
    () => devices.filter((device) => device.is_claimed),
    [devices],
  );

  const pendingPairingDeviceIds = useMemo(
    () =>
      Object.entries(pairingSessions)
        .filter(([, session]) => session?.status === "pending")
        .map(([deviceId]) => deviceId),
    [pairingSessions],
  );

  const loadDeviceLists = useCallback(async (deviceIdToKeep?: string | null) => {
    const [allVisibleDevices, unclaimed] = await Promise.all([
      fetchMyDevices(),
      fetchUnclaimedDevices(),
    ]);

    setDevices(allVisibleDevices);
    setUnclaimedDevices(unclaimed);

    const nextSelectedId =
      deviceIdToKeep &&
      allVisibleDevices.some((device) => device.device_id === deviceIdToKeep)
        ? deviceIdToKeep
        : allVisibleDevices[0]?.device_id ?? null;
    setSelectedDeviceId(nextSelectedId);
    return nextSelectedId;
  }, []);

  const loadSelectedDevice = useCallback(
    async (deviceId: string | null, scope: ConfigScope = configScope) => {
      if (!deviceId) {
        setSelectedDevice(null);
        setConfigEditor(EMPTY_CONFIG_EDITOR);
        return;
      }

      const detail = await fetchDeviceDetail(deviceId);
      setSelectedDevice(detail);
      setConfigEditor(getConfigEditorValue(detail, scope));
      return detail;
    },
    [configScope],
  );

  const loadPage = useCallback(
    async (deviceIdToKeep: string | null = null) => {
      const nextSelectedId = await loadDeviceLists(deviceIdToKeep);
      if (nextSelectedId) {
        await loadSelectedDevice(nextSelectedId);
      } else {
        setSelectedDevice(null);
        setConfigEditor(EMPTY_CONFIG_EDITOR);
      }
    },
    [loadDeviceLists, loadSelectedDevice],
  );

  const waitForDeviceUpdate = useCallback(
    async (
      deviceId: string,
      kind: SnapshotKind,
      previousTimestamp: string | null,
      scope: ConfigScope = configScope,
    ) => {
      for (let attempt = 0; attempt < 8; attempt += 1) {
        await delay(1000);
        const detail = await fetchDeviceDetail(deviceId);
        if (getSnapshotTimestamp(detail, kind) !== previousTimestamp) {
          setSelectedDevice(detail);
          setConfigEditor(getConfigEditorValue(detail, scope));
          return true;
        }
      }

      const fallback = await fetchDeviceDetail(deviceId);
      setSelectedDevice(fallback);
      setConfigEditor(getConfigEditorValue(fallback, scope));
      return false;
    },
    [configScope],
  );

  useEffect(() => {
    async function init() {
      try {
        await loadPage();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Nepodarilo sa nacitat zariadenia",
        );
      } finally {
        setIsLoading(false);
      }
    }

    void init();
  }, [loadPage]);

  useEffect(() => {
    if (!isTeacher || pendingPairingDeviceIds.length === 0) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void Promise.all(
        pendingPairingDeviceIds.map(async (deviceId) => {
          const session = await fetchDevicePairing(deviceId);
          setPairingSessions((current) => ({ ...current, [deviceId]: session }));

          if (session && session.status !== "pending") {
            await loadPage(deviceId);
          }
        }),
      ).catch((err: unknown) => {
        setError(
          err instanceof Error
            ? err.message
            : "Nepodarilo sa obnovit pairing",
        );
      });
    }, 3000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isTeacher, loadPage, pendingPairingDeviceIds]);

  async function handleRefresh() {
    setError(null);
    setNotice(null);
    setIsRefreshing(true);

    try {
      await loadPage(selectedDeviceId);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Nepodarilo sa obnovit zariadenia",
      );
    } finally {
      setIsRefreshing(false);
    }
  }

  async function handleSaveTeacherIsic() {
    setError(null);
    setNotice(null);
    setIsSavingIsic(true);

    try {
      const normalized = teacherIsic.trim() || null;
      await updateMyIsic(normalized);
      await refreshUser();
      setTeacherIsic(normalized?.toUpperCase() ?? "");
      setNotice("Teacher ISIC bol ulozeny. Teraz mozete spustit pairing.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Nepodarilo sa ulozit ISIC",
      );
    } finally {
      setIsSavingIsic(false);
    }
  }

  async function handleCreateTeacher() {
    setError(null);
    setNotice(null);
    setIsCreatingTeacher(true);

    try {
      const created = await registerTeacher(buildTeacherPayload(teacherForm));
      setTeacherForm(EMPTY_TEACHER_FORM);
      setNotice(
        `Teacher ${created.first_name} ${created.last_name} bol vytvoreny s emailom ${created.email}.`,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Nepodarilo sa vytvorit noveho ucitela",
      );
    } finally {
      setIsCreatingTeacher(false);
    }
  }

  async function handleStartPairing(deviceId: string) {
    setError(null);
    setNotice(null);
    setActiveCommand(`pair-${deviceId}`);

    try {
      const session = await startDevicePairing(deviceId);
      setPairingSessions((current) => ({ ...current, [deviceId]: session }));
      setNotice(
        `Pairing spusteny pre ${deviceId}. Do ${formatDateTime(session.expires_at)} naskenujte ucitelsky ISIC na tomto zariadeni.`,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Nepodarilo sa spustit pairing",
      );
    } finally {
      setActiveCommand(null);
    }
  }

  async function handleSelectDevice(
    deviceId: string,
    loadDetail: boolean,
  ) {
    setSelectedDeviceId(deviceId);
    setError(null);

    if (!loadDetail) {
      setSelectedDevice(null);
      return;
    }

    try {
      await loadSelectedDevice(deviceId);
    } catch (err) {
      setSelectedDevice(null);
      setError(
        err instanceof Error
          ? err.message
          : "Nepodarilo sa nacitat detail zariadenia",
      );
    }
  }

  async function handleReleaseClaim(deviceId: string) {
    setError(null);
    setNotice(null);
    setActiveCommand(`release-${deviceId}`);

    try {
      await releaseDeviceClaim(deviceId);
      setPairingSessions((current) => ({ ...current, [deviceId]: null }));
      await loadPage(selectedDeviceId === deviceId ? null : selectedDeviceId);
      setNotice(`Zariadenie ${deviceId} bolo odpojene od ucitela.`);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Nepodarilo sa uvolnit zariadenie",
      );
    } finally {
      setActiveCommand(null);
    }
  }

  async function handleRequestSnapshot(kind: SnapshotKind) {
    if (!selectedDeviceId) {
      return;
    }

    setError(null);
    setNotice(null);
    setActiveCommand(`${kind}-request`);

    try {
      const previousTimestamp = selectedDevice
        ? getSnapshotTimestamp(selectedDevice, kind)
        : null;

      let response;
      if (kind === "health") {
        response = await requestDeviceHealth(selectedDeviceId);
      } else if (kind === "metrics") {
        response = await requestDeviceMetrics(selectedDeviceId);
      } else {
        response =
          configScope === "full"
            ? await requestDeviceConfig(selectedDeviceId)
            : await requestDeviceConfig(selectedDeviceId, configScope);
      }

      const updated = await waitForDeviceUpdate(
        selectedDeviceId,
        kind,
        previousTimestamp,
        kind === "config" ? configScope : "full",
      );

      setNotice(
        updated
          ? `${response.detail}. Snapshot bol aktualizovany. Topic: ${response.topic}`
          : `${response.detail}. Topic: ${response.topic}. Backend caka na novu odpoved zariadenia.`,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Poziadavka na zariadenie zlyhala",
      );
    } finally {
      setActiveCommand(null);
    }
  }

  async function handlePublishConfig() {
    if (!selectedDeviceId) {
      return;
    }

    setError(null);
    setNotice(null);
    setIsPublishingConfig(true);

    try {
      const parsed = JSON.parse(configEditor) as Record<string, unknown>;
      const response =
        configScope === "full"
          ? await publishDeviceConfig(selectedDeviceId, parsed)
          : await publishDeviceConfigSection(
              selectedDeviceId,
              configScope,
              parsed,
            );
      await loadSelectedDevice(selectedDeviceId, configScope);
      setNotice(
        `${response.detail}. Topic: ${response.topic}. Ak chcete potvrdit runtime stav, pouzite nacitanie configu.`,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Config sa nepodarilo odoslat",
      );
    } finally {
      setIsPublishingConfig(false);
    }
  }

  const deviceListTitle = isAdmin ? "Vsetky zariadenia" : "Moje zariadenia";
  const deviceListDescription = isAdmin
    ? "Admin vidi kompletne hardware setupy, vratane priradenych a nepriradenych citaciek."
    : "Claimnute zariadenia tohto ucitela. Vyberte jedno a testujte requesty alebo config.";

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#f8fafc_0%,#eef4ff_100%)]">
        <p className="text-text-secondary">Nacitavam zariadenia...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef4ff_55%,#ffffff_100%)]">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 rounded-[28px] border border-white/70 bg-white/85 p-5 shadow-[0_18px_60px_-28px_rgba(21,94,239,0.35)] backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <Badge
                variant="outline"
                className="border-[#bfd3ff] bg-[#eef4ff] text-[#155eef]"
              >
                {isAdmin ? "Admin console" : "Hardware flow"}
              </Badge>
              <h1 className="font-heading text-3xl font-medium text-[#13213f]">
                {isAdmin
                  ? "Sprava ucitelov a zariadeni"
                  : "Sprava ISIC zariadeni"}
              </h1>
              <p className="max-w-3xl text-sm leading-6 text-[#52607a]">
                {isAdmin
                  ? "Admin tu vytvara novych teacherov a vidi vsetok hardware napriec systemom. Moze kontrolovat health, metrics, config aj vlastnika zariadenia."
                  : "Teacher tu nastavi svoj ISIC, spusti pairing na realnej citacke a potom testuje health, metrics a config spravy."}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                to="/"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                <ArrowLeft className="mr-1 h-4 w-4" />
                Spat na rozvrh
              </Link>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing}
              >
                <RefreshCcw className="mr-1 h-4 w-4" />
                {isRefreshing ? "Obnovujem..." : "Obnovit"}
              </Button>
              <Button variant="ghost" size="sm" onClick={logout}>
                Odhlasit sa
              </Button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            {isAdmin ? (
              <>
                <Card className="border border-[#dbe7ff] bg-[#f9fbff]">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-[#13213f]">
                      <UserPlus className="h-4 w-4 text-[#155eef]" />
                      Pridat noveho teachera
                    </CardTitle>
                    <CardDescription>
                      Admin vytvori ucet ucitela, ktory sa potom moze prihlasit a claimnut svoje zariadenia.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="teacher-first-name">Meno</Label>
                      <Input
                        id="teacher-first-name"
                        value={teacherForm.first_name}
                        onChange={(event) =>
                          setTeacherForm((current) => ({
                            ...current,
                            first_name: event.target.value,
                          }))
                        }
                        className="bg-white"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="teacher-last-name">Priezvisko</Label>
                      <Input
                        id="teacher-last-name"
                        value={teacherForm.last_name}
                        onChange={(event) =>
                          setTeacherForm((current) => ({
                            ...current,
                            last_name: event.target.value,
                          }))
                        }
                        className="bg-white"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="teacher-email">Email</Label>
                      <Input
                        id="teacher-email"
                        type="email"
                        value={teacherForm.email}
                        onChange={(event) =>
                          setTeacherForm((current) => ({
                            ...current,
                            email: event.target.value,
                          }))
                        }
                        className="bg-white"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="teacher-password">Heslo</Label>
                      <Input
                        id="teacher-password"
                        type="password"
                        value={teacherForm.password}
                        onChange={(event) =>
                          setTeacherForm((current) => ({
                            ...current,
                            password: event.target.value,
                          }))
                        }
                        className="bg-white"
                      />
                    </div>
                    <div className="space-y-1.5 md:col-span-2">
                      <Label htmlFor="teacher-isic">Pairing ISIC</Label>
                      <Input
                        id="teacher-isic"
                        value={teacherForm.isic_identifier}
                        onChange={(event) =>
                          setTeacherForm((current) => ({
                            ...current,
                            isic_identifier: event.target.value,
                          }))
                        }
                        placeholder="volitelne"
                        className="bg-white"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Button
                        onClick={() => void handleCreateTeacher()}
                        disabled={isCreatingTeacher}
                      >
                        {isCreatingTeacher
                          ? "Vytvaram..."
                          : "Vytvorit teachera"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border border-[#eadfff] bg-[linear-gradient(135deg,#ffffff_0%,#f6f0ff_100%)]">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-[#13213f]">
                      <Users className="h-4 w-4 text-[#7c3aed]" />
                      Admin prehlad
                    </CardTitle>
                    <CardDescription>
                      Teacher vlastni svoje zariadenia. Admin vidi vsetko, vie overit hardware stav a v nutnom pripade uvolnit claim.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm leading-6 text-[#574f6b]">
                    <p>Jeden teacher moze mat viac zariadeni.</p>
                    <p>Jedno zariadenie moze byt priradene iba jednemu teacherovi naraz.</p>
                    <p>Nepriradene zariadenia vidite hned po tom, ako sa ozvu cez MQTT.</p>
                  </CardContent>
                </Card>
              </>
            ) : (
              <>
                <Card className="border border-[#dbe7ff] bg-[#f9fbff]">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-[#13213f]">
                      <ShieldCheck className="h-4 w-4 text-[#155eef]" />
                      Teacher pairing ISIC
                    </CardTitle>
                    <CardDescription>
                      Ulozte ISIC ucitela, ktory budete skenovat na zariadeni pri claimovani.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="teacher-own-isic">ISIC identifikator</Label>
                      <Input
                        id="teacher-own-isic"
                        value={teacherIsic}
                        onChange={(event) => setTeacherIsic(event.target.value)}
                        placeholder="napr. 1234567890"
                        className="bg-white"
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        onClick={() => void handleSaveTeacherIsic()}
                        disabled={isSavingIsic}
                      >
                        {isSavingIsic ? "Ukladam..." : "Ulozit ISIC"}
                      </Button>
                      <Badge
                        variant={user?.isic_identifier ? "default" : "secondary"}
                      >
                        {user?.isic_identifier
                          ? `Aktivny: ${user.isic_identifier}`
                          : "ISIC este nie je nastaveny"}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border border-[#eadfff] bg-[linear-gradient(135deg,#ffffff_0%,#f6f0ff_100%)]">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-[#13213f]">
                      <ScanLine className="h-4 w-4 text-[#7c3aed]" />
                      Teacher flow
                    </CardTitle>
                    <CardDescription>
                      1. Spustite pairing na neclaimovanom zariadeni. 2. Naskenujte ucitelsky ISIC na tej citacke. 3. Zariadenie sa presunie do vasich zariadeni.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm leading-6 text-[#574f6b]">
                    <p>Backend berie zariadenie genericky podla base topicu a device ID.</p>
                    <p>Jeden teacher moze claimnut viac zariadeni.</p>
                    <p>Po claimovani viete zariadeniu poslat live request na health, metrics a config.</p>
                  </CardContent>
                </Card>
              </>
            )}
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

        <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <div className="space-y-6">
            <Card className="border border-[#dbe4f5] bg-white">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-[#13213f]">
                  <Cpu className="h-4 w-4 text-[#155eef]" />
                  {deviceListTitle}
                </CardTitle>
                <CardDescription>{deviceListDescription}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {devices.length === 0 && (
                  <p className="text-sm text-text-secondary">
                    {isAdmin
                      ? "Backend este neeviduje ziadne zariadenie."
                      : "Zatial nemate claimnute ziadne zariadenie."}
                  </p>
                )}

                {(isAdmin ? devices : claimedDevices).map((device) => (
                  <button
                    key={device.device_id}
                    type="button"
                    onClick={() => void handleSelectDevice(device.device_id, true)}
                    className={`w-full rounded-2xl border p-3 text-left transition ${
                      selectedDeviceId === device.device_id
                        ? "border-[#155eef] bg-[#eef4ff]"
                        : "border-[#e6edf9] bg-[#fbfdff] hover:border-[#bfd3ff]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-[#13213f]">
                          {device.device_id}
                        </p>
                        <p className="text-xs text-text-secondary">
                          {device.base_topic}
                        </p>
                      </div>
                      <Badge variant={statusVariant(device.health_state)}>
                        {device.health_state ?? "unknown"}
                      </Badge>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-text-secondary">
                      <span>
                        {device.is_claimed
                          ? `Claimed: ${formatDateTime(device.claimed_at)}`
                          : "Nepriradene"}
                      </span>
                      <span>Last seen: {formatDateTime(device.last_seen_at)}</span>
                    </div>
                    {isAdmin && (
                      <p className="mt-2 text-xs text-text-secondary">
                        Teacher: {device.teacher_name ?? "nikto"}
                      </p>
                    )}
                  </button>
                ))}
              </CardContent>
            </Card>

            <Card className="border border-[#dbe4f5] bg-white">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-[#13213f]">
                  <Wifi className="h-4 w-4 text-[#155eef]" />
                  Nepriradene zariadenia
                </CardTitle>
                <CardDescription>
                  Zariadenia, ktore backend nedrzi pod konkretnym teacherom.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {unclaimedDevices.length === 0 && (
                  <p className="text-sm text-text-secondary">
                    Ziadne aktivne nepriradene zariadenie sa nenaslo.
                  </p>
                )}

                {unclaimedDevices.map((device) => {
                  const pairing = pairingSessions[device.device_id];
                  return (
                    <button
                      key={device.device_id}
                      type="button"
                      onClick={() =>
                        void handleSelectDevice(device.device_id, isAdmin)
                      }
                      className="w-full rounded-2xl border border-[#e6edf9] bg-[#fbfdff] p-3 text-left transition hover:border-[#bfd3ff] hover:bg-[#f5f9ff]"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium text-[#13213f]">
                            {device.device_id}
                          </p>
                          <p className="text-xs text-text-secondary">
                            {device.base_topic}
                          </p>
                        </div>
                        <Badge variant={statusVariant(pairing?.status ?? null)}>
                          {pairing?.status ?? "unclaimed"}
                        </Badge>
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-2 text-xs text-text-secondary">
                        <span>
                          Naposledy videne: {formatDateTime(device.last_seen_at)}
                        </span>
                        {isTeacher ? (
                          <Button
                            size="sm"
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleStartPairing(device.device_id);
                            }}
                            disabled={
                              activeCommand === `pair-${device.device_id}` ||
                              !user?.isic_identifier
                            }
                          >
                            {activeCommand === `pair-${device.device_id}`
                              ? "Spustam..."
                              : "Pairing"}
                          </Button>
                        ) : (
                          <span className="text-[#52607a]">Admin view</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          <div>
            <Card className="border border-[#dbe4f5] bg-white">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-[#13213f]">
                  <Settings2 className="h-4 w-4 text-[#155eef]" />
                  Detail zariadenia
                </CardTitle>
                <CardDescription>
                  Vybrane zariadenie mozete otestovat cez live requesty aj config publish.
                </CardDescription>
                {selectedDevice && selectedDevice.is_claimed && (
                  <CardAction>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => void handleReleaseClaim(selectedDevice.device_id)}
                      disabled={activeCommand === `release-${selectedDevice.device_id}`}
                    >
                      <Unlink2 className="mr-1 h-4 w-4" />
                      {activeCommand === `release-${selectedDevice.device_id}`
                        ? "Odpajam..."
                        : "Uvolnit"}
                    </Button>
                  </CardAction>
                )}
              </CardHeader>

              <CardContent className="space-y-6">
                {!selectedDevice && (
                  <p className="text-sm text-text-secondary">
                    {isTeacher && selectedDeviceId && !claimedDevices.some((device) => device.device_id === selectedDeviceId)
                      ? "Po uspesnom pairingu sa zariadenie presunie do vasich zariadeni a zobrazi sa tu."
                      : "Vyberte zariadenie zo zoznamu vlavo."}
                  </p>
                )}

                {selectedDevice && (
                  <>
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                      <Card size="sm" className="border border-[#e6edf9] bg-[#fbfdff]">
                        <CardContent className="space-y-1 pt-3">
                          <p className="text-xs uppercase tracking-[0.2em] text-[#7182a3]">
                            Device ID
                          </p>
                          <p className="font-medium text-[#13213f]">
                            {selectedDevice.device_id}
                          </p>
                          <p className="text-xs text-text-secondary">
                            {selectedDevice.base_topic}
                          </p>
                        </CardContent>
                      </Card>
                      <Card size="sm" className="border border-[#e6edf9] bg-[#fbfdff]">
                        <CardContent className="space-y-1 pt-3">
                          <p className="text-xs uppercase tracking-[0.2em] text-[#7182a3]">
                            Health
                          </p>
                          <Badge variant={statusVariant(selectedDevice.health_state)}>
                            {selectedDevice.health_state ?? "unknown"}
                          </Badge>
                          <p className="text-xs text-text-secondary">
                            {selectedDevice.firmware ?? "bez firmware info"}
                          </p>
                        </CardContent>
                      </Card>
                      <Card size="sm" className="border border-[#e6edf9] bg-[#fbfdff]">
                        <CardContent className="space-y-1 pt-3">
                          <p className="text-xs uppercase tracking-[0.2em] text-[#7182a3]">
                            Teacher
                          </p>
                          <p className="font-medium text-[#13213f]">
                            {selectedDevice.teacher_name ?? "nepriradene"}
                          </p>
                          <p className="text-xs text-text-secondary">
                            {selectedDevice.is_claimed
                              ? `Claimed ${formatDateTime(selectedDevice.claimed_at)}`
                              : "Zatial bez vlastnika"}
                          </p>
                        </CardContent>
                      </Card>
                      <Card size="sm" className="border border-[#e6edf9] bg-[#fbfdff]">
                        <CardContent className="space-y-1 pt-3">
                          <p className="text-xs uppercase tracking-[0.2em] text-[#7182a3]">
                            Location
                          </p>
                          <p className="font-medium text-[#13213f]">
                            {selectedDevice.location_id ?? "nenastavene"}
                          </p>
                          <p className="text-xs text-text-secondary">
                            Last seen {formatDateTime(selectedDevice.last_seen_at)}
                          </p>
                        </CardContent>
                      </Card>
                      <Card size="sm" className="border border-[#e6edf9] bg-[#fbfdff]">
                        <CardContent className="space-y-1 pt-3">
                          <p className="text-xs uppercase tracking-[0.2em] text-[#7182a3]">
                            Activity
                          </p>
                          <p className="font-medium text-[#13213f]">
                            {formatDateTime(selectedDevice.last_attendance_at)}
                          </p>
                          <p className="text-xs text-text-secondary">
                            posledny attendance event
                          </p>
                        </CardContent>
                      </Card>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                      <Card className="border border-[#e6edf9] bg-[#fbfdff]">
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2 text-sm text-[#13213f]">
                            <Activity className="h-4 w-4 text-[#155eef]" />
                            Health
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <p className="text-xs text-text-secondary">
                            Posledne ulozenie: {formatDateTime(selectedDevice.last_health_at)}
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void handleRequestSnapshot("health")}
                            disabled={activeCommand === "health-request"}
                          >
                            {activeCommand === "health-request"
                              ? "Posielam..."
                              : "Vyziadat health"}
                          </Button>
                        </CardContent>
                      </Card>

                      <Card className="border border-[#e6edf9] bg-[#fbfdff]">
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2 text-sm text-[#13213f]">
                            <Gauge className="h-4 w-4 text-[#155eef]" />
                            Metrics
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <p className="text-xs text-text-secondary">
                            Posledne ulozenie: {formatDateTime(selectedDevice.last_metrics_at)}
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void handleRequestSnapshot("metrics")}
                            disabled={activeCommand === "metrics-request"}
                          >
                            {activeCommand === "metrics-request"
                              ? "Posielam..."
                              : "Vyziadat metrics"}
                          </Button>
                        </CardContent>
                      </Card>

                      <Card className="border border-[#e6edf9] bg-[#fbfdff]">
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2 text-sm text-[#13213f]">
                            <RadioTower className="h-4 w-4 text-[#155eef]" />
                            Config
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <p className="text-xs text-text-secondary">
                            Posledne ulozenie: {formatDateTime(selectedDevice.last_config_at)}
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void handleRequestSnapshot("config")}
                            disabled={activeCommand === "config-request"}
                          >
                            {activeCommand === "config-request"
                              ? "Posielam..."
                              : "Vyziadat config"}
                          </Button>
                        </CardContent>
                      </Card>
                    </div>

                    <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                      <div className="space-y-4">
                        <Card className="border border-[#e6edf9] bg-[#fbfdff]">
                          <CardHeader>
                            <CardTitle className="text-sm text-[#13213f]">
                              Health payload
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <pre className="max-h-72 overflow-auto rounded-2xl bg-[#0f172a] p-4 text-xs leading-5 text-[#dbeafe]">
                              {formatJson(selectedDevice.health_payload)}
                            </pre>
                          </CardContent>
                        </Card>

                        <Card className="border border-[#e6edf9] bg-[#fbfdff]">
                          <CardHeader>
                            <CardTitle className="text-sm text-[#13213f]">
                              Metrics payload
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <pre className="max-h-72 overflow-auto rounded-2xl bg-[#0f172a] p-4 text-xs leading-5 text-[#dbeafe]">
                              {formatJson(selectedDevice.metrics_payload)}
                            </pre>
                          </CardContent>
                        </Card>
                      </div>

                      <Card className="border border-[#dbe7ff] bg-[#f9fbff]">
                        <CardHeader>
                          <CardTitle className="text-sm text-[#13213f]">
                            Config editor
                          </CardTitle>
                          <CardDescription>
                            Viete si vypytat full config alebo konkretnu sekciu a potom ju rovno poslat spat na zariadenie.
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="grid gap-3 md:grid-cols-[180px_minmax(0,1fr)]">
                            <div className="space-y-1.5">
                              <Label>Rozsah configu</Label>
                              <Select
                                value={configScope}
                                onValueChange={(value) => {
                                  const scope = value as ConfigScope;
                                  setConfigScope(scope);
                                  setConfigEditor(
                                    getConfigEditorValue(selectedDevice, scope),
                                  );
                                }}
                              >
                                <SelectTrigger className="bg-white">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="full">full config</SelectItem>
                                  {CONFIG_SECTIONS.map((section) => (
                                    <SelectItem key={section} value={section}>
                                      {section}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="flex items-end">
                              <p className="text-xs leading-5 text-text-secondary">
                                Pri sekcii backend publikuje topic
                                {" "}
                                <code>
                                  config/set/
                                  {configScope === "full" ? "..." : configScope}
                                </code>
                                .
                              </p>
                            </div>
                          </div>

                          <textarea
                            value={configEditor}
                            onChange={(event) => setConfigEditor(event.target.value)}
                            className="min-h-[420px] w-full rounded-2xl border border-[#dbe4f5] bg-[#0f172a] p-4 font-mono text-xs leading-5 text-[#dbeafe] outline-none transition focus:border-[#84adff] focus:ring-3 focus:ring-[#84adff]/25"
                            spellCheck={false}
                          />

                          <div className="flex flex-wrap items-center gap-2">
                            <Button
                              onClick={() => void handlePublishConfig()}
                              disabled={isPublishingConfig}
                            >
                              {isPublishingConfig
                                ? "Odosielam..."
                                : "Publikovat config"}
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() =>
                                setConfigEditor(
                                  getConfigEditorValue(selectedDevice, configScope),
                                )
                              }
                            >
                              Reset z DB
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
