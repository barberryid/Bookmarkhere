/** Tiny shared state between the dashboard modules. */
export const state = {
  /** Current search query ("" when not searching). */
  query: "",
};

export function isSearching(): boolean {
  return state.query.trim().length > 0;
}
