import { Router } from 'express';
import { getCardById, getCards, getEditions, getTemplates, getUniverses } from '../controllers/catalogController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);
router.get('/universes', getUniverses);
router.get('/editions', getEditions);
router.get('/cards', getCards);
router.get('/cards/:id', getCardById);
router.get('/boosters', getTemplates);

export default router;
