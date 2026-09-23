import { Request, Response, NextFunction } from 'express';
import { getNotebook, listCarnets, listNotebooks, listUserBoosters, openBooster, placeCopy, unplaceCopy } from '../services/collectionService.js';

export async function getMyBoosters(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const opened = req.query.opened === '1' ? true : req.query.opened === '0' ? false : undefined;
    const data = await listUserBoosters(req.user!.userId, opened);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function postOpenBooster(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await openBooster(req.user!.userId, Number(req.params.id));
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function getMyNotebooks(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ success: true, data: await listNotebooks(req.user!.userId) });
  } catch (error) {
    next(error);
  }
}

export async function getMyCarnets(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ success: true, data: await listCarnets(req.user!.userId) });
  } catch (error) {
    next(error);
  }
}

export async function getMyNotebook(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await getNotebook(req.user!.userId, Number(req.params.editionId));
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

function readCopyId(req: Request): number {
  const raw = (req.body as { copyId?: unknown })?.copyId;
  return Number(raw);
}

function readSlotIndex(req: Request): number {
  const raw = (req.body as { slotIndex?: unknown })?.slotIndex;
  return Number(raw);
}

export async function postPlaceCopy(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await placeCopy(req.user!.userId, Number(req.params.editionId), readCopyId(req), readSlotIndex(req));
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function postUnplaceCopy(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await unplaceCopy(req.user!.userId, Number(req.params.editionId), readCopyId(req));
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}
