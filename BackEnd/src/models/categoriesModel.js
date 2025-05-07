import mongoose from 'mongoose';
import AutoIncrementFactory from 'mongoose-sequence';

const AutoIncrement = AutoIncrementFactory(mongoose);

const categorySchema = new mongoose.Schema(
  {
    type: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
);

// Auto-increment id field
categorySchema.plugin(AutoIncrement, { inc_field: 'categoryId', start_seq: 1 });

const CategoryModel = mongoose.model('Category', categorySchema);
export default CategoryModel;
