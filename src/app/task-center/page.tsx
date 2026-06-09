"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarCheck2, CheckCircle2, Clock3, Edit3, Flame, Plus, Trash2, TimerReset } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useLanguage } from "@/components/LanguageProvider";
import { CenterHero, CenterPanel, EmptyState, ExecutiveKpi, KpiGrid, MetricLine, StatusPill } from "@/components/ManagementCenter";
import { formatDatabaseError } from "@/lib/database-error";
import { supabase } from "@/lib/supabase";

type TaskStatus = "待处理" | "进行中" | "已完成" | "已取消";
type Priority = "P1 紧急" | "P2 重要" | "P3 普通" | "P4 低";
type TaskRow = {
  id: string;
  task_name: string;
  task_type: string;
  priority: Priority;
  owner: string;
  due_date: string;
  status: TaskStatus;
  remark: string | null;
  created_at: string;
};

const priorityOptions: Priority[] = ["P1 紧急", "P2 重要", "P3 普通", "P4 低"];
const statusOptions: TaskStatus[] = ["待处理", "进行中", "已完成", "已取消"];
const boardColumns: TaskStatus[] = ["待处理", "进行中", "已完成"];
const todayKey = toDateKey(new Date());
const allFilter = "全部";

const copy = {
  zh: {
    eyebrow: "待办中心",
    title: "待办中心",
    subtitle: "所有任务由你手动创建。系统只负责保存、统计、筛选、提醒和展示。",
    newTask: "新增任务",
    deleteConfirm: "确定删除这个任务吗？",
    kpis: {
      today: "今日待办",
      week: "本周待办",
      overdue: "逾期任务",
      done: "已完成任务",
      completion: "完成率",
      p1: "P1 紧急",
      realTask: "真实任务",
      byDueDate: "按截止日期",
      realStats: "真实统计"
    },
    emptyEyebrow: "空状态",
    emptyTitle: "暂无数据",
    emptyTask: "暂无任务，请点击新增任务创建今日待办。",
    topEyebrow: "今日重点",
    topTitle: "今日重点",
    weeklyEyebrow: "本周重点",
    weeklyTitle: "本周经营重点",
    filtersEyebrow: "筛选",
    filtersTitle: "筛选任务",
    kanbanEyebrow: "看板",
    kanbanTitle: "任务看板",
    realOnly: "仅真实任务",
    noOpenTask: "暂无未完成任务。",
    noWeekly: "暂无本周待办统计。",
    noTask: "暂无任务",
    itemUnit: "项",
    formNewEyebrow: "新增任务",
    formEditEyebrow: "编辑任务",
    formNewTitle: "新增任务",
    formEditTitle: "编辑任务",
    save: "保存修改",
    create: "创建任务",
    cancel: "取消",
    doneButton: "完成",
    edit: "编辑",
    delete: "删除",
    all: "全部",
    allOwner: "全部负责人",
    fields: {
      title: "任务标题",
      type: "任务类型",
      priority: "优先级",
      owner: "负责人",
      dueDate: "截止日期",
      status: "状态",
      remark: "备注"
    },
    status: {
      "待处理": "待处理",
      "进行中": "进行中",
      "已完成": "已完成",
      "已取消": "已取消"
    } as Record<TaskStatus, string>,
    priority: {
      "P1 紧急": "P1 紧急",
      "P2 重要": "P2 重要",
      "P3 普通": "P3 普通",
      "P4 低": "P4 低"
    } as Record<Priority, string>
  },
  ko: {
    eyebrow: "업무 센터",
    title: "업무 센터",
    subtitle: "모든 업무는 직접 생성합니다. 시스템은 저장, 통계, 필터링, 알림, 표시만 담당합니다.",
    newTask: "신규 업무",
    deleteConfirm: "이 업무를 삭제할까요?",
    kpis: {
      today: "오늘 업무",
      week: "이번 주 업무",
      overdue: "기한 초과 업무",
      done: "완료 업무",
      completion: "완료율",
      p1: "P1 긴급",
      realTask: "실제 업무",
      byDueDate: "마감일 기준",
      realStats: "실제 통계"
    },
    emptyEyebrow: "비어 있음",
    emptyTitle: "데이터 없음",
    emptyTask: "업무가 없습니다. 신규 업무를 눌러 오늘 할 일을 생성하세요.",
    topEyebrow: "오늘 핵심",
    topTitle: "오늘 핵심",
    weeklyEyebrow: "이번 주 핵심",
    weeklyTitle: "이번 주 운영 핵심",
    filtersEyebrow: "필터",
    filtersTitle: "업무 필터",
    kanbanEyebrow: "칸반",
    kanbanTitle: "업무 칸반",
    realOnly: "실제 업무만",
    noOpenTask: "미완료 업무가 없습니다.",
    noWeekly: "이번 주 업무 통계가 없습니다.",
    noTask: "업무 없음",
    itemUnit: "건",
    formNewEyebrow: "신규 업무",
    formEditEyebrow: "업무 수정",
    formNewTitle: "업무 추가",
    formEditTitle: "업무 수정",
    save: "수정 저장",
    create: "업무 생성",
    cancel: "취소",
    doneButton: "완료",
    edit: "수정",
    delete: "삭제",
    all: "전체",
    allOwner: "전체 담당자",
    fields: {
      title: "업무 제목",
      type: "업무 유형",
      priority: "우선순위",
      owner: "담당자",
      dueDate: "마감일",
      status: "상태",
      remark: "메모"
    },
    status: {
      "待处理": "대기",
      "进行中": "진행 중",
      "已完成": "완료",
      "已取消": "취소"
    } as Record<TaskStatus, string>,
    priority: {
      "P1 紧急": "P1 긴급",
      "P2 重要": "P2 중요",
      "P3 普通": "P3 보통",
      "P4 低": "P4 낮음"
    } as Record<Priority, string>
  }
};

