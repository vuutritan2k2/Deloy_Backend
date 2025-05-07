import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    totalPrice: { type: Number, required: true },
    status: {
      type: String,
      enum: ['Pending', 'Processing', 'Completed', 'Cancelled'],
      required: true,
    },
    items: [
      {
        productId: { type: Number },
        images: [
          {
            url: { type: String, required: true },
            isPrimary: { type: Boolean, default: false }, // Ảnh chính
            order: Number, // Thứ tự hiển thị
            publicId: { type: String }, // Lưu publicId từ Cloudinary để quản lý
          },
        ],
        name: { type: String, required: true },
        productVariationId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Product.variations',
        },
        size: { type: String, required: true },
        color: { type: String, required: true },
        price: { type: Number, required: true },
        quantity: { type: Number, required: true }, // Thêm số lượng sản phẩm
      },
    ],
    payment: {
      method: { type: String, enum: ['Cash', 'Paypal'], required: true },
      transactionId: { type: String }, // Transaction ID là chuỗi
      status: { type: String, enum: ['Pending', 'Completed', 'Failed'], required: true },
    },
    refund: {
      reason: { type: String },
      status: { type: String, enum: ['Requested', 'Approved', 'Rejected', 'Completed'] },
    },
    shippingAddress: {
      fullName: { type: String, required: true },
      phone: { type: String, required: true },
      address: { type: String, required: true },
      distance: { type: Number }, // Khoảng cách từ địa chỉ giao hàng đến cửa hàng
      shippingFee: { type: Number }, // Phí giao hàng
    },
  },
  { timestamps: true } // Tự động thêm createdAt và updatedAt
);

const OrderModel = mongoose.model('Order', orderSchema);
export default OrderModel;
