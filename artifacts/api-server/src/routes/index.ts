import { Router, type IRouter } from "express";
import healthRouter from "./health";
import ambassadorRouter from "./ambassador";
import workspaceRouter from "./workspace";
import portfolioFeedbackRouter from "./portfolio-feedback";
import portfolioContentRouter from "./portfolio-content";
import applicationSharesRouter from "./application-shares";
import caseStudiesRouter from "./case-studies";

const router: IRouter = Router();

router.use(healthRouter);
router.use(ambassadorRouter);
router.use(workspaceRouter);
router.use(portfolioFeedbackRouter);
router.use(portfolioContentRouter);
router.use(applicationSharesRouter);
router.use(caseStudiesRouter);

export default router;
