import type { Need } from "./domain.ts";

export const topics = [
  { id: "learning", label: "Đồ dùng học tập", examples: ["bút thước vở học sinh", "sách cặp sách balo", "bộ dụng cụ học tập", "tập vở cho trường", "viết chì và tập"] },
  { id: "cleaning", label: "Vật tư vệ sinh", examples: ["xà phòng khăn lau", "bột giặt nước rửa tay", "chổi cây lau nhà", "bộ vệ sinh lớp học", "nước tẩy rửa"] },
  { id: "food", label: "Thực phẩm", examples: ["gạo đóng túi", "mì gói dầu ăn", "gạo tẻ túi", "mua thực phẩm", "lương thực nấu cơm"] },
  { id: "blankets", label: "Chăn ấm", examples: ["chăn mền", "mền sạch", "chăn bông", "chăn ấm mùa đông", "mền đắp"] },
  { id: "money", label: "Ủng hộ tiền", examples: ["chuyển khoản", "ủng hộ tiền", "gửi kinh phí", "góp tiền", "gửi đồng vnd", "đóng góp tài chính"] },
] as const;

const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/\p{M}/gu,"").replace(/đ/g,"d");
const stop = new Set(["minh","toi","co","muon","gui","gop","cho","can","cai","bo","the","va","nhung","mang","ap"]);
function features(text: string) {
  const words = normalize(text).match(/[a-z]+/g)?.filter(w => !stop.has(w)) ?? [];
  return new Set([...words, ...words.slice(1).map((word,i) => `${words[i]} ${word}`)]);
}
const training = topics.map(topic => ({ ...topic, vectors: topic.examples.map(features) }));

export function classify(text: string) {
  const input = features(text);
  if (!input.size) return [];
  return training.map(topic => ({
    id: topic.id,
    label: topic.label,
    score: Math.max(...topic.vectors.map(vector => {
      const overlap = [...vector].filter(feature => input.has(feature)).length;
      return overlap / Math.sqrt(vector.size * input.size);
    })),
  })).filter(result => result.score >= 0.19).sort((a,b) => b.score - a.score).slice(0,2);
}

export function findMatches(query: string, rows: Need[]) {
  const matches = classify(query);
  return {
    topics: matches.map(({id,label}) => ({id,label})),
    goods: rows.flatMap(need => {
      const score = matches.find(m => m.id === need.topic)?.score;
      const available = need.target - need.received - need.pledged;
      return score && available > 0 ? [{...need, available, score}] : [];
    }).sort((a,b) => b.score - a.score || b.available - a.available).slice(0,5),
  };
}
