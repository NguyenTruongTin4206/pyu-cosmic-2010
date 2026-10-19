export type BodyKind = 'planet' | 'star';

export interface Wish {
  id: string;
  name: string;
  kind: BodyKind;       // 'planet' = hành tinh, 'star' = ngôi sao
  color: string;        // màu chủ đạo / ánh sáng
  accent: string;       // màu phụ (chỉ dùng cho bề mặt hành tinh)
  wish: string;         // lời chúc
  message: string;      // thông điệp ý nghĩa
  memberName?: string;  // điền tên thành viên nếu muốn cá nhân hóa
  icon?: string;
}

/*
 * Mẹo: giữ ít nhất 6 hành tinh và 6 ngôi sao. Nếu thêm nhiều hơn số vị trí có sẵn
 * trong createPlanets.ts (PLANET_CFG / STAR_POS), vị trí sẽ được dùng lại theo vòng.
 */
export const wishes: Wish[] = [
  { id: 'nu-cuoi', name: 'Hành tinh Nụ Cười', kind: 'planet', color: '#FF77C8', accent: '#FFB3E0', icon: '😊',
    wish: 'Chúc bạn luôn giữ được nụ cười rạng rỡ, bởi chính năng lượng tích cực của bạn làm cho mỗi buổi tập và mỗi trận đấu trở nên đáng nhớ hơn.',
    message: 'Một nụ cười sau pha bóng hỏng có thể kéo cả đội đứng dậy. Cảm ơn bạn vì điều đó.' },
  { id: 'ban-linh', name: 'Hành tinh Bản Lĩnh', kind: 'planet', color: '#7655F6', accent: '#B39DFF', icon: '💪',
    wish: 'Chúc cô gái PYU luôn mạnh mẽ trước thử thách, tự tin trong từng bước chạy đà và kiên định với những ước mơ của mình.',
    message: 'Bản lĩnh không phải là không biết sợ, mà là vẫn bật nhảy khi trái bóng đang bay tới.' },
  { id: 'dong-doi', name: 'Hành tinh Đồng Đội', kind: 'planet', color: '#71E8FF', accent: '#3A7BD5', icon: '🤝',
    wish: 'Cảm ơn bạn vì đã góp phần tạo nên một tập thể biết sẻ chia, tin tưởng và cùng nhau vượt qua những khoảnh khắc khó khăn.',
    message: 'Mỗi đường chuyền đẹp đều bắt đầu từ sự tin tưởng giữa hai người đứng cách nhau vài mét.' },
  { id: 'uoc-mo', name: 'Hành tinh Ước Mơ', kind: 'planet', color: '#9D7BFF', accent: '#FF77C8', icon: '🌠',
    wish: 'Chúc mọi dự định của bạn từng bước trở thành hiện thực. Hãy cứ dám ước mơ và dũng cảm tiến về phía trước.',
    message: 'Ước mơ lớn bắt đầu từ những buổi tập nhỏ, đều đặn và không bỏ cuộc.' },
  { id: 'thanh-xuan', name: 'Hành tinh Thanh Xuân', kind: 'planet', color: '#FFE6A0', accent: '#FF9F7A', icon: '🌼',
    wish: 'Chúc thanh xuân của bạn có thật nhiều tiếng cười, những chuyến đi đáng nhớ và những khoảnh khắc tuyệt đẹp bên gia đình PYU.',
    message: 'Rồi sẽ có ngày ta nhớ tiếng giày chạm sàn và tiếng cười sau buổi tập muộn.' },
  { id: 'thanh-cong', name: 'Hành tinh Thành Công', kind: 'planet', color: '#5EE6C6', accent: '#71E8FF', icon: '🏆',
    wish: 'Chúc bạn tự tin chinh phục những cột mốc mới trong học tập, cuộc sống và trên sân bóng chuyền.',
    message: 'Thành công có nhiều hình dạng: một điểm số đẹp, một trận thắng, hay đơn giản là một ngày bạn đã cố hết sức.' },
  { id: 'hai-muoi-muoi', name: 'Hành tinh 20/10', kind: 'planet', color: '#FF77C8', accent: '#FFE6A0', icon: '💐',
    wish: 'Chúc tất cả những cô gái của CLB Bóng chuyền PYU có một ngày 20/10 ngập tràn yêu thương. Cảm ơn các bạn đã là một phần tuyệt vời của đại gia đình này.',
    message: 'Hôm nay, bầu trời PYU dành riêng cho các bạn.' },

  { id: 'toa-sang', name: 'Ngôi Sao Tỏa Sáng', kind: 'star', color: '#FFE6A0', accent: '#FFE6A0', icon: '✨',
    wish: 'Mong bạn luôn được là chính mình, luôn tỏa sáng theo cách riêng và không ngừng khám phá những phiên bản tốt đẹp hơn của bản thân.',
    message: 'Mỗi vì sao có một độ sáng khác nhau, và bầu trời cần tất cả.' },
  { id: 'hanh-phuc', name: 'Ngôi Sao Hạnh Phúc', kind: 'star', color: '#FF77C8', accent: '#FF77C8', icon: '💖',
    wish: 'Chúc bạn có thật nhiều ngày bình yên, những niềm vui bất ngờ và những kỷ niệm đẹp bên những người mà bạn yêu quý.',
    message: 'Hạnh phúc thường nằm ở những điều rất nhỏ: một cái ôm, một bữa ăn sau trận, một tin nhắn hỏi thăm.' },
  { id: 'kien-cuong', name: 'Ngôi Sao Kiên Cường', kind: 'star', color: '#71E8FF', accent: '#71E8FF', icon: '🌟',
    wish: 'Dù có những ngày mệt mỏi, mong bạn vẫn đủ kiên nhẫn với chính mình và luôn nhớ rằng mỗi bước tiến nhỏ đều rất đáng trân trọng.',
    message: 'Nghỉ ngơi cũng là một phần của hành trình, không phải là bỏ cuộc.' },
  { id: 'binh-an', name: 'Ngôi Sao Bình An', kind: 'star', color: '#B8F0FF', accent: '#B8F0FF', icon: '🌙',
    wish: 'Mong bạn luôn khỏe mạnh, bình an và có đủ thời gian để chăm sóc bản thân giữa những lịch học, lịch tập và những mục tiêu riêng.',
    message: 'Hãy dành cho mình một giấc ngủ ngon, bạn xứng đáng với điều đó.' },
  { id: 'anh-sang', name: 'Ngôi Sao Ánh Sáng', kind: 'star', color: '#F7F5FF', accent: '#F7F5FF', icon: '🔆',
    wish: 'Bạn không cần phải giống bất kỳ ai để trở nên đặc biệt. Hãy tin vào giá trị riêng và những điều tốt đẹp bạn mang đến cho tập thể.',
    message: 'Tập thể mạnh không phải vì mọi người giống nhau, mà vì mỗi người giữ một vị trí không ai thay được.' },
  { id: 'diu-dang', name: 'Ngôi Sao Dịu Dàng', kind: 'star', color: '#FFB3E0', accent: '#FFB3E0', icon: '🌸',
    wish: 'Chúc bạn giữ được sự dịu dàng của mình, vì sự tử tế nhẹ nhàng của bạn khiến mọi người xung quanh cảm thấy được chào đón.',
    message: 'Mạnh mẽ và dịu dàng chưa bao giờ là hai điều đối lập.' },
];
