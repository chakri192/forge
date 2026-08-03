import { Router } from 'express';
import { HallOfFameService } from '../services/hallOfFameService.js';
import { requirePermission } from '../middleware/auth.js';
import { validate, hallOfFameSchemas } from '../middleware/validation.js';

const router = Router();

router.get('/hall-of-fame', validate({}), (_req, res, next) => {
  try {
    res.json(HallOfFameService.getHallOfFameData());
  } catch (err) {
    next(err);
  }
});

function awardTitleHandler(req, res, next) {
  try {
    const titleId = HallOfFameService.awardTitle(req.body);
    res.json({ success: true, titleId });
  } catch (err) {
    next(err);
  }
}

router.post('/hall-of-fame/award', requirePermission('HOF_AWARD'), validate(hallOfFameSchemas.award), awardTitleHandler);
router.post('/hall-of-fame/titles', requirePermission('HOF_AWARD'), validate(hallOfFameSchemas.award), awardTitleHandler);

export default router;
