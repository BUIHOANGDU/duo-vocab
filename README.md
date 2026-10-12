# Duo Vocab

Duo Vocab là PWA học từ vựng dành cho hai hành trình độc lập:

- **TOEIC — Dự:** 257 mục tiếng Anh từ `toeic_257_tu_day_du.json`.
- **BOEKI 貿易 — Châm:** 198 thuật ngữ tiếng Nhật thương mại từ `tu_vung_boueki_1-198.json`.

Frontend dùng HTML, CSS và JavaScript ES modules thuần. Dữ liệu học lưu trong IndexedDB theo profile; giao diện sáng/tối và profile hiện tại dùng localStorage. Backend Node.js tùy chọn cung cấp Web Push khi ứng dụng đã đóng.

## Chạy trên máy

Yêu cầu Node.js 22.12 trở lên.

```powershell
npm.cmd install
npm.cmd start
```

Mở `http://localhost:4173`. Không mở trực tiếp `index.html` bằng đường dẫn `file://`, vì Service Worker, module và việc đọc JSON cần HTTP.

Các lệnh hữu ích:

```powershell
npm.cmd test              # kiểm thử thuật toán và dữ liệu
npm.cmd run test:browser  # kiểm thử luồng thật bằng Microsoft Edge
npm.cmd run test:boeki    # kiểm thử BOEKI ba ngôn ngữ và hồi quy TOEIC
npm.cmd run test:learning # kiểm thử 25→40 từ và chuyển ngày theo múi giờ
npm.cmd run check         # kiểm tra cú pháp
npm.cmd run build         # tạo bản static trong dist/
```

## Tính năng

- Chuyển nhanh giữa Dự và Châm; thư viện, lịch sử, mục tiêu, SRS và lịch nhắc không dùng chung.
- Dashboard từ dữ liệu thật: từ mới hôm nay, từ đã thuộc, đến hạn, chuỗi ngày, thời gian và biểu đồ 7/30 ngày.
- Flashcard với Again / Hard / Good / Easy và lịch ôn tăng dần theo lịch sử trả lời.
- Trắc nghiệm bốn đáp án, gõ từ, nghe, ôn lỗi sai, Quick Study, thử thách ngày.
- TOEIC Part 5 gồm năm câu mẫu được kiểm tra thủ công và giải thích đáp án.
- BOEKI có Kanji → nghĩa, nghĩa → tiếng Nhật và Kanji → cách đọc. Chế độ ngữ cảnh chỉ dùng các ví dụ thật đã nhập.
- Tìm BOEKI bằng Kanji, Kana, Romaji hoặc nghĩa tiếng Việt; tìm không dấu cũng được hỗ trợ.
- Thêm, sửa, xóa mềm và khôi phục từ. Bản ghi gốc được giữ trong trường `original`.
- Import JSON/CSV, chống nhập trùng, xuất từ, sao lưu và khôi phục toàn bộ tiến độ của từng profile.
- Light/Dark Mode, giao diện mobile-first, bottom navigation, safe area, bàn phím và reduced motion.
- PWA offline cho giao diện, hai bộ JSON và dữ liệu đã học.
- In-app reminder, browser notification và backend Web Push tùy chọn.

## Học BOEKI ba ngôn ngữ

Chọn profile **Châm — BOEKI 貿易 Learner**, rồi vào **Học ngay**. Phần flashcard cho phép chọn đồng thời một hoặc nhiều chiều học:

- Nhật → Anh, Anh → Nhật.
- Nhật → Việt, Việt → Nhật.
- Việt → Anh, Anh → Việt.
- Kanji → Kana.
- Việt → Nhật + Anh.

Mỗi chiều có lịch SRS độc lập. Ví dụ, đánh giá một thẻ Nhật → Anh chỉ cập nhật kỹ năng đó; tiến độ Anh → Nhật và Kanji → Kana vẫn giữ nguyên. Một thuật ngữ chỉ được tính là thuộc toàn diện khi các chiều đang được chọn và có dữ liệu hợp lệ đều đạt chuẩn SRS.

Thẻ luôn mở mặt sau với toàn bộ dữ liệu có sẵn: tiếng Nhật, Kana, Romaji, tiếng Anh, alias, viết tắt, tiếng Việt, ví dụ và ghi chú. Các nút **Tiếng Nhật** và **English** dùng giọng `ja-JP` và `en-US` của thiết bị. Trong **Thư viện từ**, có thể tìm theo cả ba ngôn ngữ, lọc các mục thiếu tiếng Anh, và che từng ngôn ngữ để tự kiểm tra trí nhớ.

Nếu một mục chưa có bản dịch tiếng Anh, ứng dụng hiển thị **Chưa bổ sung tiếng Anh** và loại mục đó khỏi các câu hỏi cần tiếng Anh. Ứng dụng không tự tạo đáp án thay thế. Có thể bổ sung dữ liệu bằng **Thư viện từ → Chỉnh sửa** hoặc nhập JSON/CSV.

