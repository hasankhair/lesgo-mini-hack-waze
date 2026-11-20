import { z } from 'zod';

export const REPORT_TYPES = [
  'accident',
  'traffic_jam',
  'roadblock',
  'police',
  'construction',
  'flood',
  'hazard',
  'breakdown',
  'other',
];

const latitude = z.coerce.number().min(-90).max(90);
const longitude = z.coerce.number().min(-180).max(180);
export const latLng = z.object({ lat: latitude, lng: longitude });

const trimmedText = (max) =>
  z
    .string()
    .trim()
    .max(max)
    // Strip control characters; the frontend renders text, never HTML.
    .transform((s) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ''));

export const uuidParam = z.object({ id: z.uuid() });

export const geocodeSearchQuery = z.object({
  q: z.string().trim().min(2, 'Type at least 2 characters.').max(200),
  lat: latitude.optional(),
  lng: longitude.optional(),
  limit: z.coerce.number().int().min(1).max(10).default(6),
  lang: z.string().regex(/^[a-z]{2}$/).optional(),
});

export const reverseQuery = z.object({ lat: latitude, lng: longitude });

export const routeBody = z.object({
  origin: latLng,
  destination: latLng,
  preference: z.enum(['fastest', 'shortest']).default('fastest'),
  avoidTolls: z.boolean().default(false),
});

export const bboxQuery = z.object({
  bbox: z
    .string()
    .transform((value, ctx) => {
      const parts = value.split(',').map(Number);
      const [minLng, minLat, maxLng, maxLat] = parts;
      const valid =
        parts.length === 4 &&
        parts.every(Number.isFinite) &&
        minLat >= -90 && maxLat <= 90 && minLng >= -180 && maxLng <= 180 &&
        minLat < maxLat && minLng < maxLng;
      if (!valid) {
        ctx.addIssue({ code: 'custom', message: 'bbox must be "minLng,minLat,maxLng,maxLat".' });
        return z.NEVER;
      }
      if (maxLat - minLat > 5 || maxLng - minLng > 5) {
        ctx.addIssue({ code: 'custom', message: 'Area too large. Zoom in to load reports.' });
        return z.NEVER;
      }
      return { minLng, minLat, maxLng, maxLat };
    }),
});

export const createReportBody = z.object({
  report_type: z.enum(REPORT_TYPES),
  description: trimmedText(280).optional().default(''),
  latitude,
  longitude,
});

export const voteBody = z.object({
  type: z.enum(['confirm', 'not_present']),
});

export const savedLocationBody = z.object({
  location_name: trimmedText(80).pipe(z.string().min(1, 'Name is required.')),
  category: z.enum(['home', 'work', 'favorite']).default('favorite'),
  address: trimmedText(300).optional(),
  latitude,
  longitude,
});

export const savedLocationPatch = savedLocationBody.partial().refine((v) => Object.keys(v).length > 0, {
  message: 'Nothing to update.',
});

export const historyBody = z.object({
  origin: z.object({ label: trimmedText(300).optional(), lat: latitude, lng: longitude }).optional(),
  destination: z.object({ label: trimmedText(300).pipe(z.string().min(1)), lat: latitude, lng: longitude }),
  distance: z.number().min(0).max(5e7),
  duration: z.number().min(0).max(1e7),
});

export const profilePatch = z
  .object({
    username: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9_.-]{3,30}$/, 'Username must be 3–30 letters, numbers, dots, dashes or underscores.')
      .optional(),
    avatar_url: z
      .union([z.url({ protocol: /^https$/ }).max(500), z.literal(''), z.null()])
      .optional()
      .transform((v) => (v === '' ? null : v)),
    save_history: z.boolean().optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), { message: 'Nothing to update.' });

export const limitQuery = z.object({ limit: z.coerce.number().int().min(1).max(100).default(20) });
