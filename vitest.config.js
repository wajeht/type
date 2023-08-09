import { defineConfig } from 'vite';

export default defineConfig({
	test: {
		globals: true,
		setupFilesAfterEnv: ['./test-setup.js'],
	},
});