Trong **Lịch nhắc học**, BOEKI cho phép chọn Nhật → Anh, Anh → Nhật, luyện Kana và ôn lỗi sai. Nội dung thông báo chỉ đưa ra câu hỏi; khi mở thông báo, ứng dụng đi thẳng đến đúng thuật ngữ và đúng kỹ năng, còn đáp án chỉ hiện sau khi lật thẻ.

## Học từ mới và vốn từ đã học

Duo Vocab dùng một trạng thái tiến độ chung cho mọi chế độ:

- **NEW:** chưa từng hoàn thành lượt học đầu tiên; chỉ xuất hiện trong **Học từ mới**.
- **LEARNING:** đang nằm trong lượt giới thiệu đầu tiên. Tải lại trang sẽ tiếp tục đúng phiên và đúng vị trí.
- **LEARNED:** đã bấm một mức **Hoàn thành** sau khi lật thẻ. Từ này được giữ vĩnh viễn trong vốn từ đã học và có thể dùng trong ôn tập, gõ từ, trắc nghiệm, luyện nghe và thử thách.
- **MASTERED:** đạt ngưỡng SRS thành thạo. Trả lời sai có thể giảm mức thành thạo nhưng không biến từ trở lại thành NEW.

Lật thẻ, phát âm, xem nghĩa hoặc bấm **Quên** không làm tăng bộ đếm từ mới. Một từ chỉ được tính đúng một lần trong toàn bộ lịch sử của profile. Lượt ôn, gõ và quiz cập nhật kết quả ghi nhớ nhưng không tăng lại số từ mới đã học.

TOEIC mặc định cấp tối đa 25 từ NEW trong ngày. Sau khi đạt 25/25, có thể ôn lại, làm quiz, luyện gõ hoặc tăng mục tiêu lên 30, 35, 40 hay 50. Nếu tăng từ 25 lên 40, phiên tiếp theo chỉ cấp thêm 15 từ chưa học. Mục tiêu và tiến độ được lưu riêng cho từng profile.

Mỗi từ vừa hoàn thành có lượt ôn đầu tiên vào ngày địa phương kế tiếp theo múi giờ đã chọn. Luyện thêm trong cùng ngày vẫn ghi nhận đúng/sai nhưng không đẩy lùi lượt ôn đầu tiên. Khi sang ngày mới, bộ đếm hôm nay trở về 0; tổng vốn từ LEARNED và lịch sử SRS vẫn được giữ nguyên.

## Nhập JSON và CSV

Vào **Thư viện từ → Nhập tệp**. Giới hạn mỗi tệp là 15 MB và 20.000 mục. JSON có thể là một mảng hoặc một object chứa `vocabulary`, `words` hay `entries`.

Ví dụ TOEIC:

```json
[
  {
    "word": "invoice",
    "ipa": "/ˈɪnvɔɪs/",
    "meaning": "hóa đơn",
    "deck": "Bài 1",
    "group": "Danh từ"
  }
]
```

Ví dụ BOEKI:

```json
[
  {
    "japanese": "輸出",
    "kana": "ゆしゅつ",
    "romaji": "yushutsu",
    "english": "export",
    "englishAliases": ["exportation"],
    "abbreviation": "EXP",
    "vietnamese": "xuất khẩu",
    "category": "Ngoại thương",
    "exampleJa": "商品を輸出します。",
    "exampleEn": "We export the goods.",
    "exampleVi": "Chúng tôi xuất khẩu hàng hóa.",
    "notes": "Thuật ngữ cơ bản"
  }
]
```

Schema BOEKI cũ với `hiragana`, `chapter`, `word`, `reading` hoặc `meaning` vẫn được chuẩn hóa khi nhập. Trường `english` có thể để trống; khi đó mục được đánh dấu thiếu dữ liệu thay vì tạo bản dịch giả.

CSV dùng UTF-8, dấu phẩy và dòng tiêu đề. Các tên cột giống ví dụ JSON. Trình đọc CSV hỗ trợ dấu phẩy, dấu ngoặc kép và xuống dòng bên trong ô.

Một mục chỉ bị xem là trùng khi từ, nghĩa, bài, nhóm và cách đọc trùng nhau. Vì vậy cùng một từ ở bài khác hoặc nghĩa khác vẫn được giữ.

## Dữ liệu và sao lưu

Dữ liệu nằm trên chính trình duyệt, không tự đồng bộ giữa hai máy. Vào **Cài đặt → Sao lưu tiến độ** để tải backup trước khi đổi máy hoặc xóa dữ liệu trình duyệt. **Khôi phục backup** kiểm tra profile và cấu trúc trước khi thay thế; ứng dụng giữ thêm một snapshot `pre-restore` trong IndexedDB.

Sau khi khôi phục, lịch nhắc được tắt để tránh vô tình đăng ký thông báo trên thiết bị mới. Bật lại trong **Lịch nhắc học**.

## Cài lên iPhone

