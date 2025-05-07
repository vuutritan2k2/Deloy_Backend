import express from 'express';
import BannerModel from '../models/bannerModel.js';
import multer from 'multer';
import cloudinary from '../config/cloudinary.js';
import { ROLE } from '../constant/role.js';

// Lấy danh sách banner và sắp xếp dựa theo order DESC hoặc ASC
// /banners/getAll?sort=createdAt&type=DESC
const getBanners = async (req, res) => {
  BannerModel.find() // Tìm tất cả các banner trong cơ sở dữ liệu
    .then((banners) =>
      res.status(200).json({
        data: banners, // Trả về danh sách các banner
      })
    ) // Trả về danh sách các banner dưới dạng JSON với mã trạng thái 200
    .catch((err) => res.status(500).json({ message: 'Cannot get banners', error: err.message })); // Xử lý lỗi và trả về mã trạng thái 500
};

const getBannerAdmin = async (req, res) => {
  const { page, limit, sort, type } = req.query; // Lấy các tham số page, limit và sort từ query string của request
  const pageNumber = parseInt(page); // Chuyển đổi tham số page thành số nguyên
  const limitNumber = parseInt(limit); // Chuyển đổi tham số limit thành số nguyên

  const sortObject = { [sort]: type === 'DESC' ? -1 : 1 }; // Tạo object sort dựa trên tham số sort và type

  const sortKey = Object.keys(sortObject)[0]; // Lấy key của object sort
  const sortValue = Object.values(sortObject)[0]; // Lấy value của object sort
  const totalBanners = await BannerModel.countDocuments();
  BannerModel.find() // Tìm tất cả các banner trong cơ sở dữ liệu
    .sort({ [sortKey]: sortValue }) // Sắp xếp các banner theo key và value được cung cấp
    .skip((pageNumber - 1) * limitNumber) // Bỏ qua một số lượng banner nhất định để phân trang
    .limit(limitNumber) // Giới hạn số lượng banner trả về
    .then((banners) =>
      res.status(200).json({
        data: banners,
        pagination: {
          page: pageNumber,
          limit: limitNumber,
          total: totalBanners,
        },
      })
    ) // Trả về danh sách các banner dưới dạng JSON với mã trạng thái 200
    .catch((err) => res.status(500).json({ message: 'Cannot get banners', error: err.message })); // Xử lý lỗi và trả về mã trạng thái 500
};

// tạo banner
const createBanner = async (req, res) => {
  const { alt } = req.body;

  // Lấy file từ request
  const imageFile = req.file;
  console.log('imageFile', imageFile);

  if (!imageFile) {
    return res.status(400).json({
      success: false,
      message: 'No image file found in request',
    });
  }

  //   Cấu hình bộ nhớ tạm cho multer
  const storage = multer.memoryStorage();
  multer({ storage });

  //   Upload lên cloud dinary
  const result = await cloudinary.uploader.upload_stream(
    {
      folder: 'banners',
      allowed_formats: ['jpg', 'png', 'jpeg', 'gif', 'webp'], // Cho phép WebP
      format: 'webp', // Ép kiểu thành WebP
      transformation: [
        { quality: 'auto', fetch_format: 'webp' }, // Chuyển về WebP tự động
        { width: 1920, crop: 'fill', gravity: 'auto' }, // Resize ảnh
      ],
    },
    (error, result) => {
      if (error) {
        return res.status(500).json({ message: 'Upload failed', error });
      }
      const newBanner = new BannerModel({
        alt,
        url: result.secure_url,
      });

      newBanner
        .save()
        .then((banner) => res.status(201).json(banner))
        .catch((err) => res.status(500).json({ message: 'Cannot create banner', error: err.message }));
    }
  );
  result.end(imageFile.buffer); // Kết thúc quá trình upload
};

// Xóa banner
const deleteBanner = async (req, res) => {
  const { id } = req.params;

  try {
    // Tìm banner trong database trước
    const banner = await BannerModel.findById(id);

    if (!banner) {
      return res.status(404).json({ message: 'Banner not found' });
    }

    // Lấy public_id từ URL của Cloudinary
    // URL Cloudinary thường có dạng: https://res.cloudinary.com/{cloud_name}/image/upload/v{version}/{public_id}.{format}
    const urlParts = banner.url.split('/');
    const fileName = urlParts[urlParts.length - 1]; // Lấy phần cuối của URL
    const publicId = `banners/${fileName.split('.')[0]}`; // Tạo public_id (thêm folder 'banners')

    // Xóa ảnh trên Cloudinary
    await cloudinary.uploader.destroy(publicId);

    // Sau khi xóa trên Cloudinary thành công, xóa trong database
    await BannerModel.findByIdAndDelete(id);

    res.status(200).json({ message: 'Delete banner successfully' });
  } catch (err) {
    console.error('Error deleting banner:', err);
    res.status(500).json({
      message: 'Cannot delete banner',
      error: err.message,
    });
  }
};

export { getBanners, getBannerAdmin, createBanner, deleteBanner };
