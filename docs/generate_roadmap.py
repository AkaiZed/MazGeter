import os
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_PATH = os.path.join(BASE_DIR, "LoTrinh_PhatTrien_MazGeter.docx")


def set_cell_shading(cell, color_hex: str):
    shading = OxmlElement("w:shd")
    shading.set(qn("w:fill"), color_hex)
    cell._tc.get_or_add_tcPr().append(shading)


def add_heading_styled(doc: Document, text: str, level: int = 1):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(14 if level == 1 else 10)
    p.paragraph_format.space_after = Pt(4)
    run = p.add_run(text)
    run.bold = True
    if level == 1:
        run.font.size = Pt(14)
        run.font.color.rgb = RGBColor(0x4F, 0x46, 0xE5)  # Indigo 600
    else:
        run.font.size = Pt(11.5)
        run.font.color.rgb = RGBColor(0x0F, 0x17, 0x2A)
    return p


def add_bullet(doc: Document, bold_prefix: str, text: str):
    p = doc.add_paragraph(style="List Bullet")
    p.paragraph_format.space_before = Pt(2)
    p.paragraph_format.space_after = Pt(3)
    if bold_prefix:
        r_bold = p.add_run(bold_prefix)
        r_bold.bold = True
        r_bold.font.size = Pt(10.5)
    r_text = p.add_run(text)
    r_text.font.size = Pt(10.5)
    return p


def add_table(doc: Document, headers, rows):
    table = doc.add_table(rows=1 + len(rows), cols=len(headers))
    table.style = "Table Grid"
    hdr_cells = table.rows[0].cells
    for i, h in enumerate(headers):
        hdr_cells[i].text = ""
        run = hdr_cells[i].paragraphs[0].add_run(h)
        run.bold = True
        run.font.size = Pt(10)
        run.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
        set_cell_shading(hdr_cells[i], "312E81")

    for r_idx, row in enumerate(rows):
        row_cells = table.rows[r_idx + 1].cells
        bg = "F8FAFC" if r_idx % 2 == 1 else "FFFFFF"
        for c_idx, val in enumerate(row):
            row_cells[c_idx].text = ""
            run = row_cells[c_idx].paragraphs[0].add_run(val)
            run.font.size = Pt(9.5)
            set_cell_shading(row_cells[c_idx], bg)
    doc.add_paragraph()


