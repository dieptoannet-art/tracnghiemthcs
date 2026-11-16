import React, { useState } from 'react';
import {
  LayoutGrid,
  Dices,
  Rocket,
  BookOpen,
  Trophy,
  Activity,
  Brain,
} from 'lucide-react';

import imgA01 from '../../assets/images/game_a01_wheel_1794745096494.jpg';
import imgA02 from '../../assets/images/game_a02_claw_1794745099106.jpg';
import imgA03 from '../../assets/images/game_a03_gift_1794745101949.jpg';
import imgA04 from '../../assets/images/game_a04_lottery_1794745103059.jpg';
import imgBannerGamepad from '../../assets/images/banner_gamepad_3d_1794745104946.jpg';

export const CATEGORY_META: Record<
  string,
  {
    label: string;
    count: number;
    color: string;
    iconBg: string;
    activeBg: string;
    border: string;
    icon: React.FC<{ className?: string }>;
  }
> = {
  all: {
    label: 'Tất cả trò chơi',
    count: 50,
    color: 'text-[#1769F4]',
    iconBg: 'text-[#1769F4]',
    activeBg: 'bg-[#1769F4] text-white',
    border: 'border-[#1769F4]',
    icon: LayoutGrid,
  },
  random: {
    label: 'Gọi học sinh ngẫu nhiên',
    count: 12,
    color: 'text-rose-500',
    iconBg: 'text-rose-500',
    activeBg: 'bg-[#1769F4] text-white',
    border: 'border-rose-200',
    icon: Dices,
  },
  warmup: {
    label: 'Khởi động tiết học',
    count: 10,
    color: 'text-orange-500',
    iconBg: 'text-orange-500',
    activeBg: 'bg-[#1769F4] text-white',
    border: 'border-orange-200',
    icon: Rocket,
  },
  reinforce: {
    label: 'Củng cố kiến thức',
    count: 10,
    color: 'text-sky-500',
    iconBg: 'text-sky-500',
    activeBg: 'bg-[#1769F4] text-white',
    border: 'border-sky-200',
    icon: BookOpen,
  },
  competition: {
    label: 'Thi đua cá nhân & nhóm',
    count: 8,
    color: 'text-amber-500',
    iconBg: 'text-amber-500',
    activeBg: 'bg-[#1769F4] text-white',
    border: 'border-amber-200',
    icon: Trophy,
  },
  movement: {
    label: 'Vận động & tương tác',
    count: 5,
    color: 'text-red-500',
    iconBg: 'text-red-500',
    activeBg: 'bg-[#1769F4] text-white',
    border: 'border-red-200',
    icon: Activity,
  },
  puzzle: {
    label: 'Thử thách trí tuệ',
    count: 5,
    color: 'text-purple-500',
    iconBg: 'text-purple-500',
    activeBg: 'bg-[#1769F4] text-white',
    border: 'border-purple-200',
    icon: Brain,
  },
};

export interface GameThumbnailManifestItem {
  gameId: string;
  code: string;
  gameName: string;
  thumbnailAsset: string;
  bundledFallbackAsset?: string;
  hasPhotorealisticAsset: boolean;
  subject3D: string;
  prompt3D: string;
}

const STUDIO_PROMPT_SUFFIX =
  'Photorealistic 3D product render, physically based materials, cinematic studio lighting, realistic reflections, soft ambient shadows, vibrant educational game aesthetics, premium quality, sharp details, 4:3 aspect ratio, centered subject, no text or labels.';

