import { useState, useEffect, useCallback } from 'react';

type Theme = 'light' | 'dark';

export function useTheme() {
    // Initialize state from localStorage or default to 'dark'
    const [theme, setTheme] = useState<Theme>(() => {
        if (typeof window === 'undefined') {
            return 'dark';
        }
        try {
            const storedTheme = window.localStorage.getItem('theme') as Theme | null;
            return storedTheme || 'dark';
        } catch (error) {
            console.error("Error reading theme from localStorage", error);
            return 'dark';
        }
    });

    // Effect to apply the theme class to the root element and save to localStorage
    useEffect(() => {
        const root = window.document.documentElement;
        if (theme === 'light') {
            root.classList.add('light');
        } else {
            root.classList.remove('light');
        }

        try {
            window.localStorage.setItem('theme', theme);
        } catch (error) {
            console.error("Error saving theme to localStorage", error);
        }
    }, [theme]);

    const toggleTheme = useCallback(() => {
        setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
    }, []);

    return { theme, toggleTheme };
}
