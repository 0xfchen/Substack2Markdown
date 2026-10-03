import fs from 'node:fs/promises';
import type { Plugin } from 'vite';
import type { Annotation, AnnotationsRecord } from '../../scripts/annotations';
import { getContentPath } from '../paths';

/**
 * Vite dev server plugin providing annotations persistence to content/annotations.json.
 */
export function annotationsApiPlugin(): Plugin {
  return {
    name: 'annotations-api',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const parsedUrl = request.url ? new URL(request.url, 'http://localhost') : null;
        const pathname = parsedUrl ? parsedUrl.pathname : '';
        if (pathname !== '/api/annotations') {
          return next();
        }

        const filePath = getContentPath('annotations.json');

        const readAnnotationsFile = async (): Promise<AnnotationsRecord> => {
          try {
            const rawJson = await fs.readFile(filePath, 'utf-8');
            return JSON.parse(rawJson || '{}');
          } catch {
            return {};
          }
        };

        // GET /api/annotations?slug=<slug>
        if (request.method === 'GET') {
          try {
            const slug = parsedUrl ? parsedUrl.searchParams.get('slug') : null;
            const data = await readAnnotationsFile();
            response.setHeader('Content-Type', 'application/json');
            if (slug) {
              response.end(JSON.stringify(data[slug] || []));
            } else {
              response.end(JSON.stringify(data));
            }
          } catch (error) {
            response.statusCode = 500;
            response.end(JSON.stringify({ error: String(error) }));
          }
          return;
        }

        // POST /api/annotations
        // Payload: { slug: string, annotation: Annotation } or { slug: string, annotations: Annotation[] }
        if (request.method === 'POST') {
          let body = '';
          request.on('data', (chunk: Buffer | string) => {
            body += chunk;
          });
          request.on('end', async () => {
            try {
              const payload = JSON.parse(body || '{}') as {
                slug?: string;
                annotation?: Annotation;
                annotations?: Annotation[];
              };
              const { slug, annotation, annotations } = payload;
              if (!slug) {
                response.statusCode = 400;
                response.end(JSON.stringify({ error: 'Missing slug' }));
                return;
              }

              const data = await readAnnotationsFile();
              const postAnnotations = Array.isArray(data[slug]) ? [...data[slug]] : [];

              if (annotation && annotation.id) {
                const existingIndex = postAnnotations.findIndex((a) => a.id === annotation.id);
                if (existingIndex >= 0) {
                  postAnnotations[existingIndex] = {
                    ...postAnnotations[existingIndex],
                    ...annotation,
                    updatedAt: new Date().toISOString(),
                  };
                } else {
                  postAnnotations.push({
                    ...annotation,
                    createdAt: annotation.createdAt || new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                  });
                }
                data[slug] = postAnnotations;
              } else if (Array.isArray(annotations)) {
                data[slug] = annotations;
              }

              await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
              response.setHeader('Content-Type', 'application/json');
              response.end(JSON.stringify({ ok: true, annotations: data[slug] }));
            } catch (error) {
              response.statusCode = 500;
              response.end(JSON.stringify({ error: String(error) }));
            }
          });
          return;
        }

        // DELETE /api/annotations?slug=<slug>&id=<id> or body { slug, id }
        if (request.method === 'DELETE') {
          const querySlug = parsedUrl ? parsedUrl.searchParams.get('slug') : null;
          const queryId = parsedUrl ? parsedUrl.searchParams.get('id') : null;

          const handleDelete = async (slug: string, id: string) => {
            if (!slug || !id) {
              response.statusCode = 400;
              response.end(JSON.stringify({ error: 'Missing slug or id' }));
              return;
            }
            const data = await readAnnotationsFile();
            if (Array.isArray(data[slug])) {
              data[slug] = data[slug].filter((a) => a.id !== id);
              if (data[slug].length === 0) {
                delete data[slug];
              }
              await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
            }
            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({ ok: true, deleted: id }));
          };

          if (querySlug && queryId) {
            await handleDelete(querySlug, queryId);
            return;
          }

          let body = '';
          request.on('data', (chunk: Buffer | string) => {
            body += chunk;
          });
          request.on('end', async () => {
            try {
              const payload = JSON.parse(body || '{}') as { slug?: string; id?: string };
              await handleDelete(payload.slug || '', payload.id || '');
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