def build_doc():
    doc = Document()

    for section in doc.sections:
        section.top_margin = Inches(0.75)
        section.bottom_margin = Inches(0.75)
        section.left_margin = Inches(0.8)
        section.right_margin = Inches(0.8)

    # Title
    p_title = doc.add_paragraph()
    p_title.alignment = WD_ALIGN_PARAGRAPH.LEFT
    r_title = p_title.add_run("MAZGETER — LỘ TRÌNH PHÁT TRIỂN & NHẬT KÝ TRIỂN KHAI")
    r_title.bold = True
    r_title.font.size = Pt(18)
    r_title.font.color.rgb = RGBColor(0x31, 0x2E, 0x81)

    # Metadata subtitle
    p_meta = doc.add_paragraph()
    p_meta.paragraph_format.space_after = Pt(6)
    r_meta = p_meta.add_run(
        "Thư mục: E:\\ProfileGit\\MazGeter  |  Git: AkaiZed/MazGeter (main)  |  Nền tảng: Windows Desktop (Electron + React)  |  v1.0 (26/11/2026)"
    )
    r_meta.font.size = Pt(9.5)
    r_meta.font.color.rgb = RGBColor(0x47, 0x55, 0x69)

    p_intro = doc.add_paragraph(
        "Tài liệu này tổng hợp kiến trúc, môi trường cài đặt, lộ trình phát triển và nhật ký các tính năng đã hoàn thiện của MazGeter — trình quản lý tải xuống và xử lý media All-in-One trên Windows. Khi cập nhật tính năng mới, hãy chạy lại script docs/generate_roadmap.py để đồng bộ tài liệu."
    )
    p_intro.runs[0].font.size = Pt(10.5)

    # 1. Tổng quan
    add_heading_styled(doc, "1. Tổng quan & Mục tiêu sản phẩm", 1)
    add_bullet(doc, "Tên dự án & Repo: ", "MazGeter (AkaiZed/MazGeter — thư mục local E:\\ProfileGit\\MazGeter).")
    add_bullet(
        doc,
        "Mục đích sử dụng: ",
        "Ứng dụng Desktop All-in-One cho Windows, tích hợp tải file đa luồng/Torrent, tải video/âm thanh từ hơn 70 nền tảng trực tuyến, cắt sóng âm luyện nghe và xử lý chuyển đổi media ngay trên máy.",
    )
    add_bullet(
        doc,
        "Lợi thế kiến trúc Local: ",
        "Chạy trực tiếp trên máy người dùng bằng IP mạng nhà, tránh tình trạng bị chặn IP Datacenter (Render/Cloud) và không cần server trung gian hay cookies.",
    )
    add_bullet(
        doc,
        "Trải nghiệm người dùng: ",
        "Chạy duy nhất 1 phiên (Single Instance), tắt cửa sổ là thoát hoàn toàn (không chạy ngầm), có icon nhận diện riêng và giao diện tối giản hiện đại.",
    )

    # 2. Môi trường
    add_heading_styled(doc, "2. Hiện trạng Môi trường & Tài nguyên (E:\\ProfileGit\\Enviroment)", 1)
    add_table(
        doc,
        ["Thành phần", "Phiên bản / Vai trò", "Đường dẫn trên máy"],
        [
            ["Node.js & npm", "v24.19.0 / 11.17.0 (Build Electron + Vite + React)", "C:\\Program Files\\nodejs\\"],
            ["aria2c", "v1.37.0 (Lõi tải đa luồng HTTP/HTTPS/FTP & Torrent/Magnet)", "E:\\ProfileGit\\Enviroment\\aria2\\aria2c.exe"],
            ["yt-dlp", "Lõi phân tích & tải video/audio từ 70+ nền tảng", "E:\\ProfileGit\\Enviroment\\python\\mediadownloader-venv\\Scripts\\yt-dlp.exe"],
            ["FFmpeg & FFprobe", "Giải mã sóng âm, ghép video/audio, cắt & convert media", "E:\\ProfileGit\\Enviroment\\ffmpeg\\bin\\"],
        ],
    )

    # 3. Kiến trúc kỹ thuật
    add_heading_styled(doc, "3. Kiến trúc kỹ thuật tổng thể", 1)
    add_bullet(
        doc,
        "Desktop Shell (Electron + TypeScript): ",
        "Quản lý vòng đời ứng dụng (electron/main.ts), khóa Single Instance, tự động dò binary (electron/binResolver.ts), lưu cấu hình & lịch sử tải tại %APPDATA%\\MazGeter\\mazgeter-store.json.",
    )
    add_bullet(
        doc,
        "Giao diện UI (React 19 + Vite + Tailwind CSS v4): ",
        "Thanh tiêu đề tùy biến, Sidebar điều hướng kèm bộ đo tốc độ toàn cục, danh sách tác vụ real-time (Đang tải / Đang chờ / Hoàn thành), Media Tools (FFmpeg Studio) và trang Cài đặt.",
    )
    add_bullet(
        doc,
        "Engine tải file & Torrent (aria2Engine.ts): ",
        "Khởi chạy aria2c.exe ngầm qua JSON-RPC nội bộ (port 16808), hỗ trợ tới 32 luồng tải song song, pause/resume, lưu session tự động, Magnet link và file .torrent.",
    )
    add_bullet(
        doc,
        "Engine Media & Waveform Trimmer (mediaEngine.ts + TimelineTrimmer.tsx): ",
        "Phân tích link bằng yt-dlp; khi chọn MP3/M4A/WAV sẽ quét sóng âm thật bằng phương pháp 8x Parallel HTTP Range Fetch + FFmpeg (chỉ ~1–3 giây cho bài nghe 15 phút) để hiện rõ khoảng lặng. Hỗ trợ phóng to trục thời gian 1.0x–20.0x bằng con lăn chuột để căn chỉnh chính xác.",
    )

    # 4. Lộ trình
    add_heading_styled(doc, "4. Lộ trình phát triển theo từng Giai đoạn", 1)

    add_heading_styled(doc, "Giai đoạn 1 (MVP) — Khung AIO, Lõi kép & Bộ cắt Waveform [HOÀN THÀNH]", 2)
    add_bullet(doc, "Lõi tải kép: ", "Tích hợp hoàn chỉnh aria2c JSON-RPC (tải đa luồng, Torrent/Magnet) và yt-dlp + FFmpeg (70+ nền tảng).")
    add_bullet(doc, "Giao diện quản lý tác vụ: ", "Quản lý hàng đợi, mở file/thư mục nhanh, Media Tools (convert, tách nhạc, cắt video offline).")
    add_bullet(doc, "Bộ cắt Sóng âm & Timeline Zoom: ", "Tối giản (chỉ hiện sau khi phân tích link), hiển thị sóng âm xanh rõ ngắt quãng, kéo đầu–cuối chính xác 0.1s, cuộn chuột zoom 1x–20x.")
    add_bullet(doc, "Đóng gói & Vận hành: ", "Single Instance, tắt là thoát dứt khoát không chạy ngầm, icon riêng và file Start-MazGeter.bat.")

    add_heading_styled(doc, "Giai đoạn 2 — Đóng gói phát hành Windows (.exe Installer / Portable) [TIẾP THEO]", 2)
    add_bullet(doc, "Nhúng Binary độc lập: ", "Đưa aria2c.exe, yt-dlp.exe, ffmpeg.exe vào resources/bin/ để build bộ cài NSIS & bản Portable qua electron-builder (người dùng tải về chạy ngay không cần cài môi trường).")
    add_bullet(doc, "Cổng tải trên Web: ", "Đưa bản release MazGeter.exe lên GitHub Releases và liên kết lên trang cổng tải mazdownloader.vercel.app.")

    add_heading_styled(doc, "Giai đoạn 3 — Mở rộng tiện ích nâng cao", 2)
    add_bullet(doc, "Tự động cập nhật yt-dlp: ", "Thêm nút cập nhật yt-dlp.exe ngay trong phần Cài đặt để luôn tương thích thuật toán mới của các nền tảng video.")
    add_bullet(doc, "Browser Extension / Deep Link: ", "Bắt link tải trực tiếp từ trình duyệt Chrome/Edge/Cốc Cốc chuyển thẳng vào MazGeter.")

    # 5. Changelog
    add_heading_styled(doc, "5. Nhật ký chỉnh sửa & Cập nhật (Changelog)", 1)
    add_table(
        doc,
        ["Phiên bản / Ngày", "Nội dung cập nhật chính", "Trạng thái"],
        [
            ["v1.0 — 26/11/2026 (Khởi tạo)", "Dựng repo MazGeter (Electron + React + Tailwind v4), tải aria2c v1.37.0, kết nối yt-dlp & FFmpeg, hoàn thiện TaskList, MediaToolsView, SettingsView.", "Hoàn thành"],
            ["v1.0.1 — 26/11/2026", "Bỏ phần tải phụ đề, thêm Waveform Trimmer trực quan cho MP3/M4A/WAV và thanh cắt Video hỗ trợ cuộn chuột zoom.", "Hoàn thành"],
            ["v1.0.2 — 26/11/2026", "Ẩn thanh cắt khi chưa phân tích link; tối ưu quét sóng âm bằng luồng nhẹ nhất + 8x parallel HTTP Range fetch (giảm thời gian quét 15p xuống ~3.15s).", "Hoàn thành"],
            ["v1.0.3 — 26/11/2026", "Bật Single Instance (1 phiên duy nhất), bỏ chạy ngầm Tray (đóng là thoát hẳn), tạo icon PNG/ICO riêng và xuất tài liệu Word.", "Hoàn thành"],
        ],
    )

    doc.save(OUT_PATH)
    print(f"Saved: {OUT_PATH}")


if __name__ == "__main__":
    build_doc()
