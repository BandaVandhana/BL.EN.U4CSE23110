const VIEWED_KEY = "viewed_notifications";

export function getViewedIds(): string[] {
  if (typeof window === "undefined") return [];
  const stored = localStorage.getItem(VIEWED_KEY);
  return stored ? JSON.parse(stored) : [];
}

export function markAsViewed(id: string) {
  const viewed = getViewedIds();
  if (!viewed.includes(id)) {
    viewed.push(id);
    localStorage.setItem(VIEWED_KEY, JSON.stringify(viewed));
  }
}

export function isViewed(id: string): boolean {
  return getViewedIds().includes(id);
}
