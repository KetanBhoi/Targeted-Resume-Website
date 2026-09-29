export function createUserCacheInvalidator(clearCache: () => void) {
  let previousUserId: string | null | undefined;

  return (userId: string | null) => {
    if (previousUserId !== undefined && previousUserId !== userId) {
      clearCache();
    }
    previousUserId = userId;
  };
}