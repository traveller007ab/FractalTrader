import { useEffect, useCallback } from 'react';

export function usePageFocus(onFocus: () => void) {
    const handleVisibilityChange = useCallback(() => {
        if (document.visibilityState === 'visible') {
            onFocus();
        }
    }, [onFocus]);

    useEffect(() => {
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [handleVisibilityChange]);
}
