"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const PRESET_COLORS = [
  "#22c55e", "#f97316", "#fb923c", "#3b82f6", "#8b5cf6",
  "#06b6d4", "#ec4899", "#a855f7", "#f59e0b", "#10b981",
  "#6366f1", "#14b8a6", "#f472b6", "#ef4444", "#0ea5e9",
];

const PRESET_ICONS = [
  "🛒", "🏠", "🚗", "🍔", "💊", "🎮", "📚", "✈️", "💰", "🎵",
  "👕", "🐕", "💇", "🏋️", "🎁", "📱", "🔧", "🏥", "🎬", "☕",
];

interface CategoryFormData {
  name: string;
  nameDE: string;
  icon: string;
  color: string;
}

interface CategoryDialogProps {
  mode: "create" | "edit";
  initial?: { id: string; name: string; nameDE?: string | null; icon?: string | null; color?: string | null };
  trigger: React.ReactNode;
  onSubmit: (data: CategoryFormData) => void;
}

export function CategoryDialog({ mode, initial, trigger, onSubmit }: CategoryDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(initial?.name ?? "");
  const [nameDE, setNameDE] = useState(initial?.nameDE ?? "");
  const [icon, setIcon] = useState(initial?.icon ?? "📦");
  const [color, setColor] = useState(initial?.color ?? "#3b82f6");

  function handleOpen(isOpen: boolean) {
    setOpen(isOpen);
    if (isOpen && initial) {
      setName(initial.name);
      setNameDE(initial.nameDE ?? "");
      setIcon(initial.icon ?? "📦");
      setColor(initial.color ?? "#3b82f6");
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({ name: name.trim(), nameDE: nameDE.trim(), icon, color });
    setOpen(false);
    if (mode === "create") {
      setName("");
      setNameDE("");
      setIcon("📦");
      setColor("#3b82f6");
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger render={<span />} nativeButton={false}>
        {trigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {mode === "create" ? "New Category" : `Edit "${initial?.name}"`}
            </DialogTitle>
            <DialogDescription>
              {mode === "create"
                ? "Create a custom category for your transactions."
                : "Update the category name, icon, or color."}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="cat-name">Name</Label>
              <Input
                id="cat-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Groceries"
                required
              />
            </div>

            {/* German name */}
            <div className="space-y-1.5">
              <Label htmlFor="cat-name-de">German name (optional)</Label>
              <Input
                id="cat-name-de"
                value={nameDE}
                onChange={(e) => setNameDE(e.target.value)}
                placeholder="e.g. Lebensmittel"
              />
            </div>

            {/* Icon picker */}
            <div className="space-y-1.5">
              <Label>Icon</Label>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_ICONS.map((ic) => (
                  <button
                    key={ic}
                    type="button"
                    onClick={() => setIcon(ic)}
                    className={`flex h-8 w-8 items-center justify-center rounded-lg text-base transition-all ${
                      icon === ic
                        ? "bg-primary/15 ring-2 ring-primary scale-110"
                        : "bg-muted/40 hover:bg-muted/80"
                    }`}
                  >
                    {ic}
                  </button>
                ))}
              </div>
            </div>

            {/* Color picker */}
            <div className="space-y-1.5">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`h-7 w-7 rounded-full transition-all ${
                      color === c ? "ring-2 ring-foreground ring-offset-2 ring-offset-background scale-110" : "hover:scale-110"
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            {/* Preview */}
            <div className="rounded-xl bg-muted/30 px-3 py-2.5">
              <p className="text-[11px] text-muted-foreground mb-1.5">Preview</p>
              <div className="flex items-center gap-2.5">
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-sm"
                  style={{ backgroundColor: `${color}18` }}
                >
                  {icon}
                </div>
                <div>
                  <p className="text-sm font-semibold">{name || "Category name"}</p>
                  {nameDE && (
                    <p className="text-[11px] text-muted-foreground">{nameDE}</p>
                  )}
                </div>
                <div
                  className="ml-auto h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: color }}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button type="submit" disabled={!name.trim()}>
              {mode === "create" ? "Create Category" : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
