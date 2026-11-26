# MazGeter

**All-in-One Desktop Download Manager & Media Studio** cho Windows — tích hợp trình tải file đa luồng / Torrent (`aria2c`), tải video/âm thanh đa nền tảng (`yt-dlp`), xử lý media (`ffmpeg`) và bộ cắt sóng âm trực quan ngay trên máy tính.

## Tính năng chính
- **Dual-Engine thông minh**:
  - **`aria2c` (JSON-RPC)**: Tải file HTTP/HTTPS/FTP đa luồng tốc độ cao (lên tới 32 luồng), tạm dừng/tiếp tục, lưu phiên tải, hỗ trợ **Magnet link** và **file `.torrent`**.
  - **`yt-dlp` + `ffmpeg`**: Tải video/âm thanh từ hơn 70 nền tảng trực tuyến (lên tới 4K/8K, MP4, MKV, MP3, M4A, WAV), hỗ trợ playlist.
- **Bộ cắt Sóng âm & Timeline trực quan**:
  - Tự động quét sóng âm thật (hiển thị rõ khoảng lặng phục vụ luyện nghe ngoại ngữ / tách câu).
  - Kéo thả mốc đầu – cuối chính xác tới `0.1s`, hỗ trợ cuộn chuột phóng to trục thời gian `1.0x – 20.0x` và nghe/xem thử trực tiếp.
- **FFmpeg Media Tools**: Chuyển đổi định dạng (MP4, MKV, WebM, MP3, M4A, WAV), tách âm thanh, cắt đoạn video offline ngay trên máy.
- **Chạy 100% Local**: Hoạt động trực tiếp bằng IP mạng cá nhân, bảo mật dữ liệu và không phụ thuộc server trung gian.

## Phát triển & Chạy thử
```powershell
npm install
npm run dev
```

Hoặc bấm đúp `Start-MazGeter.bat` sau khi build (`npm run build`).

## Đóng gói Windows (.exe)
```powershell
npm run dist:win
```
