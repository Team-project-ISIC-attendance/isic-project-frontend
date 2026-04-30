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
import { ScheduleEntryFormDialog } from "@/features/calendar/ScheduleEntryFormDialog";
import { EventPanel } from "@/features/attendance/EventPanel";
import { SubjectOverview } from "@/features/attendance/SubjectOverview";
import { AttendanceExportDialog } from "@/features/attendance/AttendanceExportDialog";
import { ImportStudentsModal } from "@/features/import/ImportStudentsModal";
import { SemesterFormDialog } from "../features/calendar/SemesterFormDialog";

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
  const [selectedEntryId, setSelectedEntryId] = useState<number | null>(null);
  const [eventPanelOpen, setEventPanelOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [overviewOpen, setOverviewOpen] = useState(false);
  const [overviewEntryId, setOverviewEntryId] = useState<number | null>(null);
  const [selectedEntry, setSelectedEntry] =
    useState<ScheduleEntryResponse | null>(null);
  const [editingEntry, setEditingEntry] =
    useState<ScheduleEntryResponse | null>(null);

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

  async function handleScheduleEntrySaved() {
    await handleScheduleEntryCreated();
    setEditingEntry(null);
  }

  function handleEditEntry(entry: ScheduleEntryResponse | null) {
    if (entry === null) return;
    setEventPanelOpen(false);
    setOverviewOpen(false);
    setEditingEntry(entry);
    setScheduleEntryFormOpen(true);
  }

  function handleScheduleDialogOpenChange(open: boolean) {
    setScheduleEntryFormOpen(open);
    if (!open) {
      setEditingEntry(null);
    }
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
        onAddScheduleEntry={() => {
          setEditingEntry(null);
          setScheduleEntryFormOpen(true);
        }}
        onExportAttendance={() => setExportModalOpen(true)}
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
            setSelectedEntryId(entry.id);
            setSelectedEntry(entry);
            setEventPanelOpen(true);
          }}
        />
      </div>

      <SemesterFormDialog
        open={semesterFormOpen}
        onOpenChange={setSemesterFormOpen}
        onCreated={handleSemesterCreated}
      />

      {selectedSemesterId !== null && scheduleEntryFormOpen && (
        <ScheduleEntryFormDialog
          key={editingEntry ? `edit-${editingEntry.id}` : "create"}
          open={scheduleEntryFormOpen}
          onOpenChange={handleScheduleDialogOpenChange}
          semesterId={selectedSemesterId}
          mode={editingEntry ? "edit" : "create"}
          entry={editingEntry}
          onCreated={handleScheduleEntryCreated}
          onUpdated={handleScheduleEntrySaved}
        />
      )}

      <EventPanel
        lessonId={selectedLessonId}
        subjectId={selectedSubjectId}
        semesterId={selectedSemesterId}
        open={eventPanelOpen}
        onOpenChange={setEventPanelOpen}
        onMaximize={() => {
          setEventPanelOpen(false);
          setOverviewEntryId(selectedEntryId);
          setOverviewOpen(true);
        }}
        onEdit={() => handleEditEntry(selectedEntry)}
      />

      {overviewOpen && overviewEntryId !== null && selectedSubjectId !== null && selectedSemesterId !== null && (
        <SubjectOverview
          subjectId={selectedSubjectId}
          entryId={overviewEntryId}
          semesterId={selectedSemesterId}
          onClose={() => setOverviewOpen(false)}
          onMinimize={() => {
            setOverviewOpen(false);
            setEventPanelOpen(true);
          }}
          onEdit={() => handleEditEntry(selectedEntry)}
        />
      )}

      {exportModalOpen && (
        <AttendanceExportDialog
          open={exportModalOpen}
          onOpenChange={setExportModalOpen}
          subjects={subjects}
          semesterId={selectedSemesterId}
          defaultSubjectId={selectedSubjectId}
        />
      )}

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
