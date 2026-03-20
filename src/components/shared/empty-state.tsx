"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import type { ReactNode } from "react";

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  actionHref,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-up">
      <div className="rounded-2xl bg-muted/30 border border-border/30 p-5 mb-5">
        {icon}
      </div>
      <h3 className="font-heading text-lg font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground mt-1.5 max-w-sm leading-relaxed">
        {description}
      </p>
      {actionLabel && actionHref && (
        <Button
          render={<Link href={actionHref} />}
          nativeButton={false}
          className="mt-6 rounded-xl"
        >
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
