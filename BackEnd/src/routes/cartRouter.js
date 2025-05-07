import express from 'express';
import { addToCart, clearCart, getCartByUserId, updateCart } from '../controllers/cartController.js';
import authMiddleware from '../middleware/authMiddleware.js';

const cartRouter = express.Router();

cartRouter.get('/cartInfo/:userId', authMiddleware, getCartByUserId);
cartRouter.post('/add', authMiddleware, addToCart);
cartRouter.put('/update/:userId', authMiddleware, updateCart);
cartRouter.delete('/delete/:userId', authMiddleware, clearCart);

export default cartRouter;
