import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import { listCards, getCard, createCard, createCards, updateCard, deleteCard, normalizeCardInput, ensureCollectorOrder } from '../services/cardService.js';
import { aiStatus, draftFromGif, draftsFromTheme, searchGiphyGifs, type AiProgressEvent } from '../services/aiCardService.js';
import { createEdition, createUniverse, deleteEdition, deleteUniverse, listEditions, listUniverses, updateEdition, updateUniverse } from '../services/catalogService.js';
import { createTemplate, deleteTemplate, grantBoosters, listTemplates, updateTemplate } from '../services/boosterService.js';
import { listUsers } from '../services/authService.js';
import { AppError } from '../middleware/errorHandler.js';
import type { Rarity } from '../types/index.js';

export async function getUniverses(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ success: true, data: await listUniverses() });
  } catch (error) {
    next(error);
  }
}

export async function postUniverse(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await createUniverse(req.body);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function patchUniverse(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ success: true, data: await updateUniverse(Number(req.params.id), req.body) });
  } catch (error) {
    next(error);
  }
}

export async function getEditions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const universeId = req.query.universeId ? Number(req.query.universeId) : undefined;
    res.json({ success: true, data: await listEditions(universeId) });
  } catch (error) {
    next(error);
  }
}

export async function postEdition(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await createEdition(req.body);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function patchEdition(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ success: true, data: await updateEdition(Number(req.params.id), req.body) });
  } catch (error) {
    next(error);
  }
}

export async function removeEdition(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await deleteEdition(Number(req.params.id));
    res.json({ success: true, data: { deleted: true } });
  } catch (error) {
    next(error);
  }
}

export async function removeUniverse(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await deleteUniverse(Number(req.params.id));
    res.json({ success: true, data: { deleted: true } });
  } catch (error) {
    next(error);
  }
}

export async function getCards(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await ensureCollectorOrder();
    const data = await listCards({
      universeId: req.query.universeId ? Number(req.query.universeId) : undefined,
      editionId: req.query.editionId ? Number(req.query.editionId) : undefined,
      rarity: req.query.rarity as Rarity | undefined,
    });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function getCardById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ success: true, data: await getCard(Number(req.params.id)) });
  } catch (error) {
    next(error);
  }
}

export async function postCard(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = normalizeCardInput(req.body);
    const data = await createCard(input, req.user!.userId);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function postCardsBatch(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const items = Array.isArray(req.body?.cards) ? req.body.cards : [];
    if (!items.length) throw new AppError('Aucune carte à créer', 400);
    if (items.length > 40) throw new AppError('Maximum 40 cartes à la fois', 400);
    const data = await createCards(
      items.map((item: unknown) => normalizeCardInput(item as object)),
      req.user!.userId,
    );
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function getAiStatus(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ success: true, data: aiStatus() });
  } catch (error) {
    next(error);
  }
}

export async function postAiFromGif(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await draftFromGif({
      url: String(req.body?.url || ''),
      universeId: Number(req.body?.universeId),
      editionId: Number(req.body?.editionId),
    });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function postAiFromTheme(req: Request, res: Response, next: NextFunction): Promise<void> {
  const stream = String(req.headers.accept || '').includes('text/event-stream');
  const payload = {
    theme: String(req.body?.theme || ''),
    universeId: Number(req.body?.universeId),
    editionId: Number(req.body?.editionId),
    count: req.body?.count != null ? Number(req.body.count) : undefined,
    urls: req.body?.urls,
  };
  if (!stream) {
    try {
      const data = await draftsFromTheme(payload);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
    return;
  }

  req.setTimeout(0);
  req.socket.setNoDelay(true);
  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const send = (event: string, data: unknown) => {
    if (res.writableEnded) return;
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    const flush = (res as { flush?: () => void }).flush;
    if (typeof flush === 'function') flush.call(res);
  };

  try {
    const data = await draftsFromTheme({
      ...payload,
      onProgress: (event: AiProgressEvent) => send('progress', event),
      onDrafts: (drafts) => send('drafts', { drafts }),
    });
    send('done', { drafts: data });
    res.end();
  } catch (error) {
    send('error', { error: error instanceof Error ? error.message : 'Génération impossible' });
    res.end();
  }
}

export async function getGiphySearch(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await searchGiphyGifs(String(req.query.q || ''), Number(req.query.limit) || 16);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function patchCard(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await updateCard(Number(req.params.id), req.body);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function removeCard(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await deleteCard(Number(req.params.id));
    res.json({ success: true, data: { deleted: true } });
  } catch (error) {
    next(error);
  }
}

export async function getTemplates(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ success: true, data: await listTemplates() });
  } catch (error) {
    next(error);
  }
}

export async function postTemplate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await createTemplate(req.body);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function patchTemplate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await updateTemplate(Number(req.params.id), req.body);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function removeTemplate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await deleteTemplate(Number(req.params.id));
    res.json({ success: true, data: { deleted: true } });
  } catch (error) {
    next(error);
  }
}

export async function getAdminUsers(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ success: true, data: await listUsers() });
  } catch (error) {
    next(error);
  }
}

export async function postArt(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.file) throw new AppError('Fichier image ou gif requis', 400);
    res.status(201).json({ success: true, data: { url: `/uploads/cards/${req.file.filename}` } });
  } catch (error) {
    next(error);
  }
}

export async function fetchRemoteArt(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const raw = String(req.query.url || '').trim();
    if (!raw) throw new AppError('URL requise', 400);
    if (raw.startsWith('/uploads/cards/')) {
      const name = path.basename(raw);
      const folder = path.resolve(process.cwd(), 'uploads/cards');
      const file = path.resolve(folder, name);
      if (!file.startsWith(`${folder}${path.sep}`) || !fs.existsSync(file)) throw new AppError('Fichier introuvable', 404);
      res.sendFile(file);
      return;
    }
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      throw new AppError('URL invalide', 400);
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new AppError('URL invalide', 400);
    const upstream = await fetch(url.href, { redirect: 'follow' });
    if (!upstream.ok) throw new AppError('GIF introuvable', 400);
    const buf = Buffer.from(await upstream.arrayBuffer());
    if (buf.length > 12 * 1024 * 1024) throw new AppError('GIF trop lourd', 413);
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'image/gif');
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.send(buf);
  } catch (error) {
    next(error);
  }
}

export async function postGrant(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const ids = await grantBoosters(
      Number(req.params.id),
      Number(req.body.templateId),
      Number(req.body.quantity ?? 1),
      req.user!.userId,
    );
    res.status(201).json({ success: true, data: { granted: ids.length, ids } });
  } catch (error) {
    next(error);
  }
}
