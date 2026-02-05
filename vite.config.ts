import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, (process as any).cwd(), '');
  return {
    plugins: [react()],
    define: {
      // This is crucial: It replaces process.env.API_KEY in the code 
      // with the actual environment variable value during the build on Vercel.
      'process.env.API_KEY': JSON.stringify(env.API_KEY)
    }
  };
});