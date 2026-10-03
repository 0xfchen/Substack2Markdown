import fs from 'node:fs/promises';
import type { Plugin } from 'vite';
import type { ReadingItemState, ReadingState } from '../../scripts/reading-tracker';
import { getContentPath } from '../paths';

/**
 * Vite dev server plugin providing reading status persistence to content/reading_state.json.
 */
export function readingStateApiPlugin(): Plugin {
  return {
    name: 'reading-state-api',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const url = request.url ? new URL(request.url, 'http://localhost').pathname : '';
        if (url !== '/api/reading-status') {
          return next();
        }

        const filePath = getContentPath('reading_state.json');

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
          request.on('data', (chunk: Buffer | string) => {
            body += chunk;
          });
          request.on('end', async () => {
            try {
              const updates = JSON.parse(body || '{}') as Record<string, ReadingItemState | null>;
              let existingReadingState: ReadingState = {};
              try {
                const rawJson = await fs.readFile(filePath, 'utf-8');
                existingReadingState = JSON.parse(rawJson || '{}');
              } catch {
                existingReadingState = {};
              }

              for (const [slug, item] of Object.entries(updates)) {
                if (!item || item.status === 'unread') {
                  delete existingReadingState[slug];
                } else {
                  existingReadingState[slug] = item;
                }
              }
              await fs.writeFile(filePath, JSON.stringify(existingReadingState, null, 2), 'utf-8');
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
  };
}
