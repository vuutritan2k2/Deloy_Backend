import { createCategory, deleteCategory, getAllCategory, updateCategory } from '../controllers/categoryController.js';
import express from 'express';
import authAdminMiddleware from '../middleware/authAdminMiddleware.js';
const categoryRouter = express.Router();

categoryRouter.get('/', getAllCategory);
categoryRouter.post('/create', authAdminMiddleware, createCategory);
categoryRouter.patch('/update', authAdminMiddleware, updateCategory);
categoryRouter.delete('/delete', authAdminMiddleware, deleteCategory);

export default categoryRouter;
