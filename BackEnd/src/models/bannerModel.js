import mongoose from 'mongoose';

const bannerSchema = new mongoose.Schema({
  alt: { type: String, required: true },
  url: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const BannerModel = mongoose.model('Banner', bannerSchema);

export default BannerModel;
