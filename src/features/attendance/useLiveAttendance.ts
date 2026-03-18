import { useEffect, useRef, useState } from "react";
import type { components } from "@/api/schema";
import { fetchLessonAttendance } from "@/api/attendance";

type AttendanceResponse = components["schemas"]["AttendanceResponse"];
type AttendanceStudentEntry = components["schemas"]["AttendanceStudentEntry"];

const POLL_INTERVAL_MS = 5000;
const ANIMATION_DURATION_MS = 1500;
const EMPTY_CHANGED: Set<number> = new Set();

export function useLiveAttendance(
  lessonId: number | null,
  enabled: boolean,
): {
  data: AttendanceResponse | null;
  loading: boolean;
  changedIds: Set<number>;
} {
  const [data, setData] = useState<AttendanceResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [changedIds, setChangedIds] = useState<Set<number>>(EMPTY_CHANGED);
  const prevStudentsRef = useRef<AttendanceStudentEntry[] | null>(null);

  useEffect(() => {
    if (!enabled || lessonId === null) {
      prevStudentsRef.current = null;
      return;
    }

    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    async function poll() {
      if (cancelled || lessonId === null) return;

      try {
        const result = await fetchLessonAttendance(lessonId);
        if (cancelled) return;

        // Detect status changes by comparing with previous students
        const prev = prevStudentsRef.current;
        if (prev !== null) {
          const prevMap = new Map(
            prev.map((s) => [s.attendance_id, s.status]),
          );
          const newChanged = new Set<number>();
          for (const student of result.students) {
            const prevStatus = prevMap.get(student.attendance_id);
            if (prevStatus !== undefined && prevStatus !== student.status) {
              newChanged.add(student.attendance_id);
            }
          }
          if (newChanged.size > 0) {
            setChangedIds(newChanged);
            setTimeout(() => {
              if (!cancelled) {
                setChangedIds(EMPTY_CHANGED);
              }
            }, ANIMATION_DURATION_MS);
          }
        }

        prevStudentsRef.current = result.students;
        setData(result);
        setLoading(false);
      } catch {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    async function start() {
      setLoading(true);
      await poll();
      if (!cancelled) {
        intervalId = setInterval(poll, POLL_INTERVAL_MS);
      }
    }

    start();

    return () => {
      cancelled = true;
      if (intervalId !== null) {
        clearInterval(intervalId);
      }
    };
  }, [lessonId, enabled]);

  // Derive null when not active (avoids setState in effect body)
  const active = enabled && lessonId !== null;

  return {
    data: active ? data : null,
    loading: active ? loading : false,
    changedIds: active ? changedIds : EMPTY_CHANGED,
  };
}
