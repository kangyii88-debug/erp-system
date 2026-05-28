# Coupang Inventory ERP

轻量库存 ERP 第一版，用于韩国电商团队管理 Coupang 商品、库存、采购和补货建议。

## 页面结构

- `/login`: 邮箱密码登录
- `/dashboard`: 数据看板，总库存、低库存、7天销量、建议补货
- `/products`: 商品管理
- `/inventory`: 入库、出库、库存变动记录
- `/purchases`: 中国工厂采购单和生产/发货状态
- `/import-export`: CSV 导入导出，Excel 可直接打开 CSV

## 启动

```bash
npm install
npm run dev
```

复制 `.env.example` 为 `.env.local`，填入 Supabase 项目的 URL 和 anon key。

## 数据库

在 Supabase SQL Editor 运行 `supabase/schema.sql`。然后在 Supabase Authentication 里创建用户，或开启邮箱注册后在登录页注册。

## 补货逻辑

建议补货数量 = `max(0, ceil(最近7天日均销量 * 14 - 当前库存 - 未完成采购数量))`

第一版默认覆盖 14 天安全库存，可在 `src/lib/replenishment.ts` 修改。
