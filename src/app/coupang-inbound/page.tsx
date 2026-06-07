"use client";

import type { FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { AlertCircle, Boxes, CalendarDays, ClipboardList, Info, PackageCheck, Search, Truck } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/Card";
import { useLanguage } from "@/components/LanguageProvider";
import { activeProducts } from "@/lib/products";
import { supabase } from "@/lib/supabase";
import type { CoupangInboundRecord, ProductWithStock } from "@/lib/types";

type InboundMethod = CoupangInboundRecord["inbound_method"];
type OutboundLocation = CoupangInboundRecord["outbound_location"];
type MilkRunType = NonNullable<CoupangInboundRecord["milk_run_type"]>;
type ReceiveStatus = CoupangInboundRecord["receive_status"];
type DiscrepancyStatus = CoupangInboundRecord["discrepancy_status"];
type ActiveDiscrepancyStatus = Exclude<DiscrepancyStatus, "lost_or_damaged">;

type FormState = {
  product_id: string;
  inbound_date: string;
  sku: string;
  product_name: string;
  box_count: string;
  units_per_box: string;
  confirmed_quantity: string;
  inbound_method: InboundMethod;
  outbound_location: OutboundLocation;
  milk_run_type: MilkRunType;
  reservation_number: string;
  receive_status: ReceiveStatus;
  discrepancy_status: ActiveDiscrepancyStatus;
  application_date: string;
  expected_inbound_date: string;
  purchase_batch_no: string;
  memo: string;
};

const methodOptions: InboundMethod[] = ["parcel", "milk_run"];
const locationOptions: OutboundLocation[] = ["warehouse", "office"];
const milkRunOptions: MilkRunType[] = ["parcel", "pallet", "truck"];
const receiveStatusOptions: ReceiveStatus[] = ["pending", "received", "partial", "issue"];
const discrepancyOptions: ActiveDiscrepancyStatus[] = ["normal", "quantity_mismatch", "follow_up", "lost", "damaged"];

const today = new Date();
const currentYear = String(today.getFullYear());
const currentMonth = String(today.getMonth() + 1);

const copy = {
  zh: {
    eyebrow: "COUPANG INBOUND",
    title: "Coupang 入仓记录",
    subtitle: "记录商品发往 Coupang 仓库的日期、方式、接收状态、异常预警和采购批次。",
    notice: "该页面仅用于 Coupang 入仓过程记录，不直接影响当前库存。实际库存请在库存管理中维护。",
    noStockImpact: "新增、编辑、删除、修改接收状态或确认入库数量，都不会改变当前库存数量。",
    stats: {
      records: "本月入仓记录数量",
      quantity: "本月确认入库数量",
      pending: "待接收数量",
      received: "已接收数量",
      issues: "异常/差异数量"
    },
    formAdd: "新增入仓记录",
    formEdit: "编辑入仓记录",
    filters: "入仓记录筛选",
    list: "Coupang 入仓记录列表",
    fields: {
      inboundDate: "入仓日期",
      sku: "SKU",
      productName: "商品名称",
      boxCount: "箱数",
      unitsPerBox: "每箱数量",
      confirmedQuantity: "确认入库数量",
      inboundMethod: "入库方式",
      outboundLocation: "发出地点",
      milkRunType: "Milk Run 类型",
      reservationNumber: "预约号 / 入库单号",
      receiveStatus: "Coupang 接收状态",
      discrepancyStatus: "差异预警",
      applicationDate: "申请日期",
      expectedInboundDate: "预计入库日",
      purchaseBatchNo: "采购批次号",
      memo: "备注",
      actions: "操作"
    },
    method: {
      parcel: "快递发货",
      milk_run: "Milk Run"
    },
    location: {
      warehouse: "仓库发出",
      office: "办公室发出"
    },
    milkRun: {
      parcel: "택배",
      pallet: "팔레트",
      truck: "트럭"
    },
    receiveStatus: {
      pending: "待接收",
      received: "Coupang 已接收",
      partial: "部分接收",
      issue: "异常"
    },
    discrepancy: {
      normal: "正常",
      quantity_mismatch: "数量不一致",
      follow_up: "待跟进",
      lost: "丢失",
      damaged: "损耗",
      lost_or_damaged: "丢失/损耗"
    },
    allYears: "全部年份",
    allMonths: "全部月份",
    allMethods: "全部入库方式",
    allLocations: "全部发出地点",
    allReceiveStatus: "全部接收状态",
    allDiscrepancy: "全部差异状态",
    searchSku: "搜索 SKU",
    searchProduct: "搜索商品名称",
    searchBatch: "搜索采购批次号",
    startDate: "开始日期",
    endDate: "结束日期",
    selectSku: "请选择 SKU",
    save: "保存",
    update: "更新",
    cancelEdit: "取消编辑",
    edit: "编辑",
    delete: "删除",
    empty: "暂无 Coupang 入仓记录",
    loading: "正在加载入仓记录...",
    records: "条记录",
    autoCalcHint: "确认入库数量默认按“箱数 × 每箱数量”自动计算，也可以手动修改。",
    deleteConfirm: "确定删除该 Coupang 入仓记录吗？删除后不可恢复，但不会影响库存数量。",
    productRequired: "请选择 SKU。",
    dateRequired: "请输入入仓日期。",
    productNameRequired: "请输入商品名称。"
  },
  ko: {
    eyebrow: "COUPANG INBOUND",
    title: "Coupang 입고 기록",
    subtitle: "Coupang 창고로 보낸 상품의 날짜, 방식, 접수 상태, 차이 경고와 구매 배치를 기록합니다.",
    notice: "이 페이지는 Coupang 입고 과정 기록용이며 현재 재고 수량에는 직접 반영되지 않습니다. 실제 재고는 재고 관리에서 관리해주세요.",
    noStockImpact: "추가, 수정, 삭제, 접수 상태 변경 또는 확인 입고 수량 변경은 현재 재고 수량을 변경하지 않습니다.",
    stats: {
      records: "이번 달 입고 기록 수",
      quantity: "이번 달 확인 입고 수량",
      pending: "대기 수량",
      received: "접수완료 수량",
      issues: "이상/차이 건수"
    },
    formAdd: "입고 기록 추가",
    formEdit: "입고 기록 수정",
    filters: "입고 기록 필터",
    list: "Coupang 입고 기록 목록",
    fields: {
      inboundDate: "입고일",
      sku: "SKU",
      productName: "상품명",
      boxCount: "박스 수량",
      unitsPerBox: "박스당 수량",
      confirmedQuantity: "확인 입고 수량",
      inboundMethod: "입고 방법",
      outboundLocation: "출고 위치",
      milkRunType: "밀크런 타입",
      reservationNumber: "입고 예약번호 / 입고번호",
      receiveStatus: "Coupang 접수 상태",
      discrepancyStatus: "차이 경고",
      applicationDate: "신청일",
      expectedInboundDate: "예정 입고일",
      purchaseBatchNo: "구매 배치번호",
      memo: "비고",
      actions: "작업"
    },
    method: {
      parcel: "택배로 보내기",
      milk_run: "밀크런"
    },
    location: {
      warehouse: "창고 출고",
      office: "사무실 출고"
    },
    milkRun: {
      parcel: "택배",
      pallet: "팔레트",
      truck: "트럭"
    },
    receiveStatus: {
      pending: "대기",
      received: "Coupang 접수완료",
      partial: "부분입고",
      issue: "이상"
    },
    discrepancy: {
      normal: "정상",
      quantity_mismatch: "수량 불일치",
      follow_up: "확인 필요",
      lost: "분실",
      damaged: "손상",
      lost_or_damaged: "분실/손상"
    },
    allYears: "전체 연도",
    allMonths: "전체 월",
    allMethods: "전체 입고 방법",
    allLocations: "전체 출고 위치",
    allReceiveStatus: "전체 접수 상태",
    allDiscrepancy: "전체 차이 상태",
    searchSku: "SKU 검색",
    searchProduct: "상품명 검색",
    searchBatch: "구매 배치번호 검색",
    startDate: "시작일",
    endDate: "종료일",
    selectSku: "SKU를 선택하세요",
    save: "저장",
    update: "업데이트",
    cancelEdit: "수정 취소",
    edit: "수정",
    delete: "삭제",
    empty: "Coupang 입고 기록이 없습니다",
    loading: "입고 기록을 불러오는 중...",
    records: "건",
    autoCalcHint: "확인 입고 수량은 기본적으로 박스 수량 × 박스당 수량으로 자동 계산되며 직접 수정할 수 있습니다.",
    deleteConfirm: "이 Coupang 입고 기록을 삭제하시겠습니까? 삭제 후 복구할 수 없지만 재고 수량에는 영향을 주지 않습니다.",
    productRequired: "SKU를 선택해주세요.",
    dateRequired: "입고일을 입력해주세요.",
    productNameRequired: "상품명을 입력해주세요."
  }
} as const;

const initialForm: FormState = {
  product_id: "",
  inbound_date: toDateInput(new Date()),
  sku: "",
  product_name: "",
  box_count: "0",
  units_per_box: "0",
  confirmed_quantity: "0",
  inbound_method: "parcel",
  outbound_location: "warehouse",
  milk_run_type: "parcel",
  reservation_number: "",
  receive_status: "pending",
  discrepancy_status: "normal",
  application_date: "",
  expected_inbound_date: "",
  purchase_batch_no: "",
  memo: ""
};

export default function CoupangInboundPage() {
  return (
    <AppShell>
      <CoupangInboundContent />
    </AppShell>
  );
}

function CoupangInboundContent() {
  const { language, formatNumber } = useLanguage();
  const text = copy[language];
  const [products, setProducts] = useState<ProductWithStock[]>([]);
  const [records, setRecords] = useState<CoupangInboundRecord[]>([]);
  const [form, setForm] = useState<FormState>(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    year: currentYear,
    month: currentMonth,
    startDate: "",
    endDate: "",
    sku: "",
    productName: "",
    method: "all",
    location: "all",
    receiveStatus: "all",
    discrepancy: "all",
    batch: ""
  });

  const visibleProducts = useMemo(() => activeProducts(products), [products]);

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const [{ data: productRows, error: productError }, { data: inboundRows, error: inboundError }] = await Promise.all([
      supabase.from("products").select("*, inventory_balances(current_stock)").order("sku"),
      supabase.from("coupang_inbound_records").select("*").order("inbound_date", { ascending: false }).order("created_at", { ascending: false })
    ]);

    setProducts((productRows ?? []) as ProductWithStock[]);
    setRecords((inboundRows ?? []) as CoupangInboundRecord[]);
    setMessage(productError?.message || inboundError?.message || "");
    setLoading(false);
  }

  function selectProduct(productId: string) {
    const product = visibleProducts.find((item) => item.id === productId);
    setForm((current) => ({
      ...current,
      product_id: productId,
      sku: product?.sku ?? "",
      product_name: product?.name ?? ""
    }));
  }

  function updateBoxCount(value: string) {
    const confirmed = toNumber(value) * toNumber(form.units_per_box);
    setForm((current) => ({ ...current, box_count: value, confirmed_quantity: String(confirmed) }));
  }

  function updateUnitsPerBox(value: string) {
    const confirmed = toNumber(form.box_count) * toNumber(value);
    setForm((current) => ({ ...current, units_per_box: value, confirmed_quantity: String(confirmed) }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage("");

    if (!form.product_id || !form.sku) {
      setMessage(text.productRequired);
      return;
    }
    if (!form.inbound_date) {
      setMessage(text.dateRequired);
      return;
    }
    if (!form.product_name.trim()) {
      setMessage(text.productNameRequired);
      return;
    }

    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;

    const payload = {
      user_id: auth.user.id,
      product_id: form.product_id,
      inbound_date: form.inbound_date,
      sku: form.sku,
      product_name: form.product_name.trim(),
      box_count: toNumber(form.box_count),
      units_per_box: toNumber(form.units_per_box),
      confirmed_quantity: toNumber(form.confirmed_quantity),
      inbound_method: form.inbound_method,
      outbound_location: form.outbound_location,
      milk_run_type: form.inbound_method === "milk_run" ? form.milk_run_type : null,
      reservation_number: emptyToNull(form.reservation_number),
      receive_status: form.receive_status,
      discrepancy_status: form.discrepancy_status,
      application_date: emptyToNull(form.application_date),
      expected_inbound_date: emptyToNull(form.expected_inbound_date),
      purchase_batch_no: emptyToNull(form.purchase_batch_no),
      memo: emptyToNull(form.memo)
    };

    const { error } = editingId
      ? await supabase.from("coupang_inbound_records").update(payload).eq("id", editingId)
      : await supabase.from("coupang_inbound_records").insert(payload);

    if (error) {
      setMessage(error.message);
      return;
    }

    resetForm();
    await loadData();
  }

  function startEdit(record: CoupangInboundRecord) {
    setEditingId(record.id);
    setMessage("");
    setForm({
      product_id: record.product_id ?? "",
      inbound_date: record.inbound_date,
      sku: record.sku,
      product_name: record.product_name,
      box_count: String(record.box_count ?? 0),
      units_per_box: String(record.units_per_box ?? 0),
      confirmed_quantity: String(record.confirmed_quantity ?? 0),
      inbound_method: record.inbound_method ?? "parcel",
      outbound_location: record.outbound_location ?? "warehouse",
      milk_run_type: record.milk_run_type ?? "parcel",
      reservation_number: record.reservation_number ?? "",
      receive_status: record.receive_status ?? "pending",
      discrepancy_status: normalizeDiscrepancy(record.discrepancy_status),
      application_date: record.application_date ?? "",
      expected_inbound_date: record.expected_inbound_date ?? "",
      purchase_batch_no: record.purchase_batch_no ?? "",
      memo: record.memo ?? ""
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    setEditingId(null);
    setForm({ ...initialForm, inbound_date: toDateInput(new Date()) });
  }

  async function deleteRecord(id: string) {
    if (!window.confirm(text.deleteConfirm)) return;
    const { error } = await supabase.from("coupang_inbound_records").delete().eq("id", id);

    if (error) {
      setMessage(error.message);
      return;
    }

    if (editingId === id) resetForm();
    await loadData();
  }

  const years = useMemo(() => {
    const set = new Set([currentYear, ...records.map((record) => String(new Date(`${record.inbound_date}T12:00:00`).getFullYear()))]);
    return Array.from(set).sort((a, b) => Number(b) - Number(a));
  }, [records]);

  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      const date = record.inbound_date;
      const recordDate = new Date(`${date}T12:00:00`);
      const recordYear = String(recordDate.getFullYear());
      const recordMonth = String(recordDate.getMonth() + 1);
      const discrepancy = normalizeDiscrepancy(record.discrepancy_status);

      if (filters.year !== "all" && recordYear !== filters.year) return false;
      if (filters.month !== "all" && recordMonth !== filters.month) return false;
      if (filters.startDate && date < filters.startDate) return false;
      if (filters.endDate && date > filters.endDate) return false;
      if (filters.sku && !record.sku.toLowerCase().includes(filters.sku.toLowerCase())) return false;
      if (filters.productName && !record.product_name.toLowerCase().includes(filters.productName.toLowerCase())) return false;
      if (filters.method !== "all" && record.inbound_method !== filters.method) return false;
      if (filters.location !== "all" && record.outbound_location !== filters.location) return false;
      if (filters.receiveStatus !== "all" && record.receive_status !== filters.receiveStatus) return false;
      if (filters.discrepancy !== "all" && discrepancy !== filters.discrepancy) return false;
      if (filters.batch && !String(record.purchase_batch_no ?? "").toLowerCase().includes(filters.batch.toLowerCase())) return false;
      return true;
    });
  }, [records, filters]);

  const stats = useMemo(() => {
    return {
      records: filteredRecords.length,
      quantity: filteredRecords.reduce((sum, record) => sum + Number(record.confirmed_quantity || 0), 0),
      pending: filteredRecords
        .filter((record) => record.receive_status === "pending")
        .reduce((sum, record) => sum + Number(record.confirmed_quantity || 0), 0),
      received: filteredRecords
        .filter((record) => record.receive_status === "received")
        .reduce((sum, record) => sum + Number(record.confirmed_quantity || 0), 0),
      issues: filteredRecords.filter((record) => normalizeDiscrepancy(record.discrepancy_status) !== "normal").length
    };
  }, [filteredRecords]);

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.32em] text-muted">{text.eyebrow}</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">{text.title}</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted">{text.subtitle}</p>
        </div>
      </section>

      <div className="flex items-start gap-3 rounded-2xl border border-[#bad6d0] bg-[#eff8f5] px-4 py-3 text-sm text-[#22564d] shadow-sm">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <div className="font-semibold">{text.notice}</div>
          <div className="mt-1 text-xs opacity-80">{text.noStockImpact}</div>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard icon={ClipboardList} label={text.stats.records} value={formatNumber(stats.records)} />
        <StatCard icon={Boxes} label={text.stats.quantity} value={formatNumber(stats.quantity)} />
        <StatCard icon={Truck} label={text.stats.pending} value={formatNumber(stats.pending)} tone="muted" />
        <StatCard icon={PackageCheck} label={text.stats.received} value={formatNumber(stats.received)} tone="success" />
        <StatCard icon={AlertCircle} label={text.stats.issues} value={formatNumber(stats.issues)} tone="danger" />
      </section>

      <Card>
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">{editingId ? text.formEdit : text.formAdd}</h2>
            <p className="mt-1 text-xs text-muted">{text.autoCalcHint}</p>
          </div>
          {editingId ? (
            <button type="button" onClick={resetForm} className="erp-button-subtle px-3 py-2 text-xs font-semibold">
              {text.cancelEdit}
            </button>
          ) : null}
        </div>

        <form onSubmit={submit} className="grid gap-4 lg:grid-cols-4">
          <Field label={text.fields.inboundDate}>
            <input type="date" value={form.inbound_date} onChange={(event) => setForm({ ...form, inbound_date: event.target.value })} required />
          </Field>
          <Field label={text.fields.sku}>
            <select value={form.product_id} onChange={(event) => selectProduct(event.target.value)} required>
              <option value="">{text.selectSku}</option>
              {visibleProducts.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.sku} - {product.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={text.fields.productName} className="lg:col-span-2">
            <input value={form.product_name} onChange={(event) => setForm({ ...form, product_name: event.target.value })} required />
          </Field>
          <Field label={text.fields.boxCount}>
            <input type="number" min="0" value={form.box_count} onChange={(event) => updateBoxCount(event.target.value)} />
          </Field>
          <Field label={text.fields.unitsPerBox}>
            <input type="number" min="0" value={form.units_per_box} onChange={(event) => updateUnitsPerBox(event.target.value)} />
          </Field>
          <Field label={text.fields.confirmedQuantity}>
            <input type="number" min="0" value={form.confirmed_quantity} onChange={(event) => setForm({ ...form, confirmed_quantity: event.target.value })} />
          </Field>
          <Field label={text.fields.inboundMethod}>
            <select value={form.inbound_method} onChange={(event) => setForm({ ...form, inbound_method: event.target.value as InboundMethod })}>
              {methodOptions.map((method) => (
                <option key={method} value={method}>
                  {text.method[method]}
                </option>
              ))}
            </select>
          </Field>
          <Field label={text.fields.outboundLocation}>
            <select value={form.outbound_location} onChange={(event) => setForm({ ...form, outbound_location: event.target.value as OutboundLocation })}>
              {locationOptions.map((location) => (
                <option key={location} value={location}>
                  {text.location[location]}
                </option>
              ))}
            </select>
          </Field>
          {form.inbound_method === "milk_run" ? (
            <Field label={text.fields.milkRunType}>
              <select value={form.milk_run_type} onChange={(event) => setForm({ ...form, milk_run_type: event.target.value as MilkRunType })}>
                {milkRunOptions.map((type) => (
                  <option key={type} value={type}>
                    {text.milkRun[type]}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}
          <Field label={text.fields.reservationNumber}>
            <input value={form.reservation_number} onChange={(event) => setForm({ ...form, reservation_number: event.target.value })} />
          </Field>
          <Field label={text.fields.receiveStatus}>
            <select value={form.receive_status} onChange={(event) => setForm({ ...form, receive_status: event.target.value as ReceiveStatus })}>
              {receiveStatusOptions.map((status) => (
                <option key={status} value={status}>
                  {text.receiveStatus[status]}
                </option>
              ))}
            </select>
          </Field>
          <Field label={text.fields.discrepancyStatus}>
            <select value={form.discrepancy_status} onChange={(event) => setForm({ ...form, discrepancy_status: event.target.value as ActiveDiscrepancyStatus })}>
              {discrepancyOptions.map((status) => (
                <option key={status} value={status}>
                  {text.discrepancy[status]}
                </option>
              ))}
            </select>
          </Field>
          <Field label={text.fields.applicationDate}>
            <input type="date" value={form.application_date} onChange={(event) => setForm({ ...form, application_date: event.target.value })} />
          </Field>
          <Field label={text.fields.expectedInboundDate}>
            <input type="date" value={form.expected_inbound_date} onChange={(event) => setForm({ ...form, expected_inbound_date: event.target.value })} />
          </Field>
          <Field label={text.fields.purchaseBatchNo}>
            <input value={form.purchase_batch_no} onChange={(event) => setForm({ ...form, purchase_batch_no: event.target.value })} />
          </Field>
          <Field label={text.fields.memo} className="lg:col-span-3">
            <textarea rows={2} value={form.memo} onChange={(event) => setForm({ ...form, memo: event.target.value })} />
          </Field>
          <div className="flex items-end">
            <button className="erp-button-primary w-full px-4 py-3 text-sm font-semibold">{editingId ? text.update : text.save}</button>
          </div>
        </form>

        {message ? <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{message}</div> : null}
      </Card>

      <Card>
        <div className="mb-4">
          <h2 className="text-lg font-semibold">{text.filters}</h2>
          <p className="mt-1 text-xs text-muted">{text.noStockImpact}</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <select value={filters.year} onChange={(event) => setFilters({ ...filters, year: event.target.value })}>
            <option value="all">{text.allYears}</option>
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
          <select value={filters.month} onChange={(event) => setFilters({ ...filters, month: event.target.value })}>
            <option value="all">{text.allMonths}</option>
            {Array.from({ length: 12 }, (_, index) => String(index + 1)).map((month) => (
              <option key={month} value={month}>
                {month}
              </option>
            ))}
          </select>
          <input type="date" aria-label={text.startDate} value={filters.startDate} onChange={(event) => setFilters({ ...filters, startDate: event.target.value })} />
          <input type="date" aria-label={text.endDate} value={filters.endDate} onChange={(event) => setFilters({ ...filters, endDate: event.target.value })} />
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted" />
            <input className="w-full pl-9" placeholder={text.searchSku} value={filters.sku} onChange={(event) => setFilters({ ...filters, sku: event.target.value })} />
          </div>
          <input placeholder={text.searchProduct} value={filters.productName} onChange={(event) => setFilters({ ...filters, productName: event.target.value })} />
          <select value={filters.method} onChange={(event) => setFilters({ ...filters, method: event.target.value })}>
            <option value="all">{text.allMethods}</option>
            {methodOptions.map((method) => (
              <option key={method} value={method}>
                {text.method[method]}
              </option>
            ))}
          </select>
          <select value={filters.location} onChange={(event) => setFilters({ ...filters, location: event.target.value })}>
            <option value="all">{text.allLocations}</option>
            {locationOptions.map((location) => (
              <option key={location} value={location}>
                {text.location[location]}
              </option>
            ))}
          </select>
          <select value={filters.receiveStatus} onChange={(event) => setFilters({ ...filters, receiveStatus: event.target.value })}>
            <option value="all">{text.allReceiveStatus}</option>
            {receiveStatusOptions.map((status) => (
              <option key={status} value={status}>
                {text.receiveStatus[status]}
              </option>
            ))}
          </select>
          <select value={filters.discrepancy} onChange={(event) => setFilters({ ...filters, discrepancy: event.target.value })}>
            <option value="all">{text.allDiscrepancy}</option>
            {discrepancyOptions.map((status) => (
              <option key={status} value={status}>
                {text.discrepancy[status]}
              </option>
            ))}
          </select>
          <input className="xl:col-span-2" placeholder={text.searchBatch} value={filters.batch} onChange={(event) => setFilters({ ...filters, batch: event.target.value })} />
        </div>
      </Card>

      <Card className="p-0">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold">{text.list}</h2>
            <p className="mt-1 text-xs text-muted">
              {loading ? text.loading : `${formatNumber(filteredRecords.length)} ${text.records}`}
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1900px] text-left text-sm">
            <thead>
              <tr>
                {[
                  text.fields.inboundDate,
                  text.fields.sku,
                  text.fields.productName,
                  text.fields.boxCount,
                  text.fields.unitsPerBox,
                  text.fields.confirmedQuantity,
                  text.fields.inboundMethod,
                  text.fields.outboundLocation,
                  text.fields.milkRunType,
                  text.fields.reservationNumber,
                  text.fields.receiveStatus,
                  text.fields.discrepancyStatus,
                  text.fields.applicationDate,
                  text.fields.expectedInboundDate,
                  text.fields.purchaseBatchNo,
                  text.fields.memo,
                  text.fields.actions
                ].map((header) => (
                  <th key={header} className="sticky top-0 border-b border-line bg-panel/95 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }, (_, index) => (
                  <tr key={index}>
                    <td colSpan={17} className="border-b border-line px-4 py-4">
                      <div className="h-5 animate-pulse rounded-full bg-line/70" />
                    </td>
                  </tr>
                ))
              ) : filteredRecords.length ? (
                filteredRecords.map((record) => (
                  <tr key={record.id} className="transition hover:bg-panel/60">
                    <DataCell>{record.inbound_date}</DataCell>
                    <DataCell>
                      <span className="font-semibold">{record.sku}</span>
                    </DataCell>
                    <DataCell>{record.product_name}</DataCell>
                    <DataCell align="right">{formatNumber(record.box_count)}</DataCell>
                    <DataCell align="right">{formatNumber(record.units_per_box)}</DataCell>
                    <DataCell align="right">
                      <span className="font-semibold text-ink">{formatNumber(record.confirmed_quantity)}</span>
                    </DataCell>
                    <DataCell>{text.method[record.inbound_method]}</DataCell>
                    <DataCell>{text.location[record.outbound_location]}</DataCell>
                    <DataCell>{record.milk_run_type ? text.milkRun[record.milk_run_type] : "-"}</DataCell>
                    <DataCell>{record.reservation_number || "-"}</DataCell>
                    <DataCell>
                      <ReceiveBadge status={record.receive_status} label={text.receiveStatus[record.receive_status]} />
                    </DataCell>
                    <DataCell>
                      <DiscrepancyBadge status={normalizeDiscrepancy(record.discrepancy_status)} label={text.discrepancy[normalizeDiscrepancy(record.discrepancy_status)]} />
                    </DataCell>
                    <DataCell>{record.application_date || "-"}</DataCell>
                    <DataCell>{record.expected_inbound_date || "-"}</DataCell>
                    <DataCell>{record.purchase_batch_no || "-"}</DataCell>
                    <DataCell>{record.memo || "-"}</DataCell>
                    <DataCell>
                      <div className="flex min-w-[120px] justify-end gap-2">
                        <button type="button" onClick={() => startEdit(record)} className="erp-button-subtle px-3 py-1.5 text-xs font-semibold">
                          {text.edit}
                        </button>
                        <button type="button" onClick={() => deleteRecord(record.id)} className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:-translate-y-0.5 hover:bg-red-100">
                          {text.delete}
                        </button>
                      </div>
                    </DataCell>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={17} className="px-4 py-12 text-center text-sm text-muted">
                    {text.empty}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`grid gap-1.5 text-xs font-semibold text-muted ${className}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function StatCard({ icon: Icon, label, value, tone = "brand" }: { icon: LucideIcon; label: string; value: string; tone?: "brand" | "success" | "danger" | "muted" }) {
  const toneClass =
    tone === "success"
      ? "bg-emerald-50 text-emerald-700"
      : tone === "danger"
        ? "bg-red-50 text-red-700"
        : tone === "muted"
          ? "bg-slate-100 text-slate-600"
          : "bg-brand/10 text-brand";

  return (
    <div className="erp-card group p-5 transition duration-200 hover:-translate-y-1 hover:shadow-lift">
      <div className={`grid h-10 w-10 place-items-center rounded-2xl ${toneClass}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="mt-5 text-xs font-semibold text-muted">{label}</div>
      <div className="mt-2 text-3xl font-semibold tabular-nums text-ink">{value}</div>
    </div>
  );
}

function DataCell({ children, align = "left" }: { children: ReactNode; align?: "left" | "right" | "center" }) {
  const alignment = align === "right" ? "text-right tabular-nums" : align === "center" ? "text-center" : "text-left";
  return <td className={`border-b border-line px-4 py-3 align-middle text-ink/80 ${alignment}`}>{children}</td>;
}

function ReceiveBadge({ status, label }: { status: ReceiveStatus; label: string }) {
  const classes = {
    pending: "border-slate-200 bg-slate-100 text-slate-700",
    received: "border-emerald-200 bg-emerald-50 text-emerald-700",
    partial: "border-yellow-200 bg-yellow-50 text-yellow-800",
    issue: "border-red-200 bg-red-50 text-red-700"
  } satisfies Record<ReceiveStatus, string>;

  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${classes[status]}`}>{label}</span>;
}

function DiscrepancyBadge({ status, label }: { status: ActiveDiscrepancyStatus; label: string }) {
  const classes = {
    normal: "border-emerald-200 bg-emerald-50 text-emerald-700",
    quantity_mismatch: "border-yellow-200 bg-yellow-50 text-yellow-800",
    follow_up: "border-orange-200 bg-orange-50 text-orange-700",
    lost: "border-red-200 bg-red-50 text-red-700",
    damaged: "border-red-200 bg-red-50 text-red-700"
  } satisfies Record<ActiveDiscrepancyStatus, string>;

  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${classes[status]}`}>{label}</span>;
}

function normalizeDiscrepancy(status: DiscrepancyStatus): ActiveDiscrepancyStatus {
  return status === "lost_or_damaged" ? "damaged" : status;
}

function toDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toNumber(value: string) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function emptyToNull(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}
