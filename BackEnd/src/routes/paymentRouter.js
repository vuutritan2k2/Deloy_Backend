import express from 'express';
import { createOrder, paypalCancel, paypalSuccess, shippingFee } from '../controllers/paymentController.js';
import authMiddleware from '../middleware/authMiddleware.js';

const paymentRouter = express.Router();

// Tính phí vận chuyển
paymentRouter.post('/calculate-shipping-fee', authMiddleware, shippingFee);

// Đặt hàng
paymentRouter.post('/createOrder', authMiddleware, createOrder);

// Xử lý thanh toán paypal
paymentRouter.get('/paypal/success', paypalSuccess);

paymentRouter.get('/paypal/cancel', paypalCancel);
export default paymentRouter;
