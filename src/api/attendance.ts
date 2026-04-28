import type { components } from "./schema";
import { apiFetch, getToken } from "./client";

type AttendanceResponse = components["schemas"]["AttendanceResponse"];
type AttendanceUpdateResponse =
  components["schemas"]["AttendanceUpdateResponse"];
type AttendanceMoveResponse = components["schemas"]["AttendanceMoveResponse"];
type LessonResponse = components["schemas"]["LessonResponse"];
type OverviewResponse = components["schemas"]["OverviewResponse"];

const API_URL = import.meta.env.VITE_API_URL as string;

export function fetchLessonAttendance(
  lessonId: number,
): Promise<AttendanceResponse> {
  return apiFetch<AttendanceResponse>(`/lessons/${lessonId}/attendance`);
}

export function updateAttendanceStatus(
  attendanceId: number,
  status: string,
): Promise<AttendanceUpdateResponse> {
  return apiFetch<AttendanceUpdateResponse>(`/attendance/${attendanceId}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export function moveAttendance(
  attendanceId: number,
  targetLessonId: number,
): Promise<AttendanceMoveResponse> {
  return apiFetch<AttendanceMoveResponse>(`/attendance/${attendanceId}/move`, {
    method: "POST",
    body: JSON.stringify({ target_lesson_id: targetLessonId }),
  });
}

export function deleteEnrollment(
  subjectId: number,
  enrollmentId: number,
): Promise<void> {
  return apiFetch<void>(`/subjects/${subjectId}/students/${enrollmentId}`, {
    method: "DELETE",
  });
}

export function fetchScheduleEntryLessons(
  semesterId: number,
  entryId: number,
): Promise<LessonResponse[]> {
  return apiFetch<LessonResponse[]>(
    `/semesters/${semesterId}/schedule/${entryId}/lessons`,
  );
}

export function fetchScheduleEntryOverview(
  subjectId: number,
  entryId: number,
  semesterId: number,
): Promise<OverviewResponse> {
  return apiFetch<OverviewResponse>(
    `/subjects/${subjectId}/schedule-entries/${entryId}/overview?semester_id=${semesterId}`,
  );
}

export async function downloadStudentsExport(
  subjectId: number,
  format: string = "csv",
): Promise<void> {
  const token = getToken();
  const headers: HeadersInit = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(
    `${API_URL}/subjects/${subjectId}/export/students?format=${format}`,
    { headers },
  );

  if (!response.ok) {
    throw new Error(`Export failed: HTTP ${response.status}`);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);

  const disposition = response.headers.get("Content-Disposition");
  let filename = `students.${format}`;
  if (disposition) {
    const match = disposition.match(/filename="?([^";\n]+)"?/);
    if (match) {
      filename = match[1];
    }
  }

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function downloadAttendanceExport(
  subjectId: number,
  semesterId: number,
  format: string = "csv",
): Promise<void> {
  const token = getToken();
  const headers: HeadersInit = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(
    `${API_URL}/subjects/${subjectId}/export/attendance?semester_id=${semesterId}&format=${format}`,
    { headers },
  );

  if (!response.ok) {
    throw new Error(`Export failed: HTTP ${response.status}`);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);

  const disposition = response.headers.get("Content-Disposition");
  let filename = `attendance.${format}`;
  if (disposition) {
    const match = disposition.match(/filename="?([^";\n]+)"?/);
    if (match) {
      filename = match[1];
    }
  }

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
