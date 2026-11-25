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

### Triển khai Vercel và Supabase

Tạo project Supabase riêng cho đồ án và áp dụng lần lượt các migration trong `supabase/migrations` trước khi triển khai web. Migration đầu nạp ba chiến dịch mẫu vào schema riêng; migration quyền phiếu lưu mã băm cho quyền xác nhận hoặc hủy. Cấu hình mật khẩu cho role máy chủ `gopsuc_runtime` và dùng URL Transaction Pooler của chính role đó trong `DATABASE_URL`. Giữ URL này trong biến môi trường máy chủ. Role không có quyền quản trị cơ sở dữ liệu.

Trong project Vercel, thêm `DATABASE_URL`, `SITE_URL` (địa chỉ HTTPS chính thức), `ADMIN_PASSWORD` và `ORGANIZER_PASSWORD` vào môi trường Production. Bản chạy trên Vercel yêu cầu PostgreSQL. Bản chạy trên máy vẫn dùng SQLite nếu không đặt `DATABASE_URL`. Chạy `node scripts/check-hosted-db.mjs` để kiểm tra đọc, ghi và các luồng nghiệp vụ trên PostgreSQL. Các bản ghi kiểm tra nằm trong một giao dịch hoàn tác.

## Cách hệ thống hoạt động

