import type { FastifyInstance } from 'fastify';
import { processImage } from '../lib/image.js';
import crypto from 'node:crypto';

export default async function listingRoutes(fastify: FastifyInstance) {
  // Create listing (protected)
  fastify.post<{
    Body: {
      title: string;
      description: string;
      category_id?: number;
      payment_methods: string[];
      price_indication?: string;
      currency?: string;
    };
  }>(
    '/listings',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = request.user!.sub;
      const { title, description, category_id, payment_methods, price_indication, currency } =
        request.body;

      if (!title || title.length < 3 || title.length > 200) {
        return reply.status(400).send({ error: 'Title must be 3-200 characters' });
      }
      if (!description || description.length < 10 || description.length > 5000) {
        return reply.status(400).send({ error: 'Description must be 10-5000 characters' });
      }
      if (!payment_methods || !Array.isArray(payment_methods) || payment_methods.length === 0) {
        return reply.status(400).send({ error: 'At least one payment method is required' });
      }
      if (payment_methods.length > 5) {
        return reply.status(400).send({ error: 'Maximum 5 payment methods' });
      }

      const validMethods = ['btc', 'xmr', 'eth', 'cash', 'bank_transfer'];
      for (const method of payment_methods) {
        if (!validMethods.includes(method)) {
          return reply.status(400).send({ error: `Invalid payment method: ${method}` });
        }
      }

      if (price_indication !== undefined && price_indication !== null) {
        if (typeof price_indication !== 'string' || price_indication.length > 100) {
          return reply.status(400).send({ error: 'price_indication must be 100 characters or less' });
        }
      }
      if (currency !== undefined && currency !== null) {
        if (typeof currency !== 'string' || currency.length > 10) {
          return reply.status(400).send({ error: 'currency must be 10 characters or less' });
        }
      }

      if (category_id) {
        const cat = await fastify.pg.query('SELECT id FROM categories WHERE id = $1', [
          category_id,
        ]);
        if (cat.rows.length === 0) {
          return reply.status(400).send({ error: 'Invalid category' });
        }
      }

      const result = await fastify.pg.query(
        `INSERT INTO listings (user_id, title, description, category_id, payment_methods, price_indication, currency)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, user_id, title, description, category_id, payment_methods, price_indication, currency, status, created_at, updated_at`,
        [
          userId,
          title,
          description,
          category_id || null,
          JSON.stringify(payment_methods),
          price_indication || null,
          currency || null,
        ],
      );

      return reply.status(201).send(result.rows[0]);
    },
  );

  // Get single listing
  fastify.get<{ Params: { id: string } }>('/listings/:id', async (request, reply) => {
    const { id } = request.params;

    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(id)) {
      return reply.status(400).send({ error: 'Invalid listing id' });
    }

    const result = await fastify.pg.query(
      `SELECT l.*, u.nickname as seller_nickname,
              c.name as category_name, c.slug as category_slug,
              COALESCE(
                (SELECT json_agg(json_build_object('id', li.id, 'storage_key', li.storage_key, 'order_index', li.order_index) ORDER BY li.order_index)
                 FROM listing_images li WHERE li.listing_id = l.id), '[]'
              ) as images
       FROM listings l
       JOIN users u ON u.id = l.user_id
       LEFT JOIN categories c ON c.id = l.category_id
       WHERE l.id = $1`,
      [id],
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Listing not found' });
    }

    return reply.send(result.rows[0]);
  });

  // List/search listings
  fastify.get<{
    Querystring: {
      q?: string;
      category?: string;
      payment_method?: string;
      status?: string;
      user_id?: string;
      page?: string;
      limit?: string;
    };
  }>('/listings', async (request, reply) => {
    const {
      q,
      category,
      payment_method,
      status = 'active',
      user_id,
      page = '1',
      limit = '20',
    } = request.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    // Build WHERE conditions (shared between count and list queries)
    const conditions: string[] = [];
    const filterValues: (string | number)[] = [];
    let paramIdx = 1;

    if (status) {
      conditions.push(`l.status = $${paramIdx++}`);
      filterValues.push(status);
    }

    if (user_id) {
      conditions.push(`l.user_id = $${paramIdx++}::uuid`);
      filterValues.push(user_id);
    }

    if (category) {
      conditions.push(`c.slug = $${paramIdx++}`);
      filterValues.push(category);
    }

    if (payment_method) {
      conditions.push(`l.payment_methods @> $${paramIdx++}::jsonb`);
      filterValues.push(JSON.stringify([payment_method]));
    }

    // Store the param index for q so we can reference it in ORDER BY too
    let qParamIdx: number | null = null;
    if (q) {
      qParamIdx = paramIdx;
      conditions.push(`l.search_vector @@ plainto_tsquery('english', $${paramIdx++})`);
      filterValues.push(q);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count total
    const countRes = await fastify.pg.query(
      `SELECT COUNT(*) FROM listings l
       LEFT JOIN categories c ON c.id = l.category_id
       ${where}`,
      filterValues,
    );
    const total = parseInt(countRes.rows[0].count, 10);

    // Build ORDER BY — reuse the same $N param for ts_rank
    const orderBy = qParamIdx
      ? `ts_rank(l.search_vector, plainto_tsquery('english', $${qParamIdx})) DESC, l.created_at DESC`
      : 'l.created_at DESC';

    // Fetch listings with pagination params appended
    const listValues = [...filterValues, limitNum, offset];
    const listResult = await fastify.pg.query(
      `SELECT l.id, l.title, l.price_indication, l.currency, l.payment_methods,
              l.status, l.created_at, u.nickname as seller_nickname,
              c.name as category_name, c.slug as category_slug,
              (SELECT li.storage_key FROM listing_images li WHERE li.listing_id = l.id ORDER BY li.order_index LIMIT 1) as thumbnail
       FROM listings l
       JOIN users u ON u.id = l.user_id
       LEFT JOIN categories c ON c.id = l.category_id
       ${where}
       ORDER BY ${orderBy}
       LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
      listValues,
    );

    return reply.send({
      listings: listResult.rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  });

  // Update listing (protected, owner only)
  fastify.put<{
    Params: { id: string };
    Body: {
      title?: string;
      description?: string;
      category_id?: number | null;
      payment_methods?: string[];
      price_indication?: string;
      currency?: string;
      status?: string;
    };
  }>(
    '/listings/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = request.user!.sub;
      const { id } = request.params;

      // Verify ownership
      const existing = await fastify.pg.query(
        'SELECT user_id, status FROM listings WHERE id = $1',
        [id],
      );
      if (existing.rows.length === 0) {
        return reply.status(404).send({ error: 'Listing not found' });
      }
      if (existing.rows[0].user_id !== userId) {
        return reply.status(403).send({ error: 'Not your listing' });
      }

      const body = request.body;
      const updates: string[] = [];
      const values: (string | number | null)[] = [];
      let paramIdx = 1;

      if (body.title !== undefined) {
        if (body.title.length < 3 || body.title.length > 200) {
          return reply.status(400).send({ error: 'Title must be 3-200 characters' });
        }
        updates.push(`title = $${paramIdx++}`);
        values.push(body.title);
      }

      if (body.description !== undefined) {
        if (body.description.length < 10 || body.description.length > 5000) {
          return reply.status(400).send({ error: 'Description must be 10-5000 characters' });
        }
        updates.push(`description = $${paramIdx++}`);
        values.push(body.description);
      }

      if (body.category_id !== undefined) {
        if (body.category_id !== null) {
          const cat = await fastify.pg.query('SELECT id FROM categories WHERE id = $1', [
            body.category_id,
          ]);
          if (cat.rows.length === 0) {
            return reply.status(400).send({ error: 'Invalid category' });
          }
        }
        updates.push(`category_id = $${paramIdx++}`);
        values.push(body.category_id);
      }

      if (body.payment_methods !== undefined) {
        if (!Array.isArray(body.payment_methods) || body.payment_methods.length === 0) {
          return reply.status(400).send({ error: 'At least one payment method is required' });
        }
        if (body.payment_methods.length > 5) {
          return reply.status(400).send({ error: 'Maximum 5 payment methods' });
        }
        const validMethods = ['btc', 'xmr', 'eth', 'cash', 'bank_transfer'];
        for (const method of body.payment_methods) {
          if (!validMethods.includes(method)) {
            return reply.status(400).send({ error: `Invalid payment method: ${method}` });
          }
        }
        updates.push(`payment_methods = $${paramIdx++}`);
        values.push(JSON.stringify(body.payment_methods));
      }

      if (body.price_indication !== undefined) {
        if (body.price_indication !== null && body.price_indication.length > 100) {
          return reply.status(400).send({ error: 'price_indication must be 100 characters or less' });
        }
        updates.push(`price_indication = $${paramIdx++}`);
        values.push(body.price_indication);
      }

      if (body.currency !== undefined) {
        if (body.currency !== null && body.currency.length > 10) {
          return reply.status(400).send({ error: 'currency must be 10 characters or less' });
        }
        updates.push(`currency = $${paramIdx++}`);
        values.push(body.currency);
      }

      if (body.status !== undefined) {
        const validStatuses = ['active', 'paused', 'sold', 'removed'];
        if (!validStatuses.includes(body.status)) {
          return reply.status(400).send({ error: 'Invalid status' });
        }
        updates.push(`status = $${paramIdx++}`);
        values.push(body.status);
      }

      if (updates.length === 0) {
        return reply.status(400).send({ error: 'No fields to update' });
      }

      updates.push(`updated_at = now()`);
      values.push(id);

      const result = await fastify.pg.query(
        `UPDATE listings SET ${updates.join(', ')} WHERE id = $${paramIdx}
         RETURNING id, user_id, title, description, category_id, payment_methods, price_indication, currency, status, created_at, updated_at`,
        values,
      );

      return reply.send(result.rows[0]);
    },
  );

  // Delete listing (protected, owner only)
  fastify.delete<{ Params: { id: string } }>(
    '/listings/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = request.user!.sub;
      const { id } = request.params;

      const existing = await fastify.pg.query(
        'SELECT user_id FROM listings WHERE id = $1',
        [id],
      );
      if (existing.rows.length === 0) {
        return reply.status(404).send({ error: 'Listing not found' });
      }
      if (existing.rows[0].user_id !== userId) {
        return reply.status(403).send({ error: 'Not your listing' });
      }

      // Delete images from MinIO
      const images = await fastify.pg.query(
        'SELECT storage_key FROM listing_images WHERE listing_id = $1',
        [id],
      );
      for (const img of images.rows) {
        try {
          await fastify.minio.removeObject(fastify.minioBucket, img.storage_key);
        } catch {
          // Ignore if image doesn't exist in storage
        }
      }

      await fastify.pg.query('DELETE FROM listings WHERE id = $1', [id]);
      return reply.send({ ok: true });
    },
  );

  // Upload images for a listing (protected, owner only, max 5)
  fastify.post<{ Params: { id: string } }>(
    '/listings/:id/images',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = request.user!.sub;
      const { id } = request.params;

      // Verify ownership
      const existing = await fastify.pg.query(
        'SELECT user_id FROM listings WHERE id = $1',
        [id],
      );
      if (existing.rows.length === 0) {
        return reply.status(404).send({ error: 'Listing not found' });
      }
      if (existing.rows[0].user_id !== userId) {
        return reply.status(403).send({ error: 'Not your listing' });
      }

      // Check current image count
      const countResult = await fastify.pg.query(
        'SELECT COUNT(*) FROM listing_images WHERE listing_id = $1',
        [id],
      );
      const currentCount = parseInt(countResult.rows[0].count, 10);
      if (currentCount >= 5) {
        return reply.status(400).send({ error: 'Maximum 5 images per listing' });
      }

      const data = await request.file();
      if (!data) {
        return reply.status(400).send({ error: 'No file uploaded' });
      }

      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(data.mimetype)) {
        return reply.status(400).send({ error: 'Only JPEG, PNG, and WebP images are allowed' });
      }

      // Read full file into buffer for magic-byte validation + EXIF stripping
      const rawBuffer = await data.toBuffer();

      let processed: { buffer: Buffer; mime: string };
      try {
        processed = await processImage(rawBuffer, data.mimetype);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Invalid image';
        return reply.status(400).send({ error: msg });
      }

      const ext = processed.mime.split('/')[1] === 'jpeg' ? 'jpg' : processed.mime.split('/')[1];
      const key = `listings/${id}/${crypto.randomUUID()}.${ext}`;

      await fastify.minio.putObject(fastify.minioBucket, key, processed.buffer, {
        'Content-Type': processed.mime,
      });

      const imgResult = await fastify.pg.query(
        `INSERT INTO listing_images (listing_id, storage_key, order_index)
         VALUES ($1, $2, $3)
         RETURNING id, storage_key, order_index`,
        [id, key, currentCount],
      );

      return reply.status(201).send(imgResult.rows[0]);
    },
  );

  // Delete a listing image (protected, owner only)
  fastify.delete<{ Params: { id: string; imageId: string } }>(
    '/listings/:id/images/:imageId',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = request.user!.sub;
      const { id, imageId } = request.params;

      // Verify listing ownership
      const existing = await fastify.pg.query(
        'SELECT user_id FROM listings WHERE id = $1',
        [id],
      );
      if (existing.rows.length === 0) {
        return reply.status(404).send({ error: 'Listing not found' });
      }
      if (existing.rows[0].user_id !== userId) {
        return reply.status(403).send({ error: 'Not your listing' });
      }

      const img = await fastify.pg.query(
        'SELECT storage_key FROM listing_images WHERE id = $1 AND listing_id = $2',
        [imageId, id],
      );
      if (img.rows.length === 0) {
        return reply.status(404).send({ error: 'Image not found' });
      }

      try {
        await fastify.minio.removeObject(fastify.minioBucket, img.rows[0].storage_key);
      } catch {
        // Ignore
      }

      await fastify.pg.query('DELETE FROM listing_images WHERE id = $1', [imageId]);
      return reply.send({ ok: true });
    },
  );

  // Get categories
  fastify.get('/categories', async (_request, reply) => {
    const result = await fastify.pg.query(
      'SELECT id, name, slug, parent_id FROM categories ORDER BY name',
    );
    return reply.send({ categories: result.rows });
  });
}
