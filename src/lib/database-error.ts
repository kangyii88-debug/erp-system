const schemaFixPath = "supabase/migrations/repair-management-centers-schema.sql";

export function formatDatabaseError(message: string, tableName: string) {
  if (message.includes("Could not find the table") || message.includes("schema cache")) {
    return `数据库表尚未创建：${tableName}。请先在 Supabase SQL Editor 执行 ${schemaFixPath}，然后刷新页面再保存。`;
  }

  return message;
}
