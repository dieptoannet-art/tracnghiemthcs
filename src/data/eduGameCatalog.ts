export interface EduGameItem {
  id: string;
  code: string; // e.g. "A01", "B03"
  title: string;
  category: 'random' | 'warmup' | 'reinforce' | 'competition' | 'movement' | 'puzzle';
  categoryLabel: string;
  description: string;
  target: 'individual' | 'group' | 'class';
  isReady: boolean;
  modeKey: string;
}

export const EDU_GAME_CATEGORIES = [
  { key: 'all', label: 'Tất cả trò chơi', count: 50 },
  { key: 'random', label: 'Gọi học sinh ngẫu nhiên', count: 12 },
  { key: 'warmup', label: 'Khởi động tiết học', count: 10 },
  { key: 'reinforce', label: 'Củng cố kiến thức', count: 10 },
  { key: 'competition', label: 'Thi đua cá nhân & nhóm', count: 8 },
  { key: 'movement', label: 'Vận động & tương tác', count: 5 },
  { key: 'puzzle', label: 'Thử thách trí tuệ', count: 5 },
];

export const EDU_GAMES_CATALOG: EduGameItem[] = [
  // Nhóm A: Gọi học sinh ngẫu nhiên (12 trò) - Đã hoàn thiện & kiểm thử
  { id: 'a01', code: 'A01', title: 'Vòng quay may mắn', category: 'random', categoryLabel: 'Gọi học sinh ngẫu nhiên', description: 'Vòng quay số hóa chọn học sinh trực quan, sinh động với hiệu ứng âm thanh.', target: 'individual', isReady: true, modeKey: 'wheel' },
  { id: 'a02', code: 'A02', title: 'Máy gắp thú', category: 'random', categoryLabel: 'Gọi học sinh ngẫu nhiên', description: 'Cần cẩu gắp tên học sinh trong lồng kính thần kỳ đầy hứng thú.', target: 'individual', isReady: true, modeKey: 'claw_machine' },
  { id: 'a03', code: 'A03', title: 'Hộp quà bí ẩn', category: 'random', categoryLabel: 'Gọi học sinh ngẫu nhiên', description: 'Mở hộp quà bất ngờ để xướng tên học sinh may mắn trả lời câu hỏi.', target: 'individual', isReady: true, modeKey: 'gift_box' },
  { id: 'a04', code: 'A04', title: 'Bốc thăm thần kỳ', category: 'random', categoryLabel: 'Gọi học sinh ngẫu nhiên', description: 'Lá thăm may mắn rút tên học sinh ngẫu nhiên công bằng.', target: 'individual', isReady: true, modeKey: 'cards' },
  { id: 'a05', code: 'A05', title: 'Vịt đua', category: 'random', categoryLabel: 'Gọi học sinh ngẫu nhiên', description: 'Đàn vịt ngộ nghĩnh bơi đua về đích mang theo tên học sinh.', target: 'individual', isReady: true, modeKey: 'duck_race' },
  { id: 'a06', code: 'A06', title: 'Đua ngựa', category: 'random', categoryLabel: 'Gọi học sinh ngẫu nhiên', description: 'Cuộc đua tốc độ kịch tính chọn ra bạn về đích đầu tiên.', target: 'individual', isReady: true, modeKey: 'horse_race' },
  { id: 'a07', code: 'A07', title: 'Tên lửa chọn bạn', category: 'random', categoryLabel: 'Gọi học sinh ngẫu nhiên', description: 'Tên lửa phóng vút lên cao và hạ cánh chính xác vào tên học sinh.', target: 'individual', isReady: true, modeKey: 'rocket' },
  { id: 'a08', code: 'A08', title: 'Bóng bay may mắn', category: 'random', categoryLabel: 'Gọi học sinh ngẫu nhiên', description: 'Bong bay bay lượn chứa tên học sinh, châm nổ để chọn bạn.', target: 'individual', isReady: true, modeKey: 'balloons' },
  { id: 'a09', code: 'A09', title: 'Xúc xắc chọn tên', category: 'random', categoryLabel: 'Gọi học sinh ngẫu nhiên', description: 'Lắc xí ngầu điện tử chọn số ngẫu nhiên tương ứng danh sách lớp.', target: 'individual', isReady: true, modeKey: 'dice' },
  { id: 'a10', code: 'A10', title: 'Thẻ bài bí mật', category: 'random', categoryLabel: 'Gọi học sinh ngẫu nhiên', description: 'Lật thẻ bài úp để lật tẩy tên học sinh được gọi.', target: 'individual', isReady: true, modeKey: 'secret_card' },
  { id: 'a11', code: 'A11', title: 'Bánh xe số', category: 'random', categoryLabel: 'Gọi học sinh ngẫu nhiên', description: 'Bánh xe chỉ số kết hợp số thứ tự học sinh trong sổ điểm.', target: 'individual', isReady: true, modeKey: 'number_wheel' },
  { id: 'a12', code: 'A12', title: 'Robot chọn bạn', category: 'random', categoryLabel: 'Gọi học sinh ngẫu nhiên', description: 'Robot thông minh quét toàn lớp và gọi ngẫu nhiên một bạn.', target: 'individual', isReady: true, modeKey: 'robot_picker' },

  // Nhóm B: Khởi động tiết học (10 trò)
  { id: 'b01', code: 'B01', title: 'Ai nhanh hơn', category: 'warmup', categoryLabel: 'Khởi động tiết học', description: 'Thử thách phản xạ bấm chuông giành quyền trả lời câu hỏi và bảng xếp hạng trực tiếp.', target: 'class', isReady: true, modeKey: 'warmup_quiz' },
  { id: 'b02', code: 'B02', title: 'Đoán hình bí mật', category: 'warmup', categoryLabel: 'Khởi động tiết học', description: 'Trả lời câu hỏi lật mở từng ô mảnh ghép hoặc hé lộ độ mờ để giải mã bức tranh bài học.', target: 'class', isReady: true, modeKey: 'reveal_image' },
  { id: 'b03', code: 'B03', title: 'Lật ô chữ', category: 'warmup', categoryLabel: 'Khởi động tiết học', description: 'Giải các hàng ngang kiến thức bài học để lật mở từ khóa hàng dọc bí mật.', target: 'class', isReady: true, modeKey: 'crossword_basic' },
  { id: 'b04', code: 'B04', title: 'Giải mã bí mật', category: 'warmup', categoryLabel: 'Khởi động tiết học', description: 'Phiêu lưu vượt trạm câu hỏi, thu thập manh mối suy luận mật mã và mở khóa rương kho báu kiến thức.', target: 'class', isReady: true, modeKey: 'decode_cipher' },
  { id: 'b05', code: 'B05', title: 'Đúng hay sai', category: 'warmup', categoryLabel: 'Khởi động tiết học', description: 'Phản xạ chớp nhoáng Đúng/Sai, đấu trường hai phía cả lớp, thi đấu đội và thử thách câu hỏi 4 nhận định a, b, c, d.', target: 'class', isReady: true, modeKey: 'true_false' },
  { id: 'b06', code: 'B06', title: 'Đuổi hình bắt chữ', category: 'warmup', categoryLabel: 'Khởi động tiết học', description: 'Suy luận từ 1–3 hình ảnh minh họa, ghép thẻ chữ cái, gợi ý 3 cấp độ và thi đấu đội nhóm sôi nổi.', target: 'class', isReady: true, modeKey: 'catch_word' },
  { id: 'b07', code: 'B07', title: 'Ô cửa bí mật', category: 'warmup', categoryLabel: 'Khởi động tiết học', description: 'Chọn ô cửa 1, 2, 3 chứa câu hỏi khởi động.', target: 'class', isReady: false, modeKey: 'secret_doors' },
  { id: 'b08', code: 'B08', title: 'Ghép cặp kiến thức', category: 'warmup', categoryLabel: 'Khởi động tiết học', description: 'Nối thuật ngữ với định nghĩa tương ứng.', target: 'class', isReady: false, modeKey: 'match_pairs' },
  { id: 'b09', code: 'B09', title: 'Tìm từ khóa', category: 'warmup', categoryLabel: 'Khởi động tiết học', description: 'Quét tìm các từ khóa quan trọng trong lưới chữ.', target: 'class', isReady: false, modeKey: 'word_search' },
  { id: 'b10', code: 'B10', title: 'Câu hỏi chớp nhoáng', category: 'warmup', categoryLabel: 'Khởi động tiết học', description: '10 giây cho mỗi câu hỏi chớp nhoáng hào hứng.', target: 'class', isReady: false, modeKey: 'lightning_quiz' },

  // Nhóm C: Củng cố kiến thức (10 trò) - Đang phát triển
  { id: 'c01', code: 'C01', title: 'Ai là triệu phú', category: 'reinforce', categoryLabel: 'Củng cố kiến thức', description: 'Mô phỏng ghế nóng với 15 câu hỏi và các quyền trợ giúp.', target: 'individual', isReady: false, modeKey: 'millionaire' },
  { id: 'c02', code: 'C02', title: 'Rung chuông vàng', category: 'reinforce', categoryLabel: 'Củng cố kiến thức', description: 'Thử thách trả lời liên tiếp các câu hỏi loại trừ dần.', target: 'class', isReady: false, modeKey: 'golden_bell' },
  { id: 'c03', code: 'C03', title: 'Đấu trường kiến thức', category: 'reinforce', categoryLabel: 'Củng cố kiến thức', description: 'Thi đấu trả lời tính điểm thời gian thực.', target: 'class', isReady: false, modeKey: 'arena' },
  { id: 'c04', code: 'C04', title: 'Vượt chướng ngại vật', category: 'reinforce', categoryLabel: 'Củng cố kiến thức', description: 'Giải các câu hỏi hàng ngang để mở chướng ngại vật.', target: 'class', isReady: false, modeKey: 'obstacle' },
  { id: 'c05', code: 'C05', title: 'Ô chữ kiến thức', category: 'reinforce', categoryLabel: 'Củng cố kiến thức', description: 'Hệ thống ô chữ tổng kết chương học sâu sắc.', target: 'class', isReady: false, modeKey: 'crossword_pro' },
  { id: 'c06', code: 'C06', title: 'Truy tìm kho báu', category: 'reinforce', categoryLabel: 'Củng cố kiến thức', description: 'Vượt qua các trạm thử thách để đến rương kho báu.', target: 'individual', isReady: false, modeKey: 'treasure_hunt' },
  { id: 'c07', code: 'C07', title: 'Giải cứu công chúa', category: 'reinforce', categoryLabel: 'Củng cố kiến thức', description: 'Trả lời đúng câu hỏi để mở từng nhịp cầu cứu viện.', target: 'individual', isReady: false, modeKey: 'rescue_princess' },
  { id: 'c08', code: 'C08', title: 'Đường lên đỉnh núi', category: 'reinforce', categoryLabel: 'Củng cố kiến thức', description: 'Leo núi kiến thức qua các mốc Khởi động, Vượt chướng ngại, Tăng tốc, Về đích.', target: 'individual', isReady: false, modeKey: 'mountain_climb' },
  { id: 'c09', code: 'C09', title: 'Bingo kiến thức', category: 'reinforce', categoryLabel: 'Củng cố kiến thức', description: 'Điền đáp án vào bảng Bingo tạo hàng ngang/dọc chiến thắng.', target: 'class', isReady: false, modeKey: 'bingo' },
  { id: 'c10', code: 'C10', title: 'Giải cứu đại dương', category: 'reinforce', categoryLabel: 'Củng cố kiến thức', description: 'Làm sạch rác biển bằng cách trả lời đúng câu hỏi.', target: 'individual', isReady: false, modeKey: 'clean_ocean' },

  // Nhóm D: Thi đua cá nhân và nhóm (8 trò) - Đang phát triển
  { id: 'd01', code: 'D01', title: 'Đấu trường 1 đấu 1', category: 'competition', categoryLabel: 'Thi đua cá nhân và nhóm', description: 'Hai học sinh đối đầu trực diện tốc độ trả lời.', target: 'individual', isReady: false, modeKey: 'duel_1v1' },
  { id: 'd02', code: 'D02', title: 'Đua thuyền', category: 'competition', categoryLabel: 'Thi đua cá nhân và nhóm', description: 'Các đội chèo thuyền về đích qua số điểm tích lũy.', target: 'group', isReady: false, modeKey: 'boat_race' },
  { id: 'd03', code: 'D03', title: 'Kéo co kiến thức', category: 'competition', categoryLabel: 'Thi đua cá nhân và nhóm', description: 'Đội trả lời đúng kéo dây thừng về phía đội mình.', target: 'group', isReady: false, modeKey: 'tug_of_war' },
  { id: 'd04', code: 'D04', title: 'Đua xe tốc độ', category: 'competition', categoryLabel: 'Thi đua cá nhân và nhóm', description: 'Xe đua tăng tốc theo số điểm trả lời đúng.', target: 'group', isReady: false, modeKey: 'car_racing' },
  { id: 'd05', code: 'D05', title: 'Tiếp sức đồng đội', category: 'competition', categoryLabel: 'Thi đua cá nhân và nhóm', description: 'Thành viên lần lượt lên bảng tiếp sức giải bài toán.', target: 'group', isReady: false, modeKey: 'relay_team' },
  { id: 'd06', code: 'D06', title: 'Vua ghi điểm', category: 'competition', categoryLabel: 'Thi đua cá nhân và nhóm', description: 'Bảng vàng vinh danh vua điểm số trong tiết học.', target: 'individual', isReady: false, modeKey: 'king_of_score' },
  { id: 'd07', code: 'D07', title: 'Thách đấu nhóm', category: 'competition', categoryLabel: 'Thi đua cá nhân và nhóm', description: 'Các nhóm đặt cược điểm số và thử thách lẫn nhau.', target: 'group', isReady: false, modeKey: 'group_challenge' },
  { id: 'd08', code: 'D08', title: 'Đấu trường 4 đội', category: 'competition', categoryLabel: 'Thi đua cá nhân và nhóm', description: 'Giao tranh 4 đội Đỏ, Xanh dương, Vàng, Xanh lá.', target: 'group', isReady: false, modeKey: 'four_teams_arena' },

  // Nhóm E: Vận động và tương tác (5 trò) - Đang phát triển
  { id: 'e01', code: 'E01', title: 'Nhảy theo lệnh', category: 'movement', categoryLabel: 'Vận động và tương tác', description: 'Trò chơi phản ứng vui nhộn thư giãn tại chỗ.', target: 'class', isReady: false, modeKey: 'jump_command' },
  { id: 'e02', code: 'E02', title: 'Bắt bóng kiến thức', category: 'movement', categoryLabel: 'Vận động và tương tác', description: 'Bắt bóng bay xuất hiện ngẫu nhiên trên màn hình.', target: 'class', isReady: false, modeKey: 'catch_ball' },
  { id: 'e03', code: 'E03', title: 'Phản xạ nhanh', category: 'movement', categoryLabel: 'Vận động và tương tác', description: 'Nhấn nút nhanh khi tín hiệu đổi màu xanh.', target: 'class', isReady: false, modeKey: 'quick_reflex' },
  { id: 'e04', code: 'E04', title: 'Simon Says', category: 'movement', categoryLabel: 'Vận động và tương tác', description: 'Thực hiện động tác chỉ khi có hiệu lệnh Simon.', target: 'class', isReady: false, modeKey: 'simon_says' },
  { id: 'e05', code: 'E05', title: 'Săn sao kiến thức', category: 'movement', categoryLabel: 'Vận động và tương tác', description: 'Thu thập sao vàng xuất hiện trên bảng.', target: 'class', isReady: false, modeKey: 'star_hunt' },

  // Nhóm F: Thử thách trí tuệ (5 trò) - Đang phát triển
  { id: 'f01', code: 'F01', title: 'Sudoku', category: 'puzzle', categoryLabel: 'Thử thách trí tuệ', description: 'Điền số từ 1 đến 4 hoặc 6 không trùng lặp hàng/cột/vùng.', target: 'individual', isReady: false, modeKey: 'sudoku_game' },
  { id: 'f02', code: 'F02', title: 'Tangram', category: 'puzzle', categoryLabel: 'Thử thách trí tuệ', description: 'Ghép các mảnh hình học thành hình mẫu hoàn chỉnh.', target: 'individual', isReady: false, modeKey: 'tangram_game' },
  { id: 'f03', code: 'F03', title: 'Tháp Hà Nội', category: 'puzzle', categoryLabel: 'Thử thách trí tuệ', description: 'Chuyển toàn bộ đĩa sang cột đích theo quy tắc tư duy logic.', target: 'individual', isReady: false, modeKey: 'hanoi_tower' },
  { id: 'f04', code: 'F04', title: 'Mê cung trí tuệ', category: 'puzzle', categoryLabel: 'Thử thách trí tuệ', description: 'Dẫn đường cho nhân vật vượt mê cung tìm đáp án.', target: 'individual', isReady: false, modeKey: 'maze_game' },
  { id: 'f05', code: 'F05', title: 'Giải mật mã', category: 'puzzle', categoryLabel: 'Thử thách trí tuệ', description: 'Giải mã quy luật ẩn giấu trong dãy số hoặc ký tự.', target: 'individual', isReady: false, modeKey: 'cipher_puzzle' },
];
