"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarCheck2, CheckCircle2, Clock3, Flame, ListChecks, Target, TimerReset } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { CenterHero, CenterPanel, EmptyState, ExecutiveKpi, KpiGrid, MetricLine, StatusPill } from "@/components/ManagementCenter";
import { supabase } from "@/lib/supabase";

type TaskStatus = "待处理" | "进行中" | "已完成" | "已取消";
type Priority = "P1 紧急" | "P2 重要" | "P3 普通" | "P4 低优先级";
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

const todayKey = new Date().toISOString().slice(0, 10);
const sampleTasks: TaskRow[] = [
  { id: "sample-1", task_name: "确认白色 99.1x163 下周补货数量", task_type: "补货", priority: "P1 紧急", owner: "老板", due_date: todayKey, status: "待处理", remark: "结合近 7 日销量与库存周转", created_at: todayKey },
  { id: "sample-2", task_name: "整理新品供应商 A 报价差异", task_type: "新品开发", priority: "P2 重要", owner: "采购", due_date: todayKey, status: "进行中", remark: "关注 MOQ 与交期", created_at: todayKey },
  { id: "sample-3", task_name: "回复安装问题高频客诉模板", task_type: "客户投诉", priority: "P1 紧急", owner: "客服", due_date: todayKey, status: "待处理", remark: "优先处理白色系列", created_at: todayKey },
  { id: "sample-4", task_name: "复盘 Milk Run 入仓异常记录", task_type: "供应商对接", priority: "P3 普通", owner: "运营", due_date: offsetDate(-1), status: "待处理", remark: "逾期事项", created_at: offsetDate(-3) },
  { id: "sample-5", task_name: "完成本周利润率异常 SKU 检查", task_type: "经营分析", priority: "P2 重要", owner: "财务", due_date: offsetDate(4), status: "已完成", remark: "已同步采购成本", created_at: offsetDate(-2) }
];

const columns: TaskStatus[] = ["待处理", "进行中", "已完成"];

export default function TaskCenterPage() {
  return (
    <AppShell>
      <TaskCenterContent />
    </AppShell>
  );
}

