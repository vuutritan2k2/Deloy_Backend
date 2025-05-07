import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import {
  deleteUser,
  getListUser,
  getUserAddresses,
  getUserInfo,
  updateUser,
  updateUserById,
} from '../controllers/userController.js';
import authAdminMiddleware from '../middleware/authAdminMiddleware.js';

const userRouter = express.Router();

userRouter.get('/getAll', authAdminMiddleware, getListUser);
userRouter.get('/userInfo', authMiddleware, getUserInfo);
userRouter.get('/listAddress', authMiddleware, getUserAddresses);
userRouter.patch('/updateUser', authMiddleware, updateUser);
userRouter.patch('/updateUser/:id', authAdminMiddleware, updateUserById);
userRouter.delete('/delete/:id', authAdminMiddleware, deleteUser);

export default userRouter;
