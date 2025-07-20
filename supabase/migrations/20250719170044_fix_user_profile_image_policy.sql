alter policy "Auth users can read public user info" on "public"."users" to authenticated with check (true);
alter policy "Auth users can read public user info" on "public"."users" to authenticated using (true);
alter policy "Auth users can read public user info" on "public"."users" to authenticated for select using (true);
alter policy "Auth users can read public user info" on "public"."users" to authenticated for insert with check (true);
alter policy "Auth users can read public user info" on "public"."users" to authenticated for update using (true) with check (true);
alter policy "Auth users can read public user info" on "public"."users" to authenticated for delete using (true);

create policy "Public users can view profiles"
on "public"."users" for select
to public
using (true);
