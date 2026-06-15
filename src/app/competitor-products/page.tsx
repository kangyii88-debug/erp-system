"use client";

import { FormEvent, MouseEvent, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownUp,
  BadgeCheck,
  BarChart3,
  Copy,
  Download,
  Edit3,
  ExternalLink,
  Eye,
  Filter,
  Flame,
  Gauge,
  PackagePlus,
  PackageSearch,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  Upload,
  X
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useLanguage } from "@/components/LanguageProvider";
import { categoryMatches, categorySelectOptions, localizedCategoryValue, productCategoryOptions } from "@/lib/category-options";
import { supabase } from "@/lib/supabase";

type RiskLevel = "low" | "medium" | "high";
type VolumeLevel = "small" | "medium" | "large";
type WeightLevel = "light" | "medium" | "heavy";
type Priority = "high" | "medium" | "low";
type DecisionStatus = "pending_analysis" | "key_product" | "eliminated" | "ready_test" | "tested";
type RocketType = "normal" | "rocket_delivery" | "rocket_growth" | "seller_rocket" | "orange_rocket";
type DrawerMode = "view" | "edit" | "create" | "quick" | null;
type SortKey = "score" | "price" | "sales" | "reviews" | "rating" | "profitRate" | "updated";
type SortDir = "asc" | "desc";
type KpiListKey = "weekly" | "candidates" | "lowRisk" | "top";

type RawRow = Record<string, any>;

type CompetitorItem = {
  id: string;
  productNameKr: string;
  productNameCn: string;
  coupangProductId: string;
  coupangUrl: string;
  imageUrl: string;
  category: string;
  brand: string;
  storeName: string;
  currentPrice: number;
  monthlySales: number;
  reviewCount: number;
  rating: number;
  rocketType: RocketType;
  kcRiskLevel: RiskLevel;
  volumeLevel: VolumeLevel;
  weightLevel: WeightLevel;
  fragileRisk: RiskLevel;
  returnRisk: RiskLevel;
  competitionLevel: RiskLevel;
  similarProductCount: number;
  brandMonopolyLevel: RiskLevel;
  estimatedPurchasePrice: number;
  estimatedLogisticsCost: number;
  coupangFeeRate: number;
  estimatedAdCost: number;
  estimatedProfit: number;
  estimatedProfitRate: number;
  recommendationScore: number;
  testRecommended: boolean;
  suggestedTestQuantity: number;
  priority: Priority;
  status: DecisionStatus;
  recommendationReason: string;
  riskPoints: string;
  chinaSourcingFit: boolean;
  brandingFit: boolean;
  nextAction: string;
  collectedAt: string;
  updatedAt: string;
  notes: string;
  testStatus: string;
  testOwner: string;
  plannedLaunchDate: string;
  targetPrice: number;
};

type FormState = {
  productNameKr: string;
  productNameCn: string;
  coupangProductId: string;
  coupangUrl: string;
  imageUrl: string;
  category: string;
  brand: string;
  storeName: string;
  currentPrice: string;
  monthlySales: string;
  reviewCount: string;
  rating: string;
  rocketType: RocketType;
  kcRiskLevel: RiskLevel;
  volumeLevel: VolumeLevel;
  weightLevel: WeightLevel;
  fragileRisk: RiskLevel;
  returnRisk: RiskLevel;
  competitionLevel: RiskLevel;
  similarProductCount: string;
  brandMonopolyLevel: RiskLevel;
  estimatedPurchasePrice: string;
  estimatedLogisticsCost: string;
  coupangFeeRate: string;
  estimatedAdCost: string;
  recommendationScore: string;
  testRecommended: boolean;
  suggestedTestQuantity: string;
  priority: Priority;
  status: DecisionStatus;
  recommendationReason: string;
  riskPoints: string;
  chinaSourcingFit: boolean;
  brandingFit: boolean;
  nextAction: string;
  collectedAt: string;
  notes: string;
  testStatus: string;
  testOwner: string;
  plannedLaunchDate: string;
  targetPrice: string;
  productSpecSize: string;
  capacity: string;
  color: string;
  material: string;
  packageSize: string;
  packageQuantity: string;
  cartonSize: string;
  cartonQuantity: string;
  gp20: string;
  hq40: string;
};

type Filters = {
  search: string;
  category: string;
  status: string;
  rocketType: string;
  minPrice: string;
  maxPrice: string;
  minSales: string;
  maxSales: string;
  minReviews: string;
  maxReviews: string;
  minRating: string;
  maxRating: string;
  kcRiskLevel: string;
  volumeLevel: string;
  weightLevel: string;
  competitionLevel: string;
  profitSpace: string;
  testRecommended: string;
  startDate: string;
  endDate: string;
};

const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
const pageSize = 10;
const PRODUCT_IMAGE_BUCKET = "competitor-product-images";

const levelOptions: RiskLevel[] = ["low", "medium", "high"];
const kcOptions: RiskLevel[] = ["low", "high"];
const volumeOptions: VolumeLevel[] = ["small", "medium", "large"];
const weightOptions: WeightLevel[] = ["light", "medium", "heavy"];
const priorityOptions: Priority[] = ["high", "medium", "low"];
const statusOptions: DecisionStatus[] = ["pending_analysis", "key_product", "eliminated", "ready_test", "tested"];
const rocketOptions: RocketType[] = ["normal", "rocket_delivery", "rocket_growth", "seller_rocket", "orange_rocket"];

const emptyFilters: Filters = {
  search: "",
  category: "",
  status: "",
  rocketType: "",
  minPrice: "",
  maxPrice: "",
  minSales: "",
  maxSales: "",
  minReviews: "",
  maxReviews: "",
  minRating: "",
  maxRating: "",
  kcRiskLevel: "",
  volumeLevel: "",
  weightLevel: "",
  competitionLevel: "",
  profitSpace: "",
  testRecommended: "",
  startDate: "",
  endDate: ""
};

const emptyForm: FormState = {
  productNameKr: "",
  productNameCn: "",
  coupangProductId: "",
  coupangUrl: "",
  imageUrl: "",
  category: "",
  brand: "",
  storeName: "",
  currentPrice: "",
  monthlySales: "",
  reviewCount: "",
  rating: "",
  rocketType: "normal",
  kcRiskLevel: "low",
  volumeLevel: "small",
  weightLevel: "light",
  fragileRisk: "low",
  returnRisk: "low",
  competitionLevel: "medium",
  similarProductCount: "",
  brandMonopolyLevel: "medium",
  estimatedPurchasePrice: "",
  estimatedLogisticsCost: "",
  coupangFeeRate: "11.9",
  estimatedAdCost: "",
  recommendationScore: "",
  testRecommended: false,
  suggestedTestQuantity: "",
  priority: "medium",
  status: "pending_analysis",
  recommendationReason: "",
  riskPoints: "",
  chinaSourcingFit: true,
  brandingFit: false,
  nextAction: "",
  collectedAt: today(),
  notes: "",
  testStatus: "not_added",
  testOwner: "",
  plannedLaunchDate: "",
  targetPrice: "",
  productSpecSize: "",
  capacity: "",
  color: "",
  material: "",
  packageSize: "",
  packageQuantity: "",
  cartonSize: "",
  cartonQuantity: "",
  gp20: "",
  hq40: ""
};

const text = {
  zh: {
    title: "Coupang 竞品情报采集中心",
    eyebrow: "COUPANG PRODUCT INTELLIGENCE",
    subtitle: "采集 Coupang 竞品、爆款、价格、销量、评论、风险与利润数据，辅助新品测试决策。",
    quick: "快速采集",
    add: "新增竞品",
    edit: "编辑商品",
    view: "商品快速分析",
    loading: "正在加载竞品情报...",
    empty: "暂无竞品数据。先快速采集一个 Coupang 商品，系统会自动生成风险、利润和测试判断。",
    databaseHint: "竞品情报字段尚未更新。请在 Supabase SQL Editor 执行 supabase/migrations/upgrade-competitor-intelligence-center.sql。",
    kpi: {
      total: "已采集商品数",
      candidates: "重点候选商品",
      highSales: "高销量商品",
      lowRisk: "低风险商品",
      avgPrice: "平均客单价",
      topScore: "TOP 推荐指数",
      weekly: "本周新增",
      change: "环比变化",
      scoreTrend: "最高推荐分"
    },
    funnel: { captured: "已采集商品", screened: "初步筛选", lowRisk: "低风险商品", testable: "可测款", top: "TOP 推荐款" },
    filter: {
      title: "高级筛选面板",
      search: "商品名 / 品牌 / 店铺 / 链接",
      category: "类目筛选",
      status: "状态筛选",
      rocket: "Rocket 类型",
      minPrice: "最低售价",
      maxPrice: "最高售价",
      minSales: "最低月销量",
      maxSales: "最高月销量",
      minReviews: "最低评论数",
      maxReviews: "最高评论数",
      minRating: "最低评分",
      maxRating: "最高评分",
      kc: "KC 风险等级",
      volume: "体积等级",
      weight: "重量等级",
      competition: "竞争强度",
      profit: "利润空间",
      test: "是否建议测试",
      start: "采集开始日期",
      end: "采集结束日期",
      reset: "重置筛选",
      advancedOpen: "展开高级筛选",
      advancedClose: "收起高级筛选",
      exportCsv: "导出 CSV",
      exportExcel: "导出 Excel",
      batchMark: "批量标记",
      batchTest: "加入测试清单",
      batchDelete: "批量删除"
    },
    modules: {
      funnel: "选品决策漏斗",
      top10: "TOP 10 推荐商品",
      warnings: "风险预警中心",
      testList: "新品测试清单",
      table: "竞品决策表"
    },
    table: {
      product: "商品信息",
      category: "类目/品牌/店铺",
      market: "市场表现",
      risk: "风险判断",
      competition: "竞争判断",
      profit: "利润判断",
      decision: "决策结果",
      updated: "更新时间",
      actions: "操作"
    },
    fields: {
      productNameKr: "韩文商品名",
      productNameCn: "中文解释",
      productId: "Coupang 商品 ID",
      url: "Coupang 商品链接",
      image: "商品图片 URL",
      category: "类目",
      brand: "品牌",
      store: "店铺",
      price: "当前售价",
      sales: "月销量",
      reviews: "评论数",
      rating: "评分",
      rocket: "Rocket 类型",
      purchase: "预估采购价",
      logistics: "预估头程物流",
      fee: "Coupang 手续费率",
      ad: "广告成本预估",
      profit: "预估利润",
      profitRate: "预估利润率",
      score: "推荐指数",
      testQty: "建议测试数量",
      reason: "推荐理由",
      risks: "风险点",
      chinaFit: "适合中国采购",
      brandFit: "适合品牌化包装",
      nextAction: "下一步动作",
      notes: "竞品备注",
      owner: "负责人",
      launchDate: "计划上架日期",
      targetPrice: "目标售价"
    },
    risk: { low: "低风险", medium: "中风险", high: "高风险" },
    volume: { small: "小", medium: "中", large: "大" },
    weight: { light: "轻", medium: "中", heavy: "重" },
    priority: { high: "高", medium: "中", low: "低" },
    status: { pending_analysis: "待分析", key_product: "重点商品", eliminated: "已淘汰", ready_test: "准备测试", tested: "已测试" },
    rocket: { normal: "普通配送", rocket_delivery: "Rocket 配送", rocket_growth: "Rocket Growth", seller_rocket: "Seller Rocket", orange_rocket: "Orange Rocket" },
    scoreLabel: { strong: "强烈推荐", observe: "可以观察", careful: "谨慎", reject: "不推荐" },
    yes: "是",
    no: "否",
    all: "全部",
    none: "无",
    selected: "已选择",
    items: "个商品",
    profitSpace: { low: "低", medium: "中", high: "高" },
    actions: { save: "保存", cancel: "取消", close: "关闭", view: "查看", edit: "编辑", copy: "复制", open: "打开 Coupang", top: "加入 TOP 清单", delete: "删除", addTest: "加入测试清单", eliminate: "标记淘汰" },
    warnings: {
      kc: "KC 高风险商品",
      volume: "大体积商品",
      weight: "重量偏重商品",
      anomaly: "评论少但销量高",
      lowRating: "评分低于 4.3",
      lowMargin: "利润率低于 20%",
      competition: "竞争强度高"
    },
    testStatus: { not_added: "未加入", pending: "待采购", purchasing: "采购中", listing: "准备上架", testing: "测试中", done: "已完成" },
    pager: { prev: "上一页", next: "下一页" },
    confirmDelete: "确认删除这个商品吗？",
    confirmBatchDelete: "确认删除已选择的商品吗？",
    saved: "已保存",
    deleted: "已删除",
    batchDone: "批量操作已完成",
    required: "请填写 Coupang 链接和韩文商品名"
  },
  ko: {
    title: "Coupang 경쟁 상품 인텔리전스 수집 센터",
    eyebrow: "COUPANG PRODUCT INTELLIGENCE",
    subtitle: "Coupang 경쟁 상품, 인기 상품, 가격, 판매량, 리뷰, 리스크와 수익 데이터를 수집해 신상품 테스트 의사결정을 돕습니다.",
    quick: "빠른 수집",
    add: "경쟁 상품 추가",
    edit: "상품 수정",
    view: "상품 빠른 분석",
    loading: "경쟁 상품 인텔리전스를 불러오는 중...",
    empty: "아직 경쟁 상품 데이터가 없습니다. Coupang 상품을 빠르게 수집하면 리스크, 수익, 테스트 판단이 자동 계산됩니다.",
    databaseHint: "경쟁 상품 인텔리전스 필드가 아직 업데이트되지 않았습니다. Supabase SQL Editor에서 supabase/migrations/upgrade-competitor-intelligence-center.sql을 실행하세요.",
    kpi: {
      total: "수집 상품 수",
      candidates: "핵심 후보 상품",
      highSales: "고판매 상품",
      lowRisk: "저위험 상품",
      avgPrice: "평균 객단가",
      topScore: "TOP 추천 지수",
      weekly: "이번 주 신규",
      change: "전주 대비",
      scoreTrend: "최고 추천 점수"
    },
    funnel: { captured: "수집 상품", screened: "1차 선별", lowRisk: "저위험 상품", testable: "테스트 가능", top: "TOP 추천" },
    filter: {
      title: "고급 필터 패널",
      search: "상품명 / 브랜드 / 스토어 / 링크",
      category: "카테고리",
      status: "상태",
      rocket: "Rocket 유형",
      minPrice: "최저 판매가",
      maxPrice: "최고 판매가",
      minSales: "최저 월판매",
      maxSales: "최고 월판매",
      minReviews: "최저 리뷰 수",
      maxReviews: "최고 리뷰 수",
      minRating: "최저 평점",
      maxRating: "최고 평점",
      kc: "KC 리스크",
      volume: "부피 등급",
      weight: "무게 등급",
      competition: "경쟁 강도",
      profit: "수익 공간",
      test: "테스트 추천 여부",
      start: "수집 시작일",
      end: "수집 종료일",
      reset: "필터 초기화",
      advancedOpen: "고급 필터 펼치기",
      advancedClose: "고급 필터 접기",
      exportCsv: "CSV 내보내기",
      exportExcel: "Excel 내보내기",
      batchMark: "일괄 상태 변경",
      batchTest: "테스트 목록 추가",
      batchDelete: "일괄 삭제"
    },
    modules: {
      funnel: "상품 선정 의사결정 퍼널",
      top10: "TOP 10 추천 상품",
      warnings: "리스크 경보 센터",
      testList: "신상품 테스트 목록",
      table: "경쟁 상품 의사결정 표"
    },
    table: {
      product: "상품 정보",
      category: "카테고리/브랜드/스토어",
      market: "시장 성과",
      risk: "리스크 판단",
      competition: "경쟁 판단",
      profit: "수익 판단",
      decision: "의사결정",
      updated: "업데이트",
      actions: "작업"
    },
    fields: {
      productNameKr: "한국어 상품명",
      productNameCn: "중국어 설명",
      productId: "Coupang 상품 ID",
      url: "Coupang 상품 링크",
      image: "상품 이미지 URL",
      category: "카테고리",
      brand: "브랜드",
      store: "스토어",
      price: "현재 판매가",
      sales: "월판매량",
      reviews: "리뷰 수",
      rating: "평점",
      rocket: "Rocket 유형",
      purchase: "예상 매입가",
      logistics: "예상 1차 물류비",
      fee: "Coupang 수수료율",
      ad: "예상 광고비",
      profit: "예상 이익",
      profitRate: "예상 이익률",
      score: "추천 지수",
      testQty: "권장 테스트 수량",
      reason: "추천 이유",
      risks: "리스크 포인트",
      chinaFit: "중국 소싱 적합",
      brandFit: "브랜딩 포장 적합",
      nextAction: "다음 액션",
      notes: "경쟁 상품 메모",
      owner: "담당자",
      launchDate: "예정 등록일",
      targetPrice: "목표 판매가"
    },
    risk: { low: "낮음", medium: "중간", high: "높음" },
    volume: { small: "소", medium: "중", large: "대" },
    weight: { light: "가벼움", medium: "중간", heavy: "무거움" },
    priority: { high: "높음", medium: "중간", low: "낮음" },
    status: { pending_analysis: "분석 대기", key_product: "핵심 상품", eliminated: "제외", ready_test: "테스트 준비", tested: "테스트 완료" },
    rocket: { normal: "일반 배송", rocket_delivery: "로켓배송", rocket_growth: "로켓그로스", seller_rocket: "판매자로켓", orange_rocket: "오렌지로켓" },
    scoreLabel: { strong: "강력 추천", observe: "관찰 가능", careful: "신중", reject: "비추천" },
    yes: "예",
    no: "아니오",
    all: "전체",
    none: "없음",
    selected: "선택됨",
    items: "개 상품",
    profitSpace: { low: "낮음", medium: "중간", high: "높음" },
    actions: { save: "저장", cancel: "취소", close: "닫기", view: "보기", edit: "수정", copy: "복사", open: "Coupang 열기", top: "TOP 목록 추가", delete: "삭제", addTest: "테스트 목록 추가", eliminate: "제외 표시" },
    warnings: {
      kc: "KC 고위험 상품",
      volume: "대형 부피 상품",
      weight: "무거운 상품",
      anomaly: "리뷰 적고 판매 높은 이상 상품",
      lowRating: "평점 4.3 미만",
      lowMargin: "이익률 20% 미만",
      competition: "경쟁 강도 높음"
    },
    testStatus: { not_added: "미추가", pending: "매입 대기", purchasing: "매입 중", listing: "등록 준비", testing: "테스트 중", done: "완료" },
    pager: { prev: "이전", next: "다음" },
    confirmDelete: "이 상품을 삭제할까요?",
    confirmBatchDelete: "선택한 상품을 삭제할까요?",
    saved: "저장되었습니다",
    deleted: "삭제되었습니다",
    batchDone: "일괄 작업이 완료되었습니다",
    required: "Coupang 링크와 한국어 상품명을 입력하세요"
  }
} as const;

