# 📖 HƯỚNG DẪN SỬ DỤNG BOT CASIO NOT CASINO & ADMIN DASHBOARD

Tài liệu này hướng dẫn chi tiết cách sử dụng các lệnh Discord và vận hành Dashboard quản trị của hệ thống Bot Gamma Beta 2.0.

---

## 🎮 PHẦN 1: HỆ THỐNG LỆNH DISCORD (SLASH COMMANDS)

Tất cả các lệnh của bot đều sử dụng định dạng Slash Command của Discord (bắt đầu bằng dấu `/`).

### 1. Nhóm Lệnh Trò Chơi (Casino & Giải Trí)

| Lệnh | Chức năng | Mô tả chi tiết |
| :--- | :--- | :--- |
| `/blackjack [tiền_cược] [loại_tiền]` | **Chơi Xì Dách với Bot** | Đấu trực tiếp với Dealer (Bot) bằng tiền `Coins` hoặc `VND`. Áp dụng luật Xì Dách Việt Nam (Xì Bàn, Xì Dách, Ngũ Linh). |
| `/poker [tiền_cược] [loại_tiền]` | **Chơi Poker với Bot** | Trò chơi Texas Hold'em solo với Bot. Tự động chia bài tẩy, chia bài chung qua 4 vòng: Pre-flop, Flop, Turn, River. |
| `/pvp [đối_thủ] [game] [tiền_cược] [loại_tiền]` | **Thách đấu PvP người chơi** | Gửi lời thách đấu trực tiếp tới thành viên khác trong server. Có 4 trò chơi thách đấu lựa chọn:<br>1. **Blackjack**: Xì Dách PvP giữa 2 người.<br>2. **Poker**: Poker PvP giữa 2 người.<br>3. **Random Number**: Quay số ngẫu nhiên 1-100, ai lớn hơn thắng.<br>4. **Random Card**: Mỗi người bốc 1 lá bài, so điểm (2-A) và chất (Bích < Chuồn < Rô < Cơ). |
| `/random number` | **Quay số ngẫu nhiên solo** | Quay một số ngẫu nhiên từ 1 đến 100 để giải trí hoặc giải quyết tranh chấp. |
| `/random card` | **Bốc bài ngẫu nhiên solo** | Bốc ngẫu nhiên 1 lá bài từ bộ bài 52 lá để xem nút và chất bài. |

---

### 2. Nhóm Lệnh Kinh Tế (Economy)

| Lệnh | Chức năng | Mô tả chi tiết |
| :--- | :--- | :--- |
| `/eco balance [user]` | **Xem số dư tài khoản** | Hiển thị số dư Ví, Ngân Hàng (Coins) và số dư VNĐ hiện tại của bạn hoặc người được chỉ định. |
| `/eco deposit [số_tiền]` | **Gửi Coins vào ngân hàng** | Chuyển Coins từ ví cá nhân cất vào ngân hàng để tránh bị cướp hoặc bảo quản an toàn. |
| `/eco withdraw [số_tiền]` | **Rút Coins khỏi ngân hàng** | Rút Coins từ tài khoản ngân hàng ra ví để sử dụng đặt cược hoặc mua đồ. |
| `/eco send [đối_thủ] [số_tiền]` | **Chuyển Coins cho người khác** | Tặng hoặc giao dịch Coins trực tiếp cho một thành viên khác trong server. |
| `/vnd deposit [số_tiền]` | **Nạp VNĐ ảo** | Yêu cầu nạp tiền VNĐ vào game (tạo hóa đơn nạp ảo). |
| `/vnd withdraw [số_tiền]` | **Rút VNĐ ảo** | Tạo yêu cầu rút tiền VNĐ ảo về tài khoản ngân hàng thực tế. |
| `/shop` | **Cửa hàng vật phẩm** | Mở giao diện cửa hàng ảo mua sắm các vật phẩm trong server. |
| `/inventory` | **Túi đồ cá nhân** | Hiển thị danh sách các vật phẩm bạn đang sở hữu. |

---

### 3. Nhóm Lệnh Cấu Hình (Quản trị viên Discord)

