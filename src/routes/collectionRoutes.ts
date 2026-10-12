import { Router } from 'express';
import { getMyBoosters, getMyBurns, getMyCarnets, getMyNotebook, getMyNotebooks, postAckBurns, postOpenBooster, postPlaceCopy, postUnplaceCopy } from '../controllers/collectionController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);
router.get('/boosters', getMyBoosters);
router.post('/boosters/:id/open', postOpenBooster);
router.get('/notebooks', getMyNotebooks);
router.get('/carnet', getMyCarnets);
router.get('/notebooks/:editionId', getMyNotebook);
router.post('/notebooks/:editionId/place', postPlaceCopy);
router.post('/notebooks/:editionId/unplace', postUnplaceCopy);
router.get('/burns', getMyBurns);
router.post('/burns/ack', postAckBurns);

export default router;
