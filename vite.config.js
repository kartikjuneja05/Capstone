import {defineConfig} from 'vite';
export default defineConfig({build:{outDir:'src/dist'},server:{host:'127.0.0.1',port:5173,strictPort:true,proxy:{'/api':'http://127.0.0.1:3001'}}});
