import { Router, type IRouter } from "express";
import healthRouter from "./health";
import ambassadorRouter from "./ambassador";

const router: IRouter = Router();

router.use(healthRouter);
router.use(ambassadorRouter);

export default router;
