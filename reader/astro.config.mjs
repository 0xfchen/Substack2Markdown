// @ts-check

import { unified } from '@astrojs/markdown-remark';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import expressiveCode from 'astro-expressive-code';
import { defineConfig } from 'astro/config';
import process from 'node:process';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeSlug from 'rehype-slug';
import config from './astro-theme-config.ts';
import { toneExpressiveCodeOptions } from './src/config/expressive-code.ts';

// https://astro.build/config
const sitemapExcludedPaths = new Set(['/search/']);
const configuredSite = process.env.ASTRO_SITE_URL || config.site.url;
const configuredBaseValue = process.env.ASTRO_SITE_BASE ?? config.site.base;
const configuredBase =
  configuredBaseValue === '/' ? '' : configuredBaseValue.replace(/\/$/, '');

/** @param {string} pathname */
function withoutConfiguredBase(pathname) {
  if (!configuredBase) return pathname;
  if (!pathname.startsWith(configuredBase)) return pathname;

  return pathname.slice(configuredBase.length) || '/';
}

export default defineConfig({
  site: configuredSite,
  base: configuredBase || undefined,
  redirects: {
    '/posts': '/',
  },
  integrations: [
    expressiveCode(toneExpressiveCodeOptions),
    mdx(),
    sitemap({
      filter: (page) => !sitemapExcludedPaths.has(withoutConfiguredBase(new URL(page).pathname)),
    }),
  ],
  build: {
    inlineStylesheets: 'always',
  },

  markdown: {
    processor: unified({
      rehypePlugins: [
        rehypeSlug,
        [
          rehypeAutolinkHeadings,
          {
            behavior: 'append',
            properties: { ariaHidden: true, tabIndex: -1, class: 'heading-anchor' },
            content: { type: 'text', value: '#' },
          },
        ],
      ],
    }),
  },
  vite: {
    server: {
      fs: {
        allow: ['..'],
      },
    },
    plugins: [
      {
        name: 'reading-state-api',
        configureServer(server) {
          server.middlewares.use(async (request, response, next) => {
            const url = request.url ? new URL(request.url, 'http://localhost').pathname : '';
            if (url !== '/api/reading-status') {
              return next();
            }

            const fs = await import('node:fs/promises');
            const path = await import('node:path');
            const filePath = path.resolve(process.cwd(), '../content/reading_state.json');

            if (request.method === 'GET') {
              try {
                const data = await fs.readFile(filePath, 'utf-8');
                response.setHeader('Content-Type', 'application/json');
                response.end(data || '{}');
              } catch {
                response.setHeader('Content-Type', 'application/json');
                response.end('{}');
              }
              return;
            }

            if (request.method === 'POST') {
              let body = '';
              request.on('data', (chunk) => {
                body += chunk;
              });
              request.on('end', async () => {
                try {
                  const updates = JSON.parse(body || '{}');
                  /** @type {Record<string, any>} */
                  let existing = {};
                  try {
                    const raw = await fs.readFile(filePath, 'utf-8');
                    existing = JSON.parse(raw || '{}');
                  } catch {
                    existing = {};
                  }

                  for (const [slug, item] of Object.entries(updates)) {
                    if (!item || item.status === 'unread') {
                      delete existing[slug];
                    } else {
                      existing[slug] = item;
                    }
                  }
                  await fs.writeFile(filePath, JSON.stringify(existing, null, 2), 'utf-8');
                  response.setHeader('Content-Type', 'application/json');
                  response.end(JSON.stringify({ ok: true, count: Object.keys(updates).length }));
                } catch (error) {
                  response.statusCode = 500;
                  response.end(JSON.stringify({ error: String(error) }));
                }
              });
              return;
            }

            next();
          });
        },
      },
    ],
  },
});