type Copy = typeof copy.zh;
type SelectOption = string | { value: string; label: string };

const emptyForm = {
  task_name: "",
  task_type: "",
  priority: "P3 普通" as Priority,
  owner: "",
  due_date: todayKey,
  status: "待处理" as TaskStatus,
  remark: ""
};

export default function TaskCenterPage() {
  return (
    <AppShell>
      <TaskCenterContent />
    </AppShell>
  );
}

function TaskCenterContent() {
  const { language } = useLanguage();
  const c = copy[language];
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [filters, setFilters] = useState({ status: allFilter, priority: allFilter, owner: "", start: "", end: "" });
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadTasks();
  }, []);

  async function loadTasks() {
    const { data, error } = await supabase.from("tasks").select("*").order("due_date", { ascending: true }).order("created_at", { ascending: false });
    if (error) {
      setMessage(formatDatabaseError(error.message, "tasks"));
      return;
    }
    setTasks((data ?? []) as TaskRow[]);
  }

  async function saveTask(event: FormEvent) {
    event.preventDefault();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;

    const payload = {
      task_name: form.task_name.trim(),
      task_type: form.task_type.trim(),
      priority: form.priority,
      owner: form.owner.trim(),
      due_date: form.due_date,
      status: form.status,
      remark: form.remark.trim() || null
    };

    const result = editingId
      ? await supabase.from("tasks").update(payload).eq("id", editingId)
      : await supabase.from("tasks").insert({ user_id: auth.user.id, ...payload });

    if (result.error) {
      setMessage(formatDatabaseError(result.error.message, "tasks"));
      return;
    }

    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
    setMessage("");
    await loadTasks();
  }

  async function updateStatus(taskId: string, status: TaskStatus) {
    setTasks((current) => current.map((task) => task.id === taskId ? { ...task, status } : task));
    const { error } = await supabase.from("tasks").update({ status }).eq("id", taskId);
    if (error) {
      setMessage(formatDatabaseError(error.message, "tasks"));
      await loadTasks();
    }
  }

  async function deleteTask(taskId: string) {
    if (!window.confirm(c.deleteConfirm)) return;
    const { error } = await supabase.from("tasks").delete().eq("id", taskId);
    if (error) {
      setMessage(formatDatabaseError(error.message, "tasks"));
      return;
    }
    await loadTasks();
  }

  function startEdit(task: TaskRow) {
    setEditingId(task.id);
    setForm({
      task_name: task.task_name,
      task_type: task.task_type,
      priority: task.priority,
      owner: task.owner,
      due_date: task.due_date,
      status: task.status,
      remark: task.remark ?? ""
    });
    setShowForm(true);
  }

  const metrics = useMemo(() => buildMetrics(tasks), [tasks]);
  const filteredTasks = useMemo(() => applyTaskFilters(tasks, filters), [tasks, filters]);
  const topPriority = useMemo(() => tasks
    .filter((task) => task.status !== "已完成" && task.status !== "已取消")
    .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || a.due_date.localeCompare(b.due_date))
    .slice(0, 3), [tasks]);
  const weeklyFocus = useMemo(() => buildWeeklyFocus(tasks), [tasks]);

  return (
    <div className="space-y-6">
      <CenterHero
        eyebrow={c.eyebrow}
        title={c.title}
        subtitle={c.subtitle}
        action={<button className="erp-button-primary inline-flex items-center gap-2 px-4 py-2 text-sm font-bold" onClick={() => { setForm(emptyForm); setEditingId(null); setShowForm(true); }}><Plus className="h-4 w-4" />{c.newTask}</button>}
      >
        <KpiGrid>
          <ExecutiveKpi icon={Clock3} label={c.kpis.today} value={metrics.today} hint={c.kpis.realTask} tone="brand" />
          <ExecutiveKpi icon={CalendarCheck2} label={c.kpis.week} value={metrics.week} hint={c.kpis.realTask} />
          <ExecutiveKpi icon={AlertTriangle} label={c.kpis.overdue} value={metrics.overdue} hint={c.kpis.byDueDate} tone={metrics.overdue ? "risk" : "good"} />
          <ExecutiveKpi icon={CheckCircle2} label={c.kpis.done} value={metrics.done} hint={c.kpis.realTask} tone="good" />
          <ExecutiveKpi icon={TimerReset} label={c.kpis.completion} value={`${metrics.completionRate}%`} hint={c.kpis.realStats} tone={metrics.completionRate >= 70 ? "good" : "watch"} />
          <ExecutiveKpi icon={Flame} label={c.kpis.p1} value={metrics.p1} hint={c.kpis.realTask} tone={metrics.p1 ? "risk" : "neutral"} />
        </KpiGrid>
      </CenterHero>

      {message ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{message}</div> : null}

      {showForm ? (
        <TaskForm
          form={form}
          c={c}
          editing={Boolean(editingId)}
          onChange={setForm}
          onSubmit={saveTask}
          onCancel={() => { setShowForm(false); setEditingId(null); setForm(emptyForm); }}
        />
      ) : null}

      {!tasks.length ? (
        <EmptyAction c={c} title={c.emptyTask} button={c.newTask} onClick={() => setShowForm(true)} />
      ) : (
        <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
          <div className="space-y-5">
            <CenterPanel eyebrow={c.topEyebrow} title={c.topTitle}>
              <div className="space-y-3">
                {topPriority.length ? topPriority.map((task, index) => (
                  <TaskCard key={task.id} c={c} task={task} rank={index + 1} onEdit={startEdit} onDelete={deleteTask} onDone={() => updateStatus(task.id, "已完成")} />
                )) : <EmptyState text={c.noOpenTask} />}
              </div>
            </CenterPanel>

            <CenterPanel eyebrow={c.weeklyEyebrow} title={c.weeklyTitle}>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                {weeklyFocus.length ? weeklyFocus.map((item) => (
                  <MetricLine key={item.type} label={item.type} value={`${item.count} ${c.itemUnit}`} tone="brand" />
                )) : <EmptyState text={c.noWeekly} />}
              </div>
            </CenterPanel>
          </div>

          <div className="space-y-5">
            <TaskFilters c={c} filters={filters} owners={unique(tasks.map((task) => task.owner))} onChange={setFilters} />
            <CenterPanel eyebrow={c.kanbanEyebrow} title={c.kanbanTitle} aside={<StatusPill tone="brand">{c.realOnly}</StatusPill>}>
              <div className="grid gap-4 lg:grid-cols-3">
                {boardColumns.map((status) => (
                  <div key={status} className="min-h-[420px] rounded-[22px] border border-line bg-[#f6f5f0]/80 p-3" onDragOver={(event) => event.preventDefault()} onDrop={() => draggingId && updateStatus(draggingId, status)}>
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="font-semibold text-ink">{c.status[status]}</h3>
                      <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-muted">{filteredTasks.filter((task) => task.status === status).length}</span>
                    </div>
                    <div className="space-y-3">
                      {filteredTasks.filter((task) => task.status === status).map((task) => (
                        <TaskCard key={task.id} c={c} task={task} compact draggable onDragStart={() => setDraggingId(task.id)} onDragEnd={() => setDraggingId(null)} onEdit={startEdit} onDelete={deleteTask} onDone={() => updateStatus(task.id, "已完成")} />
                      ))}
                      {!filteredTasks.some((task) => task.status === status) ? <EmptyState text={c.noTask} /> : null}
                    </div>
                  </div>
                ))}
              </div>
            </CenterPanel>
          </div>
        </div>
      )}
    </div>
  );
}

