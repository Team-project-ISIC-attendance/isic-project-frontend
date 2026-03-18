import type { components } from "./schema";
import { getToken } from "./client";

type ImportResult = components["schemas"]["ImportResult"];

const API_URL = import.meta.env.VITE_API_URL as string;

export async function importStudentsCsv(
  subjectId: number,
  file: File,
): Promise<ImportResult> {
  const token = getToken();
  const headers: HeadersInit = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(
    `${API_URL}/subjects/${subjectId}/students/import`,
    {
      method: "POST",
      headers,
      body: formData,
    },
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(errorBody || `Import failed: HTTP ${response.status}`);
  }

  return response.json() as Promise<ImportResult>;
}
