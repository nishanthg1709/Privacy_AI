import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import process from 'node:process';
import path from 'node:path';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load environment variables from both frontend directory and project root directory
  const envFrontend = loadEnv(mode, process.cwd(), '');
  const envRoot = loadEnv(mode, path.resolve(process.cwd(), '..'), '');
  const merged = { ...envRoot, ...envFrontend };

  const apiTarget = merged.VITE_API_BASE_URL || 'http://localhost:8000';

  return {
    plugins: [react()],
    define: {
      ...(merged.VITE_SUPABASE_URL
        ? { 'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(merged.VITE_SUPABASE_URL) }
        : {}),
      ...(merged.VITE_SUPABASE_PUBLISHABLE_KEY || merged.VITE_SUPABASE_ANON_KEY
        ? {
            'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(
              merged.VITE_SUPABASE_PUBLISHABLE_KEY || merged.VITE_SUPABASE_ANON_KEY
            ),
          }
        : {}),
      ...(merged.VITE_SUPABASE_ANON_KEY || merged.VITE_SUPABASE_PUBLISHABLE_KEY
        ? {
            'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(
              merged.VITE_SUPABASE_ANON_KEY || merged.VITE_SUPABASE_PUBLISHABLE_KEY
            ),
          }
        : {}),
    },
    server: {
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
});