function TaskForm({ c, form, editing, onChange, onSubmit, onCancel }: { c: Copy; form: typeof emptyForm; editing: boolean; onChange: (form: typeof emptyForm) => void; onSubmit: (event: FormEvent) => void; onCancel: () => void }) {
  return (
    <CenterPanel eyebrow={editing ? c.formEditEyebrow : c.formNewEyebrow} title={editing ? c.formEditTitle : c.formNewTitle}>
      <form onSubmit={onSubmit} className="grid gap-4 lg:grid-cols-4">
        <Field label={c.fields.title}><input className="premium-input" required value={form.task_name} onChange={(event) => onChange({ ...form, task_name: event.target.value })} /></Field>
        <Field label={c.fields.type}><input className="premium-input" required value={form.task_type} onChange={(event) => onChange({ ...form, task_type: event.target.value })} /></Field>
        <Field label={c.fields.priority}><Select value={form.priority} options={prioritySelectOptions(c)} onChange={(value) => onChange({ ...form, priority: value as Priority })} /></Field>
        <Field label={c.fields.owner}><input className="premium-input" required value={form.owner} onChange={(event) => onChange({ ...form, owner: event.target.value })} /></Field>
        <Field label={c.fields.dueDate}><input className="premium-input" type="date" required value={form.due_date} onChange={(event) => onChange({ ...form, due_date: event.target.value })} /></Field>
        <Field label={c.fields.status}><Select value={form.status} options={statusSelectOptions(c)} onChange={(value) => onChange({ ...form, status: value as TaskStatus })} /></Field>
        <Field label={c.fields.remark}><input className="premium-input" value={form.remark} onChange={(event) => onChange({ ...form, remark: event.target.value })} /></Field>
        <div className="flex items-end gap-2">
          <button className="erp-button-primary h-10 px-4 text-sm font-bold" type="submit">{editing ? c.save : c.create}</button>
          <button className="erp-button-subtle h-10 px-4 text-sm font-bold" type="button" onClick={onCancel}>{c.cancel}</button>
        </div>
      </form>
    </CenterPanel>
  );
}

