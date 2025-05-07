import express from 'express';
import { createBanner, deleteBanner, getBannerAdmin, getBanners } from '../controllers/bannerController.js';
import multer from 'multer';
import authAdminMiddleware from '../middleware/authAdminMiddleware.js';

const bannerRouter = express.Router();
const upload = multer({ storage: multer.memoryStorage() });
bannerRouter.get('/getAll', getBanners);
bannerRouter.get('/getAllByAdmin', authAdminMiddleware, getBannerAdmin);
bannerRouter.post('/create', authAdminMiddleware, upload.single('image'), createBanner);
bannerRouter.delete('/delete/:id', authAdminMiddleware, deleteBanner);

export default bannerRouter;
