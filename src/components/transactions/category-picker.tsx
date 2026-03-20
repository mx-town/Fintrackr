"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";

interface Category {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
}

export function CategoryPicker({
  currentCategory,
  categories,
  onSelect,
}: {
  currentCategory: Category | null;
  categories: Category[];
  onSelect: (categoryId: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button className="cursor-pointer rounded-lg text-left transition-opacity hover:opacity-80" />
        }
      >
        {currentCategory ? (
          <Badge
            variant="secondary"
            className="text-[11px] rounded-lg border-0"
            style={{
              backgroundColor: currentCategory.color
                ? `${currentCategory.color}18`
                : undefined,
              color: currentCategory.color ?? undefined,
            }}
          >
            {currentCategory.icon} {currentCategory.name}
          </Badge>
        ) : (
          <Badge
            variant="outline"
            className="text-[11px] text-muted-foreground/50 border-border/30 rounded-lg"
          >
            Uncategorized
          </Badge>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search categories..." />
          <CommandList>
            <CommandEmpty>No category found.</CommandEmpty>
            <CommandGroup>
              {categories.map((cat) => (
                <CommandItem
                  key={cat.id}
                  value={cat.name}
                  onSelect={() => {
                    onSelect(cat.id);
                    setOpen(false);
                  }}
                  data-checked={currentCategory?.id === cat.id ? true : undefined}
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: cat.color ?? "#94a3b8" }}
                  />
                  <span className="text-sm">
                    {cat.icon} {cat.name}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