export const GAME_THUMBNAIL_MANIFEST: Record<string, GameThumbnailManifestItem> = {
  A01: {
    gameId: 'a01',
    code: 'A01',
    gameName: 'Vòng quay may mắn',
    thumbnailAsset: '/game-thumbnails/a01.webp',
    bundledFallbackAsset: imgA01,
    hasPhotorealisticAsset: true,
    subject3D: 'Vòng quay sắc màu gắn đèn LED, chân đế kim loại vàng, kim chỉ đỏ trong phòng học hiện đại',
    prompt3D: `Colorful prize wheel divided into rainbow segments on a golden metallic stand, red top pointer, warm glowing LED bulbs around the rim, modern study room background. ${STUDIO_PROMPT_SUFFIX}`,
  },
  A02: {
    gameId: 'a02',
    code: 'A02',
    gameName: 'Máy gắp thú',
    thumbnailAsset: '/game-thumbnails/a02.webp',
    bundledFallbackAsset: imgA02,
    hasPhotorealisticAsset: true,
    subject3D: 'Máy gắp thú arcade màu đỏ, lồng kính trong suốt, gấu bông, bóng màu, tay gắp kim loại và joystick',
    prompt3D: `Red arcade claw machine with transparent glass cabinet, cute plush teddy bears and colorful balls inside, metallic silver claw arm, red joystick and glowing arcade buttons. ${STUDIO_PROMPT_SUFFIX}`,
  },
  A03: {
    gameId: 'a03',
    code: 'A03',
    gameName: 'Hộp quà bí ẩn',
    thumbnailAsset: '/game-thumbnails/a03.webp',
    bundledFallbackAsset: imgA03,
    hasPhotorealisticAsset: true,
    subject3D: 'Hộp quà đỏ 3D sang trọng thắt ruy băng và nơ vàng kim nổi khối kèm hạt sáng lấp lánh',
    prompt3D: `Luxury textured red gift box with metallic gold satin ribbon and a large sculpted 3D golden bow on top, warm wooden table, floating golden bokeh sparkles. ${STUDIO_PROMPT_SUFFIX}`,
  },
  A04: {
    gameId: 'a04',
    code: 'A04',
    gameName: 'Bốc thăm thần kỳ',
    thumbnailAsset: '/game-thumbnails/a04.webp',
    bundledFallbackAsset: imgA04,
    hasPhotorealisticAsset: true,
    subject3D: 'Máy bốc thăm lồng kính tròn chứa nhiều quả bóng màu sắc trên đế kim loại đỏ bạc',
    prompt3D: `Mini lottery gumball machine with a clear spherical glass globe filled with colorful glossy balls inside, red and chrome metallic base with dispense chute. ${STUDIO_PROMPT_SUFFIX}`,
  },
  A05: {
    gameId: 'a05',
    code: 'A05',
    gameName: 'Vịt đua',
    thumbnailAsset: '/game-thumbnails/a05.webp',
    hasPhotorealisticAsset: false,
    subject3D: 'Đàn vịt vàng 3D đeo kính bơi đua trên làn nước xanh trong suốt',
    prompt3D: `Glossy yellow 3D rubber ducks wearing racing goggles swimming across crystal clear blue water lanes with gentle splashes and finish flags. ${STUDIO_PROMPT_SUFFIX}`,
  },
  A06: {
    gameId: 'a06',
    code: 'A06',
    gameName: 'Đua ngựa',
    thumbnailAsset: '/game-thumbnails/a06.webp',
    hasPhotorealisticAsset: false,
    subject3D: 'Ngựa đua 3D phi nước đại trên đường đua cỏ xanh với hàng rào trắng',
    prompt3D: `Stylized 3D miniature racehorses galloping on a vibrant green turf track with white paddock fences and golden finish arch. ${STUDIO_PROMPT_SUFFIX}`,
  },
  A07: {
    gameId: 'a07',
    code: 'A07',
    gameName: 'Tên lửa chọn bạn',
    thumbnailAsset: '/game-thumbnails/a07.webp',
    hasPhotorealisticAsset: false,
    subject3D: 'Tên lửa vũ trụ 3D trắng đỏ phóng lên từ bệ phóng giữa bầu trời sao và hành tinh',
    prompt3D: `Sleek white and red 3D space rocket launching with glowing golden thrusters and soft smoke clouds against a starry cosmos with ringed planets. ${STUDIO_PROMPT_SUFFIX}`,
  },
  A08: {
    gameId: 'a08',
    code: 'A08',
    gameName: 'Bóng bay may mắn',
    thumbnailAsset: '/game-thumbnails/a08.webp',
    hasPhotorealisticAsset: false,
    subject3D: 'Chùm bóng bay 3D căng bóng nhiều màu sắc bay giữa bầu trời mây trắng',
    prompt3D: `Cluster of glossy 3D helium balloons in vibrant red, gold, blue, and emerald floating among soft sunlit clouds with golden ribbons. ${STUDIO_PROMPT_SUFFIX}`,
  },
  A09: {
    gameId: 'a09',
    code: 'A09',
    gameName: 'Xúc xắc chọn tên',
    thumbnailAsset: '/game-thumbnails/a09.webp',
    hasPhotorealisticAsset: false,
    subject3D: 'Cặp xúc xắc 3D nhựa bóng trắng và vàng kim đang nảy trên bàn gỗ studio',
    prompt3D: `Pair of glossy 3D acrylic and metallic gold dice mid-roll over a royal blue velvet and polished wood board surface. ${STUDIO_PROMPT_SUFFIX}`,
  },
  A10: {
    gameId: 'a10',
    code: 'A10',
    gameName: 'Thẻ bài bí mật',
    thumbnailAsset: '/game-thumbnails/a10.webp',
    hasPhotorealisticAsset: false,
    subject3D: 'Bộ thẻ bài 3D viền vàng kim có ngôi sao phát sáng lơ lửng',
    prompt3D: `Three floating 3D royal blue and gold foil collector cards with embossed star emblems and magical golden rim light. ${STUDIO_PROMPT_SUFFIX}`,
  },
  A11: {
    gameId: 'a11',
    code: 'A11',
    gameName: 'Bánh xe số',
    thumbnailAsset: '/game-thumbnails/a11.webp',
    hasPhotorealisticAsset: false,
    subject3D: 'Bánh xe cơ khí 3D bằng đồng và thép không gỉ chia vạch chỉ số',
    prompt3D: `Precision 3D brass and brushed steel mechanical number wheel with glowing cyan ring segments on a studio pedestal. ${STUDIO_PROMPT_SUFFIX}`,
  },
  A12: {
    gameId: 'a12',
    code: 'A12',
    gameName: 'Robot chọn bạn',
    thumbnailAsset: '/game-thumbnails/a12.webp',
    hasPhotorealisticAsset: false,
    subject3D: 'Robot giáo dục 3D vỏ nhựa trắng xanh với màn hình LED thân thiện',
    prompt3D: `Friendly 3D educational robot with glossy white and royal blue shell, glowing cyan LED eyes, and holographic scanner beam. ${STUDIO_PROMPT_SUFFIX}`,
  },
  B01: {
    gameId: 'b01',
    code: 'B01',
    gameName: 'Ai nhanh hơn',
    thumbnailAsset: '/game-thumbnails/b01.webp',
    hasPhotorealisticAsset: false,
    subject3D: 'Bục bấm chuông gameshow 3D với nút vòm đỏ phát sáng và tia chớp vàng',
    prompt3D: `3D game show podium with a large glowing red dome buzzer button, chrome rim, and a golden 3D lightning bolt emblem. ${STUDIO_PROMPT_SUFFIX}`,
  },
  B02: {
    gameId: 'b02',
    code: 'B02',
    gameName: 'Đoán hình bí mật',
    thumbnailAsset: '/game-thumbnails/b02.webp',
    hasPhotorealisticAsset: false,
    subject3D: 'Khung tranh 3D với các mảnh ghép đang mở dần và kính lúp vàng',
    prompt3D: `3D golden picture frame covered by interlocking glossy blue puzzle tiles with one tile flipping open and a 3D brass magnifying glass. ${STUDIO_PROMPT_SUFFIX}`,
  },
  B03: {
    gameId: 'b03',
    code: 'B03',
    gameName: 'Lật ô chữ',
    thumbnailAsset: '/game-thumbnails/b03.webp',
    hasPhotorealisticAsset: false,
    subject3D: 'Bảng lưới ô chữ 3D nổi khối với cột từ khóa vàng kim phát sáng',
    prompt3D: `3D illuminated crossword board made of glossy blue and glowing metallic gold 3D tile blocks arranged in rows and a highlighted vertical keyword column. ${STUDIO_PROMPT_SUFFIX}`,
  },
  B04: {
    gameId: 'b04',
    code: 'B04',
    gameName: 'Giải mã bí mật',
    thumbnailAsset: '/game-thumbnails/b04.webp',
    hasPhotorealisticAsset: false,
    subject3D: 'Rương kho báu 3D bọc đồng vàng với ổ khóa số cơ học và chìa khóa cổ',
    prompt3D: `Ornate 3D wooden and brass treasure chest with a glowing rotary combination lock and golden key on a stone pedestal. ${STUDIO_PROMPT_SUFFIX}`,
  },
  B05: {
    gameId: 'b05',
    code: 'B05',
    gameName: 'Đúng hay sai',
    thumbnailAsset: '/game-thumbnails/b05.webp',
    hasPhotorealisticAsset: false,
    subject3D: 'Hai nút biểu tượng 3D Xanh ngọc (Tích đúng) và Đỏ hồng (Dấu nhân) đối xứng',
    prompt3D: `Dual 3D glossy game buttons on a sleek stage: an emerald green checkmark orb on the left and a ruby red cross orb on the right. ${STUDIO_PROMPT_SUFFIX}`,
  },
  B06: {
    gameId: 'b06',
    code: 'B06',
    gameName: 'Đuổi hình bắt chữ',
    thumbnailAsset: '/game-thumbnails/b06.webp',
    hasPhotorealisticAsset: false,
    subject3D: 'Các khối lập phương 3D khắc biểu tượng hình ảnh ghép thành chuỗi từ vựng',
    prompt3D: `3D glossy picture cubes showing sculpted icons (sun, book, lightbulb) connected by a golden plus sign above golden 3D letter tiles. ${STUDIO_PROMPT_SUFFIX}`,
  },
  B07: {
    gameId: 'b07',
    code: 'B07',
    gameName: 'Ô cửa bí mật',
    thumbnailAsset: '/game-thumbnails/b07.webp',
    hasPhotorealisticAsset: false,
    subject3D: 'Ba cánh cửa vòm 3D màu xanh, vàng, đỏ với khe sáng kỳ diệu hé mở',
    prompt3D: `Three mysterious 3D arched doors in royal blue, ruby red, and emerald green with golden handles and warm magical light beams peeking through. ${STUDIO_PROMPT_SUFFIX}`,
  },
  B08: {
    gameId: 'b08',
    code: 'B08',
    gameName: 'Ghép cặp kiến thức',
    thumbnailAsset: '/game-thumbnails/b08.webp',
    hasPhotorealisticAsset: false,
    subject3D: 'Hai mảnh ghép 3D kim loại vàng và xanh dương đang khớp nối phát sáng',
    prompt3D: `Two large 3D interlocking jigsaw puzzle pieces in glossy royal blue and metallic gold snapping together with a bright spark. ${STUDIO_PROMPT_SUFFIX}`,
  },
  B09: {
    gameId: 'b09',
    code: 'B09',
    gameName: 'Tìm từ khóa',
    thumbnailAsset: '/game-thumbnails/b09.webp',
    hasPhotorealisticAsset: false,
    subject3D: 'Kính lúp 3D viền đồng soi sáng chuỗi khối chữ cái trên bàn cờ',
    prompt3D: `3D brass magnifying glass hovering over a grid of tactile 3D ivory and gold letter tiles, highlighting a glowing diagonal row. ${STUDIO_PROMPT_SUFFIX}`,
  },
  B10: {
    gameId: 'b10',
    code: 'B10',
    gameName: 'Câu hỏi chớp nhoáng',
    thumbnailAsset: '/game-thumbnails/b10.webp',
    hasPhotorealisticAsset: false,
    subject3D: 'Đồng hồ bấm giờ 3D bằng vàng kết hợp tia sét năng lượng xanh',
    prompt3D: `3D golden chronograph stopwatch surrounded by dynamic electric cyan energy rings and a sculpted 3D lightning bolt. ${STUDIO_PROMPT_SUFFIX}`,
  },
  C01: {
    gameId: 'c01',
    code: 'C01',
    gameName: 'Ai là triệu phú',
    thumbnailAsset: '/game-thumbnails/c01.webp',
    hasPhotorealisticAsset: false,
    subject3D: 'Ghế nóng sân khấu 3D dưới ánh đèn spotlight cùng tháp kim cương 15 nấc',
    prompt3D: `3D quiz show stage with a sleek leather and chrome hot-seat chair under dramatic blue spotlights and a glowing golden 15-tier prize pyramid. ${STUDIO_PROMPT_SUFFIX}`,
  },
  C02: {
    gameId: 'c02',
    code: 'C02',
    gameName: 'Rung chuông vàng',
    thumbnailAsset: '/game-thumbnails/c02.webp',
    hasPhotorealisticAsset: false,
    subject3D: 'Chiếc chuông đồng vàng 3D lớn treo trên giá đỡ chạm khắc kèm vòng nguyệt quế',
    prompt3D: `Large gleaming 3D golden bell suspended on an ornate royal blue arch surrounded by a 3D golden laurel wreath and soundwave rings. ${STUDIO_PROMPT_SUFFIX}`,
  },
  C03: {
    gameId: 'c03',
    code: 'C03',
    gameName: 'Đấu trường kiến thức',
    thumbnailAsset: '/game-thumbnails/c03.webp',
    hasPhotorealisticAsset: false,
    subject3D: 'Khiên hiệp sĩ 3D mạ vàng và xanh navy đặt trên đấu trường đá cẩm thạch',
    prompt3D: `3D royal blue and gold heraldic shield with a book crest standing in the center of a miniature marble colosseum arena. ${STUDIO_PROMPT_SUFFIX}`,
  },
  C04: {
    gameId: 'c04',
    code: 'C04',
    gameName: 'Vượt chướng ngại vật',
    thumbnailAsset: '/game-thumbnails/c04.webp',
    hasPhotorealisticAsset: false,
    subject3D: 'Đường đua vượt rào 3D dẫn tới viên pha lê chiến thắng trên đỉnh bục',
    prompt3D: `3D ascending obstacle course track with glowing hurdles leading up to a radiant golden crystal trophy at the summit. ${STUDIO_PROMPT_SUFFIX}`,
  },
  C05: {
    gameId: 'c05',
    code: 'C05',
    gameName: 'Ô chữ kiến thức',
    thumbnailAsset: '/game-thumbnails/c05.webp',
    hasPhotorealisticAsset: false,
    subject3D: 'Khối lập phương 3D xoay đa chiều ghép từ các ô chữ vàng và xanh',
    prompt3D: `3D rotating cube matrix constructed from glowing sapphire blue and brushed gold letter blocks floating above a pedestal. ${STUDIO_PROMPT_SUFFIX}`,
  },
  C06: {
    gameId: 'c06',
    code: 'C06',
    gameName: 'Truy tìm kho báu',
    thumbnailAsset: '/game-thumbnails/c06.webp',
    hasPhotorealisticAsset: false,
    subject3D: 'Bản đồ đảo kho báu 3D nổi khối kèm la bàn vàng và rương châu báu',
    prompt3D: `3D diorama of a tropical treasure island with a glowing dotted trail, a brass compass, and an open chest overflowing with gold coins. ${STUDIO_PROMPT_SUFFIX}`,
  },
  C07: {
    gameId: 'c07',
    code: 'C07',
    gameName: 'Giải cứu công chúa',
    thumbnailAsset: '/game-thumbnails/c07.webp',
    hasPhotorealisticAsset: false,
    subject3D: 'Lâu đài cổ tích 3D với cây cầu đá nối liền từng nhịp qua hào nước',
    prompt3D: `3D fairy-tale stone castle tower with a glowing golden bridge of stepping stones spanning across a crystal moat. ${STUDIO_PROMPT_SUFFIX}`,
  },
  C08: {
    gameId: 'c08',
    code: 'C08',
    gameName: 'Đường lên đỉnh núi',
    thumbnailAsset: '/game-thumbnails/c08.webp',
    hasPhotorealisticAsset: false,
    subject3D: 'Ngọn núi 3D hùng vĩ với 4 trạm mốc ánh sáng và lá cờ vàng trên đỉnh',
    prompt3D: `3D stylized mountain peak with a winding golden path, four glowing checkpoint beacons, and a triumphant golden flag at the summit. ${STUDIO_PROMPT_SUFFIX}`,
  },
  C09: {
    gameId: 'c09',
    code: 'C09',
    gameName: 'Bingo kiến thức',
    thumbnailAsset: '/game-thumbnails/c09.webp',
    hasPhotorealisticAsset: false,
    subject3D: 'Bảng Bingo 5x5 3D với5 viên ngọc vàng thẳng hàng phát sáng và lồng quay',
    prompt3D: `3D 5x5 Bingo board with a glowing diagonal line of five golden spheres next to a brass wire lottery cage. ${STUDIO_PROMPT_SUFFIX}`,
  },
  C10: {
    gameId: 'c10',
    code: 'C10',
    gameName: 'Giải cứu đại dương',
    thumbnailAsset: '/game-thumbnails/c10.webp',
    hasPhotorealisticAsset: false,
    subject3D: 'Tàu ngầm mini 3D màu vàng khám phá rạn san hô xanh và vỏ sò ngọc trai',
    prompt3D: `Cute 3D yellow research submarine illuminating a vibrant coral reef and a glowing pearl clam shell underwater. ${STUDIO_PROMPT_SUFFIX}`,
  },
  D01: {
    gameId: 'd01',
    code: 'D01',
    gameName: 'Đấu trường 1 đấu 1',
    thumbnailAsset: '/game-thumbnails/d01.webp',
    hasPhotorealisticAsset: false,
    subject3D: 'Hai bục thi đấu đối kháng 3D Xanh dương và Đỏ cam với tia chớp giao nhau ở giữa',
    prompt3D: `Symmetrical 3D duel stage with a sapphire blue podium on the left and a fiery crimson podium on the right, connected by a golden clash spark. ${STUDIO_PROMPT_SUFFIX}`,
  },
  D02: {
    gameId: 'd02',
    code: 'D02',
    gameName: 'Đua thuyền',
    thumbnailAsset: '/game-thumbnails/d02.webp',
    hasPhotorealisticAsset: false,
    subject3D: 'Hai chiếc thuyền đua 3D căng buồm lướt sóng về phía phao đích vàng',
    prompt3D: `Two colorful 3D racing sailboats with billowing sails cutting through stylized turquoise waves toward a golden buoy. ${STUDIO_PROMPT_SUFFIX}`,
  },
  D03: {
    gameId: 'd03',
    code: 'D03',
    gameName: 'Kéo co kiến thức',
    thumbnailAsset: '/game-thumbnails/d03.webp',
    hasPhotorealisticAsset: false,
    subject3D: 'Sợi dây thừng 3D căng ngang với dải ruy băng đỏ ở vạch tâm vàng kim',
    prompt3D: `3D braided hemp tug-of-war rope stretched taut across a glowing golden center line marker with a red satin ribbon tied in the middle. ${STUDIO_PROMPT_SUFFIX}`,
  },
  D04: {
    gameId: 'd04',
    code: 'D04',
    gameName: 'Đua xe tốc độ',
    thumbnailAsset: '/game-thumbnails/d04.webp',
    hasPhotorealisticAsset: false,
    subject3D: 'Xe đua 3D khí động học màu xanh-vàng lướt trên đường đua có cờ caro',
    prompt3D: `Sleek 3D futuristic formula race car in royal blue and gold livery speeding down a glossy track beneath a checkered flag arch. ${STUDIO_PROMPT_SUFFIX}`,
  },
  D05: {
    gameId: 'd05',
    code: 'D05',
    gameName: 'Tiếp sức đồng đội',
    thumbnailAsset: '/game-thumbnails/d05.webp',
    hasPhotorealisticAsset: false,
    subject3D: 'Gậy tiếp sức 3D mạ vàng phát sáng trên đường chạy điền kinh',
    prompt3D: `Gleaming 3D metallic gold relay baton with glowing cyan rings hovering above a red athletics running track. ${STUDIO_PROMPT_SUFFIX}`,
  },
  D06: {
    gameId: 'd06',
    code: 'D06',
    gameName: 'Vua ghi điểm',
    thumbnailAsset: '/game-thumbnails/d06.webp',
    hasPhotorealisticAsset: false,
    subject3D: 'Vương miện vàng 3D đính đá quý đặt trên gối nhung đỏ',
    prompt3D: `Royal 3D golden crown encrusted with sapphires and rubies resting on a plush red velvet cushion with studio rim lighting. ${STUDIO_PROMPT_SUFFIX}`,
  },
  D07: {
    gameId: 'd07',
    code: 'D07',
    gameName: 'Thách đấu nhóm',
    thumbnailAsset: '/game-thumbnails/d07.webp',
    hasPhotorealisticAsset: false,
    subject3D: 'Hai lá cờ đội 3D bắt chéo sau chiếc cúp khiên danh dự bằng vàng',
    prompt3D: `Crossed 3D blue and gold team pennants behind a polished golden championship shield emblem. ${STUDIO_PROMPT_SUFFIX}`,
  },
  D08: {
    gameId: 'd08',
    code: 'D08',
    gameName: 'Đấu trường 4 đội',
    thumbnailAsset: '/game-thumbnails/d08.webp',
    hasPhotorealisticAsset: false,
    subject3D: 'Bốn trụ pha lê 3D Đỏ, Xanh dương, Vàng, Xanh lá hội tụ quanh ngôi sao trung tâm',
    prompt3D: `Four glowing 3D crystal pillars in red, blue, gold, and emerald arranged around a central levitating golden star trophy. ${STUDIO_PROMPT_SUFFIX}`,
  },
  E01: {
    gameId: 'e01',
    code: 'E01',
    gameName: 'Nhảy theo lệnh',
    thumbnailAsset: '/game-thumbnails/e01.webp',
    hasPhotorealisticAsset: false,
    subject3D: 'Sàn nhảy tương tác 3D với các ô mũi tên phát sáng đa sắc',
    prompt3D: `3D interactive arcade dance floor pad with glowing directional arrow tiles in cyan, yellow, pink, and green. ${STUDIO_PROMPT_SUFFIX}`,
  },
  E02: {
    gameId: 'e02',
    code: 'E02',
    gameName: 'Bắt bóng kiến thức',
    thumbnailAsset: '/game-thumbnails/e02.webp',
    hasPhotorealisticAsset: false,
    subject3D: 'Vợt bắt bóng 3D và những quả cầu ánh sáng nhiều màu đang bay tới',
    prompt3D: `3D golden hoop net catching vibrant glowing spheres in mid-air with dynamic motion trails. ${STUDIO_PROMPT_SUFFIX}`,
  },
  E03: {
    gameId: 'e03',
    code: 'E03',
    gameName: 'Phản xạ nhanh',
    thumbnailAsset: '/game-thumbnails/e03.webp',
    hasPhotorealisticAsset: false,
    subject3D: 'Đèn tín hiệu 3D Đỏ-Vàng-Xanh chuyển sang Xanh ngọc cùng nút bấm tốc độ',
    prompt3D: `3D reflex light tower glowing bright emerald green beside a high-speed chrome push button with ripple rings. ${STUDIO_PROMPT_SUFFIX}`,
  },
  E04: {
    gameId: 'e04',
    code: 'E04',
    gameName: 'Simon Says',
    thumbnailAsset: '/game-thumbnails/e04.webp',
    hasPhotorealisticAsset: false,
    subject3D: 'Bàn xoay 4 phím màu 3D (Đỏ, Xanh lá, Vàng, Xanh dương) phát sáng theo nhịp',
    prompt3D: `Classic 3D circular electronic memory game console with four glowing translucent color quadrants (red, green, yellow, blue). ${STUDIO_PROMPT_SUFFIX}`,
  },
  E05: {
    gameId: 'e05',
    code: 'E05',
    gameName: 'Săn sao kiến thức',
    thumbnailAsset: '/game-thumbnails/e05.webp',
    hasPhotorealisticAsset: false,
    subject3D: 'Kính thiên văn 3D bằng đồng vàng hướng lên bầu trời đầy sao băng lấp lánh',
    prompt3D: `Polished 3D brass telescope on a wooden tripod aimed at a cluster of glowing 3D golden shooting stars. ${STUDIO_PROMPT_SUFFIX}`,
  },
  F01: {
    gameId: 'f01',
    code: 'F01',
    gameName: 'Sudoku',
    thumbnailAsset: '/game-thumbnails/f01.webp',
    hasPhotorealisticAsset: false,
    subject3D: 'Khay gỗ 3D chia ô lưới Sudoku với các viên gạch khắc chữ số vàng kim',
    prompt3D: `Crafted 3D wooden Sudoku board filled with glossy navy and metallic gold 3D number tiles. ${STUDIO_PROMPT_SUFFIX}`,
  },
  F02: {
    gameId: 'f02',
    code: 'F02',
    gameName: 'Tangram',
    thumbnailAsset: '/game-thumbnails/f02.webp',
    hasPhotorealisticAsset: false,
    subject3D: 'Bảy mảnh ghép hình học Tangram 3D nhiều màu sắc ghép thành hình chim thiên nga',
    prompt3D: `Seven colorful 3D beveled acrylic Tangram geometric blocks arranged on a warm wooden board. ${STUDIO_PROMPT_SUFFIX}`,
  },
  F03: {
    gameId: 'f03',
    code: 'F03',
    gameName: 'Tháp Hà Nội',
    thumbnailAsset: '/game-thumbnails/f03.webp',
    hasPhotorealisticAsset: false,
    subject3D: 'Bộ trò chơi Tháp Hà Nội 3D với 3 cột gỗ và các đĩa tròn kim loại nhiều màu',
    prompt3D: `3D Tower of Hanoi puzzle with three polished wooden rods and stacked anodized metallic rings in rainbow colors. ${STUDIO_PROMPT_SUFFIX}`,
  },
  F04: {
    gameId: 'f04',
    code: 'F04',
    gameName: 'Mê cung trí tuệ',
    thumbnailAsset: '/game-thumbnails/f04.webp',
    hasPhotorealisticAsset: false,
    subject3D: 'Mê cung 3D góc nhìn isometric với viên bi vàng tìm đường tới tâm phát sáng',
    prompt3D: `Isometric 3D marble labyrinth maze with royal blue walls, a glowing golden path, and a polished gold sphere reaching the center goal. ${STUDIO_PROMPT_SUFFIX}`,
  },
  F05: {
    gameId: 'f05',
    code: 'F05',
    gameName: 'Giải mật mã',
    thumbnailAsset: '/game-thumbnails/f05.webp',
    hasPhotorealisticAsset: false,
    subject3D: 'Ống khóa mật mã Cryptex 3D bằng đồng vàng với các vòng xoay ký tự',
    prompt3D: `Intricate 3D Da Vinci brass cryptex cylinder lock with rotating engraved rings and a glowing cyan core. ${STUDIO_PROMPT_SUFFIX}`,
  },
};

