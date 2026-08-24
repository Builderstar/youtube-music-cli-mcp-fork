import {create} from 'zustand';

type Theme = 'dark' | 'light';

interface ThemeStore {
	theme: Theme;
	toggleTheme: () => void;
	setTheme: (theme: Theme) => void;
}

export const useTheme = create<ThemeStore>(
	(set: (partial: Partial<ThemeStore>) => void, get: () => ThemeStore) => ({
		theme: (localStorage.getItem('theme') as Theme) || 'dark',

		toggleTheme: () => {
			const currentTheme = get().theme;
			const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
			set({theme: newTheme});
			localStorage.setItem('theme', newTheme);

			// Update document class
			document.body.classList.toggle('light-theme', newTheme === 'light');
		},

		setTheme: (theme: Theme) => {
			set({theme});
			localStorage.setItem('theme', theme);

			// Update document class
			document.body.classList.toggle('light-theme', theme === 'light');
		},
	}),
);

// Initialize theme class on load
const initialTheme = (localStorage.getItem('theme') as Theme) || 'dark';
if (initialTheme === 'light') {
	document.body.classList.add('light-theme');
}
