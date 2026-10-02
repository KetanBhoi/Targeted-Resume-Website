import { Router, type IRouter } from "express";
import healthRouter from "./health";
import ambassadorRouter from "./ambassador";
import workspaceRouter from "./workspace";
import portfolioFeedbackRouter from "./portfolio-feedback";
import portfolioContentRouter from "./portfolio-content";

const router: IRouter = Router();

router.use(healthRouter);
router.use(ambassadorRouter);
router.use(workspaceRouter);
router.use(portfolioFeedbackRouter);
router.use(portfolioContentRouter);

export default router;
