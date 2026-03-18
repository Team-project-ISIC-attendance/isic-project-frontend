import type { components } from "@/api/schema";
import { downloadAttendanceExport } from "@/api/attendance";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { FileDown } from "lucide-react";

type SubjectResponse = components["schemas"]["SubjectResponse"];

interface ExportButtonProps {
  subjects: SubjectResponse[];
  semesterId: number;
}

export function ExportButton({ subjects, semesterId }: ExportButtonProps) {
  async function handleExport(subjectId: number) {
    try {
      await downloadAttendanceExport(subjectId, semesterId, "csv");
    } catch {
      // silently fail — the user sees no file download
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="sm" />
        }
      >
        <FileDown className="mr-1.5 h-4 w-4" />
        Export dochádzku
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {subjects.map((s) => (
          <DropdownMenuItem key={s.id} onClick={() => handleExport(s.id)}>
            {s.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
