delete from advertising_daily_records a
using advertising_daily_records b
where a.id < b.id
  and a.user_id = b.user_id
  and a.record_date = b.record_date
  and a.campaign_name = b.campaign_name;

create unique index if not exists advertising_daily_records_user_day_campaign_uidx
  on advertising_daily_records (user_id, record_date, campaign_name);
