import { apiFetch, getToken } from "./client";

const API_URL = import.meta.env.VITE_API_URL as string;

export const SUPPORTED_BOARDS = ["esp8266", "esp32"] as const;
export type SupportedBoard = (typeof SUPPORTED_BOARDS)[number];

export interface OtaFirmware {
  id: number;
  version: string;
  board: string;
  filename: string;
  md5: string;
  size_bytes: number;
  uploaded_at: string;
  uploaded_by_id: number | null;
}

export interface OtaDeployResponse {
  detail: string;
  firmware_id: number;
  device_id: string;
  server_url: string;
}

export function listFirmwares(): Promise<OtaFirmware[]> {
  return apiFetch<OtaFirmware[]>("/hardware/ota/firmware");
}

export async function uploadFirmware(
  file: File,
  version: string,
  board: SupportedBoard,
): Promise<OtaFirmware> {
  const params = new URLSearchParams({ version, board });
  const formData = new FormData();
  formData.append("file", file);

  // apiFetch sets JSON content-type by default — use raw fetch for multipart
  const headers: HeadersInit = {};
  const token = getToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(
    `${API_URL}/hardware/ota/firmware?${params.toString()}`,
    {
      method: "POST",
      headers,
      body: formData,
    },
  );

  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    throw new Error(text || `HTTP ${response.status}`);
  }

  return response.json() as Promise<OtaFirmware>;
}

export function deleteFirmware(firmwareId: number): Promise<void> {
  return apiFetch<void>(`/hardware/ota/firmware/${firmwareId}`, {
    method: "DELETE",
  });
}

export function deployFirmware(
  firmwareId: number,
  deviceId: string,
): Promise<OtaDeployResponse> {
  return apiFetch<OtaDeployResponse>(
    `/hardware/ota/firmware/${firmwareId}/deploy/${deviceId}`,
    { method: "POST" },
  );
}

export interface OtaStatusResponse {
  state: "completed" | "error" | "progress";
  payload: string;
  timestamp: string;
  progress?: number;
}

export function getOtaStatus(deviceId: string): Promise<OtaStatusResponse> {
  return apiFetch<OtaStatusResponse>(`/hardware/ota/status/${deviceId}`);
}
