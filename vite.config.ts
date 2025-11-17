import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const branchName = process.env.GITHUB_REF_NAME || 'main';
  const basePath = mode === 'production' 
    ? (branchName === 'main' ? '/clever-widget-factory/' : `/clever-widget-factory/${branchName}/`)
    : '/';
  
  return {
    base: basePath,
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  define: {
    global: 'globalThis',
  },
  optimizeDeps: {
    exclude: ['pg']
  }
  };
});
