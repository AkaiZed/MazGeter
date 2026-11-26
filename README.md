# MazGeter

**All-in-One Desktop Download Manager & Media Downloader** cho Windows — kết hợp sức mạnh tải đa luồng/Torrent của **Motrix (`aria2c`)** và tải video/audio 70+ nền tảng + công cụ media của **XGetter (`yt-dlp` + `ffmpeg`)**.

## Tính năng chính
- **Smart AIO Engine**: Tự động nhận diện link video/mạng xã hội (YouTube, TikTok, Facebook, Instagram, X, Bilibili...) dùng `yt-dlp + ffmpeg` hoặc link tải file trực tiếp / Magnet / Torrent dùng `aria2c` đa luồng.
- **Motrix-style Task Manager**: Quản lý hàng đợi tải xuống theo thời gian thực (Đang tải / Đang chờ / Hoàn thành), tạm dừng, tiếp tục, hủy, giới hạn tốc độ, mở thư mục chứa file.
- **XGetter-style Media Studio**: Phân tích link video lấy thumbnail, chọn chất lượng lên tới 4K/8K, tải MP4/MP3, tách phụ đề (SRT/VTT), cắt đoạn video/audio theo thời gian (`start` → `end`).
- **FFmpeg Media Tools**: Chuyển đổi định dạng (MP4, MP3, WebM, WAV, MKV), tách âm thanh, cắt video ngay trên máy mà không cần tải lại.
- **Chạy 100% Local**: Sử dụng trực tiếp IP mạng nhà, không qua server trung gian, không bị YouTube chặn IP Datacenter.

## Phát triển & Chạy thử
```powershell
npm install
npm run dev
```

## Đóng gói Windows (.exe)
```powershell
npm run dist:win
```
