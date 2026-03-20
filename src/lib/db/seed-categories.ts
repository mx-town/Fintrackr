import { db } from "./index";
import { categories } from "./schema";

export const DEFAULT_CATEGORIES = [
  { id: "cat_income", name: "Income", nameDE: "Einkommen", icon: "\u{1F4B0}", color: "#22c55e", sortOrder: 0 },
  { id: "cat_food", name: "Food & Drink", nameDE: "Essen & Trinken", icon: "\u{1F37D}\uFE0F", color: "#f97316", sortOrder: 1 },
  { id: "cat_groceries", name: "Groceries", nameDE: "Lebensmittel", icon: "\u{1F6D2}", color: "#fb923c", sortOrder: 2, parentId: "cat_food" },
  { id: "cat_dining", name: "Dining Out", nameDE: "Restaurant", icon: "\u{1F355}", color: "#f97316", sortOrder: 3, parentId: "cat_food" },
  { id: "cat_coffee", name: "Coffee & Bars", nameDE: "Caf\u00E9 & Bar", icon: "\u2615", color: "#ea580c", sortOrder: 4, parentId: "cat_food" },
  { id: "cat_transport", name: "Transportation", nameDE: "Transport", icon: "\u{1F697}", color: "#3b82f6", sortOrder: 5 },
  { id: "cat_public", name: "Public Transit", nameDE: "\u00D6ffis", icon: "\u{1F687}", color: "#60a5fa", sortOrder: 6, parentId: "cat_transport" },
  { id: "cat_fuel", name: "Gas & Fuel", nameDE: "Tanken", icon: "\u26FD", color: "#2563eb", sortOrder: 7, parentId: "cat_transport" },
  { id: "cat_housing", name: "Housing", nameDE: "Wohnen", icon: "\u{1F3E0}", color: "#8b5cf6", sortOrder: 8 },
  { id: "cat_rent", name: "Rent", nameDE: "Miete", icon: "\u{1F3E2}", color: "#a78bfa", sortOrder: 9, parentId: "cat_housing" },
  { id: "cat_utilities", name: "Utilities", nameDE: "Nebenkosten", icon: "\u{1F4A1}", color: "#06b6d4", sortOrder: 10 },
  { id: "cat_entertainment", name: "Entertainment", nameDE: "Unterhaltung", icon: "\u{1F3AC}", color: "#ec4899", sortOrder: 11 },
  { id: "cat_subscriptions", name: "Subscriptions", nameDE: "Abos", icon: "\u{1F504}", color: "#a855f7", sortOrder: 12 },
  { id: "cat_shopping", name: "Shopping", nameDE: "Einkaufen", icon: "\u{1F6CD}\uFE0F", color: "#f59e0b", sortOrder: 13 },
  { id: "cat_health", name: "Health & Medical", nameDE: "Gesundheit", icon: "\u{1F3E5}", color: "#10b981", sortOrder: 14 },
  { id: "cat_education", name: "Education", nameDE: "Bildung", icon: "\u{1F4DA}", color: "#6366f1", sortOrder: 15 },
  { id: "cat_travel", name: "Travel", nameDE: "Reisen", icon: "\u2708\uFE0F", color: "#14b8a6", sortOrder: 16 },
  { id: "cat_personal", name: "Personal Care", nameDE: "K\u00F6rperpflege", icon: "\u{1F485}", color: "#f472b6", sortOrder: 17 },
  { id: "cat_savings", name: "Savings & Invest", nameDE: "Sparen", icon: "\u{1F4C8}", color: "#2563eb", sortOrder: 18 },
  { id: "cat_fees", name: "Fees & Charges", nameDE: "Geb\u00FChren", icon: "\u{1F3E6}", color: "#94a3b8", sortOrder: 19 },
  { id: "cat_other", name: "Other", nameDE: "Sonstiges", icon: "\u{1F4E6}", color: "#64748b", sortOrder: 99 },
] as const;

export async function seedCategories() {
  for (const cat of DEFAULT_CATEGORIES) {
    await db
      .insert(categories)
      .values({
        ...cat,
        isSystem: true,
        userId: null,
      })
      .onConflictDoNothing();
  }
}
