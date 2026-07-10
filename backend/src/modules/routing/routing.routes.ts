import { Router } from 'express';
import { calculateRoute, routeRateLimit } from './routing.controller';
import { authenticateToken } from '../../middleware/auth.middleware';

const routingRouter = Router();

routingRouter.post('/route', authenticateToken, routeRateLimit, calculateRoute);

export default routingRouter;
