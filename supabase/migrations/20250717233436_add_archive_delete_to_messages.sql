alter table "public"."messages" add column "is_archived" boolean not null default false;
alter table "public"."messages" add column "is_deleted" boolean not null default false;
