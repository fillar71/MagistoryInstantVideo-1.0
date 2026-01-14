import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, (process as any).cwd(), '');

  return {
    plugins: [react()],
    define: {
      // Prioritize process.env (Vercel) -> env file -> empty string
      'process.env.API_KEY': JSON.stringify(process.env.API_KEY || env.API_KEY || ''),
      'process.env.PEXELS_API_KEY': JSON.stringify(process.env.PEXELS_API_KEY || env.PEXELS_API_KEY || ''),
      'process.env.PIXABAY_API_KEY': JSON.stringify(process.env.PIXABAY_API_KEY || env.PIXABAY_API_KEY || ''),
      'process.env.RENDER_URL': JSON.stringify(process.env.RENDER_URL || env.RENDER_URL || ''),
      'process.env.GOOGLE_CLIENT_ID': JSON.stringify(process.env.GOOGLE_CLIENT_ID || env.GOOGLE_CLIENT_ID || ''),
      // Supabase
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(process.env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL || ''),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(process.env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || ''),
      
      // Fallback for other process.env usage to prevent crash
      'process.env': JSON.stringify({})
    },
    build: {
      chunkSizeWarningLimit: 1000, 
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom'],
            genai: ['@google/genai'],
            supabase: ['@supabase/supabase-js']
          }
        }
      }
    },
    server: {
      host: true,
    }
  };
});