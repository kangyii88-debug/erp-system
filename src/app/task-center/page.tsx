"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarCheck2, CheckCircle2, Clock3, Edit3, Flame, Plus, Trash2, TimerReset } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { CenterHero, CenterPanel, EmptyState, ExecutiveKpi, KpiGrid, MetricLine, StatusPill } from "@/components/ManagementCenter";
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
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [filters, setFilters] = useState({ status: "全部", priority: "全部", owner: "", start: "", end: "" });
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadTasks();
  }, []);

  async function loadTasks() {
    const { data, error } = await supabase.from("tasks").select("*").order("due_date", { ascending: true }).order("created_at", { ascending: false });
    if (error) {
      setMessage(error.message);
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
      setMessage(result.error.message);
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
      setMessage(error.message);
      await loadTasks();
    }
  }

  async function deleteTask(taskId: string) {
    if (!window.confirm("确定删除这个任务吗？")) return;
    const { error } = await supabase.from("tasks").delete().eq("id", taskId);
    if (error) {
      setMessage(error.message);
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
        eyebrow="Task Center"
        title="待办中心"
        subtitle="所有任务由你手动创建。系统只负责保存、统计、筛选、提醒和展示。"
        action={<button className="erp-button-primary inline-flex items-center gap-2 px-4 py-2 text-sm font-bold" onClick={() => { setForm(emptyForm); setEditingId(null); setShowForm(true); }}><Plus className="h-4 w-4" />新增任务</button>}
      >
        <KpiGrid>
          <ExecutiveKpi icon={Clock3} label="今日待办" value={metrics.today} hint="真实任务" tone="brand" />
          <ExecutiveKpi icon={CalendarCheck2} label="本周待办" value={metrics.week} hint="真实任务" />
          <ExecutiveKpi icon={AlertTriangle} label="逾期任务" value={metrics.overdue} hint="按截止日期" tone={metrics.overdue ? "risk" : "good"} />
          <ExecutiveKpi icon={CheckCircle2} label="已完成任务" value={metrics.done} hint="真实任务" tone="good" />
          <ExecutiveKpi icon={TimerReset} label="完成率" value={`${metrics.completionRate}%`} hint="真实统计" tone={metrics.completionRate >= 70 ? "good" : "watch"} />
          <ExecutiveKpi icon={Flame} label="P1 紧急" value={metrics.p1} hint="真实任务" tone={metrics.p1 ? "risk" : "neutral"} />
        </KpiGrid>
      </CenterHero>

      {message ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{message}</div> : null}

      {showForm ? (
        <TaskForm
          form={form}
          editing={Boolean(editingId)}
          onChange={setForm}
          onSubmit={saveTask}
          onCancel={() => { setShowForm(false); setEditingId(null); setForm(emptyForm); }}
        />
      ) : null}

      {!tasks.length ? (
        <EmptyAction title="暂无任务，请点击新增任务创建今日待办。" button="新增任务" onClick={() => setShowForm(true)} />
      ) : (
        <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
          <div className="space-y-5">
            <CenterPanel eyebrow="Top Priority" title="今日重点">
              <div className="space-y-3">
                {topPriority.length ? topPriority.map((task, index) => (
                  <TaskCard key={task.id} task={task} rank={index + 1} onEdit={startEdit} onDelete={deleteTask} onDone={() => updateStatus(task.id, "已完成")} />
                )) : <EmptyState text="暂无未完成任务。" />}
              </div>
            </CenterPanel>

            <CenterPanel eyebrow="Weekly Focus" title="本周经营重点">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                {weeklyFocus.length ? weeklyFocus.map((item) => (
                  <MetricLine key={item.type} label={item.type} value={`${item.count} 项`} tone="brand" />
                )) : <EmptyState text="暂无本周待办统计。" />}
              </div>
            </CenterPanel>
          </div>

          <div className="space-y-5">
            <TaskFilters filters={filters} owners={unique(tasks.map((task) => task.owner))} onChange={setFilters} />
            <CenterPanel eyebrow="Kanban" title="任务看板" aside={<StatusPill tone="brand">仅真实任务</StatusPill>}>
              <div className="grid gap-4 lg:grid-cols-3">
                {boardColumns.map((status) => (
                  <div key={status} className="min-h-[420px] rounded-[22px] border border-line bg-[#f6f5f0]/80 p-3" onDragOver={(event) => event.preventDefault()} onDrop={() => draggingId && updateStatus(draggingId, status)}>
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="font-semibold text-ink">{status}</h3>
                      <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-muted">{filteredTasks.filter((task) => task.status === status).length}</span>
                    </div>
                    <div className="space-y-3">
                      {filteredTasks.filter((task) => task.status === status).map((task) => (
                        <TaskCard key={task.id} task={task} compact draggable onDragStart={() => setDraggingId(task.id)} onDragEnd={() => setDraggingId(null)} onEdit={startEdit} onDelete={deleteTask} onDone={() => updateStatus(task.id, "已完成")} />
                      ))}
                      {!filteredTasks.some((task) => task.status === status) ? <EmptyState text="暂无任务" /> : null}
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

function TaskForm({ form, editing, onChange, onSubmit, onCancel }: { form: typeof emptyForm; editing: boolean; onChange: (form: typeof emptyForm) => void; onSubmit: (event: FormEvent) => void; onCancel: () => void }) {
  return (
    <CenterPanel eyebrow={editing ? "Edit Task" : "New Task"} title={editing ? "编辑任务" : "新增任务"}>
      <form onSubmit={onSubmit} className="grid gap-4 lg:grid-cols-4">
        <Field label="任务标题"><input className="premium-input" required value={form.task_name} onChange={(event) => onChange({ ...form, task_name: event.target.value })} /></Field>
        <Field label="任务类型"><input className="premium-input" required value={form.task_type} onChange={(event) => onChange({ ...form, task_type: event.target.value })} /></Field>
        <Field label="优先级"><Select value={form.priority} options={priorityOptions} onChange={(value) => onChange({ ...form, priority: value as Priority })} /></Field>
        <Field label="负责人"><input className="premium-input" required value={form.owner} onChange={(event) => onChange({ ...form, owner: event.target.value })} /></Field>
        <Field label="截止日期"><input className="premium-input" type="date" required value={form.due_date} onChange={(event) => onChange({ ...form, due_date: event.target.value })} /></Field>
        <Field label="状态"><Select value={form.status} options={statusOptions} onChange={(value) => onChange({ ...form, status: value as TaskStatus })} /></Field>
        <Field label="备注"><input className="premium-input" value={form.remark} onChange={(event) => onChange({ ...form, remark: event.target.value })} /></Field>
        <div className="flex items-end gap-2">
          <button className="erp-button-primary h-10 px-4 text-sm font-bold" type="submit">{editing ? "保存修改" : "创建任务"}</button>
          <button className="erp-button-subtle h-10 px-4 text-sm font-bold" type="button" onClick={onCancel}>取消</button>
        </div>
      </form>
    </CenterPanel>
  );
}

function TaskFilters({ filters, owners, onChange }: { filters: { status: string; priority: string; owner: string; start: string; end: string }; owners: string[]; onChange: (filters: { status: string; priority: string; owner: string; start: string; end: string }) => void }) {
  return (
    <CenterPanel eyebrow="Filters" title="筛选任务">
      <div className="grid gap-3 md:grid-cols-5">
        <Select value={filters.status} options={["全部", ...statusOptions]} onChange={(status) => onChange({ ...filters, status })} />
        <Select value={filters.priority} options={["全部", ...priorityOptions]} onChange={(priority) => onChange({ ...filters, priority })} />
        <Select value={filters.owner || "全部负责人"} options={["全部负责人", ...owners]} onChange={(owner) => onChange({ ...filters, owner: owner === "全部负责人" ? "" : owner })} />
        <input className="premium-input" type="date" value={filters.start} onChange={(event) => onChange({ ...filters, start: event.target.value })} />
        <input className="premium-input" type="date" value={filters.end} onChange={(event) => onChange({ ...filters, end: event.target.value })} />
      </div>
    </CenterPanel>
  );
}

function TaskCard({ task, rank, compact, draggable, onDragStart, onDragEnd, onEdit, onDelete, onDone }: { task: TaskRow; rank?: number; compact?: boolean; draggable?: boolean; onDragStart?: () => void; onDragEnd?: () => void; onEdit: (task: TaskRow) => void; onDelete: (id: string) => void; onDone: () => void }) {
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
        <StatusPill tone={priorityTone(task.priority)}>{compact ? task.priority.split(" ")[0] : task.priority}</StatusPill>
      </div>
      {task.remark && !compact ? <p className="mt-3 rounded-xl bg-[#f4f2e9] px-3 py-2 text-xs leading-5 text-muted">{task.remark}</p> : null}
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        {task.status !== "已完成" ? <button className="erp-button-subtle inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold" onClick={onDone}><CheckCircle2 className="h-3.5 w-3.5" />完成</button> : null}
        <button className="erp-button-subtle inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold" onClick={() => onEdit(task)}><Edit3 className="h-3.5 w-3.5" />编辑</button>
        <button className="rounded-xl border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-bold text-red-700" onClick={() => onDelete(task.id)}><Trash2 className="inline h-3.5 w-3.5" /> 删除</button>
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
    if (filters.status !== "全部" && task.status !== filters.status) return false;
    if (filters.priority !== "全部" && task.priority !== filters.priority) return false;
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

function Select({ value, options, onChange }: { value: string; options: string[]; onChange: (value: string) => void }) {
  return <select className="premium-input w-full" value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select>;
}

function EmptyAction({ title, button, onClick }: { title: string; button: string; onClick: () => void }) {
  return (
    <CenterPanel eyebrow="Empty" title="暂无数据">
      <div className="rounded-[26px] border border-dashed border-[#cdd8cf] bg-white/65 px-6 py-12 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#e6f2ed] text-[#17483f]"><Plus className="h-6 w-6" /></div>
        <p className="mt-4 text-base font-semibold text-ink">{title}</p>
        <button className="erp-button-primary mt-5 px-4 py-2 text-sm font-bold" onClick={onClick}>{button}</button>
      </div>
    </CenterPanel>
  );
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
