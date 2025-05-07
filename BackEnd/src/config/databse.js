import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const connectDB = async () => {
  try {
    const mongoUrl = `mongodb+srv://tuannghiait2905:${process.env.MONGO_PASS}@cluster0.ghwxa.mongodb.net/IUH_KLTN?retryWrites=true&w=majority&appName=Cluster0`;
    await mongoose.connect(mongoUrl, {});
    console.log('MongoDB connected');
  } catch (error) {
    console.error('MongoDB connection failed', error);
    process.exit(1); // Hàm này kết thúc quá trình với mã thoát là 1, thường được sử dụng để chỉ ra rằng quá trình đã kết thúc với lỗi.
  }
};

export default connectDB;
