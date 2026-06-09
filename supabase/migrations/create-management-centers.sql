create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_name text not null,
  task_type text not null,
  priority text not null default 'P3 普通' check (priority in ('P1 紧急', 'P2 重要', 'P3 普通', 'P4 低优先级')),
  owner text not null,
  due_date date not null,
  status text not null default '待处理' check (status in ('待处理', '进行中', '已完成', '已取消')),
  remark text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists product_development (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_name text not null,
  product_image_url text,
  product_category text not null,
  supplier text,
  purchase_cost numeric(12, 2) not null default 0,
  expected_price numeric(12, 2) not null default 0,
  expected_margin numeric(8, 2),
  owner text not null,
  development_status text not null default '待开发' check (development_status in ('待开发', '询价中', '打样中', '测试中', '优化中', '待上架', '已上线', '已放弃')),
  expected_launch_date date,
  priority text not null default 'B级' check (priority in ('S级', 'A级', 'B级', 'C级')),
  market_potential_score integer not null default 0 check (market_potential_score between 0 and 100),
  competition_score integer not null default 0 check (competition_score between 0 and 100),
  supply_chain_score integer not null default 0 check (supply_chain_score between 0 and 100),
  profit_score integer not null default 0 check (profit_score between 0 and 100),
  remark text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists customer_issues (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  issue_date date not null,
  sku text not null,
  product_name text not null,
  issue_category text not null check (issue_category in ('安装问题', '质量问题', '尺寸问题', '颜色问题', '物流问题', '包装问题', '功能问题', '其它问题')),
  issue_description text not null,
  customer_original_text text,
  solution text,
  owner text not null,
  status text not null default '待处理' check (status in ('待处理', '处理中', '已解决', '已关闭')),
  remark text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tasks_user_due_status_idx on tasks (user_id, due_date, status);
create index if not exists product_development_user_status_idx on product_development (user_id, development_status, priority);
create index if not exists customer_issues_user_date_category_idx on customer_issues (user_id, issue_date, issue_category);
create index if not exists customer_issues_user_sku_idx on customer_issues (user_id, sku);

create trigger tasks_updated_at before update on tasks
for each row execute function set_updated_at();

create trigger product_development_updated_at before update on product_development
for each row execute function set_updated_at();

create trigger customer_issues_updated_at before update on customer_issues
for each row execute function set_updated_at();

alter table tasks enable row level security;
alter table product_development enable row level security;
alter table customer_issues enable row level security;

create policy "tasks owner access" on tasks
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "product development owner access" on product_development
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "customer issues owner access" on customer_issues
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
