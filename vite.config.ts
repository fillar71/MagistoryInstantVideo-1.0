
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, (process as any).cwd(), '');

  return {
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.API_KEY || process.env.API_KEY || ''),
      'process.env.PEXELS_API_KEY': JSON.stringify(env.PEXELS_API_KEY || process.env.PEXELS_API_KEY || ''),
      'process.env.PIXABAY_API_KEY': JSON.stringify(env.PIXABAY_API_KEY || process.env.PIXABAY_API_KEY || ''),
      'process.env.RENDER_URL': JSON.stringify(env.RENDER_URL || process.env.RENDER_URL || ''),
      'process.env.GOOGLE_CLIENT_ID': JSON.stringify(env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || ''),
      // Supabase
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''),
      // Generic fallback
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
