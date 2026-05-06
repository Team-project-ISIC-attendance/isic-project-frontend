import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Users,
  Wifi,
} from "lucide-react";
import {
  CONFIG_SECTIONS,
  claimDevice,
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
} from "@/api/hardware";
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
type PendingPairing = {
  deviceId: string;
  expiresAt: string;
};

const EMPTY_CONFIG_EDITOR = "{\n  \n}";
const DEFAULT_PAIRING_TIMEOUT_MS = 120_000;
const PAIRING_POLL_INTERVAL_MS = 1_000;
const DEVICE_POLL_INTERVAL_MS = 5_000;

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

function connectivityVariant(
  isOnline: boolean,
): "default" | "destructive" {
  return isOnline ? "default" : "destructive";
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

function getOfflineNotice(device: HardwareDeviceDetail | null): string {
  if (!device) {
    return "Zariadenie je offline. Pockajte na novu komunikaciu a skuste to znova.";
  }

  return `Zariadenie ${device.device_id} je offline. Pockajte na novu komunikaciu a skuste to znova.`;
}

export function DevicesPage() {
  const { user, logout } = useAuth();
  const isAdmin = user?.role === "admin";
  const isTeacher = user?.role === "teacher";

  const [devices, setDevices] = useState<HardwareDeviceSummary[]>([]);
  const [unclaimedDevices, setUnclaimedDevices] = useState<
    HardwareDeviceSummary[]
  >([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [selectedDevice, setSelectedDevice] =
    useState<HardwareDeviceDetail | null>(null);
  const [adminDeviceFilter, setAdminDeviceFilter] = useState<
    "all" | "online" | "offline"
  >("all");
  const [configScope, setConfigScope] = useState<ConfigScope>("full");
  const [configEditor, setConfigEditor] = useState(EMPTY_CONFIG_EDITOR);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPublishingConfig, setIsPublishingConfig] = useState(false);
  const [activeCommand, setActiveCommand] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingPairing, setPendingPairing] = useState<PendingPairing | null>(
    null,
  );
  const isBackgroundPollingRef = useRef(false);

  const claimedDevices = useMemo(
    () => devices.filter((device) => device.is_claimed),
    [devices],
  );
  const adminDevices = useMemo(
    () =>
      [...devices].sort((left, right) => {
        if (left.is_online !== right.is_online) {
          return Number(right.is_online) - Number(left.is_online);
        }
        if (left.is_claimed !== right.is_claimed) {
          return Number(left.is_claimed) - Number(right.is_claimed);
        }
        return (right.last_seen_at ?? "").localeCompare(left.last_seen_at ?? "");
      }),
    [devices],
  );
  const visibleAdminDevices = useMemo(
    () =>
      adminDeviceFilter === "all"
        ? adminDevices
        : adminDevices.filter((device) =>
            adminDeviceFilter === "online"
              ? device.is_online
              : !device.is_online,
          ),
    [adminDeviceFilter, adminDevices],
  );
  const visibleSidebarDevices = isAdmin ? visibleAdminDevices : claimedDevices;
  const selectedUnclaimedDevice = useMemo(
    () =>
      unclaimedDevices.find((device) => device.device_id === selectedDeviceId) ??
      null,
    [selectedDeviceId, unclaimedDevices],
  );
  const hasUnsavedConfigChanges = useMemo(
    () =>
      isAdmin &&
      selectedDevice !== null &&
      configEditor !== getConfigEditorValue(selectedDevice, configScope),
    [configEditor, configScope, isAdmin, selectedDevice],
  );

  const loadDeviceLists = useCallback(async (deviceIdToKeep?: string | null) => {
    const [allVisibleDevices, unclaimed] = await Promise.all([
      fetchMyDevices(),
      fetchUnclaimedDevices(),
    ]);

    setDevices(allVisibleDevices);
    setUnclaimedDevices(unclaimed);

    const hasClaimedDevice =
      deviceIdToKeep != null &&
      allVisibleDevices.some((device) => device.device_id === deviceIdToKeep);
    const hasUnclaimedDevice =
      deviceIdToKeep != null &&
      unclaimed.some((device) => device.device_id === deviceIdToKeep);
    const nextSelectedId =
      hasClaimedDevice || hasUnclaimedDevice
        ? deviceIdToKeep
        : allVisibleDevices[0]?.device_id ?? unclaimed[0]?.device_id ?? null;
    setSelectedDeviceId(nextSelectedId);
    return {
      canLoadDetail: hasClaimedDevice,
      nextSelectedId,
    };
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
      const { nextSelectedId, canLoadDetail } =
        await loadDeviceLists(deviceIdToKeep);
      if (nextSelectedId && canLoadDetail) {
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
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    async function poll() {
      if (cancelled || isBackgroundPollingRef.current) {
        return;
      }

      isBackgroundPollingRef.current = true;
      try {
        const { nextSelectedId, canLoadDetail } = await loadDeviceLists(
          selectedDeviceId,
        );
        if (cancelled) {
          return;
        }

        if (!nextSelectedId || !canLoadDetail) {
          setSelectedDevice(null);
          setConfigEditor(EMPTY_CONFIG_EDITOR);
          return;
        }

        if (activeCommand !== null || isPublishingConfig || hasUnsavedConfigChanges) {
          return;
        }

        await loadSelectedDevice(nextSelectedId, configScope);
      } catch {
        // Ignore background polling failures and keep manual actions responsive.
      } finally {
        isBackgroundPollingRef.current = false;
      }
    }

    const intervalMs =
      pendingPairing !== null ? PAIRING_POLL_INTERVAL_MS : DEVICE_POLL_INTERVAL_MS;

    void poll();
    intervalId = setInterval(() => {
      void poll();
    }, intervalMs);

    return () => {
      cancelled = true;
      if (intervalId !== null) {
        clearInterval(intervalId);
      }
    };
  }, [
    activeCommand,
    configScope,
    hasUnsavedConfigChanges,
    isPublishingConfig,
    loadDeviceLists,
    loadSelectedDevice,
    pendingPairing,
    selectedDeviceId,
  ]);

  useEffect(() => {
    if (pendingPairing === null) {
      return;
    }

    const pairingSession = pendingPairing;
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    async function pollPairing() {
      const parsedDeadline = new Date(pairingSession.expiresAt).getTime();
      const deadline = Number.isFinite(parsedDeadline)
        ? parsedDeadline
        : Date.now() + DEFAULT_PAIRING_TIMEOUT_MS;

      if (Date.now() > deadline) {
        setPendingPairing(null);
        await loadPage(pairingSession.deviceId);
        if (!cancelled) {
          setNotice(
            `Pairing pre ${pairingSession.deviceId} sa nepotvrdil v casovom limite. Zariadenie zostava nepriradene.`,
          );
        }
        return;
      }

      try {
        const pairing = await fetchDevicePairing(pairingSession.deviceId);
        if (cancelled) {
          return;
        }

        if (pairing?.status === "completed") {
          setPendingPairing(null);
          await loadPage(pairingSession.deviceId);
          if (!cancelled) {
            setNotice(
              `Zariadenie ${pairingSession.deviceId} bolo uspesne priradene a presunute do vasich zariadeni.`,
            );
          }
          return;
        }

        if (pairing?.status === "cancelled") {
          setPendingPairing(null);
          await loadPage(pairingSession.deviceId);
          if (!cancelled) {
            setNotice(
              `Pairing pre ${pairingSession.deviceId} bol zruseny. Obnovte zoznam a skuste to znova.`,
            );
          }
          return;
        }

        if (pairing != null && pairing.status !== "pending") {
          setPendingPairing(null);
          await loadPage(pairingSession.deviceId);
          if (!cancelled) {
            setNotice(
              `Pairing pre ${pairingSession.deviceId} sa nepotvrdil v casovom limite. Zariadenie zostava nepriradene.`,
            );
          }
          return;
        }
      } catch {
        if (cancelled) {
          return;
        }
      }

      timeoutId = window.setTimeout(() => {
        void pollPairing();
      }, PAIRING_POLL_INTERVAL_MS);
    }

    void pollPairing();

    return () => {
      cancelled = true;
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
    };
  }, [loadPage, pendingPairing]);

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

  async function handleStartPairing(deviceId: string) {
    setError(null);
    setNotice(null);
    setActiveCommand(`pair-${deviceId}`);

    try {
      const pairing = await startDevicePairing(deviceId);
      setPendingPairing({
        deviceId,
        expiresAt: pairing.expires_at,
      });
      setNotice(
        `Pairing pre ${deviceId} bezi. Naskenujte teacher ISIC na zariadeni a pockajte na potvrdenie.`,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Nepodarilo sa spustit pairing zariadenia",
      );
    } finally {
      setActiveCommand(null);
    }
  }

  async function handleClaimDevice(deviceId: string) {
    setError(null);
    setNotice(null);
    setActiveCommand(`claim-${deviceId}`);

    try {
      await claimDevice(deviceId);
      setPendingPairing(null);
      await loadPage(deviceId);
      setNotice(
        `Zariadenie ${deviceId} bolo priradene priamo cez web a presunute do vasich zariadeni.`,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Nepodarilo sa priradit zariadenie",
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
    if (!selectedDevice?.is_online) {
      setError(null);
      setNotice(getOfflineNotice(selectedDevice));
      return;
    }

    setError(null);
    setNotice(null);
    setActiveCommand(`${kind}-request`);

    try {
      const previousTimestamp = selectedDevice
        ? getSnapshotTimestamp(selectedDevice, kind)
        : null;

      if (kind === "health") {
        await requestDeviceHealth(selectedDeviceId);
      } else if (kind === "metrics") {
        await requestDeviceMetrics(selectedDeviceId);
      } else {
        if (configScope === "full") {
          await requestDeviceConfig(selectedDeviceId);
        } else {
          await requestDeviceConfig(selectedDeviceId, configScope);
        }
      }

      const updated = await waitForDeviceUpdate(
        selectedDeviceId,
        kind,
        previousTimestamp,
        kind === "config" ? configScope : "full",
      );

      setNotice(
        updated
          ? "Zariadenie odpovedalo a data boli aktualizovane."
          : "Poziadavka bola odoslana. Caka sa na novu odpoved zariadenia.",
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
    if (!selectedDevice?.is_online) {
      setError(null);
      setNotice(getOfflineNotice(selectedDevice));
      return;
    }

    setError(null);
    setNotice(null);
    setIsPublishingConfig(true);

    try {
      const parsed = JSON.parse(configEditor) as Record<string, unknown>;
      if (configScope === "full") {
        await publishDeviceConfig(selectedDeviceId, parsed);
      } else {
        await publishDeviceConfigSection(
          selectedDeviceId,
          configScope,
          parsed,
        );
      }
      await loadSelectedDevice(selectedDeviceId, configScope);
      setNotice(
        "Config bol odoslany na zariadenie. Ak chcete potvrdit aktualny stav, nacitajte config znova.",
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

  const deviceListTitle = isAdmin ? "Inventar zariadeni" : "Moje zariadenia";
  const deviceListDescription = isAdmin
    ? "Admin vidi jeden spolocny zoznam zariadeni. Priradene aj nepriradene citacky su spolu, bez dalsieho rozdelenia."
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
                {isAdmin ? "Admin console" : "Hardware"}
              </Badge>
              <h1 className="font-heading text-3xl font-medium text-[#13213f]">
                {isAdmin ? "Hardware konzola" : "Teacher hardware"}
              </h1>
              <p className="max-w-3xl text-sm leading-6 text-[#52607a]">
                {isAdmin
                  ? "Admin tu riesi live hardware diagnostiku. Teacheri sa spravuju v admin paneli, tu zostava jeden spolocny inventar zariadeni a detail ich stavu."
                  : "Teacher si vie pairing spustit vo webe alebo iba naskenovat svoj teacher ISIC na zariadeni. Po uspesnom pairingu tu vidi health a metrics data svojich zariadeni."}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {!isAdmin && (
                <Link
                  to="/"
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                >
                  <ArrowLeft className="mr-1 h-4 w-4" />
                  Spat na rozvrh
                </Link>
              )}
              {isAdmin && (
                <Link
                  to="/admin"
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                >
                  <Users className="mr-1 h-4 w-4" />
                  Sprava teacherov
                </Link>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
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

          <div className="grid gap-4 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            {isAdmin ? (
              <div className="grid gap-4 md:col-span-2 md:grid-cols-3">
                <Card className="border border-[#dbe7ff] bg-[#f9fbff]">
                  <CardContent className="space-y-1 pt-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-[#7182a3]">
                      Zariadenia
                    </p>
                    <p className="text-3xl font-medium text-[#13213f]">
                      {devices.length}
                    </p>
                    <p className="text-sm text-[#52607a]">
                      Vsetky citacky v jednom inventari
                    </p>
                  </CardContent>
                </Card>

                <Card className="border border-[#dbe7ff] bg-[#f9fbff]">
                  <CardContent className="space-y-1 pt-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-[#7182a3]">
                      Online
                    </p>
                    <p className="text-3xl font-medium text-[#13213f]">
                      {devices.filter((device) => device.is_online).length}
                    </p>
                    <p className="text-sm text-[#52607a]">
                      Zariadenia v aktivnom timeout okne
                    </p>
                  </CardContent>
                </Card>

                <Card className="border border-[#eadfff] bg-[linear-gradient(135deg,#ffffff_0%,#f6f0ff_100%)]">
                  <CardContent className="space-y-1 pt-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-[#7182a3]">
                      Offline
                    </p>
                    <p className="text-3xl font-medium text-[#13213f]">
                      {devices.filter((device) => !device.is_online).length}
                    </p>
                    <p className="text-sm text-[#574f6b]">
                      Potrebuju novy ping alebo novu MQTT spravu
                    </p>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <>
                <Card className="border border-[#dbe7ff] bg-[#f9fbff]">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-[#13213f]">
                      <ShieldCheck className="h-4 w-4 text-[#155eef]" />
                      Teacher ISIC
                    </CardTitle>
                    <CardDescription>
                      Naskenovanie tohto ISIC na citacke zariadenie okamzite priradi tomuto teacherovi aj bez predchadzajuceho kliknutia v UI.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-1.5">
                      <Label>Aktivny ISIC</Label>
                      <div className="rounded-2xl border border-[#dbe4f5] bg-white px-4 py-3 text-sm font-medium text-[#13213f]">
                        {user?.isic_identifier ?? "ISIC nie je nastaveny"}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
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
                      Pair cez web alebo scan
                    </CardTitle>
                    <CardDescription>
                      Zariadenie mozete priradit spustenim pairingu vo webe a naslednym teacher scanom, alebo iba priamym teacher scanom na citacke.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm leading-6 text-[#574f6b]">
                    <p>Jeden teacher moze mat priradenych viac zariadeni.</p>
                    <p>Vo webe viete zariadenie priradit aj priamo bez scanovania ISIC.</p>
                    <p>Teacher scan vzdy vyhra a prepise aj predchadzajuce priradenie zariadenia.</p>
                    <p>Po uspesnom pairingu sa zariadenie objavi v zozname vlavo.</p>
                    <p>Teacher tu potom vidi health a metrics data svojich zariadeni.</p>
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
                {isAdmin && (
                  <div className="pt-2">
                    <Select
                      value={adminDeviceFilter}
                      onValueChange={(value) =>
                        setAdminDeviceFilter(
                          value as "all" | "online" | "offline",
                        )
                      }
                    >
                      <SelectTrigger className="w-40 bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Vsetky</SelectItem>
                        <SelectItem value="online">Online</SelectItem>
                        <SelectItem value="offline">Offline</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                {visibleSidebarDevices.length === 0 && (
                  <p className="text-sm text-text-secondary">
                    {devices.length === 0
                      ? isAdmin
                        ? "Backend este neeviduje ziadne zariadenie."
                        : "Zatial nemate claimnute ziadne zariadenie."
                      : "Tomuto filtru nezodpoveda ziadne zariadenie."}
                  </p>
                )}

                {visibleSidebarDevices.map((device) => (
                  <button
                    key={device.device_id}
                    type="button"
                    onClick={() => void handleSelectDevice(device.device_id, true)}
                    className={`w-full rounded-2xl border p-4 text-left transition ${
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
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <Badge variant={connectivityVariant(device.is_online)}>
                          {device.connectivity_state}
                        </Badge>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-text-secondary">
                      <span>
                        Health: {device.health_state ?? "unknown"}
                      </span>
                      <span>
                        Last seen: {formatDateTime(device.last_seen_at)}
                      </span>
                    </div>
                    {isAdmin && (
                      <div className="mt-3 flex items-center justify-between gap-2 text-xs text-text-secondary">
                        <span>Teacher: {device.teacher_name ?? "nikto"}</span>
                        <span>
                          {device.is_claimed ? "Priradene" : "Nepriradene"}
                        </span>
                      </div>
                    )}
                  </button>
                ))}
              </CardContent>
            </Card>

            {!isAdmin && (
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
                    return (
                      <button
                        key={device.device_id}
                        type="button"
                        onClick={() =>
                          void handleSelectDevice(device.device_id, false)
                        }
                        className="w-full rounded-2xl border border-[#e6edf9] bg-[#fbfdff] p-4 text-left transition hover:border-[#bfd3ff] hover:bg-[#f5f9ff]"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-medium text-[#13213f]">
                              {device.device_id}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={connectivityVariant(device.is_online)}>
                              {device.connectivity_state}
                            </Badge>
                            <Badge variant="outline">nepriradene</Badge>
                          </div>
                        </div>

                        <div className="mt-3 flex items-center justify-between gap-2 text-xs text-text-secondary">
                          <span>
                            Naposledy videne: {formatDateTime(device.last_seen_at)}
                          </span>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              onClick={(event) => {
                                event.stopPropagation();
                                void handleClaimDevice(device.device_id);
                              }}
                              disabled={
                                activeCommand === `claim-${device.device_id}` ||
                                activeCommand === `pair-${device.device_id}`
                              }
                            >
                              {activeCommand === `claim-${device.device_id}`
                                ? "Priradzujem..."
                                : "Pair"}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(event) => {
                                event.stopPropagation();
                                void handleStartPairing(device.device_id);
                              }}
                              disabled={
                                activeCommand === `claim-${device.device_id}` ||
                                activeCommand === `pair-${device.device_id}` ||
                                pendingPairing?.deviceId === device.device_id ||
                                !user?.isic_identifier ||
                                !device.is_online
                              }
                            >
                              {activeCommand === `pair-${device.device_id}` ||
                              pendingPairing?.deviceId === device.device_id
                                ? "Cakam na scan..."
                                : "Pair cez scan"}
                            </Button>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </CardContent>
              </Card>
            )}
          </div>

          <div>
            <Card className="border border-[#dbe4f5] bg-white">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-[#13213f]">
                  <Settings2 className="h-4 w-4 text-[#155eef]" />
                  Detail zariadenia
                </CardTitle>
                <CardDescription>
                  {isAdmin
                    ? "Vybrane zariadenie mozete otestovat cez live requesty aj config publish."
                    : "Claimnute zariadenie mozete skontrolovat cez live requesty pre health a metrics."}
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
                {!selectedDevice && selectedUnclaimedDevice && isTeacher && (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-[#e6edf9] bg-[#fbfdff] p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className="text-xs uppercase tracking-[0.2em] text-[#7182a3]">
                            Nepriradene zariadenie
                          </p>
                          <p className="text-lg font-medium text-[#13213f]">
                            {selectedUnclaimedDevice.device_id}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge
                            variant={connectivityVariant(selectedUnclaimedDevice.is_online)}
                          >
                            {selectedUnclaimedDevice.connectivity_state}
                          </Badge>
                          <Badge variant="outline">nepriradene</Badge>
                        </div>
                      </div>

                      <div className="mt-4 space-y-2 text-sm leading-6 text-[#52607a]">
                        <p>
                          Po uspesnom pairingu sa zariadenie presunie do vasich
                          zariadeni a zobrazi sa tu.
                        </p>
                        <p>
                          Ak teacher nema ISIC, zariadenie viete priradit hned
                          priamo cez web bez scanovania.
                        </p>
                        <p>
                          Frontend caka iba na potvrdenie z backendu v ramci
                          timeoutu. Ak potvrdenie nepride, zariadenie ostava iba
                          online alebo offline, bez dalsieho specialneho stavu.
                        </p>
                        <p>
                          Naposledy videne:{" "}
                          {formatDateTime(selectedUnclaimedDevice.last_seen_at)}
                        </p>
                      </div>

                      {!selectedUnclaimedDevice.is_online && (
                        <div className="mt-4 rounded-2xl border border-[#f5b7b7] bg-[#fff8e8] px-4 py-3 text-sm text-[#8a5b00]">
                          Zariadenie je offline. Pairing je docasne vypnuty, kym
                          sa znova neozve.
                        </div>
                      )}

                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <Button
                          onClick={() =>
                            void handleClaimDevice(selectedUnclaimedDevice.device_id)
                          }
                          disabled={
                            activeCommand ===
                              `claim-${selectedUnclaimedDevice.device_id}` ||
                            activeCommand ===
                              `pair-${selectedUnclaimedDevice.device_id}`
                          }
                        >
                          {activeCommand ===
                          `claim-${selectedUnclaimedDevice.device_id}`
                            ? "Priradzujem..."
                            : "Pair"}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() =>
                            void handleStartPairing(selectedUnclaimedDevice.device_id)
                          }
                          disabled={
                            activeCommand ===
                              `claim-${selectedUnclaimedDevice.device_id}` ||
                            activeCommand ===
                              `pair-${selectedUnclaimedDevice.device_id}` ||
                            pendingPairing?.deviceId ===
                              selectedUnclaimedDevice.device_id ||
                            !user?.isic_identifier ||
                            !selectedUnclaimedDevice.is_online
                          }
                        >
                          {activeCommand ===
                            `pair-${selectedUnclaimedDevice.device_id}` ||
                          pendingPairing?.deviceId ===
                            selectedUnclaimedDevice.device_id
                            ? "Cakam na scan..."
                            : "Pair cez scan"}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {!selectedDevice && !selectedUnclaimedDevice && (
                  <p className="text-sm text-text-secondary">
                    Vyberte zariadenie zo zoznamu vlavo.
                  </p>
                )}

                {selectedDevice && (
                  <>
                    {!selectedDevice.is_online && (
                      <div className="rounded-2xl border border-[#f5b7b7] bg-[#fff8e8] px-4 py-3 text-sm text-[#8a5b00]">
                        {isAdmin
                          ? "Zariadenie je offline. Live requesty aj odoslanie configu su docasne vypnute, kym sa znova neozve."
                          : "Zariadenie je offline. Live requesty su docasne vypnute, kym sa znova neozve."}
                      </div>
                    )}

                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                      <Card size="sm" className="border border-[#e6edf9] bg-[#fbfdff]">
                        <CardContent className="space-y-2 pt-4">
                          <p className="text-xs uppercase tracking-[0.2em] text-[#7182a3]">
                            Device ID
                          </p>
                          <p className="font-medium text-[#13213f]">
                            {selectedDevice.device_id}
                          </p>
                        </CardContent>
                      </Card>
                      <Card size="sm" className="border border-[#e6edf9] bg-[#fbfdff]">
                        <CardContent className="space-y-2 pt-4">
                          <p className="text-xs uppercase tracking-[0.2em] text-[#7182a3]">
                            Status
                          </p>
                          <Badge
                            variant={connectivityVariant(selectedDevice.is_online)}
                          >
                            {selectedDevice.connectivity_state}
                          </Badge>
                          <p className="text-sm text-[#52607a]">
                            Health: {selectedDevice.health_state ?? "unknown"}
                          </p>
                          <p className="text-xs text-text-secondary">
                            {selectedDevice.firmware ?? "bez firmware info"}
                          </p>
                        </CardContent>
                      </Card>
                      <Card size="sm" className="border border-[#e6edf9] bg-[#fbfdff]">
                        <CardContent className="space-y-2 pt-4">
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
                        <CardContent className="space-y-2 pt-4">
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
                        <CardContent className="space-y-2 pt-4">
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

                    <div
                      className={`grid gap-4 ${isAdmin ? "md:grid-cols-3" : "md:grid-cols-2"}`}
                    >
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
                            disabled={
                              activeCommand === "health-request" ||
                              !selectedDevice.is_online
                            }
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
                            disabled={
                              activeCommand === "metrics-request" ||
                              !selectedDevice.is_online
                            }
                          >
                            {activeCommand === "metrics-request"
                              ? "Posielam..."
                              : "Vyziadat metrics"}
                          </Button>
                        </CardContent>
                      </Card>

                      {isAdmin && (
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
                              disabled={
                                activeCommand === "config-request" ||
                                !selectedDevice.is_online
                              }
                            >
                              {activeCommand === "config-request"
                                ? "Posielam..."
                                : "Vyziadat config"}
                            </Button>
                          </CardContent>
                        </Card>
                      )}
                    </div>

                    <div
                      className={`grid gap-4 ${
                        isAdmin
                          ? "xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]"
                          : ""
                      }`}
                    >
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

                      {isAdmin && (
                        <Card className="border border-[#dbe7ff] bg-[#f9fbff]">
                          <CardHeader>
                            <CardTitle className="text-sm text-[#13213f]">
                              Config editor
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div className="grid gap-3 md:grid-cols-[180px_minmax(0,1fr)]">
                              <div className="space-y-1.5">
                                <Label>Rozsah</Label>
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
                                    <SelectItem value="full">Cely config</SelectItem>
                                    {CONFIG_SECTIONS.map((section) => (
                                      <SelectItem key={section} value={section}>
                                        {section}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
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
                                disabled={
                                  isPublishingConfig || !selectedDevice.is_online
                                }
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
                      )}
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
