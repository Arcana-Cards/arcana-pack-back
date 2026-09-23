import { Request, Response, NextFunction } from 'express';
import { getProfile, listUsers, loginUser, registerUser } from '../services/authService.js';

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await registerUser(req.body);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await loginUser(req.body);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function profile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await getProfile(req.user!.userId);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function users(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await listUsers();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}
