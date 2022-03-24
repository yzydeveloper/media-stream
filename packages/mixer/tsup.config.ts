import { defineConfig } from 'tsup'

export default defineConfig(() => {
    return {
        entry: ['src/index.ts'],
        splitting: true,
        clean: true,
        dts: true,
        format: ['esm', 'iife']
    }
})
