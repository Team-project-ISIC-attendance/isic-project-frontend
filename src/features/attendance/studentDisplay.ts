export type StudentLike = {
  student_identifier?: string | null;
  isic_identifier: string;
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  study_identification?: string | null;
  email_is?: string | null;
};

export function getStudentDisplayId(student: StudentLike): string {
  return student.full_name?.trim() || student.student_identifier?.trim() || student.isic_identifier;
}

export function getStudentMeta(student: StudentLike): string | null {
  if (student.full_name?.trim() && student.student_identifier?.trim()) {
    return student.student_identifier.trim();
  }
  return student.study_identification?.trim() || null;
}

export function getStudentAdditionalInfo(student: StudentLike): string[] {
  const items = [
    student.study_identification?.trim(),
    student.email_is?.trim(),
    student.isic_identifier?.trim(),
  ].filter((value): value is string => Boolean(value));

  return Array.from(new Set(items));
}

export function getStudentAvatarLabel(student: StudentLike): string {
  if (student.full_name?.trim()) {
    const words = student.full_name.trim().split(/\s+/);
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return words[0].slice(0, 2).toUpperCase();
  }
  const id = student.student_identifier?.trim() || student.isic_identifier;
  return id.slice(-2).toUpperCase() || "ID";
}

export function matchesStudentQuery(student: StudentLike, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  const haystack = [
    student.student_identifier,
    student.isic_identifier,
    student.full_name,
    student.first_name,
    student.last_name,
    student.email_is,
    student.study_identification,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(normalized);
}