function TaskFilters({ c, filters, owners, onChange }: { c: Copy; filters: { status: string; priority: string; owner: string; start: string; end: string }; owners: string[]; onChange: (filters: { status: string; priority: string; owner: string; start: string; end: string }) => void }) {
  return (
    <CenterPanel eyebrow={c.filtersEyebrow} title={c.filtersTitle}>
      <div className="grid gap-3 md:grid-cols-5">
        <Select value={filters.status} options={[{ value: allFilter, label: c.all }, ...statusSelectOptions(c)]} onChange={(status) => onChange({ ...filters, status })} />
        <Select value={filters.priority} options={[{ value: allFilter, label: c.all }, ...prioritySelectOptions(c)]} onChange={(priority) => onChange({ ...filters, priority })} />
        <Select value={filters.owner || allFilter} options={[{ value: allFilter, label: c.allOwner }, ...owners]} onChange={(owner) => onChange({ ...filters, owner: owner === allFilter ? "" : owner })} />
        <input className="premium-input" type="date" value={filters.start} onChange={(event) => onChange({ ...filters, start: event.target.value })} />
        <input className="premium-input" type="date" value={filters.end} onChange={(event) => onChange({ ...filters, end: event.target.value })} />
      </div>
    </CenterPanel>
  );
}

function TaskCard({ c, task, rank, compact, draggable, onDragStart, onDragEnd, onEdit, onDelete, onDone }: { c: Copy; task: TaskRow; rank?: number; compact?: boolean; draggable?: boolean; onDragStart?: () => void; onDragEnd?: () => void; onEdit: (task: TaskRow) => void; onDelete: (id: string) => void; onDone: () => void }) {
  return (
    <article draggable={draggable} onDragStart={onDragStart} onDragEnd={onDragEnd} className={`rounded-2xl border bg-white/85 p-4 shadow-[0_10px_24px_rgba(23,33,29,0.06)] ${isOverdue(task) ? "border-red-200 ring-2 ring-red-100" : "border-white"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex gap-3">
          {rank ? <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#17483f] text-sm font-bold text-white">{rank}</span> : null}
          <div>
            <h4 className="font-semibold leading-snug text-ink">{task.task_name}</h4>
            <p className="mt-1 text-xs text-muted">{task.task_type} · {task.owner} · {task.due_date}</p>
          </div>
        </div>
        <StatusPill tone={priorityTone(task.priority)}>{compact ? task.priority.split(" ")[0] : c.priority[task.priority]}</StatusPill>
      </div>
      {task.remark && !compact ? <p className="mt-3 rounded-xl bg-[#f4f2e9] px-3 py-2 text-xs leading-5 text-muted">{task.remark}</p> : null}
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        {task.status !== "已完成" ? <button className="erp-button-subtle inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold" onClick={onDone}><CheckCircle2 className="h-3.5 w-3.5" />{c.doneButton}</button> : null}
        <button className="erp-button-subtle inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold" onClick={() => onEdit(task)}><Edit3 className="h-3.5 w-3.5" />{c.edit}</button>
        <button className="rounded-xl border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-bold text-red-700" onClick={() => onDelete(task.id)}><Trash2 className="inline h-3.5 w-3.5" /> {c.delete}</button>
      </div>
    </article>
  );
}

function buildMetrics(tasks: TaskRow[]) {
  const weekEnd = offsetDate(6);
  const active = tasks.filter((task) => task.status !== "已取消");
  const done = active.filter((task) => task.status === "已完成").length;
  return {
    today: active.filter((task) => task.due_date === todayKey && task.status !== "已完成").length,
    week: active.filter((task) => task.due_date >= todayKey && task.due_date <= weekEnd && task.status !== "已完成").length,
    overdue: active.filter(isOverdue).length,
    done,
    completionRate: active.length ? Math.round((done / active.length) * 100) : 0,
    p1: active.filter((task) => task.priority === "P1 紧急" && task.status !== "已完成").length
  };
}

function applyTaskFilters(tasks: TaskRow[], filters: { status: string; priority: string; owner: string; start: string; end: string }) {
  return tasks.filter((task) => {
    if (filters.status !== allFilter && task.status !== filters.status) return false;
    if (filters.priority !== allFilter && task.priority !== filters.priority) return false;
    if (filters.owner && task.owner !== filters.owner) return false;
    if (filters.start && task.due_date < filters.start) return false;
    if (filters.end && task.due_date > filters.end) return false;
    return true;
  });
}

function buildWeeklyFocus(tasks: TaskRow[]) {
  const weekEnd = offsetDate(6);
  const map = new Map<string, number>();
  for (const task of tasks) {
    if (task.due_date < todayKey || task.due_date > weekEnd || task.status === "已完成" || task.status === "已取消") continue;
    map.set(task.task_type, (map.get(task.task_type) ?? 0) + 1);
  }
  return Array.from(map.entries()).map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count);
}

function isOverdue(task: TaskRow) {
  return task.due_date < todayKey && task.status !== "已完成" && task.status !== "已取消";
}

function priorityRank(priority: Priority) {
  return { "P1 紧急": 0, "P2 重要": 1, "P3 普通": 2, "P4 低": 3 }[priority];
}

function priorityTone(priority: Priority) {
  if (priority === "P1 紧急") return "risk";
  if (priority === "P2 重要") return "watch";
  return "neutral";
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-xs font-bold text-muted"><span className="mb-1.5 block">{label}</span>{children}</label>;
}

function Select({ value, options, onChange }: { value: string; options: SelectOption[]; onChange: (value: string) => void }) {
  return (
    <select className="premium-input w-full" value={value} onChange={(event) => onChange(event.target.value)}>
      {options.map((option) => {
        const item = typeof option === "string" ? { value: option, label: option } : option;
        return <option key={item.value} value={item.value}>{item.label}</option>;
      })}
    </select>
  );
}

function EmptyAction({ c, title, button, onClick }: { c: Copy; title: string; button: string; onClick: () => void }) {
  return (
    <CenterPanel eyebrow={c.emptyEyebrow} title={c.emptyTitle}>
      <div className="rounded-[26px] border border-dashed border-[#cdd8cf] bg-white/65 px-6 py-12 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#e6f2ed] text-[#17483f]"><Plus className="h-6 w-6" /></div>
        <p className="mt-4 text-base font-semibold text-ink">{title}</p>
        <button className="erp-button-primary mt-5 px-4 py-2 text-sm font-bold" onClick={onClick}>{button}</button>
      </div>
    </CenterPanel>
  );
}

function statusSelectOptions(c: Copy): SelectOption[] {
  return statusOptions.map((status) => ({ value: status, label: c.status[status] }));
}

function prioritySelectOptions(c: Copy): SelectOption[] {
  return priorityOptions.map((priority) => ({ value: priority, label: c.priority[priority] }));
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function offsetDate(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

function toDateKey(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}
