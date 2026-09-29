import { describe, expect, it, vi } from 'vitest';
import { createUserCacheInvalidator } from './user-cache';

describe('createUserCacheInvalidator', () => {
  it('clears cached workspace data when the signed-in user changes', () => {
    const clearCache = vi.fn();
    const onUserChange = createUserCacheInvalidator(clearCache);

    onUserChange('user-a');
    onUserChange('user-a');
    expect(clearCache).not.toHaveBeenCalled();

    onUserChange(null);
    expect(clearCache).toHaveBeenCalledTimes(1);

    onUserChange(null);
    expect(clearCache).toHaveBeenCalledTimes(1);

    onUserChange('user-b');
    expect(clearCache).toHaveBeenCalledTimes(2);
  });
});