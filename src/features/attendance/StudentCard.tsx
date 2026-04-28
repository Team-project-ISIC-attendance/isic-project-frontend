import { MoreVertical } from "lucide-react";
import type { components } from "@/api/schema";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { StatusBadge } from "./StatusBadge";

type AttendanceStudentEntry = components["schemas"]["AttendanceStudentEntry"];

interface StudentCardProps {
  student: AttendanceStudentEntry;
  onStatusChange: (attendanceId: number, status: string) => void;
  onMove: (student: AttendanceStudentEntry) => void;
  onRemove: (student: AttendanceStudentEntry) => void;
  index: number;
  justScanned?: boolean;
}

export function StudentCard({
  student,
  onStatusChange,
  onMove,
  onRemove,
  index,
  justScanned,
}: StudentCardProps) {
  const initials =
    (student.first_name?.[0] ?? "") + (student.last_name?.[0] ?? "");
  const fullName = [student.first_name, student.last_name]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={`flex h-[72px] items-center justify-between border-b border-[rgba(229,229,229,0.9)] px-[24px] py-[16px] ${index % 2 === 0 ? "bg-white" : "bg-[#fafafa]"}`}
      style={{
        animation: justScanned ? "scan-highlight 1.5s ease-out" : undefined,
      }}
    >
      <div className="flex items-center gap-3">
        <Avatar>
          <AvatarFallback className="bg-[#eff6ff] text-xs font-medium text-gray-600">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-col">
          <span className="font-body text-sm font-medium text-[#3f3f3f]">
            {fullName}
          </span>
          <p className="text-xs text-[#525252]">
            ID: {student.isic_identifier}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-5">
        <StatusBadge
          status={student.status}
          onStatusChange={(status) =>
            onStatusChange(student.attendance_id, status)
          }
        />
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger className="cursor-pointer border-none p-0 text-gray-400 outline-none hover:text-gray-600">
              <MoreVertical size={20} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="cursor-pointer text-sm text-[#404040]"
                onSelect={() => onMove(student)}
              >
                Presunúť
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer text-sm text-[#dc2626]"
                onSelect={() => onRemove(student)}
              >
                Odstrániť
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