export const BannerGamepadSVG: React.FC<{ className?: string }> = ({ className = 'w-28 h-24' }) => {
  const [imgError, setImgError] = useState(false);

  if (!imgError) {
    return (
      <div className={`relative flex items-center justify-center select-none ${className}`}>
        <div className="absolute inset-0 rounded-2xl bg-cyan-400/20 blur-xl pointer-events-none" />
        <img
          src="/game-thumbnails/banner-gamepad.webp"
          onError={(e) => {
            const target = e.currentTarget;
            if (target.src !== imgBannerGamepad) {
              target.src = imgBannerGamepad;
            } else {
              setImgError(true);
            }
          }}
          alt="3D Game Controller"
          referrerPolicy="no-referrer"
          className="relative z-10 w-full h-full object-contain rounded-2xl drop-shadow-[0_10px_18px_rgba(0,0,0,0.45)]"
        />
      </div>
    );
  }

  return (
    <svg viewBox="0 0 160 120" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="padBody" x1="0" y1="0" x2="160" y2="120" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="60%" stopColor="#E0E7FF" />
          <stop offset="100%" stopColor="#93C5FD" />
        </linearGradient>
        <linearGradient id="padGrip" x1="0" y1="40" x2="160" y2="120" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#1D4ED8" />
        </linearGradient>
        <filter id="padShadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="#0F172A" floodOpacity="0.35" />
        </filter>
      </defs>
      <ellipse cx="80" cy="102" rx="54" ry="10" stroke="#20C9FF" strokeWidth="3" fill="#20C9FF" fillOpacity="0.18" />
      <g filter="url(#padShadow)" transform="rotate(-10 80 56)">
        <path
          d="M42 28 H118 C134 28 146 42 142 62 L136 88 C133 100 120 104 110 94 L98 80 H62 L50 94 C40 104 27 100 24 88 L18 62 C14 42 26 28 42 28 Z"
          fill="url(#padBody)"
          stroke="#FFFFFF"
          strokeWidth="2.5"
        />
        <path d="M24 88 L18 64 C16 54 22 46 30 48 L42 80 L34 94 C29 98 25 94 24 88 Z" fill="url(#padGrip)" />
        <path d="M136 88 L142 64 C144 54 138 46 130 48 L118 80 L126 94 C131 98 135 94 136 88 Z" fill="url(#padGrip)" />
        <rect x="42" y="44" width="8" height="22" rx="2.5" fill="#1E293B" />
        <rect x="35" y="51" width="22" height="8" rx="2.5" fill="#1E293B" />
        <circle cx="114" cy="45" r="4.5" fill="#FACC15" />
        <circle cx="123" cy="54" r="4.5" fill="#EF4444" />
        <circle cx="105" cy="54" r="4.5" fill="#3B82F6" />
        <circle cx="114" cy="63" r="4.5" fill="#10B981" />
        <circle cx="64" cy="66" r="8" fill="#1E293B" stroke="#94A3B8" strokeWidth="2" />
        <circle cx="96" cy="66" r="8" fill="#1E293B" stroke="#94A3B8" strokeWidth="2" />
      </g>
    </svg>
  );
};

