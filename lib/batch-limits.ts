export const maxAnswerBatchSize = 20;
export const maxOutreachDraftBatchSize = 20;

export function takeBatch<T>(items: T[], maxSize: number) {
  return {
    items: items.slice(0, maxSize),
    skipped: Math.max(0, items.length - maxSize),
  };
}
