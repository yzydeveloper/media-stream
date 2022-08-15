import type { Pages, Rewrite } from 'vite-plugin-mpa-plus'
import { defineConfig } from 'vite'
import { readdirSync } from 'fs'
import mpaPlugin from 'vite-plugin-mpa-plus'

const rewrites:Rewrite[] = []
const entrys = readdirSync('./src/app')
const pages = entrys.reduce<Pages>((result, pageName) => {
    result[pageName] = {
        filename: `/pages/${pageName}.html`,
        template: `src/app/${pageName}/index.html`
    }
    rewrites.push({
        from: new RegExp(`^/${pageName}$`),
        to: `/pages/${pageName}.html`
    })
    return result
}, {})

export default defineConfig({
    server: {
        host: true,
        hmr: true
    },
    plugins: [
        mpaPlugin({
            pages,
            historyApiFallback: {
                rewrites
            }
        })
    ]
})
