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

export const seedUser = {
  id: "user_private_seed",
  email: "private@example.com",
  name: "Private User",
};

export const categories: Category[] = [
  {
    id: "cat_travel",
    userId: seedUser.id,
    name: "Travel",
    slug: "travel",
    sortOrder: 10,
    createdAt: "2026-06-10T00:00:00.000Z",
    updatedAt: "2026-06-10T00:00:00.000Z",
  },
  {
    id: "cat_hotels",
    userId: seedUser.id,
    name: "Hotels",
    slug: "hotels",
    sortOrder: 20,
    createdAt: "2026-06-10T00:00:00.000Z",
    updatedAt: "2026-06-10T00:00:00.000Z",
  },
  {
    id: "cat_design",
    userId: seedUser.id,
    name: "Website Design",
    slug: "website-design",
    sortOrder: 30,
    createdAt: "2026-06-10T00:00:00.000Z",
    updatedAt: "2026-06-10T00:00:00.000Z",
  },
  {
    id: "cat_coding",
    userId: seedUser.id,
    name: "Coding",
    slug: "coding",
    sortOrder: 40,
    createdAt: "2026-06-10T00:00:00.000Z",
    updatedAt: "2026-06-10T00:00:00.000Z",
  },
  {
    id: "cat_ai",
    userId: seedUser.id,
    name: "AI Tools",
    slug: "ai-tools",
    sortOrder: 50,
    createdAt: "2026-06-10T00:00:00.000Z",
    updatedAt: "2026-06-10T00:00:00.000Z",
  },
  {
    id: "cat_finance",
    userId: seedUser.id,
    name: "Finance",
    slug: "finance",
    sortOrder: 60,
    createdAt: "2026-06-10T00:00:00.000Z",
    updatedAt: "2026-06-10T00:00:00.000Z",
  },
  {
    id: "cat_personal",
    userId: seedUser.id,
    name: "Personal",
    slug: "personal",
    sortOrder: 70,
    createdAt: "2026-06-10T00:00:00.000Z",
    updatedAt: "2026-06-10T00:00:00.000Z",
  },
];

export const bookmarks: Bookmark[] = [
  {
    id: "bm_seat61",
    userId: seedUser.id,
    categoryId: "cat_travel",
    title: "The Man in Seat 61",
    url: "https://www.seat61.com/",
    description: "Train routes, ferry connections, and practical travel notes.",
    faviconUrl: "https://www.google.com/s2/favicons?domain=seat61.com&sz=64",
    sortOrder: 10,
    isFavourite: true,
    createdAt: "2026-06-10T00:00:00.000Z",
    updatedAt: "2026-06-10T00:00:00.000Z",
  },
  {
    id: "bm_booking",
    userId: seedUser.id,
    categoryId: "cat_hotels",
    title: "Booking.com",
    url: "https://www.booking.com/",
    description: "Hotel search and saved stays.",
    faviconUrl: "https://www.google.com/s2/favicons?domain=booking.com&sz=64",
    sortOrder: 10,
    isFavourite: false,
    createdAt: "2026-06-10T00:00:00.000Z",
    updatedAt: "2026-06-10T00:00:00.000Z",
  },
  {
    id: "bm_dribbble",
    userId: seedUser.id,
    categoryId: "cat_design",
    title: "Dribbble",
    url: "https://dribbble.com/",
    description: "Interface ideas and visual references.",
    faviconUrl: "https://www.google.com/s2/favicons?domain=dribbble.com&sz=64",
    sortOrder: 10,
    isFavourite: false,
    createdAt: "2026-06-10T00:00:00.000Z",
    updatedAt: "2026-06-10T00:00:00.000Z",
  },
  {
    id: "bm_astro",
    userId: seedUser.id,
    categoryId: "cat_coding",
    title: "Astro Docs",
    url: "https://docs.astro.build/",
    description: "Astro framework documentation.",
    faviconUrl: "https://www.google.com/s2/favicons?domain=astro.build&sz=64",
    sortOrder: 10,
    isFavourite: true,
    createdAt: "2026-06-10T00:00:00.000Z",
    updatedAt: "2026-06-10T00:00:00.000Z",
  },
  {
    id: "bm_cloudflare",
    userId: seedUser.id,
    categoryId: "cat_coding",
    title: "Cloudflare D1",
    url: "https://developers.cloudflare.com/d1/",
    description: "Database reference for the next milestone.",
    faviconUrl: "https://www.google.com/s2/favicons?domain=cloudflare.com&sz=64",
    sortOrder: 20,
    isFavourite: false,
    createdAt: "2026-06-10T00:00:00.000Z",
    updatedAt: "2026-06-10T00:00:00.000Z",
  },
  {
    id: "bm_openai",
    userId: seedUser.id,
    categoryId: "cat_ai",
    title: "OpenAI Platform",
    url: "https://platform.openai.com/",
    description: "API docs and account console.",
    faviconUrl: "https://www.google.com/s2/favicons?domain=openai.com&sz=64",
    sortOrder: 10,
    isFavourite: false,
    createdAt: "2026-06-10T00:00:00.000Z",
    updatedAt: "2026-06-10T00:00:00.000Z",
  },
  {
    id: "bm_wise",
    userId: seedUser.id,
    categoryId: "cat_finance",
    title: "Wise",
    url: "https://wise.com/",
    description: "Transfers and currency checks.",
    faviconUrl: "https://www.google.com/s2/favicons?domain=wise.com&sz=64",
    sortOrder: 10,
    isFavourite: false,
    createdAt: "2026-06-10T00:00:00.000Z",
    updatedAt: "2026-06-10T00:00:00.000Z",
  },
];

export const groupedBookmarks = categories
  .map((category) => ({
    category,
    bookmarks: bookmarks
      .filter((bookmark) => bookmark.categoryId === category.id)
      .sort((a, b) => a.sortOrder - b.sortOrder),
  }))
  .sort((a, b) => a.category.sortOrder - b.category.sortOrder);
