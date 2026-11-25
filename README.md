# Góp Sức

Đồ án web gây quỹ cộng đồng. Khách có thể chọn chiến dịch, ủng hộ tiền bằng QR mô phỏng, hẹn góp hiện vật, tra cứu trạng thái và chia sẻ chiến dịch. Người tổ chức quản lý nhu cầu và lịch bàn giao. Quản trị viên duyệt chiến dịch và công bố khoản chi. Dữ liệu, ảnh và giao dịch đều phục vụ demo.

## Chạy trên máy

Cài Node.js 24, sau đó chạy:

```sh
npm ci
npm run dev
```

Mở [localhost:3100](http://localhost:3100). Ở **Trang quản trị**, dùng `gopsuc-organizer-demo` cho người tổ chức hoặc `gopsuc-admin-demo` cho quản trị viên. Hai tài khoản mẫu chỉ dùng được ở chế độ phát triển. Để chạy bản production, đặt hai mật khẩu khác nhau dài ít nhất 12 ký tự trong `.env.local` rồi chạy `npm run build` và `npm start`. Xem `.env.example`.

SQLite tạo dữ liệu mẫu ở `.data/gopsuc.sqlite` trong lần chạy đầu. Để có dữ liệu demo mới mà vẫn giữ lần chạy trước, đặt `DATABASE_FILE` thành đường dẫn đến một tệp SQLite mới. Dùng ổ đĩa bền vững nếu host. Với địa chỉ HTTPS hoặc khi truy cập từ máy khác, đặt `SITE_URL` đúng địa chỉ dùng để mở web. QR chỉ mở phiếu demo. Website không kết nối ngân hàng hay nhận tiền thật.

## Cách hệ thống hoạt động

Để tập bảo vệ với dữ liệu mẫu mới, chạy `npm run build` rồi `npm run preview:clean` và mở [127.0.0.1:3101](http://127.0.0.1:3101). Mỗi lần khởi động tạo một tệp SQLite riêng và giữ dữ liệu đang dùng ở cổng 3100. Nếu cần dùng trang quản trị ở bản dựng này, đặt mật khẩu theo hướng dẫn production ở trên.

| Phần | Nơi đọc mã | Quy tắc |
|---|---|---|
| Giao diện và chia sẻ | `app/chien-dich`, `components/client.tsx` | Trang chiến dịch và cập nhật có URL riêng, ảnh Open Graph; hộp chia sẻ có nút Facebook, sao chép và menu chia sẻ nếu thiết bị hỗ trợ. |
| Tiền và hiện vật | `app/api/gopsuc/route.ts`, `lib/db.ts` | Kiểm tra đầu vào ở máy chủ, cập nhật trong giao dịch SQLite, xác nhận tiền lặp chỉ cộng một lần. Lịch hẹn giữ chỗ hiện vật và ghi số thực nhận riêng. |
| Quản trị và thu chi | `app/quan-tri`, `lib/session.ts` | Máy chủ kiểm tra vai trò trước thao tác. Chỉ quản trị viên có thể duyệt, đóng và ghi khoản chi. Các khoản chi vượt số dư bị từ chối. |
| Ảnh bàn giao | `lib/update-image.ts`, `app/api/gopsuc/photos` | Người tổ chức có thể thêm một ảnh JPEG, PNG hoặc WebP vào bài cập nhật. Máy chủ giới hạn 4 MB, nén thành WebP tối đa 1280 px, loại metadata rồi lưu cùng bài. Ảnh của chiến dịch chờ duyệt chưa có URL truy cập công khai. |
| AI tìm cách góp | `lib/match.ts` | Phân loại gần nhất từ các câu tiếng Việt gắn nhãn. Chuẩn hóa dấu, dùng đặc trưng từ/cặp từ và tính độ tương đồng cosine. Sau khi nhận dạng loại hiện vật, lấy số lượng và lịch còn mở từ SQLite. Nếu câu có một số lượng rõ ràng và cùng đơn vị, biểu mẫu điền sẵn tối đa số còn nhận. |

Mô hình phân loại chạy cục bộ, dùng bộ ví dụ nhỏ và có ngưỡng từ chối. Đây là AI theo phạm vi hẹp, không cần khóa API. Người dùng vẫn có thể duyệt chiến dịch thủ công. Bản đồ án kế thừa luồng QR, số tiền nhanh, ẩn danh, công khai giao dịch và ảnh cập nhật từ ý tưởng A1K45. Mã trên repo này là bản đồ án riêng với dữ liệu demo, chức năng hiện vật, quản trị đa chiến dịch, tra cứu, chia sẻ và AI được triển khai cho đề tài mới.

## Kịch bản trình bày cho ba người

1. **Người 1 — khách ủng hộ và chia sẻ.** Mở chiến dịch lớp học, bấm chia sẻ, tạo QR 50k dưới chế độ ẩn danh và xác nhận. Mở lại bằng mã tra cứu để thấy khoản góp đã ghi nhận. Trình bày lý do số tiền chờ không có trong tổng tiền.
2. **Người 2 — quản trị và minh bạch.** Tạo chiến dịch bằng vai trò người tổ chức. Đăng nhập vai trò quản trị viên để duyệt. Mở phần thu chi và thử ghi một khoản vượt số dư. Giải thích cách cookie phiên và API quản lý quyền.
3. **Người 3 — hiện vật và AI.** Nhập “Mình có 15 bộ dụng cụ học tập” rồi mở kết quả để thấy biểu mẫu điền sẵn 15 bộ. Tạo phiếu hẹn, xác nhận thực nhận 12, rồi thử nhập 90 bộ để thấy hệ thống chỉ đề xuất phần còn nhận. Hỏi “mình có một cây đàn piano” để minh họa trường hợp không có nhu cầu phù hợp.

GitHub lưu lịch sử triển khai. Khi trình bày, ghi rõ phần nào được AI hỗ trợ tạo và phần nào nhóm tự kiểm tra, chỉnh sửa hoặc bổ sung. Mỗi thành viên nên chạy thử luồng mình trình bày và xem một tệp mã tương ứng.

## Kiểm tra và đóng góp

```sh
npm run check
npm test
npm run build
```

Tạo nhánh riêng cho mỗi thay đổi rồi mở pull request. GitHub Actions chạy kiểm tra kiểu dữ liệu, kiểm thử và build. Tệp cơ sở dữ liệu, cấu hình cá nhân và dữ liệu thật không được đưa lên Git.

### Tham khảo

- [Open Collective](https://github.com/opencollective/opencollective-frontend) cho trình bày thu chi.
- [OpenPledge](https://github.com/OpenPledge/OpenPledge) và [Relief Inventory](https://github.com/fiforms/reliefinventory) cho nhu cầu hiện vật và xác nhận bàn giao.
- [shadcn/ui](https://github.com/shadcn-ui/ui) cho tham khảo bố cục biểu mẫu, [Lucide](https://github.com/lucide-icons/lucide) cho biểu tượng và [React Share](https://github.com/nygardk/react-share) cho nút Facebook.

Ảnh minh họa do ImageGen tích hợp tạo cho bản demo. Prompt và tệp tương ứng nằm trong [tài liệu ảnh](docs/images.md).
