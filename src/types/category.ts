export interface Category {
  id: string;
  userId: string | null;
  parentId: string | null;
  name: string;
  nameDE: string | null;
  icon: string | null;
  color: string | null;
  sortOrder: number | null;
  isSystem: boolean;
  isHidden: boolean;
}

export interface CategoryWithChildren extends Category {
  children: Category[];
}