type CopyText = (typeof text)[keyof typeof text];

function toNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function won(value: number) {
  return new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW", maximumFractionDigits: 0 }).format(value || 0);
}

function percent(value: number) {
  return `${Number.isFinite(value) ? value.toFixed(1) : "0.0"}%`;
}

function parseMonthlySales(row: RawRow) {
  return toNumber(row.monthly_sales ?? row.monthlySales ?? row.monthly_sales_text);
}

function calculateProfit(item: Pick<CompetitorItem, "currentPrice" | "estimatedPurchasePrice" | "estimatedLogisticsCost" | "coupangFeeRate" | "estimatedAdCost">) {
  const fee = item.currentPrice * (item.coupangFeeRate || 0) / 100;
  const profit = item.currentPrice - item.estimatedPurchasePrice - item.estimatedLogisticsCost - fee - item.estimatedAdCost;
  return {
    profit,
    profitRate: item.currentPrice > 0 ? (profit / item.currentPrice) * 100 : 0
  };
}

function calculateScore(item: CompetitorItem) {
  let score = 4.2;
  score += Math.min(1.5, item.monthlySales / 800);
  score += Math.min(1.0, item.reviewCount / 1800);
  score += item.rating >= 4.7 ? 1.0 : item.rating >= 4.4 ? 0.6 : item.rating >= 4.1 ? 0.2 : -0.8;
  score += item.kcRiskLevel === "low" ? 1.0 : item.kcRiskLevel === "medium" ? 0 : -1.4;
  score += item.volumeLevel === "small" ? 0.5 : item.volumeLevel === "medium" ? 0.1 : -0.5;
  score += item.weightLevel === "light" ? 0.5 : item.weightLevel === "medium" ? 0.1 : -0.5;
  score += item.competitionLevel === "low" ? 0.7 : item.competitionLevel === "medium" ? 0.1 : -0.7;
  score += item.estimatedProfitRate >= 35 ? 1.0 : item.estimatedProfitRate >= 20 ? 0.45 : -0.9;
  score += item.testRecommended ? 0.4 : 0;
  return clamp(Number(score.toFixed(1)), 1, 10);
}

function normalize(row: RawRow): CompetitorItem {
  const base: CompetitorItem = {
    id: String(row.id),
    productNameKr: row.product_name_kr ?? row.product_name ?? "",
    productNameCn: row.product_name_cn ?? "",
    coupangProductId: row.coupang_product_id ?? row.product_id ?? "",
    coupangUrl: row.coupang_url ?? row.product_url ?? "",
    imageUrl: row.image_url ?? row.main_image_url ?? "",
    category: row.category ?? "",
    brand: row.brand ?? "",
    storeName: row.store_name ?? row.seller_name ?? "",
    currentPrice: toNumber(row.current_price),
    monthlySales: parseMonthlySales(row),
    reviewCount: toNumber(row.review_count),
    rating: toNumber(row.rating),
    rocketType: (row.rocket_type ?? "normal") as RocketType,
    kcRiskLevel: (row.kc_risk_level ?? "low") as RiskLevel,
    volumeLevel: (row.volume_level ?? "small") as VolumeLevel,
    weightLevel: (row.weight_level ?? "light") as WeightLevel,
    fragileRisk: (row.fragile_risk ?? "low") as RiskLevel,
    returnRisk: (row.return_risk ?? "low") as RiskLevel,
    competitionLevel: (row.competition_level ?? "medium") as RiskLevel,
    similarProductCount: toNumber(row.similar_product_count),
    brandMonopolyLevel: (row.brand_monopoly_level ?? "medium") as RiskLevel,
    estimatedPurchasePrice: toNumber(row.estimated_purchase_price),
    estimatedLogisticsCost: toNumber(row.estimated_logistics_cost),
    coupangFeeRate: toNumber(row.coupang_fee_rate || 11.9),
    estimatedAdCost: toNumber(row.estimated_ad_cost),
    estimatedProfit: toNumber(row.estimated_profit),
    estimatedProfitRate: toNumber(row.estimated_profit_rate),
    recommendationScore: toNumber(row.recommendation_score),
    testRecommended: Boolean(row.test_recommended ?? row.worth_following ?? false),
    suggestedTestQuantity: toNumber(row.suggested_test_quantity),
    priority: (row.priority ?? row.follow_priority ?? "medium") as Priority,
    status: (row.status ?? mapOldStatus(row.product_status)) as DecisionStatus,
    recommendationReason: row.recommendation_reason ?? row.learnings ?? "",
    riskPoints: row.risk_points ?? row.risks ?? "",
    chinaSourcingFit: row.china_sourcing_fit ?? true,
    brandingFit: row.branding_fit ?? false,
    nextAction: row.next_action ?? "",
    collectedAt: row.collected_at ?? today(),
    updatedAt: row.updated_at ?? row.created_at ?? today(),
    notes: row.notes ?? "",
    testStatus: row.test_status ?? "not_added",
    testOwner: row.test_owner ?? "",
    plannedLaunchDate: row.planned_launch_date ?? "",
    targetPrice: toNumber(row.target_price)
  };
  const calc = calculateProfit(base);
  base.estimatedProfit = base.estimatedProfit || calc.profit;
  base.estimatedProfitRate = base.estimatedProfitRate || calc.profitRate;
  base.recommendationScore = base.recommendationScore || calculateScore(base);
  return base;
}

function mapOldStatus(value: string | undefined): DecisionStatus {
  if (value === "key_competitor") return "key_product";
  if (value === "best_reference") return "ready_test";
  if (value === "eliminated") return "eliminated";
  return "pending_analysis";
}

function oldStatus(value: DecisionStatus) {
  if (value === "key_product") return "key_competitor";
  if (value === "ready_test" || value === "tested") return "best_reference";
  if (value === "eliminated") return "eliminated";
  return "watching";
}

const productSpecNotePattern = /\n*\[PRODUCT_SPEC_JSON\]([\s\S]*?)\[\/PRODUCT_SPEC_JSON\]\s*/;
const emptyProductSpecs = {
  productSpecSize: "",
  capacity: "",
  color: "",
  material: "",
  packageSize: "",
  packageQuantity: "",
  cartonSize: "",
  cartonQuantity: "",
  gp20: "",
  hq40: ""
};

function parseProductSpecNotes(notes: string) {
  const match = notes.match(productSpecNotePattern);
  if (!match) return { notes, specs: emptyProductSpecs };
  try {
    const parsed = JSON.parse(match[1]) as Partial<typeof emptyProductSpecs>;
    return {
      notes: notes.replace(productSpecNotePattern, "").trim(),
      specs: { ...emptyProductSpecs, ...parsed }
    };
  } catch {
    return { notes, specs: emptyProductSpecs };
  }
}

function serializeProductSpecNotes(notes: string, form: FormState) {
  const specs = {
    productSpecSize: form.productSpecSize.trim(),
    capacity: form.capacity.trim(),
    color: form.color.trim(),
    material: form.material.trim(),
    packageSize: form.packageSize.trim(),
    packageQuantity: form.packageQuantity.trim(),
    cartonSize: form.cartonSize.trim(),
    cartonQuantity: form.cartonQuantity.trim(),
    gp20: form.gp20.trim(),
    hq40: form.hq40.trim()
  };
  const cleanNotes = notes.replace(productSpecNotePattern, "").trim();
  if (!Object.values(specs).some(Boolean)) return cleanNotes;
  return `${cleanNotes}${cleanNotes ? "\n\n" : ""}[PRODUCT_SPEC_JSON]${JSON.stringify(specs)}[/PRODUCT_SPEC_JSON]`;
}

