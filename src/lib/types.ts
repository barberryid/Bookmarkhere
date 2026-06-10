export type Bookmark = {
  id: string;
  userId: string;
  categoryId: string;
  title: string;
  url: string;
  description?: string;
  faviconUrl?: string;
  sortOrder: number;
  isFavourite: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Category = {
  id: string;
  userId: string;
  name: string;
  slug: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type CategoryWithBookmarks = {
  category: Category;
  bookmarks: Bookmark[];
};

export type ImportSummary = {
  found: number;
  imported: number;
  skippedDuplicates: number;
  categoriesCreated: number;
  errors: string[];
};
