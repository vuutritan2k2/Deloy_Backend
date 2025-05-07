import express from 'express';
import { check } from 'express-validator';
import {
  createUser,
  login,
  loginAdmin,
  refreshToken,
  logout,
  resetPassword,
  updatePassword,
} from '../controllers/authController.js';

const authRouter = express.Router();

authRouter.post(
  '/register',
  [
    check('userName').notEmpty().withMessage('User name is required'),
    check('fullName').notEmpty().withMessage('Full name is required'),
    check('phone').notEmpty().withMessage('Phone number is required'),
    check('address').notEmpty().withMessage('Address is required'),
    check('email').isEmail().withMessage('Email is invalid'),
    check('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
    check('role').notEmpty().withMessage('Role is required'),
  ],
  createUser
);

authRouter.post('/login', login);
authRouter.post('/reset-password', resetPassword);
authRouter.post('/update-password', updatePassword);
authRouter.post('/login/admin', loginAdmin);
authRouter.post('/refresh_token', refreshToken);
authRouter.post('/logout', logout);

export default authRouter;
