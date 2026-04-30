import type { components } from "./schema";
import { apiFetch } from "./client";

type SemesterResponse = components["schemas"]["SemesterResponse"];
type SemesterCreate = components["schemas"]["SemesterCreate"];
type ScheduleEntryResponse = components["schemas"]["ScheduleEntryResponse"];
type ScheduleEntryCreate = components["schemas"]["ScheduleEntryCreate"];
type ScheduleEntryUpdate = components["schemas"]["ScheduleEntryUpdate"];
type WeekResponse = components["schemas"]["WeekResponse"];
type WeekLessonResponse = components["schemas"]["WeekLessonResponse"];
type SubjectResponse = components["schemas"]["SubjectResponse"];
type SubjectCreate = components["schemas"]["SubjectCreate"];

export function fetchSemesters(): Promise<SemesterResponse[]> {
  return apiFetch<SemesterResponse[]>("/semesters");
}

export function createSemester(data: SemesterCreate): Promise<SemesterResponse> {
  return apiFetch<SemesterResponse>("/semesters", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function fetchSchedule(
  semesterId: number,
): Promise<ScheduleEntryResponse[]> {
  return apiFetch<ScheduleEntryResponse[]>(
    `/semesters/${semesterId}/schedule`,
  );
}

export function createScheduleEntry(
  semesterId: number,
  data: ScheduleEntryCreate,
): Promise<ScheduleEntryResponse> {
  return apiFetch<ScheduleEntryResponse>(
    `/semesters/${semesterId}/schedule`,
    {
      method: "POST",
      body: JSON.stringify(data),
    },
  );
}

export function updateScheduleEntry(
  semesterId: number,
  entryId: number,
  data: ScheduleEntryUpdate,
): Promise<ScheduleEntryResponse> {
  return apiFetch<ScheduleEntryResponse>(
    `/semesters/${semesterId}/schedule/${entryId}`,
    {
      method: "PUT",
      body: JSON.stringify(data),
    },
  );
}

export function fetchWeeks(semesterId: number): Promise<WeekResponse[]> {
  return apiFetch<WeekResponse[]>(`/semesters/${semesterId}/weeks`);
}

export function updateWeekNote(
  semesterId: number,
  weekNumber: number,
  note: string,
): Promise<WeekResponse> {
  return apiFetch<WeekResponse>(
    `/semesters/${semesterId}/weeks/${weekNumber}`,
    {
      method: "PATCH",
      body: JSON.stringify({ note }),
    },
  );
}

export function fetchWeekLessons(
  semesterId: number,
  weekNumber: number,
): Promise<WeekLessonResponse[]> {
  return apiFetch<WeekLessonResponse[]>(
    `/semesters/${semesterId}/week/${weekNumber}/lessons`,
  );
}

export function fetchSubjects(): Promise<SubjectResponse[]> {
  return apiFetch<SubjectResponse[]>("/subjects");
}

export function createSubject(data: SubjectCreate): Promise<SubjectResponse> {
  return apiFetch<SubjectResponse>("/subjects", {
    method: "POST",
    body: JSON.stringify(data),
  });
}
