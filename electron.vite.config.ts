import { defineConfig, externalizeDepsPlugin, bytecodePlugin } from 'electron-vite'
import { resolve } from 'path'

export default defineConfig({
  main: {
    plugins: [
      externalizeDepsPlugin()
    ],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/main/main.ts')
        }
      },
      outDir: 'out/main',
      minify: false,
      sourcemap: true
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/preload/preload.ts')
        }
      },
      outDir: 'out/preload'
    }
  },
  renderer: {
    root: './src/renderer',
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/renderer/index.html')
        }
      },
      outDir: 'out/renderer'
    }
  }
})