function formFromItem(item: CompetitorItem): FormState {
  const parsedNotes = parseProductSpecNotes(item.notes);
  return {
    productNameKr: item.productNameKr,
    productNameCn: item.productNameCn,
    coupangProductId: item.coupangProductId,
    coupangUrl: item.coupangUrl,
    imageUrl: item.imageUrl,
    category: item.category,
    brand: item.brand,
    storeName: item.storeName,
    currentPrice: String(item.currentPrice || ""),
    monthlySales: String(item.monthlySales || ""),
    reviewCount: String(item.reviewCount || ""),
    rating: String(item.rating || ""),
    rocketType: item.rocketType,
    kcRiskLevel: item.kcRiskLevel,
    volumeLevel: item.volumeLevel,
    weightLevel: item.weightLevel,
    fragileRisk: item.fragileRisk,
    returnRisk: item.returnRisk,
    competitionLevel: item.competitionLevel,
    similarProductCount: String(item.similarProductCount || ""),
    brandMonopolyLevel: item.brandMonopolyLevel,
    estimatedPurchasePrice: String(item.estimatedPurchasePrice || ""),
    estimatedLogisticsCost: String(item.estimatedLogisticsCost || ""),
    coupangFeeRate: String(item.coupangFeeRate || 11.9),
    estimatedAdCost: String(item.estimatedAdCost || ""),
    recommendationScore: String(item.recommendationScore || ""),
    testRecommended: item.testRecommended,
    suggestedTestQuantity: String(item.suggestedTestQuantity || ""),
    priority: item.priority,
    status: item.status,
    recommendationReason: item.recommendationReason,
    riskPoints: item.riskPoints,
    chinaSourcingFit: item.chinaSourcingFit,
    brandingFit: item.brandingFit,
    nextAction: item.nextAction,
    collectedAt: item.collectedAt,
    notes: parsedNotes.notes,
    testStatus: item.testStatus,
    testOwner: item.testOwner,
    plannedLaunchDate: item.plannedLaunchDate,
    targetPrice: String(item.targetPrice || ""),
    ...parsedNotes.specs
  };
}

function itemFromForm(form: FormState): CompetitorItem {
  const base = {
    id: "",
    productNameKr: form.productNameKr.trim(),
    productNameCn: form.productNameCn.trim(),
    coupangProductId: form.coupangProductId.trim(),
    coupangUrl: form.coupangUrl.trim(),
    imageUrl: form.imageUrl.trim(),
    category: form.category.trim(),
    brand: form.brand.trim(),
    storeName: form.storeName.trim(),
    currentPrice: toNumber(form.currentPrice),
    monthlySales: toNumber(form.monthlySales),
    reviewCount: toNumber(form.reviewCount),
    rating: clamp(toNumber(form.rating), 0, 5),
    rocketType: form.rocketType,
    kcRiskLevel: form.kcRiskLevel,
    volumeLevel: form.volumeLevel,
    weightLevel: form.weightLevel,
    fragileRisk: form.fragileRisk,
    returnRisk: form.returnRisk,
    competitionLevel: form.competitionLevel,
    similarProductCount: toNumber(form.similarProductCount),
    brandMonopolyLevel: form.brandMonopolyLevel,
    estimatedPurchasePrice: toNumber(form.estimatedPurchasePrice),
    estimatedLogisticsCost: toNumber(form.estimatedLogisticsCost),
    coupangFeeRate: toNumber(form.coupangFeeRate || 11.9),
    estimatedAdCost: toNumber(form.estimatedAdCost),
    estimatedProfit: 0,
    estimatedProfitRate: 0,
    recommendationScore: toNumber(form.recommendationScore),
    testRecommended: form.testRecommended,
    suggestedTestQuantity: toNumber(form.suggestedTestQuantity),
    priority: form.priority,
    status: form.status,
    recommendationReason: form.recommendationReason.trim(),
    riskPoints: form.riskPoints.trim(),
    chinaSourcingFit: form.chinaSourcingFit,
    brandingFit: form.brandingFit,
    nextAction: form.nextAction.trim(),
    collectedAt: form.collectedAt || today(),
    updatedAt: today(),
    notes: serializeProductSpecNotes(form.notes, form),
    testStatus: form.testStatus,
    testOwner: form.testOwner.trim(),
    plannedLaunchDate: form.plannedLaunchDate,
    targetPrice: toNumber(form.targetPrice)
  } satisfies CompetitorItem;
  const profit = calculateProfit(base);
  base.estimatedProfit = profit.profit;
  base.estimatedProfitRate = profit.profitRate;
  base.recommendationScore = base.recommendationScore || calculateScore(base);
  return base;
}

function payloadFromItem(item: CompetitorItem, userId: string) {
  return {
    user_id: userId,
    platform: "Coupang",
    product_name: item.productNameKr,
    product_url: item.coupangUrl,
    product_id: item.coupangProductId || null,
    main_image_url: item.imageUrl || null,
    seller_name: item.storeName || null,
    product_name_kr: item.productNameKr,
    product_name_cn: item.productNameCn || null,
    coupang_product_id: item.coupangProductId || null,
    coupang_url: item.coupangUrl,
    image_url: item.imageUrl || null,
    category: item.category || null,
    brand: item.brand || null,
    store_name: item.storeName || null,
    current_price: item.currentPrice,
    monthly_sales: Math.round(item.monthlySales),
    monthly_sales_text: String(Math.round(item.monthlySales || 0)),
    review_count: Math.round(item.reviewCount),
    rating: item.rating,
    rocket_type: item.rocketType,
    kc_risk_level: item.kcRiskLevel,
    volume_level: item.volumeLevel,
    weight_level: item.weightLevel,
    fragile_risk: item.fragileRisk,
    return_risk: item.returnRisk,
    competition_level: item.competitionLevel,
    similar_product_count: Math.round(item.similarProductCount),
    brand_monopoly_level: item.brandMonopolyLevel,
    estimated_purchase_price: item.estimatedPurchasePrice,
    estimated_logistics_cost: item.estimatedLogisticsCost,
    coupang_fee_rate: item.coupangFeeRate,
    estimated_ad_cost: item.estimatedAdCost,
    estimated_profit: item.estimatedProfit,
    estimated_profit_rate: item.estimatedProfitRate,
    recommendation_score: item.recommendationScore,
    test_recommended: item.testRecommended,
    suggested_test_quantity: Math.round(item.suggestedTestQuantity),
    priority: item.priority,
    status: item.status,
    product_status: oldStatus(item.status),
    follow_priority: item.priority,
    worth_following: item.testRecommended,
    recommendation_reason: item.recommendationReason || null,
    risk_points: item.riskPoints || null,
    china_sourcing_fit: item.chinaSourcingFit,
    branding_fit: item.brandingFit,
    next_action: item.nextAction || null,
    collected_at: item.collectedAt || today(),
    notes: item.notes || null,
    test_status: item.testStatus,
    test_owner: item.testOwner || null,
    planned_launch_date: item.plannedLaunchDate || null,
    target_price: item.targetPrice || 0
  };
}