export const BannerTrophyBooksSVG: React.FC<{ className?: string }> = ({ className = 'w-28 h-24' }) => (
  <svg viewBox="0 0 180 130" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="goldCup3D" x1="30" y1="10" x2="105" y2="95" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#FFFBEB" />
        <stop offset="25%" stopColor="#FDE047" />
        <stop offset="55%" stopColor="#F59E0B" />
        <stop offset="85%" stopColor="#B45309" />
        <stop offset="100%" stopColor="#FDE047" />
      </linearGradient>
      <linearGradient id="podium3D" x1="20" y1="95" x2="160" y2="125" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#6366F1" />
        <stop offset="50%" stopColor="#3B82F6" />
        <stop offset="100%" stopColor="#1D4ED8" />
      </linearGradient>
      <filter id="trophyDrop" x="-15%" y="-15%" width="130%" height="130%">
        <feDropShadow dx="0" dy="6" stdDeviation="5" floodColor="#09152B" floodOpacity="0.45" />
      </filter>
    </defs>

    {/* Glowing Podium Base */}
    <ellipse cx="92" cy="112" rx="68" ry="12" fill="url(#podium3D)" stroke="#A5B4FC" strokeWidth="2" />
    <ellipse cx="92" cy="109" rx="60" ry="8" fill="#38BDF8" fillOpacity="0.28" />

    {/* Floating 3D Golden Stars */}
    <g filter="url(#trophyDrop)">
      <path d="M22 28 L25 35 L33 36 L27 41 L29 49 L22 45 L15 49 L17 41 L11 36 L19 35 Z" fill="url(#goldCup3D)" />
      <path d="M154 18 L157 24 L164 25 L159 30 L160 37 L154 33 L148 37 L149 30 L144 25 L151 24 Z" fill="url(#goldCup3D)" />
      <path d="M142 52 L144 56 L149 57 L145 60 L146 65 L142 62 L138 65 L139 60 L135 57 L140 56 Z" fill="url(#goldCup3D)" />
    </g>

    {/* 3D Golden Trophy */}
    <g transform="translate(26, 12)" filter="url(#trophyDrop)">
      <path d="M16 18 C0 18 0 46 18 48" stroke="url(#goldCup3D)" strokeWidth="6" strokeLinecap="round" fill="none" />
      <path d="M68 18 C84 18 84 46 66 48" stroke="url(#goldCup3D)" strokeWidth="6" strokeLinecap="round" fill="none" />
      <path d="M16 10 H68 V34 C68 54 54 66 42 66 C30 66 16 54 16 34 V10 Z" fill="url(#goldCup3D)" stroke="#FEF9C3" strokeWidth="1.5" />
      {/* Specular Highlight */}
      <path d="M23 15 H31 V34 C31 46 27 54 23 56 Z" fill="#FFFFFF" fillOpacity="0.38" />
      {/* Embossed 3D Star */}
      <path d="M42 22 L45.5 30 L54 31 L47.5 36.5 L49.5 45 L42 40.5 L34.5 45 L36.5 36.5 L30 31 L38.5 30 Z" fill="#FFFBEB" stroke="#D97706" strokeWidth="1" />
      {/* Stem & Pedestal */}
      <rect x="36" y="65" width="12" height="16" rx="3" fill="url(#goldCup3D)" />
      <rect x="24" y="79" width="36" height="8" rx="3" fill="#B45309" stroke="#FDE047" strokeWidth="1.2" />
      <rect x="18" y="87" width="48" height="10" rx="3" fill="#78350F" stroke="#FACC15" strokeWidth="1.5" />
    </g>

    {/* 3D Stack of Hardcover Textbooks (Clean spines without foreign text) */}
    <g transform="translate(88, 60)" filter="url(#trophyDrop)">
      {/* Bottom Blue Book */}
      <rect x="0" y="32" width="62" height="14" rx="3.5" fill="#1D4ED8" stroke="#60A5FA" strokeWidth="1.2" />
      <rect x="6" y="35" width="52" height="8" rx="1.5" fill="#F8FAFC" />
      <line x1="14" y1="32" x2="14" y2="46" stroke="#FACC15" strokeWidth="2" />
      {/* Middle Green Book */}
      <rect x="4" y="18" width="56" height="14" rx="3.5" fill="#059669" stroke="#34D399" strokeWidth="1.2" />
      <rect x="10" y="21" width="46" height="8" rx="1.5" fill="#F8FAFC" />
      <line x1="18" y1="18" x2="18" y2="32" stroke="#FACC15" strokeWidth="2" />
      {/* Top Red Book */}
      <rect x="2" y="4" width="58" height="14" rx="3.5" fill="#DC2626" stroke="#FCA5A5" strokeWidth="1.2" />
      <rect x="8" y="7" width="48" height="8" rx="1.5" fill="#F8FAFC" />
      <line x1="16" y1="4" x2="16" y2="18" stroke="#FACC15" strokeWidth="2" />
    </g>
  </svg>
);

const StudioBackdropDefs: React.FC<{ code: string; c1: string; c2: string; glow: string }> = ({
  code,
  c1,
  c2,
  glow,
}) => (
  <defs>
    <linearGradient id={`bg_${code}`} x1="0" y1="0" x2="320" y2="200" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stopColor={c1} />
      <stop offset="100%" stopColor={c2} />
    </linearGradient>
    <radialGradient id={`glow_${code}`} cx="50%" cy="48%" r="48%">
      <stop offset="0%" stopColor={glow} stopOpacity="0.42" />
      <stop offset="65%" stopColor={glow} stopOpacity="0.12" />
      <stop offset="100%" stopColor={glow} stopOpacity="0" />
    </radialGradient>
    <linearGradient id={`gold_${code}`} x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stopColor="#FFFBEB" />
      <stop offset="35%" stopColor="#FACC15" />
      <stop offset="75%" stopColor="#D97706" />
      <stop offset="100%" stopColor="#FEF08A" />
    </linearGradient>
    <linearGradient id={`chrome_${code}`} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#FFFFFF" />
      <stop offset="45%" stopColor="#CBD5E1" />
      <stop offset="80%" stopColor="#64748B" />
      <stop offset="100%" stopColor="#E2E8F0" />
    </linearGradient>
    <filter id={`sh_${code}`} x="-15%" y="-15%" width="130%" height="135%">
      <feDropShadow dx="0" dy="8" stdDeviation="6" floodColor="#020617" floodOpacity="0.45" />
    </filter>
  </defs>
);

