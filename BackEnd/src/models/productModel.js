import mongoose from 'mongoose';
import AutoIncrementFactory from 'mongoose-sequence';

const AutoIncrement = AutoIncrementFactory(mongoose);

const productSchema = new mongoose.Schema(
  {
    productId: { type: Number, unique: true }, // ID tự động tăng
    name: { type: String, required: true },
    price: { type: Number, required: true },
    description: { type: String, required: true }, // ❌ Sửa lỗi trùng lặp
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: false,
    },
    images: [
      {
        url: { type: String, required: true },
        isPrimary: { type: Boolean, default: false }, // Ảnh chính
        order: Number, // Thứ tự hiển thị
        publicId: { type: String }, // Lưu publicId từ Cloudinary để quản lý
      },
    ],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },

    // ✅ Tách `size` & `color` thành mảng biến thể
    variations: [
      {
        size: { type: String, required: true },
        color: { type: String, required: true },
        amount: { type: Number, required: true },
      },
    ],
  },
  {
    timestamps: true, // Tự động thêm `createdAt` & `updatedAt`
  }
);

// ✅ Tạo Auto Increment cho `productId`
productSchema.plugin(AutoIncrement, { inc_field: 'productId', start_seq: 1 });

const ProductModel = mongoose.model('Product', productSchema);

export default ProductModel;
