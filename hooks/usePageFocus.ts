import { useState, useEffect } from 'react';

export function usePageFocus(): boolean {
    const [isFocused, setIsFocused] = useState(document.visibilityState === 'visible');

    useEffect(() => {
        const handleVisibilityChange = () => {
            setIsFocused(document.visibilityState === 'visible');
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, []);

    return isFocused;
}
