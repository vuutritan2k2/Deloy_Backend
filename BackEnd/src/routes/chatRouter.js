import express from 'express';
import { chatWithAI, chatWithCoze } from '../controllers/chatController.js';

const chatRouter = express.Router();

chatRouter.post('/', chatWithAI);
chatRouter.post('/chatWithCoze', chatWithCoze);

export default chatRouter;