1. Deploy ứng dụng qua HTTPS và mở bằng Safari.
2. Nhấn **Chia sẻ → Thêm vào Màn hình chính**.
3. Mở Duo Vocab từ biểu tượng trên Màn hình chính.
4. Mở online ít nhất một lần để Service Worker cache nội dung.
5. Vào **Lịch nhắc học → Bật thông báo** nếu dùng iOS/iPadOS 16.4 trở lên.

Trên desktop và Android, dùng nút cài ứng dụng trong thanh địa chỉ hoặc menu trình duyệt.

## Web Push khi ứng dụng đã đóng

Static hosting chỉ hỗ trợ học offline, in-app reminders và browser notification trong phiên đang mở. Muốn nhận thông báo khi ứng dụng đã đóng, cần chạy `backend/server.js` liên tục trên một origin HTTPS.

Tạo khóa VAPID:

```powershell
npm.cmd run vapid
Copy-Item .env.example .env
```

Điền `.env`:

```dotenv
PORT=4173
HOST=0.0.0.0
APP_ORIGIN=https://vocab.example.com
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:admin@example.com
PUSH_SETUP_CODE=mot-chuoi-dai-ngau-nhien
PUSH_DATA_DIR=/var/lib/duo-vocab
```

Sau đó chạy `npm start` bằng process manager như systemd, Docker hoặc nền tảng Node.js, đặt reverse proxy HTTPS phía trước và gắn volume bền vững cho `PUSH_DATA_DIR`. Cả trang web và `/api/*` phải ở đúng `APP_ORIGIN`; không đặt private VAPID key trong frontend.

Trên từng trình duyệt, vào **Lịch nhắc học**, nhập `PUSH_SETUP_CODE` một lần rồi nhấn **Bật thông báo**. Server chỉ lưu endpoint Push, lịch/múi giờ, ID profile và từ/cách đọc cần cho thông báo; tệp lưu có quyền chỉ chủ tiến trình đọc. Mỗi thiết bị sinh token riêng. Mã ghép nối bảo vệ việc đăng ký thiết bị mới.

Các endpoint Push chỉ cho phép danh sách hostname của Apple, Google, Mozilla và Microsoft nhằm tránh server-side request forgery. Hãy dùng một mã ghép nối dài, giới hạn truy cập `.env`, sao lưu volume runtime và đặt thêm rate limiting ở reverse proxy nếu triển khai công khai.

## Deploy

### Bản static

```powershell
npm.cmd ci
npm.cmd run build
```

Đưa toàn bộ thư mục `dist/` lên static host HTTPS. Bản này không gửi Web Push theo lịch khi ứng dụng đã đóng; giao diện sẽ nói rõ backend chưa cấu hình.

### Bản có Web Push

Deploy toàn bộ repository trên dịch vụ Node.js 22+, chạy `npm ci --omit=dev` rồi `npm start`. Cấu hình các biến môi trường ở trên, HTTPS, persistent volume và health monitoring cho tiến trình. Không chạy nhiều replica cùng ghi một `subscriptions.json`; nếu cần scale ngang, thay file store bằng database và scheduler có khóa phân tán.

## Cấu trúc chính

```text
index.html                 giao diện gốc
css/style.css              thiết kế responsive, light/dark
js/app.js                  router và điều phối tương tác
js/storage.js              IndexedDB, ghi nguyên tử
js/progress-model.js       trạng thái NEW/LEARNING/LEARNED và migration
js/data-import.js          normalizer JSON/CSV và backup
js/spaced-repetition.js    thuật toán lịch ôn
js/learning-engine.js      chọn từ đến hạn và từ mới
js/flashcards.js           giao diện phiên học
js/boeki-engine.js         schema, kỹ năng và SRS BOEKI độc lập
js/boeki-flashcards.js     phiên học BOEKI ba ngôn ngữ
js/boeki-views.js          dashboard, thư viện và cài đặt BOEKI
js/quiz.js                 quiz và TOEIC Part 5
js/notifications.js        Notification, Push subscription, outbox
js/reminder-rules.js       lịch nhắc dùng chung frontend/backend
backend/server.js          static server và Web Push scheduler
manifest.webmanifest       metadata PWA
sw.js                      offline cache và Push handler
tests/                     kiểm thử lõi và trình duyệt
```

## Giới hạn hiện tại

- Chưa có tài khoản hoặc cloud sync; hai thiết bị trao đổi dữ liệu qua backup.
- Hai JSON gốc chưa có câu ví dụ, từ loại hoặc audio thu sẵn cho mọi mục. Ứng dụng không bịa nội dung còn thiếu; phát âm dùng giọng Text-to-Speech của thiết bị.
- BOEKI Context Practice chỉ khả dụng với từ có ví dụ chứa chính thuật ngữ.
- Backend mẫu dùng một file JSON phù hợp cho triển khai nhỏ, một tiến trình. Production nhiều replica cần database và job queue.
- Việc giao Push cuối cùng phụ thuộc trình duyệt, hệ điều hành, quyền người dùng và dịch vụ Push của thiết bị; server ghi nhận yêu cầu gửi chứ không thể bảo đảm thiết bị luôn hiển thị.
