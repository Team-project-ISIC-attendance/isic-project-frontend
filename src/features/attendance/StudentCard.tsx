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
}

export function StudentCard({ student, onStatusChange }: StudentCardProps) {
  const initials =
    (student.first_name?.[0] ?? "") + (student.last_name?.[0] ?? "");
  const fullName = [student.first_name, student.last_name]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="flex items-center justify-between rounded-lg border-[0.5px] border-border-custom bg-white px-3 py-2">
      <div className="flex items-center gap-3">
        <Avatar>
          <AvatarFallback className="bg-gray-200 text-xs font-medium text-gray-600">
            {initials}
          </AvatarFallback>
        </Avatar>
        <span className="font-body text-sm font-medium text-[#3f3f3f]">
          {fullName}
        </span>
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
              <DropdownMenuItem className="text-sm text-gray-500">
                Žiadne akcie
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