const renderUnique3DSubject = (code: string): React.ReactNode => {
  const sh = `url(#sh_${code})`;
  const gold = `url(#gold_${code})`;
  const chrome = `url(#chrome_${code})`;

  switch (code) {
    case 'A01':
      return (
        <g filter={sh} transform="translate(160, 96)">
          <path d="M-28 74 L0 28 L28 74 Z" fill={gold} />
          <rect x="-38" y="70" width="76" height="10" rx="5" fill={gold} />
          <circle r="58" fill={gold} />
          <path d="M0 0 L0 -50 A50 50 0 0 1 43 -25 Z" fill="#EF4444" />
          <path d="M0 0 L43 -25 A50 50 0 0 1 43 25 Z" fill="#F59E0B" />
          <path d="M0 0 L43 25 A50 50 0 0 1 0 50 Z" fill="#10B981" />
          <path d="M0 0 L0 50 A50 50 0 0 1 -43 25 Z" fill="#3B82F6" />
          <path d="M0 0 L-43 25 A50 50 0 0 1 -43 -25 Z" fill="#8B5CF6" />
          <path d="M0 0 L-43 -25 A50 50 0 0 1 0 -50 Z" fill="#EC4899" />
          <circle r="14" fill={gold} />
          <path d="M-8 -64 H8 L0 -46 Z" fill="#EF4444" stroke="#FFF" strokeWidth="2" />
        </g>
      );

    case 'A02':
      return (
        <g filter={sh} transform="translate(96, 18)">
          <rect width="128" height="158" rx="14" fill="#DC2626" stroke={gold} strokeWidth="3" />
          <rect x="10" y="14" width="108" height="96" rx="8" fill="#E0F2FE" fillOpacity="0.25" stroke="#BAE6FD" strokeWidth="2" />
          <line x1="64" y1="14" x2="64" y2="38" stroke={chrome} strokeWidth="4" />
          <path d="M48 52 C48 36 80 36 80 52" stroke={chrome} strokeWidth="4" fill="none" />
          <circle cx="64" cy="76" r="16" fill="#D97706" />
          <circle cx="64" cy="96" r="18" fill="#B45309" />
          <circle cx="32" cy="96" r="10" fill="#F43F5E" />
          <circle cx="96" cy="96" r="10" fill="#3B82F6" />
          <circle cx="64" cy="126" r="7" fill="#EF4444" stroke="#FFF" strokeWidth="2" />
        </g>
      );

    case 'A03':
      return (
        <g filter={sh} transform="translate(106, 42)">
          <rect x="8" y="36" width="92" height="76" rx="10" fill="#DC2626" stroke="#FCA5A5" strokeWidth="2" />
          <rect x="44" y="36" width="20" height="76" fill={gold} />
          <rect x="8" y="66" width="92" height="16" fill={gold} />
          <rect x="0" y="18" width="108" height="22" rx="7" fill="#B91C1C" stroke={gold} strokeWidth="2" />
          <rect x="44" y="18" width="20" height="22" fill={gold} />
          <path d="M54 18 C32 -8 12 8 36 20 Z" fill={gold} />
          <path d="M54 18 C76 -8 96 8 72 20 Z" fill={gold} />
          <circle cx="54" cy="16" r="7" fill={gold} />
        </g>
      );

    case 'A04':
      return (
        <g filter={sh} transform="translate(160, 88)">
          <path d="M-44 76 H44 L32 38 H-32 Z" fill="#DC2626" stroke={chrome} strokeWidth="3" />
          <rect x="-14" y="50" width="28" height="20" rx="5" fill={chrome} />
          <circle cy="-10" r="54" fill="#E0F2FE" fillOpacity="0.24" stroke="#E0F2FE" strokeWidth="3" />
          <circle cx="-22" cy="10" r="12" fill="#EF4444" />
          <circle cx="0" cy="16" r="12" fill="#FACC15" />
          <circle cx="22" cy="8" r="12" fill="#10B981" />
          <circle cx="-12" cy="-10" r="12" fill="#3B82F6" />
          <circle cx="14" cy="-12" r="12" fill="#EC4899" />
          <circle cx="0" cy="-30" r="11" fill="#A855F7" />
        </g>
      );

    case 'A05': // Vịt đua 3D
      return (
        <g filter={sh}>
          <ellipse cx="160" cy="142" rx="115" ry="26" fill="#0284C7" fillOpacity="0.55" stroke="#38BDF8" strokeWidth="2" />
          <g transform="translate(105, 48)">
            <ellipse cx="44" cy="66" rx="42" ry="26" fill={gold} />
            <ellipse cx="40" cy="66" rx="22" ry="13" fill="#F59E0B" />
            <circle cx="68" cy="30" r="24" fill={gold} />
            <rect x="54" y="18" width="28" height="12" rx="5" fill="#0866F5" stroke="#FFF" strokeWidth="2" />
            <path d="M88 28 C106 28 106 40 88 40 Z" fill="#EA580C" />
            <circle cx="32" cy="54" r="6" fill="#FFF" fillOpacity="0.4" />
          </g>
        </g>
      );

    case 'A06': // Đua ngựa 3D
      return (
        <g filter={sh}>
          <rect x="36" y="128" width="248" height="24" rx="12" fill="#15803D" stroke="#4ADE80" strokeWidth="2" />
          <g transform="translate(88, 34)">
            <path d="M18 64 Q-8 70 4 88" stroke="#451A03" strokeWidth="8" strokeLinecap="round" fill="none" />
            <line x1="30" y1="80" x2="12" y2="112" stroke="#92400E" strokeWidth="7" strokeLinecap="round" />
            <line x1="94" y1="78" x2="122" y2="104" stroke="#92400E" strokeWidth="7" strokeLinecap="round" />
            <ellipse cx="66" cy="68" rx="46" ry="22" fill="#B45309" />
            <path d="M94 58 L122 24 L142 34 L132 48 L106 72 Z" fill="#B45309" />
            <rect x="48" y="46" width="32" height="18" rx="5" fill={gold} />
            <circle cx="72" cy="24" r="10" fill={gold} />
          </g>
        </g>
      );

    case 'A07': // Tên lửa chọn bạn 3D
      return (
        <g filter={sh}>
          <circle cx="255" cy="52" r="20" fill={gold} />
          <ellipse cx="255" cy="52" rx="34" ry="7" transform="rotate(-20 255 52)" stroke="#FEF08A" strokeWidth="3" fill="none" />
          <g transform="translate(156, 92) rotate(32)">
            <path d="M-16 44 L0 86 L16 44 Z" fill="#F97316" />
            <path d="M-9 44 L0 68 L9 44 Z" fill="#FEF08A" />
            <path d="M-20 20 L-38 46 L-16 42 Z" fill="#EF4444" />
            <path d="M20 20 L38 46 L16 42 Z" fill="#EF4444" />
            <path d="M0 -58 C26 -26 24 22 18 44 H-18 C-24 22 -26 -26 0 -58 Z" fill={chrome} />
            <path d="M0 -58 C13 -40 17 -24 18 -14 H-18 C-17 -24 -13 -40 0 -58 Z" fill="#EF4444" />
            <circle cx="0" cy="4" r="12" fill="#38BDF8" stroke={gold} strokeWidth="3" />
          </g>
        </g>
      );

    case 'A08': // Bóng bay may mắn 3D
      return (
        <g filter={sh}>
          <path d="M110 118 Q130 150 155 172" stroke="#E2E8F0" strokeWidth="2.5" fill="none" />
          <path d="M160 104 Q160 140 160 172" stroke="#E2E8F0" strokeWidth="2.5" fill="none" />
          <path d="M210 118 Q190 150 165 172" stroke="#E2E8F0" strokeWidth="2.5" fill="none" />
          <ellipse cx="108" cy="78" rx="30" ry="36" fill="#EF4444" />
          <ellipse cx="98" cy="64" rx="7" ry="11" fill="#FFF" fillOpacity="0.45" />
          <ellipse cx="212" cy="78" rx="30" ry="36" fill="#10B981" />
          <ellipse cx="202" cy="64" rx="7" ry="11" fill="#FFF" fillOpacity="0.45" />
          <ellipse cx="160" cy="60" rx="34" ry="42" fill={gold} />
          <ellipse cx="148" cy="44" rx="8" ry="13" fill="#FFF" fillOpacity="0.6" />
        </g>
      );

    case 'A09': // Xúc xắc 3D
      return (
        <g filter={sh}>
          <g transform="translate(78, 38) rotate(-14)">
            <rect width="74" height="74" rx="16" fill={chrome} stroke="#FFF" strokeWidth="2.5" />
            <circle cx="22" cy="22" r="6.5" fill="#EF4444" />
            <circle cx="52" cy="22" r="6.5" fill="#EF4444" />
            <circle cx="37" cy="37" r="7.5" fill="#EF4444" />
            <circle cx="22" cy="52" r="6.5" fill="#EF4444" />
            <circle cx="52" cy="52" r="6.5" fill="#EF4444" />
          </g>
          <g transform="translate(164, 54) rotate(16)">
            <rect width="74" height="74" rx="16" fill={gold} stroke="#FEF9C3" strokeWidth="2.5" />
            <circle cx="22" cy="22" r="6.5" fill="#0F172A" />
            <circle cx="52" cy="22" r="6.5" fill="#0F172A" />
            <circle cx="22" cy="37" r="6.5" fill="#0F172A" />
            <circle cx="52" cy="37" r="6.5" fill="#0F172A" />
            <circle cx="22" cy="52" r="6.5" fill="#0F172A" />
            <circle cx="52" cy="52" r="6.5" fill="#0F172A" />
          </g>
        </g>
      );

    case 'A10': // Thẻ bài bí mật 3D
      return (
        <g filter={sh}>
          <g transform="translate(74, 38) rotate(-18)">
            <rect width="68" height="102" rx="10" fill="#1D4ED8" stroke={gold} strokeWidth="3" />
            <circle cx="34" cy="51" r="16" fill="#60A5FA" fillOpacity="0.4" />
          </g>
          <g transform="translate(178, 38) rotate(18)">
            <rect width="68" height="102" rx="10" fill="#DB2777" stroke={gold} strokeWidth="3" />
            <circle cx="34" cy="51" r="16" fill="#F472B6" fillOpacity="0.4" />
          </g>
          <g transform="translate(122, 24)">
            <rect width="76" height="114" rx="12" fill={gold} stroke="#FFF" strokeWidth="3" />
            <rect x="7" y="7" width="62" height="100" rx="8" fill="#4C1D95" />
            <path d="M38 32 L44 46 L59 48 L47 58 L50 73 L38 64 L26 73 L29 58 L17 48 L32 46 Z" fill={gold} />
          </g>
        </g>
      );

    case 'A11': // Bánh xe số 3D
      return (
        <g filter={sh} transform="translate(160, 92)">
          <circle r="64" fill={chrome} stroke={gold} strokeWidth="6" />
          <circle r="48" fill="#0F172A" stroke="#38BDF8" strokeWidth="3" />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
            <line
              key={deg}
              x1="0"
              y1="-48"
              x2="0"
              y2="-34"
              stroke={gold}
              strokeWidth="4"
              transform={`rotate(${deg})`}
            />
          ))}
          <circle r="20" fill={gold} />
          <path d="M-9 -70 H9 L0 -52 Z" fill="#EF4444" stroke="#FFF" strokeWidth="2" />
        </g>
      );

    case 'A12': // Robot chọn bạn 3D
      return (
        <g filter={sh} transform="translate(112, 20)">
          <line x1="48" y1="0" x2="48" y2="18" stroke="#38BDF8" strokeWidth="5" />
          <circle cx="48" cy="0" r="7" fill={gold} />
          <rect x="12" y="18" width="72" height="54" rx="18" fill={chrome} stroke="#38BDF8" strokeWidth="3" />
          <rect x="22" y="28" width="52" height="34" rx="10" fill="#0F172A" />
          <circle cx="36" cy="43" r="6" fill="#20C9FF" />
          <circle cx="60" cy="43" r="6" fill="#20C9FF" />
          <path d="M38 53 Q48 59 58 53" stroke="#00BF83" strokeWidth="3" fill="none" strokeLinecap="round" />
          <rect x="18" y="78" width="60" height="56" rx="16" fill={chrome} stroke="#38BDF8" strokeWidth="3" />
          <circle cx="48" cy="106" r="14" fill={gold} />
        </g>
      );

    case 'B01': // Ai nhanh hơn (Buzzer Podium 3D)
      return (
        <g filter={sh} transform="translate(160, 118)">
          <path d="M-64 46 L-46 4 L46 4 L64 46 Z" fill="#1E293B" stroke="#38BDF8" strokeWidth="3" />
          <ellipse cx="0" cy="4" rx="52" ry="14" fill={chrome} />
          <path d="M-38 2 C-38 -32 38 -32 38 2 Z" fill="#EF4444" stroke={gold} strokeWidth="3" />
          <ellipse cx="-12" cy="-12" rx="12" ry="5" fill="#FFF" fillOpacity="0.5" />
          <path d="M6 -76 L-16 -38 L0 -38 L-8 -10 L20 -48 L4 -48 Z" fill={gold} />
        </g>
      );

    case 'B02': // Đoán hình bí mật 3D
      return (
        <g filter={sh}>
          <rect x="64" y="22" width="184" height="132" rx="14" fill="#1E293B" stroke={gold} strokeWidth="4" />
          <rect x="74" y="32" width="78" height="52" rx="8" fill="#0866F5" stroke="#93C5FD" strokeWidth="2" />
          <rect x="160" y="32" width="78" height="52" rx="8" fill="#10B981" stroke="#6EE7B7" strokeWidth="2" />
          <rect x="74" y="92" width="78" height="52" rx="8" fill="#8B5CF6" stroke="#C4B5FD" strokeWidth="2" />
          <rect x="160" y="92" width="78" height="52" rx="8" fill={gold} />
          <g transform="translate(226, 112) rotate(35)">
            <circle cx="0" cy="0" r="24" fill="#38BDF8" fillOpacity="0.35" stroke={gold} strokeWidth="5" />
            <rect x="-4" y="24" width="8" height="28" rx="4" fill={gold} />
          </g>
        </g>
      );

    case 'B03': // Lật ô chữ 3D
      return (
        <g filter={sh} transform="translate(64, 30)">
          {[0, 1, 2, 3].map((row) =>
            [0, 1, 2, 3, 4].map((col) => {
              const isKeyCol = col === 2;
              return (
                <rect
                  key={`${row}_${col}`}
                  x={col * 38}
                  y={row * 32}
                  width="32"
                  height="26"
                  rx="6"
                  fill={isKeyCol ? gold : row === 1 ? '#00BF83' : '#0866F5'}
                  stroke="#FFFFFF"
                  strokeWidth="1.5"
                />
              );
            })
          )}
        </g>
      );

    case 'B04': // Giải mã bí mật (Rương kho báu 3D)
      return (
        <g filter={sh} transform="translate(88, 38)">
          <path d="M8 38 C8 10 136 10 136 38 Z" fill="#92400E" stroke={gold} strokeWidth="4" />
          <rect x="8" y="38" width="128" height="70" rx="10" fill="#78350F" stroke={gold} strokeWidth="4" />
          <rect x="34" y="18" width="14" height="90" fill={gold} />
          <rect x="96" y="18" width="14" height="90" fill={gold} />
          <circle cx="72" cy="56" r="18" fill={gold} stroke="#FFF" strokeWidth="2" />
          <path d="M72 50 L67 62 H77 Z" fill="#451A03" />
        </g>
      );

    case 'B05': // Đúng hay sai 3D
      return (
        <g filter={sh}>
          <g transform="translate(52, 46)">
            <circle cx="48" cy="48" r="46" fill="#00BF83" stroke="#A7F3D0" strokeWidth="4" />
            <path d="M30 48 L43 61 L68 34" fill="none" stroke="#FFF" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
          </g>
          <g transform="translate(172, 46)">
            <circle cx="48" cy="48" r="46" fill="#EF4444" stroke="#FECDD3" strokeWidth="4" />
            <path d="M33 33 L63 63 M63 33 L33 63" fill="none" stroke="#FFF" strokeWidth="8" strokeLinecap="round" />
          </g>
        </g>
      );

    case 'B06': // Đuổi hình bắt chữ 3D
      return (
        <g filter={sh}>
          <rect x="44" y="36" width="84" height="84" rx="18" fill="#0866F5" stroke="#93C5FD" strokeWidth="3" />
          <circle cx="86" cy="78" r="24" fill={gold} />
          <circle cx="160" cy="78" r="16" fill={gold} />
          <path d="M153 78 H167 M160 71 V85" stroke="#0F172A" strokeWidth="4" strokeLinecap="round" />
          <rect x="192" y="36" width="84" height="84" rx="18" fill="#8B5CF6" stroke="#DDD6FE" strokeWidth="3" />
          <path d="M234 54 L254 96 H214 Z" fill={gold} />
        </g>
      );

    case 'B07': // Ô cửa bí mật 3D
      return (
        <g filter={sh} transform="translate(46, 32)">
          <path d="M0 116 V40 C0 16 32 0 32 0 C32 0 64 16 64 40 V116 Z" fill="#EF4444" stroke={gold} strokeWidth="3" />
          <circle cx="50" cy="68" r="5" fill={gold} />
          <path d="M82 116 V34 C82 10 114 -6 114 -6 C114 -6 146 10 146 34 V116 Z" fill={gold} stroke="#FFF" strokeWidth="3" />
          <circle cx="132" cy="64" r="5" fill="#78350F" />
          <path d="M164 116 V40 C164 16 196 0 196 0 C196 0 228 16 228 40 V116 Z" fill="#0866F5" stroke={gold} strokeWidth="3" />
          <circle cx="214" cy="68" r="5" fill={gold} />
        </g>
      );

    case 'B08': // Ghép cặp kiến thức 3D
      return (
        <g filter={sh} transform="translate(68, 46)">
          <path d="M0 16 H72 V34 C86 34 86 58 72 58 V76 H0 Z" fill="#0866F5" stroke="#93C5FD" strokeWidth="3" />
          <path d="M104 16 H176 V76 H104 V58 C90 58 90 34 104 34 Z" fill={gold} stroke="#FFF" strokeWidth="3" />
          <circle cx="88" cy="46" r="10" fill="#FFF" fillOpacity="0.6" />
        </g>
      );

    case 'B09': // Tìm từ khóa (Kính lúp 3D)
      return (
        <g filter={sh}>
          <g transform="translate(68, 38)">
            {[0, 1, 2].map((r) =>
              [0, 1, 2, 3].map((c) => (
                <rect
                  key={`${r}_${c}`}
                  x={c * 42}
                  y={r * 34}
                  width="34"
                  height="28"
                  rx="6"
                  fill={r === 1 ? gold : chrome}
                />
              ))
            )}
          </g>
          <g transform="translate(175, 86) rotate(32)">
            <circle r="34" fill="#38BDF8" fillOpacity="0.3" stroke={gold} strokeWidth="7" />
            <rect x="-5" y="34" width="10" height="38" rx="5" fill={gold} />
          </g>
        </g>
      );

    case 'B10': // Câu hỏi chớp nhoáng (Đồng hồ bấm giờ + Tia sét 3D)
      return (
        <g filter={sh} transform="translate(160, 96)">
          <rect x="-12" y="-68" width="24" height="12" rx="4" fill={gold} />
          <circle r="52" fill={gold} stroke="#FFF" strokeWidth="3" />
          <circle r="40" fill="#0F172A" />
          <path d="M6 -28 L-12 2 L2 2 L-6 28 L16 -4 L2 -4 Z" fill={gold} />
        </g>
      );

    case 'C01': // Ai là triệu phú (Tháp kim cương & Spotlight 3D)
      return (
        <g filter={sh} transform="translate(160, 92)">
          <polygon points="0,-60 68,54 -68,54" fill="none" stroke={gold} strokeWidth="4" />
          <polygon points="0,-42 48,44 -48,44" fill="#0866F5" fillOpacity="0.5" stroke="#38BDF8" strokeWidth="2.5" />
          <polygon points="0,-24 26,26 -26,26" fill={gold} />
          <circle cy="-60" r="8" fill="#FFF" />
        </g>
      );

    case 'C02': // Rung chuông vàng 3D
      return (
        <g filter={sh} transform="translate(160, 86)">
          <path d="M-56 20 C-72 -10 -52 -46 -28 -54" stroke={gold} strokeWidth="6" strokeLinecap="round" fill="none" />
          <path d="M56 20 C72 -10 52 -46 28 -54" stroke={gold} strokeWidth="6" strokeLinecap="round" fill="none" />
          <path d="M-38 34 L-26 -22 C-24 -44 24 -44 26 -22 L38 34 Z" fill={gold} stroke="#FFF" strokeWidth="2.5" />
          <rect x="-44" y="30" width="88" height="12" rx="6" fill={gold} />
          <circle cy="46" r="10" fill="#D97706" />
        </g>
      );

    case 'C03': // Đấu trường kiến thức (Khiên hiệp sĩ 3D)
      return (
        <g filter={sh} transform="translate(160, 90)">
          <path d="M-48 -48 H48 V4 C48 40 0 64 0 64 C0 64 -48 40 -48 4 Z" fill={gold} stroke="#FFF" strokeWidth="3" />
          <path d="M-36 -36 H36 V2 C36 28 0 48 0 48 C0 48 -36 28 -36 2 Z" fill="#0866F5" />
          <path d="M0 -24 L7 -6 L26 -4 L12 8 L16 26 L0 16 L-16 26 L-12 8 L-26 -4 L-7 -6 Z" fill={gold} />
        </g>
      );

    case 'C04': // Vượt chướng ngại vật 3D
      return (
        <g filter={sh}>
          <path d="M40 156 L110 70 H210 L280 156 Z" fill="#1E293B" stroke="#38BDF8" strokeWidth="2.5" />
          <rect x="86" y="102" width="148" height="12" rx="4" fill="#EF4444" stroke="#FFF" strokeWidth="2" />
          <rect x="104" y="76" width="112" height="10" rx="4" fill={gold} />
          <polygon points="160,22 180,52 160,68 140,52" fill={gold} stroke="#FFF" strokeWidth="2" />
        </g>
      );

    case 'C05': // Ô chữ kiến thức 3D Cube
      return (
        <g filter={sh} transform="translate(160, 92)">
          <polygon points="0,-58 56,-28 0,2 -56,-28" fill={gold} />
          <polygon points="-56,-28 0,2 0,62 -56,32" fill="#0866F5" stroke="#93C5FD" strokeWidth="2" />
          <polygon points="56,-28 0,2 0,62 56,32" fill="#1D4ED8" stroke="#60A5FA" strokeWidth="2" />
        </g>
      );

    case 'C06': // Truy tìm kho báu (La bàn vàng & Đảo 3D)
      return (
        <g filter={sh} transform="translate(160, 92)">
          <circle r="56" fill={gold} stroke="#FFF" strokeWidth="3" />
          <circle r="44" fill="#0F172A" />
          <polygon points="0,-38 10,0 0,38 -10,0" fill="#EF4444" />
          <polygon points="-38,0 0,-10 38,0 0,10" fill={chrome} />
          <circle r="8" fill={gold} />
        </g>
      );

    case 'C07': // Giải cứu công chúa (Lâu đài 3D)
      return (
        <g filter={sh} transform="translate(92, 28)">
          <rect x="8" y="48" width="32" height="80" fill={chrome} />
          <polygon points="4,48 24,16 44,48" fill="#EC4899" />
          <rect x="96" y="48" width="32" height="80" fill={chrome} />
          <polygon points="92,48 112,16 132,48" fill="#EC4899" />
          <rect x="36" y="64" width="64" height="64" fill="#E2E8F0" />
          <polygon points="44,64 68,24 92,64" fill={gold} />
          <path d="M54 128 V96 C54 84 82 84 82 96 V128 Z" fill="#78350F" stroke={gold} strokeWidth="2" />
        </g>
      );

    case 'C08': // Đường lên đỉnh núi 3D
      return (
        <g filter={sh}>
          <polygon points="44,158 148,42 248,158" fill="#0284C7" />
          <polygon points="148,42 182,82 158,76 148,90 134,74 116,80" fill="#FFFFFF" />
          <polygon points="120,158 204,66 284,158" fill="#0369A1" />
          <line x1="148" y1="14" x2="148" y2="44" stroke={gold} strokeWidth="4" />
          <polygon points="148,14 180,24 148,34" fill="#EF4444" stroke={gold} strokeWidth="2" />
        </g>
      );

    case 'C09': // Bingo kiến thức 3D
      return (
        <g filter={sh} transform="translate(88, 28)">
          <rect width="144" height="124" rx="16" fill="#1E293B" stroke={gold} strokeWidth="4" />
          {[0, 1, 2].map((r) =>
            [0, 1, 2].map((c) => {
              const diag = r === c;
              return (
                <circle
                  key={`${r}_${c}`}
                  cx={34 + c * 38}
                  cy={28 + r * 34}
                  r="13"
                  fill={diag ? gold : '#0866F5'}
                />
              );
            })
          )}
        </g>
      );

    case 'C10': // Giải cứu đại dương (Tàu ngầm vàng 3D)
      return (
        <g filter={sh} transform="translate(160, 96)">
          <path d="M-12 -46 V-24 H16" stroke={gold} strokeWidth="6" strokeLinecap="round" fill="none" />
          <ellipse cx="0" cy="4" rx="58" ry="32" fill={gold} stroke="#FFF" strokeWidth="2.5" />
          <circle cx="-18" cy="4" r="12" fill="#38BDF8" stroke="#0F172A" strokeWidth="3" />
          <circle cx="16" cy="4" r="12" fill="#38BDF8" stroke="#0F172A" strokeWidth="3" />
          <polygon points="-58,4 -76,-14 -76,22" fill="#F59E0B" />
        </g>
      );

    case 'D01': // Đấu trường 1 đấu 1
      return (
        <g filter={sh}>
          <polygon points="48,44 138,44 118,142 48,142" fill="#0866F5" stroke="#93C5FD" strokeWidth="3" />
          <polygon points="202,44 272,44 272,142 182,142" fill="#EF4444" stroke="#FCA5A5" strokeWidth="3" />
          <path d="M168 24 L138 92 H164 L148 158 L188 84 H160 Z" fill={gold} stroke="#FFF" strokeWidth="2" />
        </g>
      );

    case 'D02': // Đua thuyền 3D
      return (
        <g filter={sh}>
          <ellipse cx="160" cy="144" rx="118" ry="20" fill="#0284C7" />
          <g transform="translate(96, 30)">
            <polygon points="60,8 60,88 6,88" fill={gold} />
            <polygon points="68,20 116,88 68,88" fill="#EF4444" />
            <path d="M0 94 H128 L108 118 H20 Z" fill="#B45309" stroke={gold} strokeWidth="2.5" />
          </g>
        </g>
      );

    case 'D03': // Kéo co kiến thức 3D
      return (
        <g filter={sh}>
          <rect x="24" y="82" width="272" height="16" rx="8" fill="#D97706" stroke="#FDE047" strokeWidth="2.5" />
          <polygon points="160,44 178,136 142,136" fill="#EF4444" stroke="#FFF" strokeWidth="2.5" />
          <circle cx="160" cy="90" r="14" fill={gold} />
        </g>
      );

    case 'D04': // Đua xe tốc độ 3D
      return (
        <g filter={sh} transform="translate(68, 56)">
          <path d="M16 56 L48 24 H122 L168 44 L180 64 H8 Z" fill="#EF4444" stroke={gold} strokeWidth="2.5" />
          <path d="M56 28 H114 L136 44 H44 Z" fill="#38BDF8" />
          <circle cx="44" cy="66" r="20" fill="#0F172A" stroke={gold} strokeWidth="5" />
          <circle cx="142" cy="66" r="20" fill="#0F172A" stroke={gold} strokeWidth="5" />
        </g>
      );

    case 'D05': // Tiếp sức đồng đội (Gậy tiếp sức vàng 3D)
      return (
        <g filter={sh} transform="translate(160, 90) rotate(-28)">
          <rect x="-74" y="-16" width="148" height="32" rx="16" fill={gold} stroke="#FFF" strokeWidth="3" />
          <rect x="-24" y="-16" width="48" height="32" fill="#0866F5" />
          <circle cx="-74" cy="0" r="24" fill="#38BDF8" fillOpacity="0.3" />
          <circle cx="74" cy="0" r="24" fill="#FACC15" fillOpacity="0.3" />
        </g>
      );

    case 'D06': // Vua ghi điểm (Vương miện vàng 3D)
      return (
        <g filter={sh} transform="translate(86, 38)">
          <path d="M12 88 L0 24 L42 52 L74 12 L106 52 L148 24 L136 88 Z" fill={gold} stroke="#FFF" strokeWidth="3" />
          <rect x="8" y="88" width="132" height="18" rx="6" fill="#B45309" stroke={gold} strokeWidth="2.5" />
          <circle cx="74" cy="60" r="9" fill="#EF4444" />
          <circle cx="38" cy="66" r="7" fill="#0866F5" />
          <circle cx="110" cy="66" r="7" fill="#10B981" />
        </g>
      );

    case 'D07': // Thách đấu nhóm 3D
      return (
        <g filter={sh} transform="translate(160, 90)">
          <line x1="-56" y1="54" x2="48" y2="-54" stroke={gold} strokeWidth="6" strokeLinecap="round" />
          <line x1="56" y1="54" x2="-48" y2="-54" stroke={gold} strokeWidth="6" strokeLinecap="round" />
          <circle r="38" fill={gold} stroke="#FFF" strokeWidth="3" />
          <circle r="28" fill="#0866F5" />
          <polygon points="0,-18 5,-4 20,-4 8,5 12,19 0,10 -12,19 -8,5 -20,-4 -5,-4" fill={gold} />
        </g>
      );

    case 'D08': // Đấu trường 4 đội 3D
      return (
        <g filter={sh} transform="translate(160, 90)">
          <rect x="-64" y="-56" width="52" height="46" rx="12" fill="#EF4444" stroke="#FFF" strokeWidth="2.5" />
          <rect x="12" y="-56" width="52" height="46" rx="12" fill="#0866F5" stroke="#FFF" strokeWidth="2.5" />
          <rect x="-64" y="10" width="52" height="46" rx="12" fill={gold} stroke="#FFF" strokeWidth="2.5" />
          <rect x="12" y="10" width="52" height="46" rx="12" fill="#00BF83" stroke="#FFF" strokeWidth="2.5" />
          <circle r="22" fill={gold} stroke="#0F172A" strokeWidth="4" />
        </g>
      );

    case 'E01': // Nhảy theo lệnh 3D
      return (
        <g filter={sh} transform="translate(160, 92)">
          <rect x="-24" y="-64" width="48" height="40" rx="10" fill="#20C9FF" stroke="#FFF" strokeWidth="2.5" />
          <rect x="-24" y="24" width="48" height="40" rx="10" fill="#EC4899" stroke="#FFF" strokeWidth="2.5" />
          <rect x="-78" y="-20" width="48" height="40" rx="10" fill={gold} stroke="#FFF" strokeWidth="2.5" />
          <rect x="30" y="-20" width="48" height="40" rx="10" fill="#00BF83" stroke="#FFF" strokeWidth="2.5" />
        </g>
      );

    case 'E02': // Bắt bóng kiến thức 3D
      return (
        <g filter={sh}>
          <circle cx="104" cy="54" r="22" fill="#EF4444" />
          <circle cx="164" cy="42" r="24" fill={gold} />
          <circle cx="220" cy="62" r="20" fill="#20C9FF" />
          <ellipse cx="160" cy="134" rx="68" ry="18" fill="none" stroke={gold} strokeWidth="6" />
          <path d="M96 134 L118 168 H202 L224 134" stroke="#E2E8F0" strokeWidth="3" fill="none" />
        </g>
      );

    case 'E03': // Phản xạ nhanh 3D
      return (
        <g filter={sh} transform="translate(160, 90)">
          <rect x="-34" y="-64" width="68" height="128" rx="34" fill="#0F172A" stroke={chrome} strokeWidth="4" />
          <circle cy="-36" r="15" fill="#EF4444" fillOpacity="0.45" />
          <circle cy="0" r="15" fill="#FACC15" fillOpacity="0.45" />
          <circle cy="36" r="18" fill="#00BF83" stroke="#A7F3D0" strokeWidth="3" />
        </g>
      );

    case 'E04': // Simon Says 3D
      return (
        <g filter={sh} transform="translate(160, 90)">
          <circle r="64" fill="#0F172A" stroke={chrome} strokeWidth="4" />
          <path d="M-4 -4 L-4 -54 A50 50 0 0 0 -54 -4 Z" fill="#00BF83" />
          <path d="M4 -4 L54 -4 A50 50 0 0 0 4 -54 Z" fill="#EF4444" />
          <path d="M-4 4 L-54 4 A50 50 0 0 0 -4 54 Z" fill={gold} />
          <path d="M4 4 L4 54 A50 50 0 0 0 54 4 Z" fill="#0866F5" />
          <circle r="18" fill={chrome} />
        </g>
      );

    case 'E05': // Săn sao kiến thức 3D
      return (
        <g filter={sh}>
          <path d="M84 52 L92 70 L112 72 L97 85 L101 104 L84 94 L67 104 L71 85 L56 72 L76 70 Z" fill={gold} />
          <path d="M174 30 L185 54 L212 57 L192 75 L197 102 L174 88 L151 102 L156 75 L136 57 L163 54 Z" fill={gold} />
          <path d="M244 82 L250 96 L265 98 L254 108 L257 123 L244 115 L231 123 L234 108 L223 98 L238 96 Z" fill={gold} />
        </g>
      );

    case 'F01': // Sudoku 3D
      return (
        <g filter={sh} transform="translate(96, 26)">
          <rect width="128" height="128" rx="16" fill={gold} />
          {[0, 1, 2].map((r) =>
            [0, 1, 2].map((c) => (
              <rect
                key={`${r}_${c}`}
                x={10 + c * 38}
                y={10 + r * 38}
                width="32"
                height="32"
                rx="6"
                fill={(r + c) % 2 === 0 ? '#0866F5' : '#0F172A'}
              />
            ))
          )}
        </g>
      );

    case 'F02': // Tangram 3D
      return (
        <g filter={sh} transform="translate(96, 26)">
          <polygon points="0,0 128,0 64,64" fill="#EF4444" stroke="#FFF" strokeWidth="2" />
          <polygon points="0,0 64,64 0,128" fill="#0866F5" stroke="#FFF" strokeWidth="2" />
          <polygon points="128,0 128,64 96,32" fill={gold} stroke="#FFF" strokeWidth="2" />
          <polygon points="64,64 96,32 128,64 96,96" fill="#00BF83" stroke="#FFF" strokeWidth="2" />
          <polygon points="0,128 64,64 128,128" fill="#8B5CF6" stroke="#FFF" strokeWidth="2" />
        </g>
      );

    case 'F03': // Tháp Hà Nội 3D
      return (
        <g filter={sh} transform="translate(56, 36)">
          <rect x="0" y="104" width="208" height="14" rx="7" fill="#92400E" stroke={gold} strokeWidth="2" />
          <rect x="44" y="16" width="8" height="88" rx="4" fill={gold} />
          <rect x="156" y="16" width="8" height="88" rx="4" fill={gold} />
          <rect x="8" y="84" width="80" height="18" rx="9" fill="#EF4444" />
          <rect x="18" y="64" width="60" height="18" rx="9" fill="#00BF83" />
          <rect x="28" y="44" width="40" height="18" rx="9" fill={gold} />
          <rect x="126" y="84" width="68" height="18" rx="9" fill="#0866F5" />
        </g>
      );

    case 'F04': // Mê cung trí tuệ 3D
      return (
        <g filter={sh} transform="translate(160, 90)">
          <circle r="60" fill="none" stroke="#38BDF8" strokeWidth="8" strokeDasharray="280 40" />
          <circle r="40" fill="none" stroke={gold} strokeWidth="8" strokeDasharray="180 40" />
          <circle r="20" fill="none" stroke="#00BF83" strokeWidth="8" strokeDasharray="85 25" />
          <circle r="8" fill={gold} />
        </g>
      );

    case 'F05': // Giải mật mã (Cryptex 3D)
    default:
      return (
        <g filter={sh} transform="translate(76, 48)">
          <rect x="0" y="12" width="22" height="64" rx="6" fill={gold} />
          <rect x="146" y="12" width="22" height="64" rx="6" fill={gold} />
          {[0, 1, 2, 3].map((i) => (
            <rect
              key={i}
              x={26 + i * 30}
              y="4"
              width="24"
              height="80"
              rx="6"
              fill={i === 1 ? '#20C9FF' : chrome}
              stroke={gold}
              strokeWidth="2.5"
            />
          ))}
        </g>
      );
  }
};