function TaskCenterContent() {
  const [tasks, setTasks] = useState<TaskRow[]>(sampleTasks);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  useEffect(() => {
    loadTasks();
  }, []);

  async function loadTasks() {
    const { data, error } = await supabase.from("tasks").select("*").order("due_date", { ascending: true }).order("created_at", { ascending: false });
    if (!error && data?.length) setTasks(data as TaskRow[]);
  }

  async function moveTask(taskId: string, status: TaskStatus) {
    setTasks((current) => current.map((task) => task.id === taskId ? { ...task, status } : task));
    if (!taskId.startsWith("sample-")) await supabase.from("tasks").update({ status }).eq("id", taskId);
  }

  const metrics = useMemo(() => buildMetrics(tasks), [tasks]);
  const topPriority = [...tasks]
    .filter((task) => task.status !== "已完成" && task.status !== "已取消")
    .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || a.due_date.localeCompare(b.due_date))
    .slice(0, 3);

  return (
    <div className="space-y-6">
      <CenterHero
        eyebrow="Task Center"
        title="待办中心"
        subtitle="老板每天打开第一眼看到今天要推进什么、本周要抓什么、哪些事项已经影响经营节奏。"
        action={<StatusPill tone="brand">执行中枢</StatusPill>}
      >
        <KpiGrid>
          <ExecutiveKpi icon={Clock3} label="今日待办" value={metrics.today} hint="Today" tone="brand" />
          <ExecutiveKpi icon={CalendarCheck2} label="本周待办" value={metrics.week} hint="This Week" />
          <ExecutiveKpi icon={AlertTriangle} label="逾期任务" value={metrics.overdue} hint="Overdue" tone={metrics.overdue ? "risk" : "good"} />
          <ExecutiveKpi icon={CheckCircle2} label="已完成任务" value={metrics.done} hint="Completed" tone="good" />
          <ExecutiveKpi icon={TimerReset} label="完成率" value={`${metrics.completionRate}%`} hint="Completion" tone={metrics.completionRate >= 70 ? "good" : "watch"} />
          <ExecutiveKpi icon={Flame} label="P1 紧急" value={metrics.p1} hint="Critical" tone={metrics.p1 ? "risk" : "neutral"} />
        </KpiGrid>
      </CenterHero>

      <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
        <div className="space-y-5">
          <CenterPanel eyebrow="Top Priority" title="今日重点">
            <div className="space-y-3">
              {topPriority.map((task, index) => (
                <article key={task.id} className={`rounded-2xl border bg-white/75 p-4 shadow-[0_10px_28px_rgba(23,33,29,0.06)] ${isOverdue(task) ? "border-red-200" : "border-line"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#17483f] text-sm font-bold text-white">{index + 1}</span>
                      <div>
                        <h3 className="font-semibold leading-snug text-ink">{task.task_name}</h3>
                        <p className="mt-1 text-xs text-muted">{task.task_type} · {task.owner} · 截止 {task.due_date}</p>
                      </div>
                    </div>
                    <StatusPill tone={priorityTone(task.priority)}>{task.priority}</StatusPill>
                  </div>
                  {task.remark ? <p className="mt-3 rounded-xl bg-[#f4f2e9] px-3 py-2 text-xs leading-5 text-muted">{task.remark}</p> : null}
                </article>
              ))}
            </div>
          </CenterPanel>

          <CenterPanel eyebrow="Weekly Operating Focus" title="本周经营重点">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              {["补货", "新品开发", "客户投诉", "供应商对接"].map((type) => {
                const count = tasks.filter((task) => task.task_type === type && task.status !== "已完成").length;
                return <MetricLine key={type} label={type} value={`${count} 项待推进`} tone={count ? "brand" : "good"} />;
              })}
            </div>
          </CenterPanel>
        </div>

        <CenterPanel eyebrow="Kanban Execution" title="任务看板模式" aside={<StatusPill tone="brand">拖拽切换状态</StatusPill>}>
          <div className="grid gap-4 lg:grid-cols-3">
            {columns.map((status) => (
              <div
                key={status}
                className="min-h-[420px] rounded-[22px] border border-line bg-[#f6f5f0]/80 p-3"
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => draggingId && moveTask(draggingId, status)}
              >
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-semibold text-ink">{status}</h3>
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-muted">{tasks.filter((task) => task.status === status).length}</span>
                </div>
                <div className="space-y-3">
                  {tasks.filter((task) => task.status === status).map((task) => (
                    <article
                      key={task.id}
                      draggable
                      onDragStart={() => setDraggingId(task.id)}
                      onDragEnd={() => setDraggingId(null)}
                      className={`cursor-grab rounded-2xl border bg-white/85 p-4 shadow-[0_10px_24px_rgba(23,33,29,0.06)] active:cursor-grabbing ${isOverdue(task) ? "border-red-200 ring-2 ring-red-100" : "border-white"}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <h4 className="font-semibold leading-snug text-ink">{task.task_name}</h4>
                        <StatusPill tone={priorityTone(task.priority)}>{task.priority.split(" ")[0]}</StatusPill>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <StatusPill tone="neutral">{task.task_type}</StatusPill>
                        <StatusPill tone={isOverdue(task) ? "risk" : "neutral"}>{task.due_date}</StatusPill>
                      </div>
                      <div className="mt-3 flex items-center justify-between text-xs text-muted">
                        <span>{task.owner}</span>
                        <span>{task.created_at.slice(0, 10)}</span>
                      </div>
                    </article>
                  ))}
                  {!tasks.some((task) => task.status === status) ? <EmptyState text="暂无任务" /> : null}
                </div>
              </div>
            ))}
          </div>
        </CenterPanel>
      </div>
    </div>
  );
}

function buildMetrics(tasks: TaskRow[]) {
  const today = todayKey;
  const weekEnd = offsetDate(6);
  const active = tasks.filter((task) => task.status !== "已取消");
  const done = active.filter((task) => task.status === "已完成").length;
  return {
    today: active.filter((task) => task.due_date === today && task.status !== "已完成").length,
    week: active.filter((task) => task.due_date >= today && task.due_date <= weekEnd && task.status !== "已完成").length,
    overdue: active.filter(isOverdue).length,
    done,
    completionRate: active.length ? Math.round((done / active.length) * 100) : 0,
    p1: active.filter((task) => task.priority === "P1 紧急" && task.status !== "已完成").length
  };
}

function isOverdue(task: TaskRow) {
  return task.due_date < todayKey && task.status !== "已完成" && task.status !== "已取消";
}

function priorityRank(priority: Priority) {
  return { "P1 紧急": 0, "P2 重要": 1, "P3 普通": 2, "P4 低优先级": 3 }[priority];
}

function priorityTone(priority: Priority) {
  if (priority === "P1 紧急") return "risk";
  if (priority === "P2 重要") return "watch";
  return "neutral";
}

function offsetDate(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}
