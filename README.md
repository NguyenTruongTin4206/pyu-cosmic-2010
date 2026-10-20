# PYU Cosmic 20/10

Trang web 3D chúc mừng ngày Phụ nữ Việt Nam 20/10 dành cho CLB Bóng chuyền PYU.
Công nghệ: Vite, TypeScript, Three.js, GSAP.

## Chạy thử
```
npm install
npm run dev
npm run build
```

## Chất lượng hình ảnh và độ ổn định
Trang tự chọn 1 trong 4 mức (Cao, Cân bằng, Nhẹ, Siêu nhẹ) theo thiết bị, và tự giảm mức nếu thấy giật.
Có thể ép mức bằng tham số trên link:

- `?q=0` đến `?q=3`: chọn mức cụ thể (0 là đẹp nhất, 3 là nhẹ nhất)
- `?lite`: chế độ nhẹ, `?hq`: chế độ đẹp nhất
- `?debug`: hiện bảng chẩn đoán (tên GPU, FPS, mức chất lượng, số lần mất WebGL)

Nút ⚙ ở thanh điều khiển cũng đổi mức chất lượng được.
