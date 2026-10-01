import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useDeleteExamSubject,
  useSaveExamSubject,
  type ExamSubject,
} from "@/lib/exam-subjects";

/** Subject papers of a session exam, each with its own total marks. */
export function ExamPapersCard({
  examId,
  papers,
  canEdit,
  activePaperId,
  onSelect,
}: {
  examId: string;
  papers: ExamSubject[];
  canEdit: boolean;
  activePaperId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const save = useSaveExamSubject(examId);
  const remove = useDeleteExamSubject(examId);
  const [name, setName] = useState("");
  const [marks, setMarks] = useState("100");

  const add = () => {
    const total = Number(marks);
    if (!name.trim()) {
      toast.error("Enter the subject name.");
      return;
    }
    if (!Number.isFinite(total) || total <= 0) {
      toast.error("Enter valid total marks.");
      return;
    }
    save.mutate(
      { name, total_marks: total, display_order: papers.length },
      {
        onSuccess: () => {
          setName("");
          setMarks("100");
          toast.success("Subject paper added");
        },
        onError: (e: Error) => toast.error(e.message),
      },
    );
  };

  return (
    <Card className="no-print mb-4">
      <CardHeader>
        <CardTitle className="font-serif text-lg">Subject papers</CardTitle>
        <CardDescription>
          Add each paper of this exam with its own total marks, then record results paper by paper.
          Leave this empty to keep a single-subject exam.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button
            variant={activePaperId === null ? "default" : "outline"}
            size="sm"
            onClick={() => onSelect(null)}
          >
            Whole exam
          </Button>
          {papers.map((p) => (
            <span key={p.id} className="flex items-center gap-1">
              <Button
                variant={activePaperId === p.id ? "default" : "outline"}
                size="sm"
                onClick={() => onSelect(p.id)}
              >
                {p.name} · {p.total_marks}
              </Button>
              {canEdit ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() =>
                    remove.mutate(p.id, {
                      onSuccess: () => {
                        if (activePaperId === p.id) onSelect(null);
                        toast.success("Paper removed");
                      },
                      onError: (e: Error) => toast.error(e.message),
                    })
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              ) : null}
            </span>
          ))}
        </div>

        {canEdit ? (
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[10rem] flex-1 space-y-1">
              <Label className="text-xs">Subject</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="English" />
            </div>
            <div className="w-28 space-y-1">
              <Label className="text-xs">Total marks</Label>
              <Input
                type="number"
                min={1}
                value={marks}
                onChange={(e) => setMarks(e.target.value)}
              />
            </div>
            <Button onClick={add} disabled={save.isPending}>
              <Plus className="mr-1.5 h-4 w-4" /> Add paper
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
