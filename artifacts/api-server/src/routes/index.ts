import { Router, type IRouter } from "express";
import healthRouter from "./health";
import ambassadorRouter from "./ambassador";
import workspaceRouter from "./workspace";

const router: IRouter = Router();

router.use(healthRouter);
router.use(ambassadorRouter);
router.use(workspaceRouter);

export default router;
