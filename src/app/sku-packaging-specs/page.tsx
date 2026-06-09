"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Boxes,
  Check,
  Copy,
  Edit3,
  Layers3,
  PackageCheck,
  Plus,
  Ruler,
  Search,
  Trash2,
  X
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useLanguage } from "@/components/LanguageProvider";
import { CenterHero, CenterPanel, EmptyState, ExecutiveKpi, KpiGrid, StatusPill } from "@/components/ManagementCenter";
import { supabase } from "@/lib/supabase";

type ProductStatus = "在售" | "停售" | "待上架" | "已停产";
type InboundMethod = "택배" | "밀크런" | "팔레트" | "트럭";
type CompletenessStatus = "缺少尺寸" | "缺少重量" | "箱规完整" | "疑似超重" | "疑似超体积";
type DrawerMode = "create" | "edit" | "view" | null;

type CategoryRow = {
  id: string;
  name: string;
  status: "active" | "inactive";
  sort_order: number;
};

type SpecRow = {
  id: string;
  category_series: string;
  sku: string;
  product_name: string;
  color: string | null;
  size: string | null;
  product_status: ProductStatus;
  unit_length_cm: number | null;
  unit_width_cm: number | null;
  unit_height_cm: number | null;
  unit_cbm: number | null;
  unit_weight_kg: number | null;
  carton_length_cm: number | null;
  carton_width_cm: number | null;
  carton_height_cm: number | null;
  carton_cbm: number | null;
  units_per_carton: number | null;
  carton_gross_weight_kg: number | null;
  carton_net_weight_kg: number | null;
  theoretical_carton_weight_kg: number | null;
  coupang_barcode: string | null;
  purchase_batch_no: string | null;
  default_inbound_method: InboundMethod;
  fragile: boolean;
  overweight_flag: boolean | null;
  oversize_flag: boolean | null;
  completeness_status: CompletenessStatus | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type FormState = {
  category_series: string;
  sku: string;
  product_name: string;
  color: string;
  size: string;
  product_status: ProductStatus;
  unit_length_cm: string;
  unit_width_cm: string;
  unit_height_cm: string;
  unit_weight_kg: string;
  carton_length_cm: string;
  carton_width_cm: string;
  carton_height_cm: string;
  units_per_carton: string;
  carton_gross_weight_kg: string;
  carton_net_weight_kg: string;
  coupang_barcode: string;
  purchase_batch_no: string;
  default_inbound_method: InboundMethod;
  fragile: boolean;
  notes: string;
};

const pageSize = 10;
const productStatuses: ProductStatus[] = ["在售", "停售", "待上架", "已停产"];
const inboundMethods: InboundMethod[] = ["택배", "밀크런", "팔레트", "트럭"];
const completenessOptions: CompletenessStatus[] = ["箱规完整", "缺少尺寸", "缺少重量", "疑似超重", "疑似超体积"];

const emptyForm: FormState = {
  category_series: "蜂巢帘系列",
  sku: "",
  product_name: "",
  color: "",
  size: "",
  product_status: "在售",
  unit_length_cm: "",
  unit_width_cm: "",
  unit_height_cm: "",
  unit_weight_kg: "",
  carton_length_cm: "",
  carton_width_cm: "",
  carton_height_cm: "",
  units_per_carton: "",
  carton_gross_weight_kg: "",
  carton_net_weight_kg: "",
  coupang_barcode: "",
  purchase_batch_no: "",
  default_inbound_method: "택배",
  fragile: false,
  notes: ""
};

const copyText = {
  zh: {
    eyebrow: "SKU PACKAGING SPECS",
    title: "SKU 包装规格库",
    subtitle: "统一维护 SKU 单品包装、外箱箱规、重量、CBM 与 Coupang 入仓辅助信息。",
    add: "新增规格",
    manageCategory: "品类系列管理",
    tableTitle: "包装规格列表",
    filtersTitle: "高级筛选",
    empty: "暂无 SKU 包装规格，请点击新增规格开始维护包装基础数据。",
    databaseHint: "数据库表尚未创建：请先在 Supabase SQL Editor 执行 supabase/migrations/create-sku-packaging-specs.sql。",
    kpis: {
      total: "SKU 总数",
      complete: "箱规完整",
      missing: "缺少包装数据",
      categories: "品类系列"
    },
    fields: {
      category: "品类系列",
      sku: "SKU",
      product: "商品名称",
      color: "颜色",
      size: "尺寸",
      status: "状态",
      unit: "单品包装",
      unitWeight: "单个重量",
      carton: "外箱包装",
      units: "每箱装箱数",
      gross: "整箱毛重",
      net: "整箱净重",
      cbm: "CBM",
      barcode: "Coupang 入仓条码",
      batch: "采购批次号",
      method: "默认入仓方式",
      fragile: "是否易损",
      notes: "备注",
      updated: "最近更新时间",
      actions: "操作"
    },
    sections: {
      basic: "基础信息",
      unit: "单品包装",
      carton: "整箱包装",
      logistics: "入仓物流信息"
    },
    filters: {
      search: "搜索 SKU / 商品名称",
      all: "全部",
      allCategory: "全部品类",
      allColor: "全部颜色",
      allSize: "全部尺寸",
      allStatus: "全部状态",
      allComplete: "全部完整度",
      reset: "重置筛选"
    },
    actions: {
      view: "查看",
      edit: "编辑",
      copy: "复制",
      delete: "删除",
      save: "保存",
      cancel: "取消",
      close: "关闭",
      addCategory: "新增品类",
      deactivate: "停用",
      activate: "启用"
    },
    drawer: {
      create: "新增 SKU 包装规格",
      edit: "编辑 SKU 包装规格",
      view: "查看 SKU 包装规格"
    },
    helper: {
      unitCbm: "单品 CBM",
      cartonCbm: "外箱 CBM",
      theoretical: "理论整箱重量",
      warning: "毛重与理论重量差异较大，请复核箱规。"
    },
    toastSaved: "保存成功",
    toastDeleted: "删除成功",
    required: "请填写品类系列、SKU 和商品名称。"
  },
  ko: {
    eyebrow: "SKU PACKAGING SPECS",
    title: "SKU 포장 규격",
    subtitle: "SKU별 단품 포장, 외箱 규격, 중량, CBM 및 Coupang 입고 보조 정보를 통합 관리합니다.",
    add: "규격 추가",
    manageCategory: "카테고리 시리즈 관리",
    tableTitle: "포장 규격 목록",
    filtersTitle: "고급 필터",
    empty: "SKU 포장 규격이 없습니다. 규격 추가를 눌러 포장 기본 데이터를 등록하세요.",
    databaseHint: "데이터베이스 테이블이 없습니다. Supabase SQL Editor에서 supabase/migrations/create-sku-packaging-specs.sql을 실행하세요.",
    kpis: {
      total: "SKU 총수",
      complete: "완성 규격",
      missing: "누락 데이터",
      categories: "카테고리 시리즈"
    },
    fields: {
      category: "카테고리",
      sku: "SKU",
      product: "상품명",
      color: "색상",
      size: "사이즈",
      status: "상태",
      unit: "단품 포장",
      unitWeight: "단품 중량",
      carton: "외箱 포장",
      units: "박스당 수량",
      gross: "외箱 총중량",
      net: "외箱 순중량",
      cbm: "CBM",
      barcode: "Coupang 입고 바코드",
      batch: "구매 배치번호",
      method: "기본 입고 방식",
      fragile: "파손주의",
      notes: "메모",
      updated: "최근 업데이트",
      actions: "작업"
    },
    sections: {
      basic: "기본 정보",
      unit: "단품 포장",
      carton: "외箱 포장",
      logistics: "입고 물류 정보"
    },
    filters: {
      search: "SKU / 상품명 검색",
      all: "전체",
      allCategory: "전체 카테고리",
      allColor: "전체 색상",
      allSize: "전체 사이즈",
      allStatus: "전체 상태",
      allComplete: "전체 완성도",
      reset: "필터 초기화"
    },
    actions: {
      view: "보기",
      edit: "수정",
      copy: "복사",
      delete: "삭제",
      save: "저장",
      cancel: "취소",
      close: "닫기",
      addCategory: "카테고리 추가",
      deactivate: "비활성",
      activate: "활성"
    },
    drawer: {
      create: "SKU 포장 규격 추가",
      edit: "SKU 포장 규격 수정",
      view: "SKU 포장 규격 보기"
    },
    helper: {
      unitCbm: "단품 CBM",
      cartonCbm: "외箱 CBM",
      theoretical: "이론 외箱 중량",
      warning: "총중량과 이론 중량 차이가 큽니다. 박스 규격을 확인하세요."
    },
    toastSaved: "저장되었습니다",
    toastDeleted: "삭제되었습니다",
    required: "카테고리, SKU, 상품명을 입력하세요."
  }
};

const productStatusLabel: Record<"zh" | "ko", Record<ProductStatus, string>> = {
  zh: { 在售: "在售", 停售: "停售", 待上架: "待上架", 已停产: "已停产" },
  ko: { 在售: "판매중", 停售: "판매중지", 待上架: "입점대기", 已停产: "단종" }
};

const completenessLabel: Record<"zh" | "ko", Record<CompletenessStatus, string>> = {
  zh: { 箱规完整: "箱规完整", 缺少尺寸: "缺少尺寸", 缺少重量: "缺少重量", 疑似超重: "疑似超重", 疑似超体积: "疑似超体积" },
  ko: { 箱规完整: "규격완성", 缺少尺寸: "치수누락", 缺少重量: "중량누락", 疑似超重: "초중량 의심", 疑似超体积: "초부피 의심" }
};

function toNumber(value: string | number | null | undefined) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function fmt(value: number | null | undefined, digits = 2) {
  const number = toNumber(value);
  return number ? number.toLocaleString(undefined, { maximumFractionDigits: digits }) : "-";
}

function cmTriple(a: number | null, b: number | null, c: number | null) {
  if (!a || !b || !c) return "-";
  return `${fmt(a)} x ${fmt(b)} x ${fmt(c)} cm`;
}

function calcCbm(a: string | number | null, b: string | number | null, c: string | number | null) {
  return (toNumber(a) * toNumber(b) * toNumber(c)) / 1000000;
}

function getCompleteness(row: Pick<SpecRow, "completeness_status" | "unit_length_cm" | "unit_width_cm" | "unit_height_cm" | "carton_length_cm" | "carton_width_cm" | "carton_height_cm" | "units_per_carton" | "unit_weight_kg" | "carton_gross_weight_kg" | "carton_net_weight_kg">): CompletenessStatus {
  if (row.completeness_status) return row.completeness_status;
  if (!row.unit_length_cm || !row.unit_width_cm || !row.unit_height_cm || !row.carton_length_cm || !row.carton_width_cm || !row.carton_height_cm || !row.units_per_carton) return "缺少尺寸";
  if (!row.unit_weight_kg || !row.carton_gross_weight_kg || !row.carton_net_weight_kg) return "缺少重量";
  if (row.carton_gross_weight_kg >= 20) return "疑似超重";
  if (calcCbm(row.carton_length_cm, row.carton_width_cm, row.carton_height_cm) >= 0.18 || Math.max(row.carton_length_cm, row.carton_width_cm, row.carton_height_cm) >= 120) return "疑似超体积";
  return "箱规完整";
}

function statusTone(status: CompletenessStatus) {
  if (status === "箱规完整") return "good";
  if (status === "疑似超重" || status === "疑似超体积") return "risk";
  return "watch";
}

function formFromRow(row: SpecRow): FormState {
  return {
    category_series: row.category_series,
    sku: row.sku,
    product_name: row.product_name,
    color: row.color ?? "",
    size: row.size ?? "",
    product_status: row.product_status,
    unit_length_cm: row.unit_length_cm?.toString() ?? "",
    unit_width_cm: row.unit_width_cm?.toString() ?? "",
    unit_height_cm: row.unit_height_cm?.toString() ?? "",
    unit_weight_kg: row.unit_weight_kg?.toString() ?? "",
    carton_length_cm: row.carton_length_cm?.toString() ?? "",
    carton_width_cm: row.carton_width_cm?.toString() ?? "",
    carton_height_cm: row.carton_height_cm?.toString() ?? "",
    units_per_carton: row.units_per_carton?.toString() ?? "",
    carton_gross_weight_kg: row.carton_gross_weight_kg?.toString() ?? "",
    carton_net_weight_kg: row.carton_net_weight_kg?.toString() ?? "",
    coupang_barcode: row.coupang_barcode ?? "",
    purchase_batch_no: row.purchase_batch_no ?? "",
    default_inbound_method: row.default_inbound_method,
    fragile: row.fragile,
    notes: row.notes ?? ""
  };
}

export default function SkuPackagingSpecsPage() {
  return (
    <AppShell>
      <SkuPackagingSpecsContent />
    </AppShell>
  );
}

function SkuPackagingSpecsContent() {
  const { language, formatDate } = useLanguage();
  const c = copyText[language];
  const [specs, setSpecs] = useState<SpecRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [toast, setToast] = useState("");
  const [drawerMode, setDrawerMode] = useState<DrawerMode>(null);
  const [selected, setSelected] = useState<SpecRow | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [newCategory, setNewCategory] = useState("");
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    search: "",
    category: "",
    color: "",
    size: "",
    status: "",
    completeness: ""
  });

  const loadData = async () => {
    setLoading(true);
    setMessage("");
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) {
      setLoading(false);
      return;
    }

    const [categoryResult, specResult] = await Promise.all([
      supabase.from("sku_category_series").select("id,name,status,sort_order").order("sort_order", { ascending: true }),
      supabase.from("sku_packaging_specs").select("*").order("updated_at", { ascending: false })
    ]);

    if (categoryResult.error || specResult.error) {
      setMessage(c.databaseHint);
      setLoading(false);
      return;
    }

    if ((categoryResult.data ?? []).length === 0) {
      await supabase.from("sku_category_series").insert([
        { user_id: userId, name: "蜂巢帘系列", sort_order: 1 },
        { user_id: userId, name: "百褶帘系列", sort_order: 2 }
      ]);
      const refreshed = await supabase.from("sku_category_series").select("id,name,status,sort_order").order("sort_order", { ascending: true });
      setCategories((refreshed.data ?? []) as CategoryRow[]);
    } else {
      setCategories((categoryResult.data ?? []) as CategoryRow[]);
    }

    setSpecs((specResult.data ?? []) as SpecRow[]);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const activeCategories = categories.filter((category) => category.status === "active");
  const colorOptions = Array.from(new Set(specs.map((row) => row.color).filter(Boolean))) as string[];
  const sizeOptions = Array.from(new Set(specs.map((row) => row.size).filter(Boolean))) as string[];

  const filtered = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    return specs.filter((row) => {
      const rowCompleteness = getCompleteness(row);
      const matchesSearch = !search || row.sku.toLowerCase().includes(search) || row.product_name.toLowerCase().includes(search);
      return (
        matchesSearch &&
        (!filters.category || row.category_series === filters.category) &&
        (!filters.color || row.color === filters.color) &&
        (!filters.size || row.size === filters.size) &&
        (!filters.status || row.product_status === filters.status) &&
        (!filters.completeness || rowCompleteness === filters.completeness)
      );
    });
  }, [filters, specs]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);
  const completeCount = specs.filter((row) => getCompleteness(row) === "箱规完整").length;
  const missingCount = specs.filter((row) => ["缺少尺寸", "缺少重量"].includes(getCompleteness(row))).length;

  const openCreate = () => {
    setSelected(null);
    setForm({ ...emptyForm, category_series: activeCategories[0]?.name ?? "蜂巢帘系列" });
    setDrawerMode("create");
  };

  const openRow = (row: SpecRow, mode: Exclude<DrawerMode, "create" | null>) => {
    setSelected(row);
    setForm(formFromRow(row));
    setDrawerMode(mode);
  };

  const copyRow = (row: SpecRow) => {
    setSelected(null);
    setForm({ ...formFromRow(row), sku: `${row.sku}-COPY`, product_name: `${row.product_name} Copy` });
    setDrawerMode("create");
  };

  const payloadFromForm = async () => {
    const { data } = await supabase.auth.getUser();
    const userId = data.user?.id;
    if (!userId) throw new Error("Missing user");

    return {
      user_id: userId,
      category_series: form.category_series.trim(),
      sku: form.sku.trim(),
      product_name: form.product_name.trim(),
      color: form.color.trim() || null,
      size: form.size.trim() || null,
      product_status: form.product_status,
      unit_length_cm: form.unit_length_cm ? toNumber(form.unit_length_cm) : null,
      unit_width_cm: form.unit_width_cm ? toNumber(form.unit_width_cm) : null,
      unit_height_cm: form.unit_height_cm ? toNumber(form.unit_height_cm) : null,
      unit_weight_kg: form.unit_weight_kg ? toNumber(form.unit_weight_kg) : null,
      carton_length_cm: form.carton_length_cm ? toNumber(form.carton_length_cm) : null,
      carton_width_cm: form.carton_width_cm ? toNumber(form.carton_width_cm) : null,
      carton_height_cm: form.carton_height_cm ? toNumber(form.carton_height_cm) : null,
      units_per_carton: form.units_per_carton ? Math.round(toNumber(form.units_per_carton)) : null,
      carton_gross_weight_kg: form.carton_gross_weight_kg ? toNumber(form.carton_gross_weight_kg) : null,
      carton_net_weight_kg: form.carton_net_weight_kg ? toNumber(form.carton_net_weight_kg) : null,
      coupang_barcode: form.coupang_barcode.trim() || null,
      purchase_batch_no: form.purchase_batch_no.trim() || null,
      default_inbound_method: form.default_inbound_method,
      fragile: form.fragile,
      notes: form.notes.trim() || null
    };
  };

  const saveSpec = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.category_series.trim() || !form.sku.trim() || !form.product_name.trim()) {
      setMessage(c.required);
      return;
    }
    const payload = await payloadFromForm();
    const result =
      drawerMode === "edit" && selected
        ? await supabase.from("sku_packaging_specs").update(payload).eq("id", selected.id)
        : await supabase.from("sku_packaging_specs").insert(payload);

    if (result.error) {
      setMessage(result.error.message);
      return;
    }

    setDrawerMode(null);
    setToast(c.toastSaved);
    await loadData();
  };

  const deleteSpec = async (row: SpecRow) => {
    if (!window.confirm(`${c.actions.delete}: ${row.sku}?`)) return;
    const { error } = await supabase.from("sku_packaging_specs").delete().eq("id", row.id);
    if (error) {
      setMessage(error.message);
      return;
    }
    setToast(c.toastDeleted);
    await loadData();
  };

  const saveCategory = async () => {
    const name = newCategory.trim();
    if (!name) return;
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    const { error } = await supabase.from("sku_category_series").insert({
      user_id: data.user.id,
      name,
      sort_order: categories.length + 1
    });
    if (error) {
      setMessage(error.message);
      return;
    }
    setNewCategory("");
    await loadData();
  };

  const toggleCategory = async (category: CategoryRow) => {
    const { error } = await supabase
      .from("sku_category_series")
      .update({ status: category.status === "active" ? "inactive" : "active" })
      .eq("id", category.id);
    if (error) {
      setMessage(error.message);
      return;
    }
    await loadData();
  };

  const unitCbm = calcCbm(form.unit_length_cm, form.unit_width_cm, form.unit_height_cm);
  const cartonCbm = calcCbm(form.carton_length_cm, form.carton_width_cm, form.carton_height_cm);
  const theoreticalWeight = toNumber(form.unit_weight_kg) * toNumber(form.units_per_carton);
  const grossDiff = Math.abs(toNumber(form.carton_gross_weight_kg) - theoreticalWeight);
  const showWeightWarning = theoreticalWeight > 0 && grossDiff / theoreticalWeight > 0.25;
  const readOnly = drawerMode === "view";

  return (
    <>
      <div className="space-y-6">
        {toast ? <div className="fixed right-6 top-20 z-50 rounded-full bg-[#123c35] px-4 py-2 text-sm font-semibold text-white shadow-lift">{toast}</div> : null}

        <CenterHero
          eyebrow={c.eyebrow}
          title={c.title}
          subtitle={c.subtitle}
          action={
            <button className="inline-flex items-center gap-2 rounded px-4 py-2 text-sm font-bold erp-button-primary" onClick={openCreate}>
              <Plus size={16} />
              {c.add}
            </button>
          }
        >
          <KpiGrid>
            <ExecutiveKpi icon={Boxes} label={c.kpis.total} value={specs.length} hint="SKU" tone="brand" />
            <ExecutiveKpi icon={BadgeCheck} label={c.kpis.complete} value={completeCount} hint={language === "zh" ? "可用于入仓联动" : "입고 연동 가능"} tone="good" />
            <ExecutiveKpi icon={AlertTriangle} label={c.kpis.missing} value={missingCount} hint={language === "zh" ? "需要补充数据" : "보완 필요"} tone={missingCount ? "watch" : "neutral"} />
            <ExecutiveKpi icon={Layers3} label={c.kpis.categories} value={activeCategories.length} hint={language === "zh" ? "启用品类" : "활성 카테고리"} tone="neutral" />
          </KpiGrid>
        </CenterHero>

        {message ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{message}</div> : null}

        <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            <CenterPanel eyebrow="FILTERS" title={c.filtersTitle}>
              <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                <label className="relative md:col-span-2">
                  <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted" />
                  <input className="w-full pl-9" value={filters.search} placeholder={c.filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} />
                </label>
                <Select value={filters.category} onChange={(value) => setFilters({ ...filters, category: value })} options={activeCategories.map((item) => item.name)} allLabel={c.filters.allCategory} />
                <Select value={filters.color} onChange={(value) => setFilters({ ...filters, color: value })} options={colorOptions} allLabel={c.filters.allColor} />
                <Select value={filters.size} onChange={(value) => setFilters({ ...filters, size: value })} options={sizeOptions} allLabel={c.filters.allSize} />
                <Select value={filters.status} onChange={(value) => setFilters({ ...filters, status: value })} options={productStatuses} allLabel={c.filters.allStatus} labelMap={productStatusLabel[language]} />
                <Select value={filters.completeness} onChange={(value) => setFilters({ ...filters, completeness: value })} options={completenessOptions} allLabel={c.filters.allComplete} labelMap={completenessLabel[language]} />
                <button
                  className="rounded border border-line bg-white/70 px-3 py-2 text-sm font-bold text-ink hover:bg-white"
                  onClick={() => {
                    setFilters({ search: "", category: "", color: "", size: "", status: "", completeness: "" });
                    setPage(1);
                  }}
                >
                  {c.filters.reset}
                </button>
              </div>
            </CenterPanel>

            <CenterPanel eyebrow="SKU PACKAGING DATABASE" title={c.tableTitle}>
              {loading ? (
                <div className="grid gap-3">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <div key={index} className="h-16 animate-pulse rounded-2xl bg-white/65" />
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <EmptyState text={c.empty} />
              ) : (
                <>
                  <div className="overflow-hidden rounded-2xl border border-line bg-white/70">
                    <div className="max-w-full overflow-x-auto">
                      <table className="min-w-[1180px] w-full text-left text-sm">
                        <thead className="sticky top-0 z-[1] bg-[#edf1ec] text-xs font-bold uppercase tracking-[0.12em] text-muted">
                          <tr>
                            <th className="px-4 py-3">{c.fields.category}</th>
                            <th className="px-4 py-3">SKU / {c.fields.product}</th>
                            <th className="px-4 py-3">{c.fields.color} / {c.fields.size}</th>
                            <th className="px-4 py-3">{c.fields.unit}</th>
                            <th className="px-4 py-3">{c.fields.unitWeight}</th>
                            <th className="px-4 py-3">{c.fields.carton}</th>
                            <th className="px-4 py-3">{c.fields.units}</th>
                            <th className="px-4 py-3">{c.fields.gross}</th>
                            <th className="px-4 py-3">{c.fields.cbm}</th>
                            <th className="px-4 py-3">{c.fields.status}</th>
                            <th className="px-4 py-3">{c.fields.updated}</th>
                            <th className="px-4 py-3 text-right">{c.fields.actions}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paged.map((row) => {
                            const rowCompleteness = getCompleteness(row);
                            return (
                              <tr key={row.id} className="border-t border-line/80 transition hover:bg-[#f3f6f1]">
                                <td className="px-4 py-4 font-semibold text-ink">{row.category_series}</td>
                                <td className="px-4 py-4">
                                  <div className="font-bold text-ink">{row.sku}</div>
                                  <div className="mt-1 max-w-[260px] truncate text-xs text-muted">{row.product_name}</div>
                                </td>
                                <td className="px-4 py-4">
                                  <div className="font-semibold text-ink">{row.color || "-"}</div>
                                  <div className="text-xs text-muted">{row.size || "-"}</div>
                                </td>
                                <td className="px-4 py-4 text-xs font-semibold text-muted">{cmTriple(row.unit_length_cm, row.unit_width_cm, row.unit_height_cm)}</td>
                                <td className="px-4 py-4 font-semibold tabular-nums">{fmt(row.unit_weight_kg, 3)} kg</td>
                                <td className="px-4 py-4 text-xs font-semibold text-muted">{cmTriple(row.carton_length_cm, row.carton_width_cm, row.carton_height_cm)}</td>
                                <td className="px-4 py-4 font-semibold tabular-nums">{row.units_per_carton ?? "-"}</td>
                                <td className="px-4 py-4 font-semibold tabular-nums">{fmt(row.carton_gross_weight_kg, 3)} kg</td>
                                <td className="px-4 py-4 font-semibold tabular-nums">{fmt(row.carton_cbm, 6)}</td>
                                <td className="px-4 py-4">
                                  <div className="flex flex-col gap-1">
                                    <StatusPill tone={statusTone(rowCompleteness)}>{completenessLabel[language][rowCompleteness]}</StatusPill>
                                    <span className="text-xs text-muted">{productStatusLabel[language][row.product_status]}</span>
                                  </div>
                                </td>
                                <td className="px-4 py-4 text-xs text-muted">{formatDate(row.updated_at)}</td>
                                <td className="px-4 py-4">
                                  <div className="flex justify-end gap-1.5">
                                    <IconButton label={c.actions.view} onClick={() => openRow(row, "view")} icon={<Search size={14} />} />
                                    <IconButton label={c.actions.edit} onClick={() => openRow(row, "edit")} icon={<Edit3 size={14} />} />
                                    <IconButton label={c.actions.copy} onClick={() => copyRow(row)} icon={<Copy size={14} />} />
                                    <IconButton label={c.actions.delete} onClick={() => deleteSpec(row)} icon={<Trash2 size={14} />} danger />
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between text-sm text-muted">
                    <span>
                      {filtered.length} SKU · {page}/{totalPages}
                    </span>
                    <div className="flex gap-2">
                      <button className="erp-button-subtle px-3 py-2 font-semibold disabled:opacity-40" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
                        {language === "zh" ? "上一页" : "이전"}
                      </button>
                      <button className="erp-button-subtle px-3 py-2 font-semibold disabled:opacity-40" disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>
                        {language === "zh" ? "下一页" : "다음"}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </CenterPanel>
          </div>

          <CenterPanel eyebrow="CATEGORY SERIES" title={c.manageCategory} className="xl:sticky xl:top-24 xl:h-fit">
            <div className="space-y-3">
              <div className="flex gap-2">
                <input className="min-w-0 flex-1" value={newCategory} placeholder={language === "zh" ? "新增品类名称" : "새 카테고리명"} onChange={(event) => setNewCategory(event.target.value)} />
                <button className="erp-button-primary px-3 py-2 text-sm font-bold" onClick={saveCategory}>{c.actions.addCategory}</button>
              </div>
              <div className="space-y-2">
                {categories.map((category) => (
                  <div key={category.id} className="flex items-center justify-between rounded-2xl border border-line bg-white/70 px-3 py-2">
                    <div>
                      <div className="font-bold text-ink">{category.name}</div>
                      <div className="text-xs text-muted">{category.status === "active" ? (language === "zh" ? "启用" : "활성") : language === "zh" ? "停用" : "비활성"}</div>
                    </div>
                    <button className="erp-button-subtle px-3 py-1.5 text-xs font-bold" onClick={() => toggleCategory(category)}>
                      {category.status === "active" ? c.actions.deactivate : c.actions.activate}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </CenterPanel>
        </div>
      </div>

      {drawerMode ? (
        <div className="fixed inset-0 z-40 flex justify-end bg-[#0a1714]/35 backdrop-blur-sm" onClick={() => setDrawerMode(null)}>
          <form
            className="h-full w-full max-w-5xl overflow-y-auto border-l border-white/40 bg-[#f6f5ef] p-5 shadow-lift md:p-7"
            onClick={(event) => event.stopPropagation()}
            onSubmit={saveSpec}
          >
            <div className="mb-6 flex items-start justify-between gap-3">
              <div>
                <p className="premium-section-eyebrow">{drawerMode.toUpperCase()}</p>
                <h2 className="mt-2 text-3xl font-semibold tracking-tight text-ink">{c.drawer[drawerMode]}</h2>
              </div>
              <button type="button" className="erp-button-subtle p-2" onClick={() => setDrawerMode(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="grid gap-5">
              <FormSection title={c.sections.basic}>
                <SelectField label={c.fields.category} value={form.category_series} disabled={readOnly} onChange={(value) => setForm({ ...form, category_series: value })} options={activeCategories.map((item) => item.name)} />
                <Field label={c.fields.sku} value={form.sku} disabled={readOnly} onChange={(value) => setForm({ ...form, sku: value })} required />
                <Field label={c.fields.product} value={form.product_name} disabled={readOnly} onChange={(value) => setForm({ ...form, product_name: value })} required />
                <Field label={c.fields.color} value={form.color} disabled={readOnly} onChange={(value) => setForm({ ...form, color: value })} />
                <Field label={c.fields.size} value={form.size} disabled={readOnly} onChange={(value) => setForm({ ...form, size: value })} />
                <SelectField label={c.fields.status} value={form.product_status} disabled={readOnly} onChange={(value) => setForm({ ...form, product_status: value as ProductStatus })} options={productStatuses} labelMap={productStatusLabel[language]} />
              </FormSection>

              <FormSection title={c.sections.unit}>
                <Field label={language === "zh" ? "长 cm" : "길이 cm"} type="number" value={form.unit_length_cm} disabled={readOnly} onChange={(value) => setForm({ ...form, unit_length_cm: value })} />
                <Field label={language === "zh" ? "宽 cm" : "너비 cm"} type="number" value={form.unit_width_cm} disabled={readOnly} onChange={(value) => setForm({ ...form, unit_width_cm: value })} />
                <Field label={language === "zh" ? "高 cm" : "높이 cm"} type="number" value={form.unit_height_cm} disabled={readOnly} onChange={(value) => setForm({ ...form, unit_height_cm: value })} />
                <ReadOnlyMetric label={c.helper.unitCbm} value={unitCbm ? unitCbm.toFixed(6) : "0.000000"} />
                <Field label={`${c.fields.unitWeight} kg`} type="number" value={form.unit_weight_kg} disabled={readOnly} onChange={(value) => setForm({ ...form, unit_weight_kg: value })} />
              </FormSection>

              <FormSection title={c.sections.carton}>
                <Field label={language === "zh" ? "外箱长 cm" : "외箱 길이 cm"} type="number" value={form.carton_length_cm} disabled={readOnly} onChange={(value) => setForm({ ...form, carton_length_cm: value })} />
                <Field label={language === "zh" ? "外箱宽 cm" : "외箱 너비 cm"} type="number" value={form.carton_width_cm} disabled={readOnly} onChange={(value) => setForm({ ...form, carton_width_cm: value })} />
                <Field label={language === "zh" ? "外箱高 cm" : "외箱 높이 cm"} type="number" value={form.carton_height_cm} disabled={readOnly} onChange={(value) => setForm({ ...form, carton_height_cm: value })} />
                <ReadOnlyMetric label={c.helper.cartonCbm} value={cartonCbm ? cartonCbm.toFixed(6) : "0.000000"} />
                <Field label={c.fields.units} type="number" value={form.units_per_carton} disabled={readOnly} onChange={(value) => setForm({ ...form, units_per_carton: value })} />
                <Field label={`${c.fields.gross} kg`} type="number" value={form.carton_gross_weight_kg} disabled={readOnly} onChange={(value) => setForm({ ...form, carton_gross_weight_kg: value })} />
                <Field label={`${c.fields.net} kg`} type="number" value={form.carton_net_weight_kg} disabled={readOnly} onChange={(value) => setForm({ ...form, carton_net_weight_kg: value })} />
                <ReadOnlyMetric label={c.helper.theoretical} value={`${theoreticalWeight.toFixed(3)} kg`} />
              </FormSection>

              {showWeightWarning ? <div className="rounded-2xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm font-bold text-yellow-800">{c.helper.warning}</div> : null}

              <FormSection title={c.sections.logistics}>
                <Field label={c.fields.barcode} value={form.coupang_barcode} disabled={readOnly} onChange={(value) => setForm({ ...form, coupang_barcode: value })} />
                <Field label={c.fields.batch} value={form.purchase_batch_no} disabled={readOnly} onChange={(value) => setForm({ ...form, purchase_batch_no: value })} />
                <SelectField label={c.fields.method} value={form.default_inbound_method} disabled={readOnly} onChange={(value) => setForm({ ...form, default_inbound_method: value as InboundMethod })} options={inboundMethods} />
                <label className="flex items-center gap-2 rounded-2xl border border-line bg-white/70 px-3 py-2 text-sm font-bold text-ink">
                  <input type="checkbox" className="h-4 w-4" checked={form.fragile} disabled={readOnly} onChange={(event) => setForm({ ...form, fragile: event.target.checked })} />
                  {c.fields.fragile}
                </label>
                <label className="md:col-span-2 xl:col-span-4">
                  <span className="mb-1 block text-xs font-bold text-muted">{c.fields.notes}</span>
                  <textarea className="min-h-24 w-full" value={form.notes} disabled={readOnly} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
                </label>
              </FormSection>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button type="button" className="erp-button-subtle px-4 py-2 font-bold" onClick={() => setDrawerMode(null)}>
                {readOnly ? c.actions.close : c.actions.cancel}
              </button>
              {!readOnly ? (
                <button type="submit" className="inline-flex items-center gap-2 erp-button-primary px-4 py-2 font-bold">
                  <Check size={16} />
                  {c.actions.save}
                </button>
              ) : null}
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}

function Select({
  value,
  onChange,
  options,
  allLabel,
  labelMap
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  allLabel: string;
  labelMap?: Record<string, string>;
}) {
  return (
    <select className="w-full" value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">{allLabel}</option>
      {options.map((option) => (
        <option key={option} value={option}>
          {labelMap?.[option] ?? option}
        </option>
      ))}
    </select>
  );
}

function IconButton({ label, icon, onClick, danger = false }: { label: string; icon: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      title={label}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border text-xs font-bold ${
        danger ? "border-red-200 bg-red-50 text-red-700" : "border-line bg-white/80 text-ink hover:bg-[#eef4ef]"
      }`}
      onClick={onClick}
    >
      {icon}
    </button>
  );
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[24px] border border-line bg-white/70 p-4 shadow-card">
      <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-ink">
        <PackageCheck className="h-5 w-5 text-[#17483f]" />
        {title}
      </h3>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  disabled = false,
  required = false
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "number";
  disabled?: boolean;
  required?: boolean;
}) {
  return (
    <label>
      <span className="mb-1 block text-xs font-bold text-muted">
        {label}
        {required ? " *" : ""}
      </span>
      <input
        className="w-full"
        type={type}
        min={type === "number" ? "0" : undefined}
        step={type === "number" ? "0.001" : undefined}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
  disabled = false,
  labelMap
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  disabled?: boolean;
  labelMap?: Record<string, string>;
}) {
  return (
    <label>
      <span className="mb-1 block text-xs font-bold text-muted">{label}</span>
      <select className="w-full" value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option} value={option}>
            {labelMap?.[option] ?? option}
          </option>
        ))}
      </select>
    </label>
  );
}

function ReadOnlyMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-[#f3f6f1] px-3 py-2">
      <div className="text-xs font-bold text-muted">{label}</div>
      <div className="mt-1 font-semibold tabular-nums text-ink">{value}</div>
    </div>
  );
}
