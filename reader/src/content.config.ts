import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const posts = defineCollection({
  // Ingest posts across author directories in ../content (e.g. ../content/<author>/posts/*.md)
  loader: glob({
    base: '../content',
    pattern: '*/**/posts/*.{md,mdx}',
  }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      subtitle: z.string().optional(),
      description: z.string().optional().default(''),
      // Map date / pubDate flexibly
      date: z.coerce.date().optional(),
      pubDate: z.coerce.date().optional(),
      updatedDate: z.coerce.date().optional(),
      author: z.string().optional(),
      post_id: z.number().optional(),
      tags: z.array(z.string()).default([]),
      category: z.string().optional(),
      wordcount: z.number().optional(),
      audience: z.string().optional().default('everyone'),
      canonical_url: z.string().optional(),
      cover_image: z.string().optional(),
      heroImage: z.optional(image()),
      focusEffect: z.literal('scroll-dark').optional(),
      homeFeatured: z.boolean().default(false),
      homeHeroOrder: z.number().int().positive().optional(),
      homeOrder: z.number().int().positive().optional(),
      draft: z.boolean().default(false),
    }).transform((data) => {
      // Harmonize pubDate and category with Substack metadata
      const pubDate = data.pubDate || data.date || new Date(0);
      const category = data.category || (data.tags && data.tags.length > 0 ? data.tags[0] : (data.author || 'Essay'));
      const description = data.description || data.subtitle || '';
      return {
        ...data,
        pubDate,
        category,
        description,
      };
    }),
});

export const collections = { posts };
