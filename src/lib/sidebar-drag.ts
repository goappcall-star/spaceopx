/** Move one category before/after another without changing the input or losing IDs. */
export function reorderCategoryIds(
  ids: string[],
  sourceId: string,
  targetId: string,
  after: boolean,
) {
  if (sourceId === targetId || !ids.includes(sourceId) || !ids.includes(targetId)) return [...ids];
  const next = ids.filter((id) => id !== sourceId);
  next.splice(next.indexOf(targetId) + (after ? 1 : 0), 0, sourceId);
  return next;
}