Để tập bảo vệ với dữ liệu mẫu mới, chạy `npm run build` rồi `npm run preview:clean` và mở [127.0.0.1:3101](http://127.0.0.1:3101). Mỗi lần khởi động tạo một tệp SQLite riêng và giữ dữ liệu đang dùng ở cổng 3100. Nếu cần dùng trang quản trị ở bản dựng này, đặt mật khẩu theo hướng dẫn production ở trên.

| Phần | Nơi đọc mã | Quy tắc |
|---|---|---|
| Giao diện và chia sẻ | `app/chien-dich`, `components/client.tsx` | Trang chiến dịch và cập nhật có URL riêng, ảnh Open Graph; hộp chia sẻ có nút Facebook, sao chép và menu chia sẻ nếu thiết bị hỗ trợ. |
| Tiền và hiện vật | `app/api/gopsuc/route.ts`, `lib/db.ts` | Kiểm tra đầu vào ở máy chủ, cập nhật trong giao dịch SQLite, xác nhận tiền lặp chỉ cộng một lần. Lịch hẹn giữ chỗ hiện vật và ghi số thực nhận riêng. |
| Quản trị và thu chi | `app/quan-tri`, `lib/session.ts` | Máy chủ kiểm tra vai trò trước thao tác. Chỉ quản trị viên có thể duyệt, đóng và ghi khoản chi. Các khoản chi vượt số dư bị từ chối. |
| Ảnh chứng từ | `app/api/gopsuc/expense-photos`, `lib/db.ts` | Quản trị viên có thể đính kèm một ảnh chứng từ mô phỏng sau khi xác nhận đã che dữ liệu cá nhân. Ảnh được nén WebP và thêm mã SHA-256 của tệp hiển thị; mã này không chứng minh khoản chi hoặc giấy tờ là thật. Có thể ẩn ảnh mà không đổi số tiền trong sổ thu chi. |
| Bàn điều phối | `components/coordination-board.tsx`, `lib/coordination.ts` | Gom phiếu hiện vật chờ, chiến dịch chờ duyệt và ca trong 48 giờ còn trống ít nhất 30%, theo quyền quản lý. Mỗi việc dẫn đến đúng mục xử lý. Tab Nhật ký có thể điền bản nháp bằng số liệu đã ghi nhận, không tự công bố. |
| Ca tình nguyện | `components/volunteer.tsx`, `lib/db.ts` | Người tổ chức đặt giờ Việt Nam và giới hạn số chỗ. Mỗi lần đăng ký cấp mã riêng để tra cứu hoặc trả chỗ trước giờ bắt đầu. Hệ thống kiểm tra sức chứa trong cùng giao dịch với việc giữ chỗ. |
| Thêm ca vào lịch | `lib/calendar.ts`, `app/api/gopsuc/volunteer-calendar` | Tải tệp `.ics` từ phiếu tình nguyện. Tệp có giờ bắt đầu, điểm tập trung và đường dẫn chiến dịch công khai, không chứa mã phiếu. Tệp đã lưu độc lập với đặt chỗ: khi hủy, khách cần xóa sự kiện trên lịch của mình. |
| Theo dõi sau khi góp | `app/tra-cuu`, `components/receipt-impact.tsx` | Phiếu cá nhân tách riêng với kết quả chung của chiến dịch. Xem tiến độ, liên kết thu chi và hai cập nhật công khai gần nhất, kể cả sau khi chiến dịch đóng. |
| Quyền trên phiếu | `lib/receipt-access.ts`, `lib/db.ts` | Mã tra cứu chỉ dùng để đọc. QR mô phỏng để xác nhận và liên kết để hủy ca có khóa riêng; chỉ bản băm lưu trên máy chủ. Phiếu cũ vẫn xem được nhưng xác nhận/hủy từ mã cũ không còn được phép. Giữ liên kết thao tác riêng để dùng lại sau khi đóng tab. |
| Ảnh bàn giao | `lib/update-image.ts`, `app/api/gopsuc/photos` | Người tổ chức có thể thêm một ảnh JPEG, PNG hoặc WebP vào bài cập nhật. Máy chủ giới hạn 4 MB, nén thành WebP tối đa 1280 px, loại metadata rồi lưu cùng bài. Ảnh của chiến dịch chờ duyệt chưa có URL truy cập công khai. |
| Trợ lý tìm cách góp | `lib/match.ts`, `lib/assist.ts`, `components/giving-assistant.tsx` | Tách câu tiếng Việt thành các nhóm hiện vật, số lượng, khu vực, ngày/buổi tình nguyện và số tiền mô phỏng. Có thể sửa điều kiện và tìm lại. Máy chủ chỉ trả nhu cầu/công việc đang mở, chặn sai đơn vị và số hiện vật gợi ý không vượt phần còn nhận. |

Trợ lý dùng bộ phân loại dựa trên độ tương đồng với câu mẫu kết hợp quy tắc số lượng/lịch, chạy trên máy chủ Góp Sức và không gửi câu hỏi ra ngoài. Đây là AI theo phạm vi hẹp, không phải chatbot tạo sinh, không cần khóa API. Nếu không rõ số lượng hoặc lịch, trợ lý cho sửa điều kiện thay vì cam kết đã giữ chỗ. Bộ lọc ngày và buổi áp dụng cho giờ bắt đầu ca tình nguyện; giờ nhận hiện vật vẫn hiển thị theo nội dung ban tổ chức nhập. Bản đồ án kế thừa luồng QR, số tiền nhanh, ẩn danh, công khai giao dịch và ảnh cập nhật từ ý tưởng A1K45. Mã trên repo này là bản đồ án riêng với dữ liệu demo, chức năng hiện vật, quản trị đa chiến dịch, tra cứu, chia sẻ và AI được triển khai cho đề tài mới.

## Kịch bản trình bày cho ba người

1. **Người 1 — khách ủng hộ và chia sẻ.** Mở chiến dịch lớp học, bấm chia sẻ, tạo QR 50k dưới chế độ ẩn danh và xác nhận. Mở lại bằng mã tra cứu để thấy khoản góp đã ghi nhận. Trình bày lý do số tiền chờ không có trong tổng tiền.
2. **Người 2 — quản trị và minh bạch.** Tạo chiến dịch bằng vai trò người tổ chức. Đăng nhập vai trò quản trị viên để duyệt. Mở phần thu chi và thử ghi một khoản vượt số dư. Giải thích cách cookie phiên và API quản lý quyền.
3. **Người 3 — hiện vật và AI.** Nhập “Mình có 15 bộ dụng cụ học tập ở Quảng Nam và muốn phụ đóng gói”. Mở kết quả góp hiện vật và kiểm tra form đã điền 15 bộ. Tạo phiếu, xác nhận thực nhận 12, rồi mở lại phiếu và so với tiến độ chung. Thử đổi khu vực của cùng một yêu cầu để thấy kết quả đổi theo dữ liệu, và hỏi “mình có một cây đàn piano” để kiểm tra trường hợp không phù hợp. Đảm bảo ca đóng gói ở tương lai nếu demo gợi ý tình nguyện.

GitHub lưu lịch sử triển khai. Khi trình bày, ghi rõ phần nào được AI hỗ trợ tạo và phần nào nhóm tự kiểm tra, chỉnh sửa hoặc bổ sung. Mỗi thành viên nên chạy thử luồng mình trình bày và xem một tệp mã tương ứng.

## Kiểm tra và đóng góp

```sh
npm run check
npm test
npm run build
npm run test:api
```

Tạo nhánh riêng cho mỗi thay đổi rồi mở pull request. GitHub Actions chạy kiểm tra kiểu dữ liệu, kiểm thử nghiệp vụ, build và kiểm tra API quản trị trên bản build. Kiểm tra API tự khởi động một bản chạy cục bộ với SQLite tạm, không sử dụng dữ liệu đang chạy hoặc dữ liệu online. Tệp cơ sở dữ liệu, cấu hình cá nhân và dữ liệu thật không được đưa lên Git.

### Tham khảo

- [Open Collective](https://github.com/opencollective/opencollective-frontend) cho trình bày thu chi.
- [OpenPledge](https://github.com/OpenPledge/OpenPledge) và [Relief Inventory](https://github.com/fiforms/reliefinventory) cho nhu cầu hiện vật và xác nhận bàn giao.
- [shadcn/ui](https://github.com/shadcn-ui/ui) cho tham khảo bố cục biểu mẫu, [Lucide](https://github.com/lucide-icons/lucide) cho biểu tượng và [React Share](https://github.com/nygardk/react-share) cho nút Facebook.

Ảnh minh họa do ImageGen tích hợp tạo cho bản demo. Prompt và tệp tương ứng nằm trong [tài liệu ảnh](docs/images.md).
