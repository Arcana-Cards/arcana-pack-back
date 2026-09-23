import { Router } from 'express';
import {
  getAdminUsers,
  getAiStatus,
  getCards,
  getEditions,
  getGiphySearch,
  getTemplates,
  getUniverses,
  patchCard,
  patchEdition,
  patchTemplate,
  patchUniverse,
  postArt,
  fetchRemoteArt,
  postAiFromGif,
  postAiFromTheme,
  postCard,
  postCardsBatch,
  postEdition,
  postGrant,
  postTemplate,
  postUniverse,
  removeCard,
  removeEdition,
  removeTemplate,
  removeUniverse,
} from '../controllers/catalogController.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { artUpload } from '../middleware/upload.js';

const router = Router();

router.use(authMiddleware, requireAdmin);

router.get('/universes', getUniverses);
router.post('/universes', postUniverse);
router.patch('/universes/:id', patchUniverse);
router.delete('/universes/:id', removeUniverse);
router.get('/editions', getEditions);
router.post('/editions', postEdition);
router.patch('/editions/:id', patchEdition);
router.delete('/editions/:id', removeEdition);
router.get('/cards', getCards);
router.post('/cards', postCard);
router.post('/cards/batch', postCardsBatch);
router.get('/ai/status', getAiStatus);
router.post('/ai/from-gif', postAiFromGif);
router.post('/ai/from-theme', postAiFromTheme);
router.get('/giphy/search', getGiphySearch);
router.post('/uploads/art', artUpload.single('file'), postArt);
router.get('/uploads/fetch', fetchRemoteArt);
router.patch('/cards/:id', patchCard);
router.delete('/cards/:id', removeCard);
router.get('/boosters', getTemplates);
router.post('/boosters', postTemplate);
router.patch('/boosters/:id', patchTemplate);
router.delete('/boosters/:id', removeTemplate);
router.get('/users', getAdminUsers);
router.post('/users/:id/boosters', postGrant);

export default router;
