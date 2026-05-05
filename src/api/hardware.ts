import { apiFetch } from "./client";

export interface HardwareDeviceSummary {
  id: number;
  device_id: string;
  base_topic: string;
  teacher_id: number | null;
  teacher_name: string | null;
  claimed_at: string | null;
  is_claimed: boolean;
  location_id: string | null;
  firmware: string | null;
  health_state: string | null;
  last_seen_at: string | null;
  last_attendance_at: string | null;
  last_health_at: string | null;
  last_metrics_at: string | null;
  last_config_at: string | null;
}

export interface HardwareDeviceDetail extends HardwareDeviceSummary {
  health_payload: Record<string, unknown> | null;
  metrics_payload: Record<string, unknown> | null;
  config_payload: Record<string, unknown> | null;
}

export interface HardwareSnapshot {
  device_id: string;
  received_at: string | null;
  payload: Record<string, unknown> | null;
}

export interface HardwareCommandResponse {
  detail: string;
  topic: string;
}

export interface PairingSessionResponse {
  device_id: string;
  teacher_id: number;
  teacher_isic_identifier: string;
  status: "pending" | "completed" | "expired" | "cancelled" | string;
  started_at: string;
  expires_at: string;
  completed_at: string | null;
}

export const CONFIG_SECTIONS = [
  "wifi",
  "mqtt",
  "device",
  "pn532",
  "attendance",
  "feedback",
  "health",
  "ota",
  "power",
] as const;

export type ConfigSection = (typeof CONFIG_SECTIONS)[number];

export function fetchMyDevices(): Promise<HardwareDeviceSummary[]> {
  return apiFetch<HardwareDeviceSummary[]>("/hardware/devices");
}

export function fetchUnclaimedDevices(
  activeWithinMinutes: number = 10,
): Promise<HardwareDeviceSummary[]> {
  return apiFetch<HardwareDeviceSummary[]>(
    `/hardware/devices/unclaimed?active_within_minutes=${activeWithinMinutes}`,
  );
}

export function fetchDeviceDetail(
  deviceId: string,
): Promise<HardwareDeviceDetail> {
  return apiFetch<HardwareDeviceDetail>(`/hardware/devices/${deviceId}`);
}

export function fetchDeviceHealth(
  deviceId: string,
): Promise<HardwareSnapshot> {
  return apiFetch<HardwareSnapshot>(`/hardware/devices/${deviceId}/health`);
}

export function fetchDeviceMetrics(
  deviceId: string,
): Promise<HardwareSnapshot> {
  return apiFetch<HardwareSnapshot>(`/hardware/devices/${deviceId}/metrics`);
}

export function fetchDeviceConfig(
  deviceId: string,
): Promise<HardwareSnapshot> {
  return apiFetch<HardwareSnapshot>(`/hardware/devices/${deviceId}/config`);
}

export function requestDeviceHealth(
  deviceId: string,
): Promise<HardwareCommandResponse> {
  return apiFetch<HardwareCommandResponse>(
    `/hardware/devices/${deviceId}/health/request`,
    { method: "POST" },
  );
}

export function requestDeviceMetrics(
  deviceId: string,
): Promise<HardwareCommandResponse> {
  return apiFetch<HardwareCommandResponse>(
    `/hardware/devices/${deviceId}/metrics/request`,
    { method: "POST" },
  );
}

export function requestDeviceConfig(
  deviceId: string,
  section?: ConfigSection,
): Promise<HardwareCommandResponse> {
  const query = section ? `?section=${section}` : "";
  return apiFetch<HardwareCommandResponse>(
    `/hardware/devices/${deviceId}/config/request${query}`,
    { method: "POST" },
  );
}

export function publishDeviceConfig(
  deviceId: string,
  payload: Record<string, unknown>,
): Promise<HardwareCommandResponse> {
  return apiFetch<HardwareCommandResponse>(`/hardware/devices/${deviceId}/config`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function publishDeviceConfigSection(
  deviceId: string,
  section: ConfigSection,
  payload: Record<string, unknown>,
): Promise<HardwareCommandResponse> {
  return apiFetch<HardwareCommandResponse>(
    `/hardware/devices/${deviceId}/config/${section}`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    },
  );
}

export function startDevicePairing(
  deviceId: string,
): Promise<PairingSessionResponse> {
  return apiFetch<PairingSessionResponse>(
    `/hardware/devices/${deviceId}/pairing/start`,
    { method: "POST" },
  );
}

export function fetchDevicePairing(
  deviceId: string,
): Promise<PairingSessionResponse | null> {
  return apiFetch<PairingSessionResponse | null>(
    `/hardware/devices/${deviceId}/pairing`,
  );
}

export function releaseDeviceClaim(
  deviceId: string,
): Promise<HardwareDeviceDetail> {
  return apiFetch<HardwareDeviceDetail>(`/hardware/devices/${deviceId}/claim`, {
    method: "DELETE",
  });
}
