import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import logger from '../lib/logger';

const recommendSkuSchema = z.object({
  modelId: z.string().min(1),
  parameterCount: z.number().nullable().optional(),
  precision: z.string().default('FP16'),
  concurrency: z.number().default(1),
  region: z.string().default('westus2'),
  maxBudgetPerHour: z.number().nullable().optional(),
  priority: z.string().default('balanced'),
  strategy: z.literal('deterministic').default('deterministic'),
});

const optimusRoutes = new Hono()
  .post('/recommend-sku', zValidator('json', recommendSkuSchema), async (c) => {
    const endpoint = process.env.OPTIMUS_ENDPOINT;
    if (!endpoint) {
      return c.json(
        { error: 'OPTIMUS_ENDPOINT not configured' },
        503,
      );
    }

    const body = c.req.valid('json');
    const url = `${endpoint}/api/recommendVmSku`;

    logger.info({ url, modelId: body.modelId }, 'Proxying to Optimus');

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });

    if (!resp.ok) {
      const text = await resp.text();
      logger.error(
        { status: resp.status, body: text },
        'Optimus request failed',
      );
      return c.json({ error: `Optimus returned ${resp.status}` }, 502);
    }

    const data = await resp.json();
    return c.json(data);
  });

export default optimusRoutes;
