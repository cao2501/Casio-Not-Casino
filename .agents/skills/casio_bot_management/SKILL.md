---
name: casio-bot-management
description: Hướng dẫn quản lý, bảo trì và phát triển bot casino Casio-Not-Casino, bao gồm luật chơi đặc thù và cơ chế phân quyền.
---

# Hướng Dẫn Phát Triển & Bảo Trì Bot Casio-Not-Casino

Tài liệu này lưu trữ các kiến thức đặc thù, quy tắc và bài học kinh nghiệm thu được trong quá trình phát triển hệ thống bot Casio-Not-Casino. Các agent Antigravity trong tương lai cần đọc kỹ hướng dẫn này trước khi sửa đổi code.

---

## 🎨 1. Vẽ Quân Bài Trên Canvas (Tránh Lỗi Thiếu Font)
*   **Vấn đề**: Khi vẽ các ký tự chất bài (♥, ♦, ♣, ♠) bằng text (`ctx.fillText`), trên Linux VPS thường bị thiếu font hỗ trợ unicode emoji/symbol, dẫn đến hiển thị các ô vuông gạch chéo (tofu glyph).
*   **Giải pháp**: Không dùng text để vẽ các chất bài. Hãy sử dụng các đường vector đồ họa đồ vẽ trực tiếp trong [CardDrawer.ts](file:///d:/Antigravity/discord.js/apps/bot/src/core/ui/CardDrawer.ts).
    *   Sử dụng hàm `drawSuitPath(ctx, suit, x, y, size)` vẽ bằng `bezierCurveTo`, `arc`, `lineTo`.
    *   Tất cả các chất bài ở bốn góc và trung tâm quân bài đều phải được vẽ qua hàm vector này.

---

## 🔒 2. Quản Lý Khóa Phiên Chơi (Active Game Lock) & Khắc Phục Kẹt Game
*   **Vấn đề**: Người chơi bị kẹt phòng đấu khi game kết thúc đột ngột (do Xì Bàn/Xì Dách đầu game) hoặc khi người chơi bỏ dở ván đấu nửa chừng mà collector giữ lock quá lâu.
*   **Giải pháp**:
    1.  **Lưu timestamp thay vì giá trị boolean**: Khi kích hoạt khóa phòng chơi, lưu timestamp hiện tại:
        `kernel.cache.set(`active_game:${userId}`, Date.now(), 1800);`
    2.  **Cơ chế Tự Giải Phóng Khóa (Auto-expire)**: Ở đầu mỗi lệnh game, kiểm tra xem nếu lock cũ đã tồn tại quá **2 phút** (với game solo) hoặc **3 phút** (với game PvP) mà chưa giải phóng, bot tự động xóa lock cũ và cho phép chơi ván mới:
        ```typescript
        const activeLock = kernel.cache.get(`active_game:${userId}`);
        if (activeLock) {
          const lockTime = typeof activeLock === 'number' ? activeLock : 0;
          if (Date.now() - lockTime > 120000) {
            kernel.cache.del(`active_game:${userId}`);
          } else {
            // Thông báo thời gian chờ còn lại...
          }
        }
        ```
    3.  **Rút ngắn idle timer**: Thiết lập `idle` của button collector xuống **60 giây** (solo) và **90 giây** (PvP) để tránh giam chân người chơi quá lâu.

---

## 🃏 3. Luật Blackjack Việt Nam Đặc Thù
Khi lập trình logic Blackjack (Xì Dách), cần đảm bảo đúng luật Việt Nam:
*   **Xì Bàn (Đôi AA từ 2 lá đầu)**: Thắng tuyệt đối mọi tổ hợp khác. Ăn gấp 3 lần tiền cược. Kết thúc ván lập tức.
*   **Xì Dách (Ace + 10/J/Q/K từ 2 lá đầu)**: Thắng mọi tổ hợp thường (trừ Xì Bàn). Ăn gấp 2.5 lần tiền cược. Kết thúc ván lập tức.
*   **Ngũ Linh (Rút đủ 5 lá bài mà tổng điểm <= 21)**: Thắng mọi điểm thường (kể cả 21 điểm thường).
    *   *Nếu hai bên cùng Ngũ Linh*: Ai có tổng điểm **thấp hơn** sẽ thắng cuộc.

---

## 🌐 4. Phân Quyền Dashboard (Command Permissions)
Hệ thống quản lý quyền hạn của dashboard sử dụng 3 cột checkbox tương tác:
1.  **Cho phép (Allowed - Xanh)**: Cho phép vai trò sử dụng lệnh.
2.  **Bị chặn (Denied - Đỏ)**: Cấm vai trò sử dụng lệnh.
3.  **Đặc biệt (Special/Admin Bypass - Vàng gold)**: Cấm hoặc cấp quyền tương đương Admin đối với lệnh đó và bỏ qua mọi kiểm tra Allowed/Denied khác.
*   **Quy tắc mutual exclusion (loại trừ lẫn nhau)**: Trong giao diện dashboard, khi chọn `Đặc biệt` thì phải tự động bỏ chọn `Allowed` & `Denied` và ngược lại.

---

## ➕ 5. Game Bài Ngẫu Nhiên Tương Tác (Interactive Random Card)
Áp dụng cho cả lệnh `/random card` và `/pvp` (game `RANDOM_CARD`):
*   Ban đầu chia bài ở trạng thái **úp (Facedown - isHidden = true)**.
*   Người chơi click nút **Rút 1 lá (Draw)** để lật ngửa từng lá bài một từ trái qua phải của chính họ (trong PvP, nút lật của ai chỉ ảnh hưởng đến bài của người đó).
*   Người chơi có thể click **Mở tất cả (Reveal)** để lật nhanh toàn bộ số bài úp của mình.
*   Trong PvP, khi cả hai bên lật hết bài mới tiến hành so lá bài mạnh nhất (High Card) kèm so chất (Cơ ♥ > Rô ♦ > Chuồn ♣ > Bích ♠) để định đoạt thắng thua.
