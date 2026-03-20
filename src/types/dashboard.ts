export interface KPIData {
  type: string;
  total: number;
  count: number;
}

export interface CategorySpending {
  categoryId: string | null;
  categoryName: string | null;
  categoryIcon: string | null;
  categoryColor: string | null;
  total: number;
  count: number;
}

export interface DailySpending {
  date: string;
  total: number;
}

export interface CalendarHeatmapData {
  day: string;
  value: number;
}

export interface SankeyNode {
  id: string;
  color?: string;
}

export interface SankeyLink {
  source: string;
  target: string;
  value: number;
}

export interface SankeyData {
  nodes: SankeyNode[];
  links: SankeyLink[];
}