| Lệnh | Chức năng | Mô tả chi tiết |
| :--- | :--- | :--- |
| `/config-log [kênh]` | **Thiết lập kênh ghi log** | Chỉ định một kênh Discord làm nơi bot ghi lại tất cả các hoạt động giao dịch nạp/rút tiền, log cược và kết quả các ván game. |

---

## ⚖️ PHẦN 2: CHI TIẾT LUẬT CHƠI BLACKJACK VIỆT NAM (XÌ DÁCH)

Hệ thống Blackjack của bot áp dụng chuẩn luật chơi Xì Dách truyền thống Việt Nam:

1. **Xì Bàn (Đôi AA)**: 
   - Xuất hiện khi 2 lá bài đầu tiên được chia là **hai lá Ace (A - A)**.
   - Đây là tổ hợp **lớn nhất** trong trò chơi. Thắng tuyệt đối và lật bài kết thúc ván ngay lập tức.
2. **Xì Dách (A + 10/J/Q/K)**:
   - Xuất hiện khi 2 lá bài đầu tiên gồm **1 lá Ace (A)** đi kèm với **1 lá 10, J, Q hoặc K**.
   - Đây là tổ hợp **lớn thứ hai** (chỉ thua Xì Bàn). Thắng luôn và lật bài ngay lập tức.
3. **Ngũ Linh (5 lá bài)**:
   - Đạt được khi bạn rút đủ **5 lá bài** trên tay mà tổng điểm của 5 lá bài đó **nhỏ hơn hoặc bằng 21**.
   - Ngũ Linh thắng tất cả các điểm thường khác (kể cả 21 điểm bằng 3 hoặc 4 lá).
   - *Nếu cả hai bên cùng đạt Ngũ Linh*: Bên nào có số điểm **thấp hơn** sẽ giành chiến thắng (ví dụ: 17 điểm thắng 19 điểm).
4. **Quá 21 điểm (Bust/Quắc)**: 
   - Rút bài vượt quá 21 điểm sẽ bị coi là quắc bài (thua điểm thường).

---

## 🌐 PHẦN 3: VẬN HÀNH ADMIN DASHBOARD

Trang quản trị chạy tại tên miền bảo mật: **`https://casionotcasino.duckdns.org`**

### 1. Đăng Nhập
*   Truy cập đường dẫn trên trình duyệt web.
*   Nhập mật khẩu quản trị: Là giá trị của biến `SESSION_SECRET` trong tệp `.env` của bạn trên VPS.

### 2. Các Tab Chức Năng Chính

*   **📊 Tổng Quan (Overview)**:
    *   Xem thời gian chạy liên tục của bot (Uptime), RAM/CPU tiêu thụ thời gian thực trên VPS.
    *   **Bật/Tắt Chế Độ Bảo Trì (Maintenance Mode)**: Khi bật lên, tất cả thành viên thường trong Discord sẽ bị tạm khóa không cho dùng lệnh của bot, chỉ duy nhất Owner/Admin mới dùng được để bảo dưỡng hệ thống.
*   **🎮 Luật Chơi & Tỷ Lệ (Settings)**:
    *   Thiết lập số tiền cược tối thiểu (Min Bet) và tối đa (Max Bet) cho game Blackjack và Poker.
    *   Thiết lập thời gian chờ lượt rút bài (giây).
    *   **Điều chỉnh Tỉ lệ Thắng của Bot**: Kéo thanh trượt để chỉnh tỉ lệ thắng của Bot (từ 0% đến 100%). Bot sẽ tự động tráo bài (Poker) hoặc rút bài thông minh chọn lọc (Blackjack) để thắng người chơi khi cần thiết.
*   **🏆 Bảng Xếp Hạng (Leaderboard)**:
    *   Xem top 10 người chơi sở hữu nhiều Coins nhất và nhiều VND nhất trong cơ sở dữ liệu.
*   **🛡️ Quyền Hạn Lệnh (Command Permissions)**:
    *   Chọn máy chủ Discord cần thiết lập.
    *   Chọn một lệnh Slash Command cụ thể cần giới hạn quyền.
    *   Tick chọn vai trò (Role) được phép sử dụng (`Allowed`) hoặc bị cấm sử dụng (`Denied`) lệnh đó. Hệ thống bot Discord sẽ tự động từ chối và gửi ảnh thông báo lỗi nếu có người cố tình vi phạm.

