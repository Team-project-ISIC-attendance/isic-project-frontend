import { useState } from "react";
import { MoreVertical } from "lucide-react";
import type { components } from "@/api/schema";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ConfirmationPopover } from "@/components/ui/confirmation-popover";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { StatusBadge } from "./StatusBadge";
import {
  getStudentAdditionalInfo,
  getStudentAvatarLabel,
  getStudentDisplayId,
  getStudentMeta,
} from "./studentDisplay";

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
  const displayId = getStudentDisplayId(student);
  const meta = getStudentMeta(student);
  const additionalInfo = getStudentAdditionalInfo(student);
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);

  return (
    <div
      className={`flex min-h-[84px] items-start justify-between gap-4 border-b border-[rgba(229,229,229,0.9)] px-7 py-4 ${index % 2 === 0 ? "bg-white" : "bg-[#fafafa]"}`}
      style={{
        animation: justScanned ? "scan-highlight 1.5s ease-out" : undefined,
      }}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3.5 pr-4">
        <Avatar className="mt-0.5 shrink-0">
          <AvatarFallback className="bg-[#eff6ff] text-xs font-medium text-gray-600">
            {getStudentAvatarLabel(student)}
          </AvatarFallback>
        </Avatar>
        <div
          className="flex min-w-0 flex-col gap-1"
          title={additionalInfo.join("\n")}
        >
          <span className="font-body text-sm leading-5 font-medium text-[#3f3f3f]">
            {displayId}
          </span>
          {meta && <p className="text-xs leading-5 text-[#525252]">{meta}</p>}
        </div>
      </div>
      <div className="flex shrink-0 items-start gap-4 pt-1">
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
                onClick={() => onMove(student)}
              >
                Presunúť
              </DropdownMenuItem>
              <ConfirmationPopover
                open={removeConfirmOpen}
                onOpenChange={setRemoveConfirmOpen}
                title="Odstrániť študenta"
                description={
                  <>
                    Naozaj chcete odstrániť študenta{" "}
                    <strong>{displayId}</strong> z predmetu? Táto akcia sa nedá
                    vrátiť späť.
                  </>
                }
                confirmLabel="Odstrániť"
                onConfirm={() => {
                  setRemoveConfirmOpen(false);
                  void onRemove(student);
                }}
                trigger={
                  <DropdownMenuItem
                    closeOnClick={false}
                    variant="destructive"
                    className="cursor-pointer text-sm"
                  />
                }
                triggerContent="Odstrániť"
                triggerNativeButton={false}
                triggerDisabled={student.enrollment_id === null}
                side="left"
                align="start"
              />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
