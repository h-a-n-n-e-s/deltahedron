import { defineConfig } from 'vite'

export default defineConfig({

  build: {
    
    target: 'esnext', // assuming browsers can handle the latest ES features

    // rollupOptions: {
      
    //   input: {
    //     app: 'index.html',
    //     'worker': 'src/worker.ts'
    //   },
      
    //   output: {
    //     entryFileNames: assetInfo => {
    //       return assetInfo.name === 'worker'
    //          ? 'src/[name].js'
    //          : 'assets/[name]-[hash].js'
    //     }
    //   }
    // }
  }
});