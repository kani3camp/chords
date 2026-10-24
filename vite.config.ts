import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({ plugins: [react()], json:{stringify:true,namedExports:false},build: { target: 'es2022' } });
