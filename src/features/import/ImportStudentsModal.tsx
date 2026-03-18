import { useState, useCallback } from "react";
import type { components } from "@/api/schema";
import { importStudentsCsv } from "@/api/import";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Upload } from "lucide-react";
import { CsvPreview } from "./CsvPreview";

type SubjectResponse = components["schemas"]["SubjectResponse"];
type ImportResult = components["schemas"]["ImportResult"];

interface ImportStudentsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subjects: SubjectResponse[];
  onImported: () => void;
}

function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");
  if (lines.length === 0) return { headers: [], rows: [] };
  const delimiter = lines[0].includes(";") ? ";" : ",";
  const headers = lines[0].split(delimiter).map((h) => h.trim());
  const rows = lines
    .slice(1)
    .map((line) => line.split(delimiter).map((c) => c.trim()));
  return { headers, rows };
}

export function ImportStudentsModal({
  open,
  onOpenChange,
  subjects,
  onImported,
}: ImportStudentsModalProps) {
  const [subjectId, setSubjectId] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{
    headers: string[];
    rows: string[][];
  } | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  function resetForm() {
    setSubjectId("");
    setFile(null);
    setPreview(null);
    setResult(null);
    setError("");
  }

  function handleOpenChange(isOpen: boolean) {
    if (!isOpen) {
      resetForm();
    }
    onOpenChange(isOpen);
  }

  const handleFile = useCallback((f: File) => {
    setFile(f);
    setResult(null);
    setError("");
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseCsv(text);
      setPreview(parsed);
    };
    reader.readAsText(f);
  }, []);

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f && f.name.endsWith(".csv")) {
      handleFile(f);
    }
  }

  async function handleSubmit() {
    if (!subjectId || !file) return;
    setError("");
    setSubmitting(true);

    try {
      const importResult = await importStudentsCsv(Number(subjectId), file);
      setResult(importResult);
      onImported();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Chyba pri importe";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  const selectedSubject = subjects.find((s) => String(s.id) === subjectId);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import študentov</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>Predmet</Label>
            <Select
              value={subjectId}
              onValueChange={(val) => {
                if (val !== null) setSubjectId(val);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Vyberte predmet">
                  {selectedSubject?.name ?? "Vyberte predmet"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {subjects.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!result && (
            <>
              <div className="flex flex-col gap-2">
                <Label>CSV súbor</Label>
                <div
                  className={`flex flex-col items-center justify-center rounded-md border-2 border-dashed p-6 transition-colors ${
                    dragOver
                      ? "border-primary bg-primary/5"
                      : "border-border-custom"
                  }`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                >
                  <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Presuňte CSV súbor sem alebo
                  </p>
                  <label className="mt-2 cursor-pointer">
                    <span className="text-sm font-medium text-primary underline">
                      vyberte súbor
                    </span>
                    <input
                      type="file"
                      accept=".csv"
                      className="hidden"
                      onChange={handleFileInput}
                    />
                  </label>
                  {file && (
                    <p className="mt-2 text-sm font-medium">{file.name}</p>
                  )}
                </div>
              </div>

              {preview && (
                <div className="flex flex-col gap-2">
                  <Label>Náhľad</Label>
                  <CsvPreview
                    headers={preview.headers}
                    rows={preview.rows}
                    maxRows={5}
                  />
                </div>
              )}
            </>
          )}

          {result && (
            <div className="flex flex-col gap-3 rounded-md border border-border-custom p-4">
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-success">
                    {result.imported}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    importovaných
                  </p>
                </div>
                {result.skipped > 0 && (
                  <div className="text-center">
                    <p className="text-2xl font-bold text-warning">
                      {result.skipped}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      preskočených
                    </p>
                  </div>
                )}
              </div>
              {result.errors.length > 0 && (
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium text-danger">
                    Chyby ({result.errors.length}):
                  </p>
                  <div className="max-h-32 overflow-auto text-xs">
                    {result.errors.map((err, i) => (
                      <p key={i} className="text-muted-foreground">
                        Riadok {err.row}: {err.reason}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {error && <p className="text-sm text-danger">{error}</p>}

          <DialogFooter>
            {result ? (
              <Button onClick={() => handleOpenChange(false)}>Zavrieť</Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={!subjectId || !file || submitting}
              >
                {submitting ? "Importovanie..." : "Importovať"}
              </Button>
            )}
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
