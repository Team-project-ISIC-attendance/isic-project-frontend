import { useCallback, useEffect, useState } from "react";
import type { components } from "@/api/schema";
import {
  fetchSemesters,
  fetchSchedule,
  fetchWeeks,
  fetchWeekLessons,
  fetchSubjects,
  updateWeekNote,
} from "@/api/calendar";
import { CalendarToolbar } from "@/features/calendar/CalendarToolbar";
import { WeekSidebar } from "@/features/calendar/WeekSidebar";
import { CalendarGrid } from "@/features/calendar/CalendarGrid";
import { SemesterFormDialog } from "@/features/calendar/SemesterFormDialog";
import { ScheduleEntryFormDialog } from "@/features/calendar/ScheduleEntryFormDialog";
import { EventPanel } from "@/features/attendance/EventPanel";
import { ImportStudentsModal } from "@/features/import/ImportStudentsModal";

type SemesterResponse = components["schemas"]["SemesterResponse"];
type ScheduleEntryResponse = components["schemas"]["ScheduleEntryResponse"];
type WeekResponse = components["schemas"]["WeekResponse"];
type WeekLessonResponse = components["schemas"]["WeekLessonResponse"];
type SubjectResponse = components["schemas"]["SubjectResponse"];

export function CalendarPage() {
  const [semesters, setSemesters] = useState<SemesterResponse[]>([]);
  const [selectedSemesterId, setSelectedSemesterId] = useState<number | null>(
    null,
  );
  const [schedule, setSchedule] = useState<ScheduleEntryResponse[]>([]);
  const [weeks, setWeeks] = useState<WeekResponse[]>([]);
  const [activeWeek, setActiveWeek] = useState(1);
  const [weekLessons, setWeekLessons] = useState<WeekLessonResponse[]>([]);
  const [subjects, setSubjects] = useState<SubjectResponse[]>([]);
  const [semesterFormOpen, setSemesterFormOpen] = useState(false);
  const [scheduleEntryFormOpen, setScheduleEntryFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedLessonId, setSelectedLessonId] = useState<number | null>(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(
    null,
  );
  const [eventPanelOpen, setEventPanelOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);

  // Build lesson map: schedule_entry_id → lesson_id
  const lessonMap = new Map<number, number>();
  for (const wl of weekLessons) {
    lessonMap.set(wl.schedule_entry_id, wl.lesson_id);
  }

  // Active week display
  const activeWeekData = weeks.find((w) => w.week_number === activeWeek);
  const activeWeekDisplay = activeWeekData
    ? `Týždeň ${activeWeekData.week_number}, ${activeWeekData.date_range}`
    : `Týždeň ${activeWeek}`;

  // Load semester data
  const loadSemesterData = useCallback(
    async (semesterId: number, weekNum: number) => {
      const [scheduleData, weeksData, subjectsData, lessonsData] =
        await Promise.all([
          fetchSchedule(semesterId),
          fetchWeeks(semesterId),
          fetchSubjects(),
          fetchWeekLessons(semesterId, weekNum),
        ]);
      setSchedule(scheduleData);
      setWeeks(weeksData);
      setSubjects(subjectsData);
      setWeekLessons(lessonsData);
    },
    [],
  );

  // Initial load
  useEffect(() => {
    async function init() {
      try {
        const semesterList = await fetchSemesters();
        setSemesters(semesterList);
        if (semesterList.length > 0) {
          const first = semesterList[0];
          setSelectedSemesterId(first.id);
          await loadSemesterData(first.id, 1);
        }
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [loadSemesterData]);

  // Semester change
  async function handleSemesterChange(id: number) {
    setSelectedSemesterId(id);
    setActiveWeek(1);
    await loadSemesterData(id, 1);
  }

  // Week change
  async function handleWeekClick(weekNumber: number) {
    setActiveWeek(weekNumber);
    if (selectedSemesterId !== null) {
      const lessons = await fetchWeekLessons(selectedSemesterId, weekNumber);
      setWeekLessons(lessons);
    }
  }

  // Week note update
  async function handleNoteUpdate(weekNumber: number, note: string) {
    if (selectedSemesterId === null) return;
    await updateWeekNote(selectedSemesterId, weekNumber, note);
    const updatedWeeks = await fetchWeeks(selectedSemesterId);
    setWeeks(updatedWeeks);
  }

  // Semester created
  async function handleSemesterCreated(semester: SemesterResponse) {
    const updatedSemesters = await fetchSemesters();
    setSemesters(updatedSemesters);
    setSelectedSemesterId(semester.id);
    setActiveWeek(1);
    await loadSemesterData(semester.id, 1);
  }

  // Schedule entry created
  async function handleScheduleEntryCreated() {
    if (selectedSemesterId === null) return;
    const [scheduleData, lessonsData, subjectsData] = await Promise.all([
      fetchSchedule(selectedSemesterId),
      fetchWeekLessons(selectedSemesterId, activeWeek),
      fetchSubjects(),
    ]);
    setSchedule(scheduleData);
    setWeekLessons(lessonsData);
    setSubjects(subjectsData);
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-text-secondary">Načítavanie...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <CalendarToolbar
        semesters={semesters}
        selectedSemesterId={selectedSemesterId}
        onSemesterChange={handleSemesterChange}
        activeWeekDisplay={activeWeekDisplay}
        onCreateSemester={() => setSemesterFormOpen(true)}
        onImportStudents={() => setImportModalOpen(true)}
        onAddScheduleEntry={() => setScheduleEntryFormOpen(true)}
        subjects={subjects}
      />
      <div className="flex flex-1 overflow-hidden">
        <WeekSidebar
          weeks={weeks}
          activeWeek={activeWeek}
          onWeekClick={handleWeekClick}
          onNoteUpdate={handleNoteUpdate}
        />
        <CalendarGrid
          scheduleEntries={schedule}
          lessonMap={lessonMap}
          onBlockClick={(lessonId, entry) => {
            setSelectedLessonId(lessonId);
            setSelectedSubjectId(entry.subject_id);
            setEventPanelOpen(true);
          }}
        />
      </div>

      <SemesterFormDialog
        open={semesterFormOpen}
        onOpenChange={setSemesterFormOpen}
        onCreated={handleSemesterCreated}
      />

      {selectedSemesterId !== null && (
        <ScheduleEntryFormDialog
          open={scheduleEntryFormOpen}
          onOpenChange={setScheduleEntryFormOpen}
          semesterId={selectedSemesterId}
          totalWeeks={semesters.find((s) => s.id === selectedSemesterId)?.total_weeks ?? 13}
          onCreated={handleScheduleEntryCreated}
        />
      )}

      <EventPanel
        lessonId={selectedLessonId}
        subjectId={selectedSubjectId}
        semesterId={selectedSemesterId}
        open={eventPanelOpen}
        onOpenChange={setEventPanelOpen}
      />

      <ImportStudentsModal
        open={importModalOpen}
        onOpenChange={setImportModalOpen}
        subjects={subjects}
        onImported={async () => {
          if (selectedSemesterId !== null) {
            await loadSemesterData(selectedSemesterId, activeWeek);
          }
        }}
      />
    </div>
  );
}
