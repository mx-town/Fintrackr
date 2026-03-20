import { EmptyState } from "@/components/shared/empty-state";
import { Building2 } from "lucide-react";

export default function AccountsPage() {
  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold tracking-tight">Accounts</h1>
      <EmptyState
        icon={<Building2 className="h-8 w-8 text-muted-foreground" />}
        title="No accounts yet"
        description="Bank accounts are created automatically when you upload your first statement. You can also add accounts manually."
        actionLabel="Upload Statement"
        actionHref="/upload"
      />
    </div>
  );
}
