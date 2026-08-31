import { Router } from 'express';
import {
  createPreLaunchRegistration,
} from '../controllers/prelaunch-registration.controller';

const router = Router();

router.post(
  '/',
  createPreLaunchRegistration
);

export default router;