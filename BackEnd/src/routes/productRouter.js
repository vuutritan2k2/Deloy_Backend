import express from 'express';
import {
  createProduct,
  getAllProducts,
  getAllProductsByCategoryId,
  getAllProductsCount,
  getSingleProduct,
  deleteProduct,
  updateProduct,
} from '../controllers/productController.js';
import multer from 'multer';
import authAdminMiddleware from '../middleware/authAdminMiddleware.js';

const productRouter = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

productRouter.post(
  '/create',
  authAdminMiddleware,
  upload.array('images', 5), // Giới hạn tối đa 5 ảnh
  createProduct
);
productRouter.get('/getAllProducts', getAllProducts);
productRouter.get('/getAllProducts/:categoryId', getAllProductsByCategoryId);
productRouter.get('/getProductsCount', getAllProductsCount);
productRouter.get('/:id', getSingleProduct);
productRouter.delete('/:id', authAdminMiddleware, deleteProduct);
productRouter.put('/update/:id', authAdminMiddleware, updateProduct);

export default productRouter;
