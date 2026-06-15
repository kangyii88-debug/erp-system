export const productCategoryOptions = [
  { zh: "时尚服饰/杂货", ko: "패션의류/잡화" },
  { zh: "美妆", ko: "뷰티" },
  { zh: "母婴/儿童", ko: "출산/유아동" },
  { zh: "食品", ko: "식품" },
  { zh: "厨房用品", ko: "주방용품" },
  { zh: "生活用品", ko: "생활용품" },
  { zh: "家居室内", ko: "홈인테리어" },
  { zh: "家电数码", ko: "가전디지털" },
  { zh: "运动/休闲", ko: "스포츠/레저" },
  { zh: "汽车用品", ko: "자동차용품" },
  { zh: "图书/音像/DVD", ko: "도서/음반/DVD" },
  { zh: "玩具/爱好", ko: "완구/취미" },
  { zh: "文具/办公", ko: "문구/오피스" },
  { zh: "宠物用品", ko: "반려동물용품" },
  { zh: "健康/保健食品", ko: "헬스/건강식품" }
] as const;

export type SupportedLanguage = "zh" | "ko";

export function categoryPair(value: string) {
  return productCategoryOptions.find((option) => option.zh === value || option.ko === value);
}

export function localizedCategoryValue(value: string, language: SupportedLanguage) {
  const pair = categoryPair(value);
  return pair ? pair[language] : value;
}

export function categoryMatches(value: string, filter: string) {
  if (value === filter) return true;
  const valuePair = categoryPair(value);
  const filterPair = categoryPair(filter);
  return !!valuePair && !!filterPair && valuePair.zh === filterPair.zh;
}

export function categorySelectOptions(values: string[], language: SupportedLanguage) {
  const fixed: string[] = productCategoryOptions.map((option) => option[language]);
  const extra = values
    .map((value) => localizedCategoryValue(value, language))
    .filter((value) => value && !fixed.includes(value));
  return Array.from(new Set([...fixed, ...extra]));
}