export const GameCardIllustration: React.FC<{ code: string; category: string }> = ({ code, category }) => {
  const [imgFailed, setImgFailed] = useState(false);
  const [usedFallbackBundle, setUsedFallbackBundle] = useState(false);

  const manifest = GAME_THUMBNAIL_MANIFEST[code];

  // Studio color themes by category for 3D SVG scenes
  const themeByCat: Record<string, { c1: string; c2: string; glow: string }> = {
    random: { c1: '#102C52', c2: '#174CA8', glow: '#20C9FF' },
    warmup: { c1: '#0F172A', c2: '#1E3A8A', glow: '#FFBF25' },
    reinforce: { c1: '#102C52', c2: '#0F766E', glow: '#00BF83' },
    competition: { c1: '#1E1B4B', c2: '#7C2D12', glow: '#FFBF25' },
    movement: { c1: '#0F172A', c2: '#6B21A8', glow: '#20C9FF' },
    puzzle: { c1: '#102C52', c2: '#312E81', glow: '#FFBF25' },
  };
  const pal = themeByCat[category] || themeByCat.random;

  if (manifest?.hasPhotorealisticAsset && !imgFailed) {
    const srcToUse = usedFallbackBundle && manifest.bundledFallbackAsset
      ? manifest.bundledFallbackAsset
      : manifest.thumbnailAsset;

    return (
      <div className="relative w-full h-full overflow-hidden bg-[#102C52]">
        <img
          src={srcToUse}
          alt={manifest.gameName}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => {
            if (!usedFallbackBundle && manifest.bundledFallbackAsset) {
              setUsedFallbackBundle(true);
            } else {
              setImgFailed(true);
            }
          }}
          className="w-full h-full object-cover object-center select-none"
        />
      </div>
    );
  }

  return (
    <svg viewBox="0 0 320 180" className="w-full h-full object-cover select-none" xmlns="http://www.w3.org/2000/svg">
      <StudioBackdropDefs code={code} c1={pal.c1} c2={pal.c2} glow={pal.glow} />
      <rect width="320" height="180" fill={`url(#bg_${code})`} />
      {/* Studio Spotlight & 3D Floor Reflection */}
      <circle cx="160" cy="88" r="95" fill={`url(#glow_${code})`} />
      <ellipse cx="160" cy="158" rx="92" ry="12" fill="#020617" fillOpacity="0.38" />
      <ellipse cx="160" cy="156" rx="76" ry="7" fill={pal.glow} fillOpacity="0.22" />
      {/* Ambient Bokeh Particles */}
      <circle cx="48" cy="40" r="3" fill="#FFBF25" fillOpacity="0.65" />
      <circle cx="272" cy="46" r="3.5" fill="#20C9FF" fillOpacity="0.65" />
      <circle cx="62" cy="134" r="2.5" fill="#FFFFFF" fillOpacity="0.45" />
      <circle cx="262" cy="128" r="3" fill="#FFBF25" fillOpacity="0.55" />
      {/* Unique 3D Subject for this Game */}
      {renderUnique3DSubject(code)}
    </svg>
  );
};
