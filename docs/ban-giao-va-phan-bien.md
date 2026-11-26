# Góp Sức: Bàn giao và phản biện đồ án web

Góp Sức giúp người dùng tìm việc cộng đồng phù hợp, góp **tiền mô phỏng, hiện vật hoặc thời gian**, rồi xem kết quả. Đây là đồ án tiếng Việt cho nhóm ba người, độc lập với A1K45. [Bản demo công khai](https://gop-suc-demo.vercel.app/) dùng dữ liệu mô phỏng. QR mở phiếu của Góp Sức; web không kết nối ngân hàng, không yêu cầu chuyển khoản và không nhận tiền thật.

## Tính năng hiện có

| Phần | Có thể làm gì? | Điều dễ hiểu nhầm |
| --- | --- | --- |
| Trang chủ và chiến dịch | Tìm theo tên hoặc khu vực, lọc chủ đề; mở một chiến dịch để xem cách góp, tiến độ, nhật ký, thu chi và các khoản góp gần đây. | Bản chờ duyệt không xuất hiện công khai. Chiến dịch đã đóng vẫn xem được kết quả nhưng ngừng nhận đóng góp mới. |
| Góp tiền | Chọn 20k, 50k, 100k, 200k, 500k hoặc nhập số khác. Chọn công khai tên hoặc ẩn danh, thêm lời nhắn nếu muốn. Tạo QR và xác nhận mô phỏng. | Chỉ sau khi xác nhận thì khoản góp mới vào tổng. Ẩn danh chỉ ẩn tên; số tiền và lời nhắn công khai vẫn có thể hiển thị. |
| Góp hiện vật | Chọn món và số lượng, lấy phiếu hẹn; người tổ chức xác nhận số thực nhận hoặc hủy hẹn. | Hẹn chưa phải đã nhận. Còn có thể hẹn = mục tiêu − đã nhận − đang hẹn; chênh lệch khi giao thiếu trở về phần còn có thể nhận hẹn. |
| Góp thời gian | Chọn ca sắp tới còn chỗ, giữ một chỗ, tải tệp lịch hoặc dùng liên kết riêng để hủy trước giờ bắt đầu. | Tệp lịch chỉ chứa dữ liệu công khai của ca. Hủy chỗ không tự xóa lịch đã lưu. Web chưa điểm danh hoặc xác nhận giờ thực tế. |
| Phiếu và chia sẻ | Mã tra cứu mở phiếu cùng tiến độ và tối đa hai cập nhật gần nhất. Chia sẻ chiến dịch hoặc bài cập nhật qua sao chép, Facebook hoặc menu của thiết bị khi được hỗ trợ. | Mã tra cứu chỉ xem. Xác nhận tiền hoặc hủy ca cần quyền riêng đi kèm QR hoặc liên kết thao tác. Chỉ chia sẻ URL công khai; tiến độ là kết quả cả chiến dịch, không gán cho một phiếu. |
| Phiếu đã lưu | Bấm **Lưu phiếu** rồi mở lại từ mục **Tra cứu** mà không cần chép mã bằng tay. Lưu được tối đa 12 phiếu tiền mô phỏng, hiện vật hoặc tình nguyện. | Chỉ lưu mã xem và loại phiếu trên trình duyệt này, không chuyển sang thiết bị khác và không cấp quyền thao tác. Không nên dùng trên máy chung. Bỏ lưu không hủy phiếu. |
| Điều phối và duyệt | Người tổ chức tạo bản nháp, quản lý nhu cầu, bàn giao, ca và nhật ký. Quản trị viên duyệt hoặc đóng chiến dịch, công bố chi. Bàn điều phối gom việc theo quyền và mở thẳng mục cần xử lý. | Bản demo dùng mật khẩu theo vai trò, không có tài khoản riêng từng cá nhân. Nhóm “Ca cần thêm người” chỉ hiện ca trong 48 giờ tới còn trống ít nhất 30%. |
| Nhật ký và thu chi | Nhật ký có thể điền nháp từ số liệu đã ghi để người tổ chức sửa trước khi đăng. Sổ thu chi hiển thị đã nhận, đã chi và số dư. Quản trị viên có thể công khai hoặc ẩn ảnh chứng từ. | Ảnh được nén WebP và loại metadata. Người đăng vẫn phải che thông tin nhạy cảm nhìn thấy trong ảnh. Mã băm nhận diện tệp, không xác thực giấy tờ hoặc chứng minh khoản chi là thật. |
| Gửi lại khi mất mạng | Khi biểu mẫu còn mở, gửi lại cùng nội dung cho phiếu tiền, hiện vật, chỗ tình nguyện hoặc khoản chi sẽ không tạo bản ghi lần hai. | Không giữ lần gửi qua tải lại trang. Đây là chống ghi trùng, không phải hàng đợi gửi khi không có mạng. |

## Trợ lý trên web

**Trợ lý Góp Sức** đọc câu tiếng Việt, kết hợp so khớp với câu mẫu và quy tắc để nhận diện loại đóng góp, số lượng, khu vực và khung thời gian. Sau đó máy chủ tra các nhu cầu và ca đang mở. Người dùng có thể sửa điều kiện, tìm lại và mở đúng biểu mẫu; trợ lý không tự tạo phiếu.

| Câu thử | Kết quả cần quan sát |
| --- | --- |
| “Mình có 15 bộ dụng cụ học tập ở Quảng Nam và muốn phụ đóng gói.” | Trên bản tập thử mới, hiện nhu cầu dụng cụ học tập, điền trước 15 bộ và gợi ý ca đóng gói. Trên bản công khai, ca chỉ hiện nếu vẫn còn chỗ và chưa tới giờ. |
| “Mình muốn phụ đóng gói tuần sau.” | Yêu cầu làm rõ ngày hoặc buổi; không tự nới điều kiện để đưa một ca bất kỳ. |
| “Mình có 15 bộ dụng cụ học tập ở Huế.” | Nếu không có nơi nhận khớp tại Huế nhưng có ở nơi khác, hiện nút **Tìm không giới hạn khu vực**. Chỉ khi bấm nút, trợ lý mới bỏ khu vực cho nhóm đồ dùng học tập; số lượng và đơn vị được giữ nguyên. Có thể quay về điều kiện ban đầu. |
| “Mình có một cây đàn piano.” | Không ép khớp với món đang nhận. Có thể sửa yêu cầu hoặc quay về danh sách chiến dịch. |

Đây là xử lý tiếng Việt theo phạm vi hẹp, không phải chatbot tạo sinh. Câu hỏi không chuyển sang nhà cung cấp AI khác. Gợi ý hiện vật bị giới hạn theo đơn vị và số lượng còn nhận. Máy chủ vẫn kiểm tra sức nhận lúc bấm gửi, vì số chỗ có thể thay đổi sau khi trợ lý trả lời. Bản nháp nhật ký lấy từ số liệu có sẵn; không tự công bố hay suy diễn đã bàn giao cho người thụ hưởng.

## Chuẩn bị và tập bảo vệ

Trên máy trình chiếu, cài Node.js 24. Chạy lần lượt `npm ci`, `npm run build`, `npm run preview:clean`, rồi mở [bản tập thử cục bộ](http://127.0.0.1:3101/). Lệnh tạo dữ liệu mẫu riêng cho mỗi lần khởi động; không dùng thông tin đăng nhập online. Xem mật khẩu mẫu trong README. Mở cửa sổ riêng nếu cần dùng đồng thời hai vai trò. Dừng và chạy lại lệnh tập thử để có dữ liệu mới trước buổi trình bày.

Chạy bản cục bộ trên **cùng máy** với trình duyệt. Nếu chỉ có điện thoại, dùng link công khai để xem giao diện; QR của bản cục bộ trỏ về máy đang chạy web, không mở từ điện thoại khác. Để trình diễn xác nhận cục bộ, dùng nút xác nhận ngay trong hộp QR.

| Thời gian | Người trình bày và thao tác | Kết quả cần thấy |
| --- | --- | --- |
| 0:00–1:20 | **Bạn 1:** Mở “Góp lại lớp học sau mùa mưa”, bấm **Ủng hộ tiền**, chọn 50k và ẩn danh, tạo QR. Xác nhận demo rồi mở phiếu. | Số nhận của chiến dịch từ 36.500.000 ₫ lên 36.550.000 ₫, không tăng ngay lúc tạo QR. Phiếu xác nhận hiện bên cạnh kết quả chung; có thể mở thu chi. |
| 1:20–2:55 | **Bạn 2:** Dùng câu thử 15 bộ trong trợ lý, mở biểu mẫu hiện vật, kiểm tra số đã điền, đăng ký và lưu phiếu. Nêu thêm cách chọn ca, giữ chỗ và tải lịch. | “Đã nhận” vẫn là 80 bộ. Có thêm 15 bộ đang hẹn; số còn có thể hẹn từ 40 xuống 25. Gợi ý ca là lời mời đăng ký, chưa giữ chỗ. |
| 2:55–4:25 | **Bạn 3:** Đăng nhập vai trò người tổ chức, mở mục chờ trên **Bàn điều phối**, tìm phiếu vừa tạo, ghi thực nhận 12 bộ. Mở lại phiếu phía khách; xem bản nháp cập nhật nếu còn thời gian. | Phiếu ghi thực nhận 12, không phải 15. Trang chiến dịch có 92 bộ đã nhận và còn nhận hẹn 28 bộ: 3 bộ chưa giao được trả lại phần còn hẹn. |
| 4:25–5:00 | **Cả nhóm:** Chốt ý nghĩa của phiếu và phân quyền. Mở menu chia sẻ công khai nếu chưa kịp trình bày. | Người xem hiểu tiền chỉ mô phỏng, AI chỉ gợi ý, và khác biệt giữa người tổ chức, quản trị viên và khách. |

Khi có thêm thời gian, thử công bố một bản nháp bằng quản trị viên, ghi khoản chi vượt số dư để thấy bị từ chối, hoặc hủy ca với liên kết riêng rồi kiểm tra chỗ được mở lại. Mỗi người nên tự thử luồng được giao và trình bày đúng phần nhóm đã kiểm tra, chỉnh sửa hoặc được AI hỗ trợ.

## Kiến trúc và giới hạn

- Next.js, React và TypeScript dựng giao diện và xử lý yêu cầu. Bản online chạy trên Vercel với PostgreSQL của Supabase; bản tập dùng SQLite. Các phép ghi nhạy cảm đi qua máy chủ, không ghi thẳng từ trình duyệt.
- Cookie quản trị chứa phiên có thời hạn, không đọc được qua JavaScript. Máy chủ kiểm tra quyền trước khi ghi, đối chiếu số dư và giới hạn trong cùng giao dịch cơ sở dữ liệu. Khách có mã tra cứu có thể xem phiếu, vì vậy không gửi mã hoặc QR riêng khi xin phản biện.
- Bộ kiểm thử nghiệp vụ bao phủ AI, giới hạn sức nhận và ảnh. Bộ kiểm thử HTTP khởi động bản build riêng để kiểm tra quyền, chống gửi trùng, tra cứu, giới hạn và trạng thái thực sự được lưu. Một lần kiểm thử chạy đạt không chứng minh web không thể có lỗi bảo mật.
- Các nội dung chưa có: thanh toán thực, tài khoản riêng từng người, điểm danh tình nguyện, đối soát tiền thật và chatbot tạo sinh. Đây là ranh giới của bản demo.

## Câu hỏi gửi người phản biện

> Hãy đánh giá Góp Sức như một đồ án web của nhóm ba người. Chỉ duyệt trang công khai ở chế độ đọc; không cần mật khẩu, mã phiếu hay tạo giao dịch. Nói rõ đâu là quan sát từ trang demo, đâu là đánh giá dựa trên tài liệu.
>
> 1. Trên điện thoại, ở bước nào khách khó hiểu nhất: tìm chỗ góp, chọn hình thức, nhận phiếu hay theo dõi? Nêu dấu hiệu cụ thể và cách sửa có thể kiểm thử.
> 2. Với một câu tiếng Việt mơ hồ, trợ lý cần hỏi lại điều gì để giúp người dùng quyết định? Đề xuất ví dụ rõ ràng, mơ hồ và không phù hợp, kèm kết quả mong đợi; đừng giả định đã tích hợp chatbot tạo sinh.
> 3. Chọn tối đa ba cải tiến có giá trị nhất cho đội nhỏ. Mỗi mục nêu người dùng, vấn đề, tiêu chí đạt và một rủi ro. Có cải tiến nào sẽ làm đồ án phức tạp lên nhưng ít giúp ích?
> 4. Đánh giá kịch bản 5 phút: sau khi xem, người nghe có phân biệt được số đang hẹn, số thực nhận và kết quả của cả chiến dịch không? Nếu chưa, đề xuất một cảnh hoặc câu giải thích cụ thể.