async function uploadProductImage(userId: string, file: File) {
  if (!file.type.startsWith("image/")) return { error: "Only image files are supported", url: null };
  const extension = file.name.split(".").pop()?.toLowerCase() || file.type.split("/").pop() || "jpg";
  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}-${safeName || `product.${extension}`}`;
  const { error } = await supabase.storage.from(PRODUCT_IMAGE_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false
  });
  if (error) return { error: error.message, url: null };
  const { data } = supabase.storage.from(PRODUCT_IMAGE_BUCKET).getPublicUrl(path);
  return { error: null, url: data.publicUrl };
}

function productImageUploadMessage(message: string, language: "zh" | "ko") {
  if (message.toLowerCase().includes("bucket")) {
    return language === "zh"
      ? "图片没有上传成功：Supabase Storage 缺少 competitor-product-images 存储桶。请执行 supabase/migrations/create-competitor-product-images-bucket.sql。"
      : "이미지를 업로드하지 못했습니다. Supabase Storage에 competitor-product-images 버킷이 없습니다. supabase/migrations/create-competitor-product-images-bucket.sql을 실행하세요.";
  }
  if (message === "Only image files are supported") {
    return language === "zh" ? "请上传 JPG、PNG、WebP 等图片文件。" : "JPG, PNG, WebP 같은 이미지 파일만 업로드하세요.";
  }
  return message;
}

export default function CompetitorProductsPage() {
  return (
    <AppShell>
      <CompetitorProductsContent />
    </AppShell>
  );
}

function CompetitorProductsContent() {
  const { language, formatDate } = useLanguage();
  const c = text[language];
  const [rows, setRows] = useState<CompetitorItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [drawerMessage, setDrawerMessage] = useState("");
  const [toast, setToast] = useState("");
  const [drawer, setDrawer] = useState<DrawerMode>(null);
  const [selected, setSelected] = useState<CompetitorItem | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "score", dir: "desc" });
  const [page, setPage] = useState(1);
  const [activeKpi, setActiveKpi] = useState<KpiListKey | null>(null);

  const loadRows = async () => {
    setLoading(true);
    setMessage("");
    const { data, error } = await supabase.from("competitor_product_library").select("*").order("updated_at", { ascending: false });
    if (error) {
      setMessage(error.message.includes("column") ? c.databaseHint : error.message);
      setLoading(false);
      return;
    }
    setRows((data ?? []).map(normalize));
    setLoading(false);
  };

  useEffect(() => {
    loadRows();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const categories = useMemo(() => categorySelectOptions(rows.map((row) => row.category), language), [rows, language]);

  const filtered = useMemo(() => {
    const query = filters.search.trim().toLowerCase();
    return rows.filter((row) => {
      const searchable = `${row.productNameKr} ${row.productNameCn} ${row.brand} ${row.storeName} ${row.coupangUrl}`.toLowerCase();
      const margin = row.estimatedProfitRate;
      const profitMatch =
        !filters.profitSpace ||
        (filters.profitSpace === "high" && margin >= 30) ||
        (filters.profitSpace === "medium" && margin >= 20 && margin < 30) ||
        (filters.profitSpace === "low" && margin < 20);
      return (
        (!query || searchable.includes(query)) &&
        (!filters.category || categoryMatches(row.category, filters.category)) &&
        (!filters.status || row.status === filters.status) &&
        (!filters.rocketType || row.rocketType === filters.rocketType) &&
        (!filters.minPrice || row.currentPrice >= toNumber(filters.minPrice)) &&
        (!filters.maxPrice || row.currentPrice <= toNumber(filters.maxPrice)) &&
        (!filters.minSales || row.monthlySales >= toNumber(filters.minSales)) &&
        (!filters.maxSales || row.monthlySales <= toNumber(filters.maxSales)) &&
        (!filters.minReviews || row.reviewCount >= toNumber(filters.minReviews)) &&
        (!filters.maxReviews || row.reviewCount <= toNumber(filters.maxReviews)) &&
        (!filters.minRating || row.rating >= toNumber(filters.minRating)) &&
        (!filters.maxRating || row.rating <= toNumber(filters.maxRating)) &&
        (!filters.kcRiskLevel || row.kcRiskLevel === filters.kcRiskLevel) &&
        (!filters.volumeLevel || row.volumeLevel === filters.volumeLevel) &&
        (!filters.weightLevel || row.weightLevel === filters.weightLevel) &&
        (!filters.competitionLevel || row.competitionLevel === filters.competitionLevel) &&
        (!filters.testRecommended || row.testRecommended === (filters.testRecommended === "yes")) &&
        (!filters.startDate || row.collectedAt >= filters.startDate) &&
        (!filters.endDate || row.collectedAt <= filters.endDate) &&
        profitMatch
      );
    });
  }, [filters, rows]);

  const sorted = useMemo(() => {
    const valueMap: Record<SortKey, (row: CompetitorItem) => number> = {
      score: (row) => row.recommendationScore,
      price: (row) => row.currentPrice,
      sales: (row) => row.monthlySales,
      reviews: (row) => row.reviewCount,
      rating: (row) => row.rating,
      profitRate: (row) => row.estimatedProfitRate,
      updated: (row) => new Date(row.updatedAt).getTime()
    };
    return [...filtered].sort((a, b) => (valueMap[sort.key](a) - valueMap[sort.key](b)) * (sort.dir === "asc" ? 1 : -1));
  }, [filtered, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const pageRows = sorted.slice((page - 1) * pageSize, page * pageSize);
  const top10 = useMemo(() => [...rows].sort(topSort).slice(0, 10), [rows]);
  const weeklyRows = rows.filter((row) => daysAgo(row.collectedAt) <= 7);
  const lastWeekRows = rows.filter((row) => daysAgo(row.collectedAt) > 7 && daysAgo(row.collectedAt) <= 14);
  const candidateRows = rows.filter((row) => row.status === "key_product" || row.recommendationScore >= 7).sort(topSort);
  const lowRiskRows = rows.filter((row) => row.kcRiskLevel === "low" && row.volumeLevel !== "large" && row.weightLevel !== "heavy").sort(topSort);
  const kpiLists: Record<KpiListKey, { title: string; subtitle: string; rows: CompetitorItem[]; cta: string; onFilter: () => void }> = {
    weekly: {
      title: language === "zh" ? `本周新增产品 ${weeklyRows.length} 个` : `이번 주 신규 상품 ${weeklyRows.length}개`,
      subtitle: language === "zh" ? "最近 7 天采集的产品，适合先做快速初筛。" : "최근 7일 내 수집된 상품입니다.",
      rows: [...weeklyRows].sort((a, b) => new Date(b.collectedAt).getTime() - new Date(a.collectedAt).getTime()).slice(0, 10),
      cta: language === "zh" ? "查看本周新增" : "이번 주 신규 보기",
      onFilter: () => { setFilters(emptyFilters); setSort({ key: "updated", dir: "desc" }); setPage(1); }
    },
    candidates: {
      title: language === "zh" ? `重点候选商品 ${candidateRows.length} 个` : `핵심 후보 상품 ${candidateRows.length}개`,
      subtitle: language === "zh" ? "推荐指数较高或已被标记为重点商品。" : "추천 지수가 높거나 핵심 상품으로 표시된 상품입니다.",
      rows: candidateRows.slice(0, 10),
      cta: language === "zh" ? "筛选重点候选" : "핵심 후보 필터",
      onFilter: () => { setFilters({ ...emptyFilters, status: "key_product" }); setPage(1); }
    },
    lowRisk: {
      title: language === "zh" ? `低风险商品 ${lowRiskRows.length} 个` : `저위험 상품 ${lowRiskRows.length}개`,
      subtitle: language === "zh" ? "KC 低风险，并且不是大体积或重货。" : "KC 저위험이며 대형/중량 상품이 아닙니다.",
      rows: lowRiskRows.slice(0, 10),
      cta: language === "zh" ? "筛选低风险" : "저위험 필터",
      onFilter: () => { setFilters({ ...emptyFilters, kcRiskLevel: "low" }); setPage(1); }
    },
    top: {
      title: language === "zh" ? "TOP 推荐产品列表" : "TOP 추천 상품 목록",
      subtitle: language === "zh" ? "按推荐指数、风险、销量综合排序的前 10 个产品。" : "추천 지수, 리스크, 판매량 기준 상위 10개 상품입니다.",
      rows: top10,
      cta: language === "zh" ? "按推荐指数排序" : "추천 지수순 정렬",
      onFilter: () => { setFilters(emptyFilters); setSort({ key: "score", dir: "desc" }); setPage(1); }
    }
  };
  const stats = {
    total: rows.length,
    candidates: rows.filter((row) => row.status === "key_product" || row.recommendationScore >= 7).length,
    highSales: rows.filter((row) => row.monthlySales >= 300).length,
    lowRisk: rows.filter((row) => row.kcRiskLevel === "low" && row.volumeLevel !== "large" && row.weightLevel !== "heavy").length,
    avgPrice: rows.length ? rows.reduce((sum, row) => sum + row.currentPrice, 0) / rows.length : 0,
    topScore: rows.length ? Math.max(...rows.map((row) => row.recommendationScore)) : 0,
    weekly: weeklyRows.length,
    change: lastWeekRows.length ? ((weeklyRows.length - lastWeekRows.length) / lastWeekRows.length) * 100 : weeklyRows.length ? 100 : 0
  };

  const testCandidateCount = rows.filter((row) => (row.testRecommended || row.recommendationScore >= 8) && row.status !== "eliminated").length;
  const reviewNeededCount = rows.filter((row) => row.estimatedProfitRate < 20 || row.competitionLevel === "high" || (row.rating > 0 && row.rating < 4.3)).length;
  const riskBlockedCount = rows.filter((row) => row.kcRiskLevel === "high" || row.volumeLevel === "large" || row.weightLevel === "heavy").length;

  const warnings = [
    { key: "kc", label: c.warnings.kc, count: rows.filter((row) => row.kcRiskLevel === "high").length, onClick: () => setFilters({ ...emptyFilters, kcRiskLevel: "high" }) },
    { key: "volume", label: c.warnings.volume, count: rows.filter((row) => row.volumeLevel === "large").length, onClick: () => setFilters({ ...emptyFilters, volumeLevel: "large" }) },
    { key: "weight", label: c.warnings.weight, count: rows.filter((row) => row.weightLevel === "heavy").length, onClick: () => setFilters({ ...emptyFilters, weightLevel: "heavy" }) },
    { key: "anomaly", label: c.warnings.anomaly, count: rows.filter((row) => row.reviewCount < 30 && row.monthlySales >= 300).length, onClick: () => setFilters({ ...emptyFilters, maxReviews: "30", minSales: "300" }) },
    { key: "lowRating", label: c.warnings.lowRating, count: rows.filter((row) => row.rating > 0 && row.rating < 4.3).length, onClick: () => setFilters({ ...emptyFilters, maxRating: "4.3" }) },
    { key: "lowMargin", label: c.warnings.lowMargin, count: rows.filter((row) => row.estimatedProfitRate < 20).length, onClick: () => setFilters({ ...emptyFilters, profitSpace: "low" }) },
    { key: "competition", label: c.warnings.competition, count: rows.filter((row) => row.competitionLevel === "high").length, onClick: () => setFilters({ ...emptyFilters, competitionLevel: "high" }) }
  ];

  const openCreate = (mode: "create" | "quick") => {
    setSelected(null);
    setForm(emptyForm);
    setDrawerMessage("");
    setDrawer(mode);
  };

  const openView = (row: CompetitorItem) => {
    setSelected(row);
    setForm(formFromItem(row));
    setDrawerMessage("");
    setDrawer("view");
  };

  const openEdit = (row: CompetitorItem) => {
    setSelected(row);
    setForm(formFromItem(row));
    setDrawerMessage("");
    setDrawer("edit");
  };

  const duplicate = (row: CompetitorItem) => {
    setSelected(null);
    setForm({ ...formFromItem(row), productNameKr: `${row.productNameKr} Copy`, coupangProductId: "" });
    setDrawerMessage("");
    setDrawer("create");
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setDrawerMessage("");
    if (!form.coupangUrl.trim() || !form.productNameKr.trim()) {
      setMessage(c.required);
      setDrawerMessage(c.required);
      return;
    }
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      setMessage("Missing user session");
      setDrawerMessage("Missing user session");
      return;
    }
    const item = itemFromForm(form);
    const payload = payloadFromItem(item, data.user.id);
    const result = drawer === "edit" && selected
      ? await supabase.from("competitor_product_library").update(payload).eq("id", selected.id)
      : await supabase.from("competitor_product_library").insert(payload);
    if (result.error) {
      const errorMessage = result.error.message.includes("column") ? c.databaseHint : result.error.message;
      setMessage(errorMessage);
      setDrawerMessage(errorMessage);
      return;
    }
    setDrawer(null);
    setToast(c.saved);
    await loadRows();
  };

  const remove = async (row: CompetitorItem) => {
    if (!window.confirm(c.confirmDelete)) return;
    const { error } = await supabase.from("competitor_product_library").delete().eq("id", row.id);
    if (error) {
      setMessage(error.message);
      return;
    }
    setToast(c.deleted);
    await loadRows();
  };

  const batchUpdate = async (patch: RawRow) => {
    if (!selectedIds.length) return;
    const { error } = await supabase.from("competitor_product_library").update(patch).in("id", selectedIds);
    if (error) {
      setMessage(error.message);
      return;
    }
    setToast(c.batchDone);
    setSelectedIds([]);
    await loadRows();
  };

  const patchOne = async (id: string, patch: RawRow) => {
    const { error } = await supabase.from("competitor_product_library").update(patch).eq("id", id);
    if (error) {
      setMessage(error.message);
      return false;
    }
    setToast(c.batchDone);
    await loadRows();
    return true;
  };

  const batchDelete = async () => {
    if (!selectedIds.length || !window.confirm(c.confirmBatchDelete)) return;
    const { error } = await supabase.from("competitor_product_library").delete().in("id", selectedIds);
    if (error) {
      setMessage(error.message);
      return;
    }
    setToast(c.batchDone);
    setSelectedIds([]);
    await loadRows();
  };

  const exportRows = (format: "csv" | "xls") => {
    const headers = ["product_name_kr", "product_name_cn", "coupang_product_id", "coupang_url", "category", "brand", "store_name", "current_price", "monthly_sales", "review_count", "rating", "rocket_type", "kc_risk_level", "volume_level", "weight_level", "competition_level", "estimated_profit", "estimated_profit_rate", "recommendation_score", "test_recommended", "suggested_test_quantity", "priority", "status", "updated_at"];
    const body = sorted.map((row) => [
      row.productNameKr,
      row.productNameCn,
      row.coupangProductId,
      row.coupangUrl,
      row.category,
      row.brand,
      row.storeName,
      row.currentPrice,
      row.monthlySales,
      row.reviewCount,
      row.rating,
      row.rocketType,
      row.kcRiskLevel,
      row.volumeLevel,
      row.weightLevel,
      row.competitionLevel,
      row.estimatedProfit,
      row.estimatedProfitRate,
      row.recommendationScore,
      row.testRecommended ? c.yes : c.no,
      row.suggestedTestQuantity,
      row.priority,
      row.status,
      row.updatedAt
    ]);
    const csv = [headers, ...body].map((line) => line.map(csvCell).join(",")).join("\n");
    const blob = new Blob([`\ufeff${csv}`], { type: format === "csv" ? "text/csv;charset=utf-8" : "application/vnd.ms-excel;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `coupang-competitor-intelligence.${format === "csv" ? "csv" : "xls"}`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const toggleSort = (key: SortKey) => setSort((current) => ({ key, dir: current.key === key && current.dir === "desc" ? "asc" : "desc" }));

  return (
    <div className="space-y-6">
      {toast ? <div className="fixed right-6 top-20 z-50 rounded-full bg-[#123c35] px-4 py-2 text-sm font-semibold text-white shadow-lift">{toast}</div> : null}

      <section className="relative overflow-hidden rounded-[28px] border border-[#d5ddd4] bg-[#fbfcf8] p-6 shadow-[0_26px_82px_rgba(18,31,27,0.10)] md:p-7">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#123c35] via-[#2c6b5a] to-[#b6a16d]" />
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-4xl">
            <div className="premium-section-eyebrow">{c.eyebrow}</div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink md:text-4xl">{c.title}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">{c.subtitle}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="erp-button-primary inline-flex items-center gap-2 px-4 py-2 text-sm font-bold" onClick={() => openCreate("quick")}><PackagePlus size={16} />{c.quick}</button>
          </div>
        </div>
      </section>

      {message ? <div className="rounded-2xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm font-semibold text-yellow-800">{message}</div> : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard icon={PackageSearch} label={c.kpi.total} value={stats.total.toLocaleString()} trend={`${c.kpi.weekly} ${stats.weekly}`} meta={`${c.kpi.change} ${percent(stats.change)}`} active={activeKpi === "weekly"} onClick={() => setActiveKpi(activeKpi === "weekly" ? null : "weekly")} />
        <KpiCard icon={BadgeCheck} label={c.kpi.candidates} value={stats.candidates.toLocaleString()} trend={language === "zh" ? "推荐指数 ≥ 7" : "추천 지수 ≥ 7"} meta={`${language === "zh" ? "转化率" : "전환율"} ${percent(ratio(stats.candidates, stats.total))}`} active={activeKpi === "candidates"} onClick={() => setActiveKpi(activeKpi === "candidates" ? null : "candidates")} />
        <KpiCard icon={ShieldCheck} label={c.kpi.lowRisk} value={stats.lowRisk.toLocaleString()} trend={language === "zh" ? "KC 低风险 + 轻小件" : "KC 저위험 + 소형"} meta={`${language === "zh" ? "占比" : "비중"} ${percent(ratio(stats.lowRisk, stats.total))}`} active={activeKpi === "lowRisk"} onClick={() => setActiveKpi(activeKpi === "lowRisk" ? null : "lowRisk")} />
        <KpiCard icon={Flame} label={c.kpi.topScore} value={stats.topScore.toFixed(1)} trend={c.kpi.scoreTrend} meta={scoreText(stats.topScore, c)} active={activeKpi === "top"} onClick={() => setActiveKpi(activeKpi === "top" ? null : "top")} />
      </div>

      {activeKpi ? (
        <KpiProductList
          c={c}
          language={language}
          config={kpiLists[activeKpi]}
          onOpen={openView}
        />
      ) : null}

      <Panel title={language === "zh" ? "今天先看这三类" : "오늘 먼저 볼 3가지"} icon={Sparkles}>
        <div className="grid gap-3 lg:grid-cols-3">
          <DecisionCard
            icon={BadgeCheck}
            title={language === "zh" ? "可以小批量测试" : "소량 테스트 가능"}
            value={testCandidateCount}
            description={language === "zh" ? "推荐指数高，且没有被淘汰。优先看这些。" : "추천 지수가 높고 제외되지 않은 상품입니다."}
            action={language === "zh" ? "筛出可测款" : "테스트 상품 보기"}
            tone="good"
            onClick={() => { setFilters({ ...emptyFilters, testRecommended: "yes" }); setPage(1); }}
          />
          <DecisionCard
            icon={AlertTriangle}
            title={language === "zh" ? "需要再复查" : "재검토 필요"}
            value={reviewNeededCount}
            description={language === "zh" ? "低利润、高竞争或评分偏低。先确认别盲测。" : "낮은 이익률, 높은 경쟁, 낮은 평점 상품입니다."}
            action={language === "zh" ? "查看复查项" : "재검토 상품 보기"}
            tone="watch"
            onClick={() => { setFilters({ ...emptyFilters, profitSpace: "low" }); setPage(1); }}
          />
          <DecisionCard
            icon={ShieldCheck}
            title={language === "zh" ? "高风险先拦截" : "고위험 먼저 차단"}
            value={riskBlockedCount}
            description={language === "zh" ? "KC 高风险、大体积或重货。没有把握先别做。" : "KC 고위험, 대형, 중량 상품입니다."}
            action={language === "zh" ? "查看风险品" : "리스크 상품 보기"}
            tone="risk"
            onClick={() => { setFilters({ ...emptyFilters, kcRiskLevel: "high" }); setPage(1); }}
          />
        </div>
      </Panel>

      <Panel title={language === "zh" ? "常用筛选" : "자주 쓰는 필터"} icon={Filter}>
        <div className="grid gap-3 lg:grid-cols-[2fr_repeat(5,1fr)]">
          <Input icon={Search} placeholder={c.filter.search} value={filters.search} onChange={(value) => setFilters({ ...filters, search: value })} />
          <Select value={localizedCategoryValue(filters.category, language)} allLabel={c.filter.category} options={categories} onChange={(value) => setFilters({ ...filters, category: value })} />
          <Select value={filters.status} allLabel={c.filter.status} options={statusOptions} labelMap={c.status} onChange={(value) => setFilters({ ...filters, status: value })} />
          <Select value={filters.kcRiskLevel} allLabel={c.filter.kc} options={kcOptions} labelMap={kcLabelMap(language)} onChange={(value) => setFilters({ ...filters, kcRiskLevel: value })} />
          <Select value={filters.profitSpace} allLabel={c.filter.profit} options={levelOptions} labelMap={c.profitSpace} onChange={(value) => setFilters({ ...filters, profitSpace: value })} />
          <Select value={filters.testRecommended} allLabel={c.filter.test} options={["yes", "no"]} labelMap={{ yes: c.yes, no: c.no }} onChange={(value) => setFilters({ ...filters, testRecommended: value })} />
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            <button className="erp-button-subtle inline-flex items-center gap-2 px-3 py-2 text-sm font-bold" onClick={() => { setFilters(emptyFilters); setPage(1); }}><RotateCcw size={15} />{c.filter.reset}</button>
            <button className="erp-button-subtle inline-flex items-center gap-2 px-3 py-2 text-sm font-bold" onClick={() => exportRows("csv")}><Download size={15} />{c.filter.exportCsv}</button>
            <button className="erp-button-primary inline-flex items-center gap-2 px-3 py-2 text-sm font-bold" onClick={() => openCreate("create")}><Plus size={15} />{c.add}</button>
          </div>
          {selectedIds.length ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="erp-chip px-3 py-2 text-xs font-bold">{c.selected} {selectedIds.length} {c.items}</span>
              <button className="erp-button-subtle px-3 py-2 text-sm font-bold" onClick={() => batchUpdate({ status: "key_product", product_status: "key_competitor", priority: "high", follow_priority: "high" })}>{c.filter.batchMark}</button>
              <button className="erp-button-subtle px-3 py-2 text-sm font-bold" onClick={() => batchUpdate({ test_recommended: true, worth_following: true, status: "ready_test", product_status: "best_reference", test_status: "pending" })}>{c.filter.batchTest}</button>
              <button className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700" onClick={batchDelete}>{c.filter.batchDelete}</button>
            </div>
          ) : null}
        </div>
      </Panel>

      <div className="hidden">
        <Panel title={language === "zh" ? "优先看这些商品" : "먼저 볼 상품"} icon={Flame}>
          <div className="grid gap-2">
            {top10.slice(0, 5).map((row, index) => (
              <button key={row.id} className="group grid grid-cols-[42px_1fr_auto] items-center gap-3 rounded-2xl border border-line bg-white/72 px-3 py-2 text-left hover:border-[#17483f]/30 hover:bg-[#eef5f0]" onClick={() => openView(row)}>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#123c35] text-sm font-black text-white">#{index + 1}</div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-ink">{row.productNameKr}</div>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted"><span>{row.category || c.none}</span><span>{c.fields.sales}: {row.monthlySales.toLocaleString()}</span><span>{c.fields.reviews}: {row.reviewCount.toLocaleString()}</span></div>
                </div>
                <div className="text-right"><ScoreBadge score={row.recommendationScore} c={c} /><div className="mt-1 text-xs font-bold text-[#17483f]">{row.testRecommended ? c.actions.addTest : c.scoreLabel.observe}</div></div>
              </button>
            ))}
          </div>
        </Panel>

        <Panel title={language === "zh" ? "需要避开的风险" : "피해야 할 리스크"} icon={AlertTriangle}>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
            {warnings.filter((item) => item.count > 0).length ? warnings.filter((item) => item.count > 0).slice(0, 5).map((item) => (
              <button key={item.key} className="group flex items-center justify-between rounded-2xl border border-line bg-white/72 px-3 py-3 text-left hover:border-red-200 hover:bg-red-50" onClick={() => { item.onClick(); setPage(1); }}>
                <span className="text-sm font-bold text-ink">{item.label}</span>
                <span className={`rounded-full px-2.5 py-1 text-xs font-black ${item.count ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>{item.count}</span>
              </button>
            )) : <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-5 text-sm font-bold text-emerald-700">{language === "zh" ? "当前没有明显高风险商品。" : "현재 뚜렷한 고위험 상품이 없습니다."}</div>}
          </div>
        </Panel>
      </div>

      <Panel title={c.modules.table} icon={BarChart3}>
        {loading ? <Skeleton /> : pageRows.length ? (
          <>
            <div className="overflow-x-auto rounded-[22px] border border-line bg-white/90 shadow-[0_14px_36px_rgba(23,72,63,0.06)]">
              <table className="w-full min-w-[1540px] table-fixed text-left text-sm">
                <colgroup>
                  <col className="w-[46px]" />
                  <col className="w-[390px]" />
                  <col className="w-[230px]" />
                  <col className="w-[230px]" />
                  <col className="w-[250px]" />
                  <col className="w-[255px]" />
                  <col className="w-[120px]" />
                  <col className="w-[150px]" />
                </colgroup>
                <thead className="sticky top-0 z-[1] border-b border-line bg-[#f3f6f2] text-[11px] uppercase tracking-[0.08em] text-muted">
                  <tr>
                    <th className="px-3 py-3.5"><input type="checkbox" checked={pageRows.length > 0 && pageRows.every((row) => selectedIds.includes(row.id))} onChange={(event) => setSelectedIds(event.target.checked ? Array.from(new Set([...selectedIds, ...pageRows.map((row) => row.id)])) : selectedIds.filter((id) => !pageRows.some((row) => row.id === id)))} /></th>
                    <th className="px-4 py-3.5">{c.table.product}</th>
                    <th className="px-4 py-3.5"><SortButton label={c.table.decision} active={sort.key === "score"} dir={sort.dir} onClick={() => toggleSort("score")} /></th>
                    <th className="px-4 py-3.5"><SortButton label={c.table.market} active={sort.key === "sales"} dir={sort.dir} onClick={() => toggleSort("sales")} /></th>
                    <th className="px-4 py-3.5"><SortButton label={c.table.profit} active={sort.key === "profitRate"} dir={sort.dir} onClick={() => toggleSort("profitRate")} /></th>
                    <th className="px-4 py-3.5">{c.table.risk} / {c.table.competition}</th>
                    <th className="px-4 py-3.5">{c.table.updated}</th>
                    <th className="px-4 py-3.5 text-right">{c.table.actions}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/70">
                  {pageRows.map((row) => (
                    <tr key={row.id} className="cursor-pointer bg-white transition hover:bg-[#f7faf7]" onClick={() => openView(row)}>
                      <td className="px-3 py-5 align-top" onClick={stop}><input type="checkbox" checked={selectedIds.includes(row.id)} onChange={(event) => setSelectedIds(event.target.checked ? [...selectedIds, row.id] : selectedIds.filter((id) => id !== row.id))} /></td>
                      <td className="px-4 py-5 align-top">
                        <div className="flex gap-3">
                          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-line bg-[#f4f6f1]">
                            {row.imageUrl ? <img className="h-full w-full object-cover" src={row.imageUrl} alt="" /> : <PackageSearch className="m-5 h-6 w-6 text-muted" />}
                          </div>
                          <div className="min-w-0">
                            <div className="line-clamp-2 font-bold leading-5 text-ink">{row.productNameKr}</div>
                            <div className="mt-1 line-clamp-1 text-xs text-muted">{row.productNameCn || "-"}</div>
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted"><span>ID: {row.coupangProductId || "-"}</span><span className="text-line">|</span><span>{row.category || "-"}</span><a href={row.coupangUrl} target="_blank" onClick={stop} className="inline-flex items-center gap-1 font-bold text-[#17483f]">{c.actions.open}<ExternalLink size={12} /></a></div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-5 align-top">
                        <DecisionSnapshot row={row} language={language} c={c} />
                      </td>
                      <td className="px-4 py-5 align-top">
                        <MarketSnapshot row={row} c={c} />
                      </td>
                      <td className="px-4 py-5 align-top">
                        <ProfitSnapshot row={row} c={c} />
                      </td>
                      <td className="px-4 py-5 align-top">
                        <RiskCompetitionSnapshot row={row} language={language} c={c} />
                      </td>
                      <td className="px-4 py-5 align-top text-xs text-muted">{formatDate(row.updatedAt)}</td>
                      <td className="px-4 py-5 align-top" onClick={stop}>
                        <div className="flex justify-end gap-1.5">
                          <IconButton label={c.actions.view} icon={<Eye size={14} />} onClick={() => openView(row)} />
                          <IconButton label={c.actions.edit} icon={<Edit3 size={14} />} onClick={() => openEdit(row)} />
                          <IconButton label={c.actions.copy} icon={<Copy size={14} />} onClick={() => duplicate(row)} />
                          <IconButton label={c.actions.open} icon={<ExternalLink size={14} />} onClick={() => window.open(row.coupangUrl, "_blank")} />
                          <IconButton label={c.actions.top} icon={<Flame size={14} />} onClick={() => patchOne(row.id, { status: "key_product", product_status: "key_competitor", priority: "high", follow_priority: "high" })} />
                          <IconButton danger label={c.actions.delete} icon={<Trash2 size={14} />} onClick={() => remove(row)} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex items-center justify-between text-sm text-muted">
              <span>{sorted.length} {c.items} · {page}/{totalPages}</span>
              <div className="flex gap-2">
                <button className="erp-button-subtle px-3 py-2 font-bold disabled:opacity-40" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>{c.pager.prev}</button>
                <button className="erp-button-subtle px-3 py-2 font-bold disabled:opacity-40" disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>{c.pager.next}</button>
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-3xl border border-dashed border-line bg-white/50 px-6 py-14 text-center">
            <PackageSearch className="mx-auto h-12 w-12 text-[#17483f]" />
            <p className="mt-4 text-lg font-bold text-ink">
              {rows.length && !sorted.length
                ? (language === "zh" ? "当前筛选没有结果，商品还在。清空筛选就能看到全部产品。" : "현재 필터 결과가 없습니다. 필터를 초기화하면 전체 상품을 볼 수 있습니다.")
                : c.empty}
            </p>
            {rows.length && !sorted.length ? (
              <button className="mt-5 erp-button-primary inline-flex items-center gap-2 px-4 py-2 font-bold" onClick={() => { setFilters(emptyFilters); setPage(1); }}>
                <RotateCcw size={16} />{c.filter.reset}
              </button>
            ) : (
              <button className="mt-5 erp-button-primary inline-flex items-center gap-2 px-4 py-2 font-bold" onClick={() => openCreate("quick")}><Plus size={16} />{c.quick}</button>
            )}
          </div>
        )}
      </Panel>

      {drawer ? (
        <Drawer
          c={c}
          language={language}
          mode={drawer}
          form={form}
          setForm={setForm}
          selected={selected}
          message={drawerMessage}
          onClose={() => setDrawer(null)}
          onSubmit={submit}
          onPatch={(patch) => selected ? patchOne(selected.id, patch) : undefined}
        />
      ) : null}
    </div>
  );
}

function topSort(a: CompetitorItem, b: CompetitorItem) {
  const points = (row: CompetitorItem) =>
    row.recommendationScore * 10 +
    (row.kcRiskLevel === "low" ? 10 : row.kcRiskLevel === "medium" ? 2 : -10) +
    (row.volumeLevel === "small" ? 6 : row.volumeLevel === "medium" ? 2 : -5) +
    (row.weightLevel === "light" ? 6 : row.weightLevel === "medium" ? 2 : -5) +
    Math.min(8, row.reviewCount / 250) +
    Math.min(8, row.monthlySales / 120);
  return points(b) - points(a);
}

function daysAgo(value: string) {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return 999;
  return (Date.now() - time) / 86400000;
}

function ratio(value: number, base: number) {
  return base > 0 ? (value / base) * 100 : 0;
}

function scoreText(score: number, c: CopyText) {
  if (score >= 8) return c.scoreLabel.strong;
  if (score >= 6) return c.scoreLabel.observe;
  if (score >= 4) return c.scoreLabel.careful;
  return c.scoreLabel.reject;
}

function kcLabel(level: RiskLevel, language: "zh" | "ko") {
  if (level === "high") return language === "zh" ? "需要" : "필요";
  if (level === "medium") return language === "zh" ? "需要确认" : "확인 필요";
  return language === "zh" ? "不需要" : "불필요";
}

function kcLabelMap(language: "zh" | "ko") {
  return {
    low: language === "zh" ? "不需要" : "불필요",
    high: language === "zh" ? "需要" : "필요"
  };
}

function csvCell(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function stop(event: MouseEvent) {
  event.stopPropagation();
}

function Drawer({
  c,
  language,
  mode,
  form,
  setForm,
  selected,
  message,
  onClose,
  onSubmit,
  onPatch
}: {
  c: CopyText;
  language: "zh" | "ko";
  mode: DrawerMode;
  form: FormState;
  setForm: (form: FormState) => void;
  selected: CompetitorItem | null;
  message: string;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
  onPatch: (patch: RawRow) => Promise<boolean | void> | boolean | void;
}) {
  const readOnly = mode === "view";
  const quick = mode === "quick";
  const item = itemFromForm(form);
  const title = mode === "view" ? c.view : mode === "edit" ? c.edit : quick ? c.quick : c.add;
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageUploadMessage, setImageUploadMessage] = useState("");
  const [imageUploadTone, setImageUploadTone] = useState<"error" | "success">("error");

  const handleImageUpload = async (file: File | null) => {
    if (!file) return;
    setUploadingImage(true);
    setImageUploadMessage("");
    setImageUploadTone("error");
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      setUploadingImage(false);
      setImageUploadMessage(language === "zh" ? "请先登录后再上传图片。" : "이미지를 업로드하려면 먼저 로그인하세요.");
      return;
    }
    const uploaded = await uploadProductImage(data.user.id, file);
    setUploadingImage(false);
    if (uploaded.error || !uploaded.url) {
      setImageUploadTone("error");
      setImageUploadMessage(productImageUploadMessage(uploaded.error || "Upload failed", language));
      return;
    }
    setForm({ ...form, imageUrl: uploaded.url });
    if (selected?.id) {
      const saved = await onPatch({
        image_url: uploaded.url,
        main_image_url: uploaded.url
      });
      if (saved === false) {
        const fallbackSaved = await onPatch({ main_image_url: uploaded.url });
        if (fallbackSaved === false) {
          setImageUploadTone("error");
          setImageUploadMessage(language === "zh" ? "图片已上传，但没有写入商品记录。请确认已执行字段升级 SQL。" : "이미지는 업로드되었지만 상품 기록에 저장되지 않았습니다. 필드 업그레이드 SQL 실행 여부를 확인하세요.");
          return;
        }
      }
      setImageUploadTone("success");
      setImageUploadMessage(language === "zh" ? "图片已上传并保存到当前商品。" : "이미지가 업로드되어 현재 상품에 저장되었습니다.");
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-[#071512]/45 backdrop-blur-sm" onClick={onClose}>
      <form className="h-full w-full max-w-5xl overflow-y-auto border-l border-white/40 bg-[#f7f8f3] p-5 shadow-lift md:p-6" onClick={(event) => event.stopPropagation()} onSubmit={onSubmit}>
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <div className="premium-section-eyebrow">COUPANG ANALYSIS DRAWER</div>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-ink">{title}</h2>
          </div>
          <button type="button" className="erp-button-subtle p-2" onClick={onClose}><X size={18} /></button>
        </div>

        {readOnly && selected ? <QuickAnalysis c={c} language={language} row={selected} onPatch={onPatch} /> : null}

        {message ? <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{message}</div> : null}

        {!readOnly ? (
          <>
            <FormSection title={language === "zh" ? "商品基础信息" : "상품 기본 정보"}>
              <Field label={c.fields.url} value={form.coupangUrl} required readOnly={readOnly} onChange={(value) => setForm({ ...form, coupangUrl: value })} className="md:col-span-2" />
              <Field label={c.fields.productNameKr} value={form.productNameKr} required readOnly={readOnly} onChange={(value) => setForm({ ...form, productNameKr: value })} />
              <Field label={c.fields.productNameCn} value={form.productNameCn} readOnly={readOnly} onChange={(value) => setForm({ ...form, productNameCn: value })} />
              <Field label={c.fields.productId} value={form.coupangProductId} readOnly={readOnly} onChange={(value) => setForm({ ...form, coupangProductId: value })} />
              <ImageUploadField
                label={c.fields.image}
                uploadLabel={language === "zh" ? "上传图片" : "이미지 업로드"}
                uploadingLabel={language === "zh" ? "上传中..." : "업로드 중..."}
                clearLabel={language === "zh" ? "清除图片" : "이미지 지우기"}
                value={form.imageUrl}
                readOnly={readOnly}
                uploading={uploadingImage}
                message={imageUploadMessage}
                messageTone={imageUploadTone}
                onChange={(value) => setForm({ ...form, imageUrl: value })}
                onFile={handleImageUpload}
                className="md:col-span-2"
              />
              <CategoryField label={c.fields.category} value={form.category} language={language} disabled={readOnly} onChange={(value) => setForm({ ...form, category: value })} />
              <Field label={c.fields.brand} value={form.brand} readOnly={readOnly} onChange={(value) => setForm({ ...form, brand: value })} />
              <Field label={c.fields.store} value={form.storeName} readOnly={readOnly} onChange={(value) => setForm({ ...form, storeName: value })} />
            </FormSection>

            <FormSection title={language === "zh" ? "市场表现" : "시장 성과"}>
              <Field label={c.fields.price} type="number" value={form.currentPrice} readOnly={readOnly} onChange={(value) => setForm({ ...form, currentPrice: value, targetPrice: form.targetPrice || value })} />
              <Field label={c.fields.sales} type="number" value={form.monthlySales} readOnly={readOnly} onChange={(value) => setForm({ ...form, monthlySales: value })} />
              <Field label={c.fields.reviews} type="number" value={form.reviewCount} readOnly={readOnly} onChange={(value) => setForm({ ...form, reviewCount: value })} />
              <Field label={c.fields.rating} type="number" value={form.rating} readOnly={readOnly} onChange={(value) => setForm({ ...form, rating: value })} />
              <SelectField label={c.fields.rocket} value={form.rocketType} disabled={readOnly} options={rocketOptions} labelMap={c.rocket} onChange={(value) => setForm({ ...form, rocketType: value as RocketType })} />
            </FormSection>

            <FormSection title={language === "zh" ? "风险与竞争判断" : "리스크 및 경쟁 판단"}>
              <KcRequirementField value={form.kcRiskLevel === "high" ? "high" : "low"} language={language} disabled={readOnly} onChange={(value) => setForm({ ...form, kcRiskLevel: value })} />
              <SelectField label={c.filter.volume} value={form.volumeLevel} disabled={readOnly} options={volumeOptions} labelMap={c.volume} onChange={(value) => setForm({ ...form, volumeLevel: value as VolumeLevel })} />
              <SelectField label={c.filter.weight} value={form.weightLevel} disabled={readOnly} options={weightOptions} labelMap={c.weight} onChange={(value) => setForm({ ...form, weightLevel: value as WeightLevel })} />
              <SelectField label={language === "zh" ? "易碎风险" : "파손 리스크"} value={form.fragileRisk} disabled={readOnly} options={levelOptions} labelMap={c.risk} onChange={(value) => setForm({ ...form, fragileRisk: value as RiskLevel })} />
              <SelectField label={language === "zh" ? "退货风险" : "반품 리스크"} value={form.returnRisk} disabled={readOnly} options={levelOptions} labelMap={c.risk} onChange={(value) => setForm({ ...form, returnRisk: value as RiskLevel })} />
              <SelectField label={c.filter.competition} value={form.competitionLevel} disabled={readOnly} options={levelOptions} labelMap={c.risk} onChange={(value) => setForm({ ...form, competitionLevel: value as RiskLevel })} />
              <Field label={language === "zh" ? "同类商品数量" : "유사 상품 수"} type="number" value={form.similarProductCount} readOnly={readOnly} onChange={(value) => setForm({ ...form, similarProductCount: value })} />
              <SelectField label={language === "zh" ? "头部品牌垄断程度" : "상위 브랜드 독점도"} value={form.brandMonopolyLevel} disabled={readOnly} options={levelOptions} labelMap={c.risk} onChange={(value) => setForm({ ...form, brandMonopolyLevel: value as RiskLevel })} />
            </FormSection>

            <FormSection title={language === "zh" ? "利润与测试决策" : "수익 및 테스트 의사결정"}>
              <Field label={c.fields.purchase} type="number" value={form.estimatedPurchasePrice} readOnly={readOnly} onChange={(value) => setForm({ ...form, estimatedPurchasePrice: value })} />
              <Field label={c.fields.logistics} type="number" value={form.estimatedLogisticsCost} readOnly={readOnly} onChange={(value) => setForm({ ...form, estimatedLogisticsCost: value })} />
              <Field label={c.fields.fee} type="number" value={form.coupangFeeRate} readOnly={readOnly} onChange={(value) => setForm({ ...form, coupangFeeRate: value })} />
              <Field label={c.fields.ad} type="number" value={form.estimatedAdCost} readOnly={readOnly} onChange={(value) => setForm({ ...form, estimatedAdCost: value })} />
              <Field label={c.fields.score} type="number" value={form.recommendationScore} readOnly={readOnly} onChange={(value) => setForm({ ...form, recommendationScore: value })} />
              <Field label={c.fields.testQty} type="number" value={form.suggestedTestQuantity} readOnly={readOnly} onChange={(value) => setForm({ ...form, suggestedTestQuantity: value })} />
              <SelectField label={language === "zh" ? "优先级" : "우선순위"} value={form.priority} disabled={readOnly} options={priorityOptions} labelMap={c.priority} onChange={(value) => setForm({ ...form, priority: value as Priority })} />
              <SelectField label={language === "zh" ? "当前状态" : "현재 상태"} value={form.status} disabled={readOnly} options={statusOptions} labelMap={c.status} onChange={(value) => setForm({ ...form, status: value as DecisionStatus })} />
              <DecisionToggleRow
                language={language}
                className="md:col-span-3"
                items={[
                  { label: c.fields.chinaFit, description: language === "zh" ? "中国供应链可开发" : "중국 공급망 개발 가능", checked: form.chinaSourcingFit, onChange: (value) => setForm({ ...form, chinaSourcingFit: value }) },
                  { label: c.fields.brandFit, description: language === "zh" ? "适合做品牌包装" : "브랜드 포장 적합", checked: form.brandingFit, onChange: (value) => setForm({ ...form, brandingFit: value }) },
                  { label: c.filter.test, description: language === "zh" ? "加入新品测试判断" : "신상품 테스트 판단", checked: form.testRecommended, onChange: (value) => setForm({ ...form, testRecommended: value }) }
                ]}
              />
              <Field label={c.fields.targetPrice} type="number" value={form.targetPrice} readOnly={readOnly} onChange={(value) => setForm({ ...form, targetPrice: value })} />
              <Field label={c.fields.owner} value={form.testOwner} readOnly={readOnly} onChange={(value) => setForm({ ...form, testOwner: value })} />
              <Field label={c.fields.launchDate} type="date" value={form.plannedLaunchDate} readOnly={readOnly} onChange={(value) => setForm({ ...form, plannedLaunchDate: value })} />
              <div className="rounded-2xl border border-line bg-[#eef5f0] px-3 py-2">
                <div className="text-xs font-bold text-muted">{c.fields.profit}</div>
                <div className="mt-1 text-xl font-black text-[#17483f]">{won(item.estimatedProfit)} / {percent(item.estimatedProfitRate)}</div>
              </div>
            </FormSection>

            <FormSection title={language === "zh" ? "产品规格与装箱信息" : "제품 사양 및 포장 정보"}>
              <Field label={language === "zh" ? "产品规格尺寸" : "제품 규격/사이즈"} value={form.productSpecSize} readOnly={readOnly} onChange={(value) => setForm({ ...form, productSpecSize: value })} />
              <Field label={language === "zh" ? "容量" : "용량"} value={form.capacity} readOnly={readOnly} onChange={(value) => setForm({ ...form, capacity: value })} />
              <Field label={language === "zh" ? "颜色" : "색상"} value={form.color} readOnly={readOnly} onChange={(value) => setForm({ ...form, color: value })} />
              <Field label={language === "zh" ? "材质" : "소재"} value={form.material} readOnly={readOnly} onChange={(value) => setForm({ ...form, material: value })} />
              <Field label={language === "zh" ? "包装尺寸" : "포장 사이즈"} value={form.packageSize} readOnly={readOnly} onChange={(value) => setForm({ ...form, packageSize: value })} />
              <Field label={language === "zh" ? "包装数量" : "포장 수량"} value={form.packageQuantity} readOnly={readOnly} onChange={(value) => setForm({ ...form, packageQuantity: value })} />
              <Field label={language === "zh" ? "外箱尺寸" : "박스 사이즈"} value={form.cartonSize} readOnly={readOnly} onChange={(value) => setForm({ ...form, cartonSize: value })} />
              <Field label={language === "zh" ? "外箱装箱数" : "박스 입수"} value={form.cartonQuantity} readOnly={readOnly} onChange={(value) => setForm({ ...form, cartonQuantity: value })} />
              <Field label="20GP" value={form.gp20} readOnly={readOnly} onChange={(value) => setForm({ ...form, gp20: value })} />
              <Field label="40HQ" value={form.hq40} readOnly={readOnly} onChange={(value) => setForm({ ...form, hq40: value })} />
            </FormSection>

            {!quick ? (
              <FormSection title={language === "zh" ? "备注与行动" : "메모 및 액션"}>
                <TextArea label={c.fields.reason} value={form.recommendationReason} readOnly={readOnly} onChange={(value) => setForm({ ...form, recommendationReason: value })} />
                <TextArea label={c.fields.risks} value={form.riskPoints} readOnly={readOnly} onChange={(value) => setForm({ ...form, riskPoints: value })} />
                <TextArea label={c.fields.nextAction} value={form.nextAction} readOnly={readOnly} onChange={(value) => setForm({ ...form, nextAction: value })} />
                <TextArea label={c.fields.notes} value={form.notes} readOnly={readOnly} onChange={(value) => setForm({ ...form, notes: value })} className="md:col-span-3" />
              </FormSection>
            ) : null}

            <div className="mt-6 flex justify-end gap-2">
              <button type="button" className="erp-button-subtle px-4 py-2 font-bold" onClick={onClose}>{c.actions.cancel}</button>
              <button type="submit" className="erp-button-primary px-4 py-2 font-bold">{c.actions.save}</button>
            </div>
          </>
        ) : null}
      </form>
    </div>
  );
}

function QuickAnalysis({ c, language, row, onPatch }: { c: CopyText; language: "zh" | "ko"; row: CompetitorItem; onPatch: (patch: RawRow) => Promise<boolean | void> | boolean | void }) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 rounded-[24px] border border-line bg-white/80 p-4 shadow-card md:grid-cols-[180px_1fr]">
        <div className="aspect-square overflow-hidden rounded-2xl border border-line bg-[#f4f6f1]">
          {row.imageUrl ? <img className="h-full w-full object-cover" src={row.imageUrl} alt="" /> : <PackageSearch className="m-14 h-14 w-14 text-muted" />}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap gap-2">
            <ScoreBadge score={row.recommendationScore} c={c} />
            <RiskTag label={`KC ${kcLabel(row.kcRiskLevel, language)}`} level={row.kcRiskLevel} />
            <Tag tone={row.testRecommended ? "good" : "neutral"}>{row.testRecommended ? c.yes : c.no}</Tag>
            <Tag>{c.status[row.status]}</Tag>
          </div>
          <h3 className="mt-4 text-2xl font-semibold tracking-tight text-ink">{row.productNameKr}</h3>
          <p className="mt-2 text-sm text-muted">{row.productNameCn || row.category || "-"}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            <Mini label={c.fields.price} value={won(row.currentPrice)} />
            <Mini label={c.fields.sales} value={row.monthlySales.toLocaleString()} />
            <Mini label={c.fields.reviews} value={row.reviewCount.toLocaleString()} />
            <Mini label={c.fields.rating} value={row.rating.toFixed(1)} />
          </div>
          <a className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#17483f] px-4 py-2 text-sm font-bold text-white" href={row.coupangUrl} target="_blank">{c.actions.open}<ExternalLink size={15} /></a>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <AnalysisBlock title={language === "zh" ? "风险分析" : "리스크 분석"}>
          <RiskTag label={`KC ${kcLabel(row.kcRiskLevel, language)}`} level={row.kcRiskLevel} />
          <Tag>{c.filter.volume}: {c.volume[row.volumeLevel]}</Tag>
          <Tag>{c.filter.weight}: {c.weight[row.weightLevel]}</Tag>
          <RiskTag label={`${language === "zh" ? "易碎" : "파손"} ${c.risk[row.fragileRisk]}`} level={row.fragileRisk} />
          <RiskTag label={`${language === "zh" ? "退货" : "반품"} ${c.risk[row.returnRisk]}`} level={row.returnRisk} />
        </AnalysisBlock>
        <AnalysisBlock title={language === "zh" ? "利润测算" : "수익 계산"}>
          <Mini label={c.fields.purchase} value={won(row.estimatedPurchasePrice)} />
          <Mini label={c.fields.logistics} value={won(row.estimatedLogisticsCost)} />
          <Mini label={c.fields.fee} value={percent(row.coupangFeeRate)} />
          <Mini label={c.fields.profit} value={`${won(row.estimatedProfit)} / ${percent(row.estimatedProfitRate)}`} />
        </AnalysisBlock>
        <AnalysisBlock title={language === "zh" ? "适配判断" : "적합성 판단"}>
          <Tag tone={row.chinaSourcingFit ? "good" : "neutral"}>{c.fields.chinaFit}: {row.chinaSourcingFit ? c.yes : c.no}</Tag>
          <Tag tone={row.brandingFit ? "good" : "neutral"}>{c.fields.brandFit}: {row.brandingFit ? c.yes : c.no}</Tag>
          <Tag>{language === "zh" ? "测试数量" : "테스트 수량"}: {row.suggestedTestQuantity || "-"}</Tag>
        </AnalysisBlock>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <TextBlock title={c.fields.reason} value={row.recommendationReason} />
        <TextBlock title={c.fields.risks} value={row.riskPoints} />
        <TextBlock title={c.fields.nextAction} value={row.nextAction} />
      </div>

      <div className="sticky bottom-0 -mx-5 flex flex-wrap justify-end gap-2 border-t border-line bg-[#f7f8f3]/92 px-5 py-4 backdrop-blur">
        <button type="button" className="erp-button-subtle px-4 py-2 text-sm font-bold" onClick={() => onPatch({ status: "key_product", product_status: "key_competitor", priority: "high", follow_priority: "high" })}>{c.actions.top}</button>
        <button type="button" className="erp-button-primary px-4 py-2 text-sm font-bold" onClick={() => onPatch({ test_recommended: true, worth_following: true, status: "ready_test", product_status: "best_reference", test_status: "pending" })}>{c.actions.addTest}</button>
        <button type="button" className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-bold text-red-700" onClick={() => onPatch({ status: "eliminated", product_status: "eliminated", test_recommended: false, worth_following: false })}>{c.actions.eliminate}</button>
        <a className="erp-button-subtle inline-flex items-center gap-2 px-4 py-2 text-sm font-bold" href={row.coupangUrl} target="_blank">{c.actions.open}<ExternalLink size={15} /></a>
      </div>
    </div>
  );
}

function Panel({ title, icon: Icon, children }: { title: string; icon: LucideIcon; children: React.ReactNode }) {
  return <section className="rounded-[24px] border border-line bg-card/90 p-5 shadow-card backdrop-blur"><div className="mb-4 flex items-center gap-2"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#e8f1ed] text-[#17483f]"><Icon size={18} /></div><h2 className="text-xl font-semibold tracking-tight text-ink">{title}</h2></div>{children}</section>;
}

function KpiCard({
  icon: Icon,
  label,
  value,
  trend,
  meta,
  active = false,
  onClick
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  trend: string;
  meta: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className={`premium-dashboard-card w-full p-4 text-left transition hover:-translate-y-0.5 hover:border-[#17483f]/30 hover:shadow-lift ${active ? "border-[#17483f]/40 bg-[#eef5f0] ring-2 ring-[#17483f]/10" : ""}`}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e7f0ec] text-[#17483f]"><Icon size={19} /></div>
        <div className="min-w-0">
          <div className="text-xs font-bold text-muted">{label}</div>
          <div className="premium-number mt-1 truncate text-2xl font-black text-ink">{value}</div>
          <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-bold"><span className="rounded-full bg-[#eef5f0] px-2 py-1 text-[#17483f]">{trend}</span><span className="rounded-full bg-white px-2 py-1 text-muted">{meta}</span></div>
        </div>
      </div>
    </button>
  );
}

function KpiProductList({
  c,
  language,
  config,
  onOpen
}: {
  c: CopyText;
  language: "zh" | "ko";
  config: { title: string; subtitle: string; rows: CompetitorItem[]; cta: string; onFilter: () => void };
  onOpen: (row: CompetitorItem) => void;
}) {
  return (
    <section className="rounded-[24px] border border-[#d9e2dc] bg-white/92 p-4 shadow-card">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-lg font-black text-ink">{config.title}</h3>
          <p className="mt-1 text-sm text-muted">{config.subtitle}</p>
        </div>
        <button type="button" className="erp-button-subtle px-3 py-2 text-sm font-bold" onClick={config.onFilter}>{config.cta}</button>
      </div>
      {config.rows.length ? (
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
          {config.rows.map((row) => (
            <button
              key={row.id}
              type="button"
              className="group rounded-2xl border border-line bg-[#fbfcfb] p-3 text-left transition hover:border-[#17483f]/30 hover:bg-[#f4f8f4]"
              onClick={() => onOpen(row)}
            >
              <div className="flex gap-3">
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-line bg-[#f4f6f1]">
                  {row.imageUrl ? <img className="h-full w-full object-cover" src={row.imageUrl} alt="" /> : <PackageSearch className="m-3 h-6 w-6 text-muted" />}
                </div>
                <div className="min-w-0">
                  <div className="line-clamp-2 text-sm font-black leading-5 text-ink group-hover:text-[#17483f]">{row.productNameKr}</div>
                  <div className="mt-1 truncate text-xs text-muted">{row.category || "-"}</div>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <MiniMetric label={c.fields.profit} value={`${won(row.estimatedProfit)} / ${percent(row.estimatedProfitRate)}`} />
                <MiniMetric label={c.fields.score} value={row.recommendationScore.toFixed(1)} />
                <MiniMetric label={c.fields.sales} value={row.monthlySales.toLocaleString()} />
                <MiniMetric label="KC" value={kcLabel(row.kcRiskLevel, language)} />
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-line bg-[#fbfcfb] px-4 py-8 text-center text-sm font-bold text-muted">
          {language === "zh" ? "暂无符合条件的商品" : "조건에 맞는 상품이 없습니다."}
        </div>
      )}
    </section>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-white px-2 py-1.5">
      <div className="truncate text-[10px] font-bold text-muted">{label}</div>
      <div className="mt-0.5 truncate font-black tabular-nums text-ink">{value}</div>
    </div>
  );
}

function DecisionCard({ icon: Icon, title, value, description, action, tone, onClick }: { icon: LucideIcon; title: string; value: number; description: string; action: string; tone: "good" | "watch" | "risk"; onClick: () => void }) {
  const toneStyle =
    tone === "good"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : tone === "watch"
        ? "border-yellow-200 bg-yellow-50 text-yellow-800"
        : "border-red-200 bg-red-50 text-red-700";
  return (
    <button type="button" className="group rounded-2xl border border-line bg-white/76 p-4 text-left shadow-card hover:border-[#17483f]/30 hover:bg-[#f8fbf8]" onClick={onClick}>
      <div className="flex items-start justify-between gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl border ${toneStyle}`}>
          <Icon size={18} />
        </div>
        <div className="text-3xl font-black tabular-nums text-ink">{value.toLocaleString()}</div>
      </div>
      <div className="mt-3 text-base font-black text-ink">{title}</div>
      <p className="mt-1 min-h-10 text-sm leading-5 text-muted">{description}</p>
      <div className="mt-3 text-xs font-black text-[#17483f] group-hover:underline">{action}</div>
    </button>
  );
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="mb-5 rounded-[20px] border border-line bg-white/76 p-4 shadow-card"><h3 className="mb-4 text-lg font-semibold text-ink">{title}</h3><div className="grid gap-3 md:grid-cols-3">{children}</div></section>;
}

function Field({ label, value, onChange, type = "text", required = false, readOnly = false, className = "" }: { label: string; value: string; onChange: (value: string) => void; type?: "text" | "number" | "date"; required?: boolean; readOnly?: boolean; className?: string }) {
  return <label className={className}><span className="mb-1 block text-xs font-bold text-muted">{label}{required ? " *" : ""}</span><input className="w-full" type={type} min={type === "number" ? "0" : undefined} step={type === "number" ? "0.01" : undefined} value={value} required={required} disabled={readOnly} onChange={(event) => onChange(event.target.value)} /></label>;
}

function ImageUploadField({
  label,
  uploadLabel,
  uploadingLabel,
  clearLabel,
  value,
  readOnly = false,
  uploading = false,
  message = "",
  messageTone = "error",
  onChange,
  onFile,
  className = ""
}: {
  label: string;
  uploadLabel: string;
  uploadingLabel: string;
  clearLabel: string;
  value: string;
  readOnly?: boolean;
  uploading?: boolean;
  message?: string;
  messageTone?: "error" | "success";
  onChange: (value: string) => void;
  onFile: (file: File | null) => void;
  className?: string;
}) {
  return (
    <div className={className}>
      <span className="mb-1 block text-xs font-bold text-muted">{label}</span>
      <div className="grid gap-3 rounded-2xl border border-line bg-white/70 p-3 md:grid-cols-[96px_1fr]">
        <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border border-line bg-[#f4f6f1]">
          {value ? <img className="h-full w-full object-cover" src={value} alt="" /> : <PackageSearch className="h-8 w-8 text-muted" />}
        </div>
        <div className="min-w-0 space-y-2">
          <input className="w-full" value={value} disabled={readOnly} onChange={(event) => onChange(event.target.value)} placeholder="https://..." />
          <div className="flex flex-wrap items-center gap-2">
            <label className={`erp-button-subtle inline-flex cursor-pointer items-center gap-2 px-3 py-2 text-sm font-bold ${readOnly || uploading ? "pointer-events-none opacity-50" : ""}`}>
              <Upload size={15} />
              {uploading ? uploadingLabel : uploadLabel}
              <input
                className="hidden"
                type="file"
                accept="image/*"
                disabled={readOnly || uploading}
                onChange={(event) => onFile(event.target.files?.[0] ?? null)}
              />
            </label>
            {value ? (
              <button type="button" className="erp-button-subtle px-3 py-2 text-sm font-bold" disabled={readOnly || uploading} onClick={() => onChange("")}>
                {clearLabel}
              </button>
            ) : null}
          </div>
          {message ? <p className={`text-xs font-semibold ${messageTone === "success" ? "text-emerald-700" : "text-red-700"}`}>{message}</p> : null}
        </div>
      </div>
    </div>
  );
}

function TextArea({ label, value, onChange, readOnly = false, className = "" }: { label: string; value: string; onChange: (value: string) => void; readOnly?: boolean; className?: string }) {
  return <label className={className}><span className="mb-1 block text-xs font-bold text-muted">{label}</span><textarea className="min-h-24 w-full" value={value} disabled={readOnly} onChange={(event) => onChange(event.target.value)} /></label>;
}

function SelectField({ label, value, options, labelMap, onChange, disabled = false }: { label: string; value: string; options: readonly string[]; labelMap: Record<string, string>; onChange: (value: string) => void; disabled?: boolean }) {
  return <label><span className="mb-1 block text-xs font-bold text-muted">{label}</span><select className="w-full" value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option} value={option}>{labelMap[option]}</option>)}</select></label>;
}

function CategoryField({ label, value, language, onChange, disabled = false }: { label: string; value: string; language: "zh" | "ko"; onChange: (value: string) => void; disabled?: boolean }) {
  const fixed: string[] = productCategoryOptions.map((option) => option[language]);
  const current = localizedCategoryValue(value, language);
  const options = current && !fixed.includes(current) ? [current, ...fixed] : fixed;
  return (
    <label>
      <span className="mb-1 block text-xs font-bold text-muted">{label}</span>
      <select className="w-full" value={current} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
        <option value="">{label}</option>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

function KcRequirementField({ value, language, disabled = false, onChange }: { value: RiskLevel; language: "zh" | "ko"; disabled?: boolean; onChange: (value: RiskLevel) => void }) {
  const options: Array<{ value: RiskLevel; label: string; hint: string }> = [
    {
      value: "low",
      label: language === "zh" ? "不需要" : "불필요",
      hint: language === "zh" ? "无需 KC 认证" : "KC 인증 불필요"
    },
    {
      value: "high",
      label: language === "zh" ? "需要" : "필요",
      hint: language === "zh" ? "需要 KC 认证" : "KC 인증 필요"
    }
  ];
  return (
    <div>
      <span className="mb-1 block text-xs font-bold text-muted">KC</span>
      <div className="grid grid-cols-2 gap-2">
        {options.map((option) => {
          const active = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              disabled={disabled}
              className={`rounded-2xl border px-3 py-3 text-left transition ${active ? "border-[#17483f] bg-[#e8f1ed] text-[#17483f]" : "border-line bg-white/70 text-ink hover:border-[#17483f]/30"} ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
              onClick={() => onChange(option.value)}
            >
              <span className="block text-sm font-black">{option.label}</span>
              <span className="mt-1 block text-xs font-semibold text-muted">{option.hint}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Select({ value, options, allLabel, labelMap, onChange }: { value: string; options: readonly string[]; allLabel: string; labelMap?: Record<string, string>; onChange: (value: string) => void }) {
  return <select className="w-full" value={value} onChange={(event) => onChange(event.target.value)}><option value="">{allLabel}</option>{options.map((option) => <option key={option} value={option}>{labelMap?.[option] ?? option}</option>)}</select>;
}

function Input({ value, onChange, placeholder, type = "text", icon: Icon }: { value: string; onChange: (value: string) => void; placeholder: string; type?: "text" | "number" | "date"; icon?: LucideIcon }) {
  return <label className="relative block">{Icon ? <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" /> : null}<input className={`w-full ${Icon ? "pl-9" : ""}`} type={type} min={type === "number" ? "0" : undefined} step={type === "number" ? "0.01" : undefined} placeholder={placeholder} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function Toggle({ label, checked, disabled, onChange }: { label: string; checked: boolean; disabled?: boolean; onChange: (value: boolean) => void }) {
  return <label className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-white/70 px-3 py-2 text-sm font-bold text-ink"><span>{label}</span><input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} /></label>;
}

function DecisionToggleRow({
  items,
  language,
  className = ""
}: {
  items: Array<{ label: string; description: string; checked: boolean; onChange: (value: boolean) => void }>;
  language: "zh" | "ko";
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="mb-1 text-xs font-bold text-muted">{language === "zh" ? "关键判断" : "핵심 판단"}</div>
      <div className="grid gap-2 md:grid-cols-3">
        {items.map((item) => (
          <button
            key={item.label}
            type="button"
            className={`flex min-h-[74px] items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition ${item.checked ? "border-[#17483f] bg-[#e8f1ed] text-[#17483f]" : "border-line bg-white/72 text-ink hover:border-[#17483f]/30"}`}
            onClick={() => item.onChange(!item.checked)}
          >
            <span className="min-w-0">
              <span className="block text-sm font-black">{item.label}</span>
              <span className="mt-1 block text-xs font-semibold text-muted">{item.description}</span>
            </span>
            <span className={`relative h-5 w-9 shrink-0 rounded-full transition ${item.checked ? "bg-[#17483f]" : "bg-[#cfd8d1]"}`}>
              <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${item.checked ? "left-[18px]" : "left-0.5"}`} />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Tag({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "good" | "watch" | "risk" }) {
  const styles = tone === "good" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : tone === "risk" ? "border-red-200 bg-red-50 text-red-700" : tone === "watch" ? "border-yellow-200 bg-yellow-50 text-yellow-800" : "border-[#17483f]/15 bg-[#e8f1ed] text-[#17483f]";
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold ${styles}`}>{children}</span>;
}

function RiskTag({ label, level }: { label: string; level: RiskLevel }) {
  return <Tag tone={level === "low" ? "good" : level === "medium" ? "watch" : "risk"}>{label}</Tag>;
}

function ScoreBadge({ score, c }: { score: number; c: CopyText }) {
  const tone = score >= 8 ? "good" : score >= 6 ? "watch" : score >= 4 ? "neutral" : "risk";
  return <Tag tone={tone}><Gauge size={12} className="mr-1" />{score.toFixed(1)} · {scoreText(score, c)}</Tag>;
}

function DecisionSnapshot({ row, language, c }: { row: CompetitorItem; language: "zh" | "ko"; c: CopyText }) {
  const decision = decisionView(row, language);
  return (
    <div className={`rounded-2xl border px-3 py-3 ${decision.className}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-black uppercase tracking-[0.08em] opacity-70">{language === "zh" ? "决策" : "Decision"}</div>
          <div className="mt-1 text-base font-black leading-5">{decision.title}</div>
        </div>
        <div className="rounded-full bg-white/70 px-2 py-1 text-xs font-black tabular-nums">{row.recommendationScore.toFixed(1)}</div>
      </div>
      <div className="mt-3 grid gap-1.5 text-xs font-bold">
        <div className="flex items-center justify-between gap-3"><span className="opacity-70">{c.fields.testQty}</span><span>{row.testRecommended ? row.suggestedTestQuantity || "-" : "-"}</span></div>
        <div className="flex items-center justify-between gap-3"><span className="opacity-70">{language === "zh" ? "优先级" : "Priority"}</span><span>{c.priority[row.priority]}</span></div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Tag tone={row.status === "ready_test" ? "good" : row.status === "eliminated" ? "risk" : row.status === "key_product" ? "watch" : "neutral"}>{c.status[row.status]}</Tag>
      </div>
    </div>
  );
}

function MarketSnapshot({ row, c }: { row: CompetitorItem; c: CopyText }) {
  return (
    <div className="grid gap-2">
      <div className="rounded-2xl border border-line bg-[#fbfcfb] px-3 py-2.5">
        <Metric label={c.fields.price} value={won(row.currentPrice)} strong />
        <Metric label={c.fields.sales} value={row.monthlySales.toLocaleString()} />
        <Metric label={c.fields.reviews} value={row.reviewCount.toLocaleString()} />
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="inline-flex items-center gap-1 rounded-full border border-[#e4d4ae] bg-[#fff8e8] px-2.5 py-1 font-black text-[#8a6b24]"><Star size={13} />{row.rating.toFixed(1)}</span>
        <Tag>{c.rocket[row.rocketType]}</Tag>
      </div>
    </div>
  );
}

function ProfitSnapshot({ row, c }: { row: CompetitorItem; c: CopyText }) {
  const good = row.estimatedProfit >= 0 && row.estimatedProfitRate >= 20;
  const warn = row.estimatedProfit >= 0 && row.estimatedProfitRate < 20;
  return (
    <div className={`rounded-2xl border px-3 py-3 ${good ? "border-emerald-200 bg-emerald-50/70" : warn ? "border-yellow-200 bg-yellow-50/70" : "border-red-200 bg-red-50/70"}`}>
      <div className="text-[11px] font-black uppercase tracking-[0.08em] text-muted">{c.fields.profit}</div>
      <div className={`mt-1 text-lg font-black tabular-nums ${row.estimatedProfit >= 0 ? "text-[#17483f]" : "text-red-700"}`}>{won(row.estimatedProfit)}</div>
      <div className={`text-sm font-black tabular-nums ${row.estimatedProfitRate >= 20 ? "text-[#17483f]" : row.estimatedProfitRate >= 0 ? "text-yellow-800" : "text-red-700"}`}>{percent(row.estimatedProfitRate)}</div>
      <div className="mt-2 grid gap-1">
        <Metric label={c.fields.purchase} value={won(row.estimatedPurchasePrice)} />
        <Metric label={c.fields.logistics} value={won(row.estimatedLogisticsCost)} />
        <Metric label={c.fields.fee} value={percent(row.coupangFeeRate)} />
        <Metric label={c.fields.ad} value={won(row.estimatedAdCost)} />
      </div>
    </div>
  );
}

function RiskCompetitionSnapshot({ row, language, c }: { row: CompetitorItem; language: "zh" | "ko"; c: CopyText }) {
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-1.5">
        <RiskTag label={`KC ${kcLabel(row.kcRiskLevel, language)}`} level={row.kcRiskLevel} />
        <RiskTag label={`${language === "zh" ? "竞争" : "경쟁"} ${c.risk[row.competitionLevel]}`} level={row.competitionLevel} />
        <RiskTag label={`${language === "zh" ? "破损" : "파손"} ${c.risk[row.fragileRisk]}`} level={row.fragileRisk} />
        <RiskTag label={`${language === "zh" ? "退货" : "반품"} ${c.risk[row.returnRisk]}`} level={row.returnRisk} />
      </div>
      <div className="rounded-2xl border border-line bg-[#fbfcfb] px-3 py-2">
        <Metric label={language === "zh" ? "同类商品" : "유사 상품"} value={row.similarProductCount.toLocaleString()} />
        <Metric label={language === "zh" ? "品牌垄断" : "브랜드 독점"} value={c.risk[row.brandMonopolyLevel]} />
        <Metric label={c.filter.volume} value={c.volume[row.volumeLevel]} />
        <Metric label={c.filter.weight} value={c.weight[row.weightLevel]} />
      </div>
    </div>
  );
}

function decisionView(row: CompetitorItem, language: "zh" | "ko") {
  const blocked = row.status === "eliminated" || row.recommendationScore < 4 || row.estimatedProfit < 0;
  const strong = !blocked && (row.testRecommended || row.recommendationScore >= 8) && row.estimatedProfitRate >= 20 && row.competitionLevel !== "high";
  const watch = !blocked && (row.recommendationScore >= 6 || row.estimatedProfitRate >= 20);
  if (blocked) {
    return {
      title: language === "zh" ? "不建议做" : "비추천",
      className: "border-red-200 bg-red-50/80 text-red-800"
    };
  }
  if (strong) {
    return {
      title: language === "zh" ? "建议测试" : "테스트 추천",
      className: "border-emerald-200 bg-emerald-50/80 text-emerald-800"
    };
  }
  if (watch) {
    return {
      title: language === "zh" ? "谨慎观察" : "관찰 필요",
      className: "border-yellow-200 bg-yellow-50/80 text-yellow-900"
    };
  }
  return {
    title: language === "zh" ? "暂不优先" : "우선순위 낮음",
    className: "border-line bg-[#f7f8f5] text-ink"
  };
}

function IconButton({ label, icon, onClick, danger = false }: { label: string; icon: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return <button type="button" title={label} className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border ${danger ? "border-red-200 bg-red-50 text-red-700" : "border-line bg-white/80 text-ink hover:bg-[#eef4ef]"}`} onClick={onClick}>{icon}</button>;
}

function Mini({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-line bg-[#fbfcfb] px-3 py-2"><div className="text-xs text-muted">{label}</div><div className="mt-1 truncate font-bold text-ink">{value}</div></div>;
}

function Metric({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <div className="flex items-center justify-between gap-3 text-xs"><span className="text-muted">{label}</span><span className={`tabular-nums ${strong ? "font-black text-ink" : "font-bold text-ink"}`}>{value}</span></div>;
}

function SortButton({ label, active, dir, onClick }: { label: string; active: boolean; dir: SortDir; onClick: () => void }) {
  return <button className={`inline-flex items-center gap-1 font-black ${active ? "text-[#17483f]" : ""}`} onClick={onClick}>{label}<ArrowDownUp size={13} className={active && dir === "asc" ? "rotate-180" : ""} /></button>;
}

function AnalysisBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="rounded-[20px] border border-line bg-white/76 p-4 shadow-card"><h3 className="mb-3 text-sm font-black text-ink">{title}</h3><div className="flex flex-wrap gap-2">{children}</div></div>;
}

function TextBlock({ title, value }: { title: string; value: string }) {
  return <div className="rounded-[20px] border border-line bg-white/76 p-4 shadow-card"><h3 className="text-sm font-black text-ink">{title}</h3><p className="mt-2 min-h-20 whitespace-pre-wrap text-sm leading-6 text-muted">{value || "-"}</p></div>;
}

function Skeleton() {
  return <div className="grid gap-3">{Array.from({ length: 8 }).map((_, index) => <div key={index} className="h-20 animate-pulse rounded-2xl bg-white/65" />)}</div>;
}
