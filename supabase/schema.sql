-- =============================================
-- VIDEO TASKS DATABASE SCHEMA
-- Виконати в Supabase SQL Editor одним запуском.
-- =============================================

-- =============================================
-- TABLES
-- =============================================

-- 1. PROFILES: розширення auth.users
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

-- 2. TASKS
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'todo'
    check (status in ('todo', 'in_progress', 'review', 'done')),
  source_video_path text,
  source_video_duration_sec numeric,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tasks_status_idx on public.tasks(status);
create index tasks_user_id_idx on public.tasks(user_id);

-- 3. SCENES: результат FFmpeg scene detection (іммутабельний)
create table public.scenes (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  scene_index integer not null,
  start_sec numeric not null,
  end_sec numeric not null,
  created_at timestamptz not null default now(),
  unique (task_id, scene_index)
);

create index scenes_task_id_idx on public.scenes(task_id);

-- 4. VERSIONS: версії монтажу (v1, v2...)
create table public.versions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  version_number integer not null,
  name text not null,
  rendered_video_path text,
  rendered_duration_sec numeric,
  render_status text not null default 'pending'
    check (render_status in ('pending', 'rendering', 'done', 'failed')),
  render_duration_ms bigint,
  render_error text,
  created_at timestamptz not null default now(),
  unique (task_id, version_number)
);

create index versions_task_id_idx on public.versions(task_id);

-- 5. VERSION_SEGMENTS: таймлайн версії (мутабельний)
create table public.version_segments (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.versions(id) on delete cascade,
  source_scene_id uuid references public.scenes(id) on delete set null,
  position integer not null,
  start_sec numeric not null,
  end_sec numeric not null,
  created_at timestamptz not null default now()
);

create index version_segments_version_id_idx
  on public.version_segments(version_id, position);

-- 6. COMMENTS
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index comments_task_id_idx on public.comments(task_id, created_at);

-- 7. ERROR_LOGS
create table public.error_logs (
  id uuid primary key default gen_random_uuid(),
  stage text not null
    check (stage in ('upload', 'scene_detection', 'render', 'auth', 'db', 'telegram', 'other')),
  error_type text,
  message text not null,
  stack_trace text,
  user_id uuid references auth.users(id) on delete set null,
  task_id uuid references public.tasks(id) on delete set null,
  context jsonb,
  is_critical boolean not null default false,
  created_at timestamptz not null default now()
);

create index error_logs_created_at_idx on public.error_logs(created_at desc);
create index error_logs_stage_idx on public.error_logs(stage);

-- =============================================
-- TRIGGERS
-- =============================================

-- Автостворення profile при реєстрації нового юзера
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Автооновлення updated_at при зміні задачі
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger tasks_touch_updated_at
  before update on public.tasks
  for each row execute function public.touch_updated_at();

-- =============================================
-- RLS POLICIES
-- =============================================

alter table public.profiles enable row level security;
alter table public.tasks enable row level security;
alter table public.scenes enable row level security;
alter table public.versions enable row level security;
alter table public.version_segments enable row level security;
alter table public.comments enable row level security;
alter table public.error_logs enable row level security;

-- PROFILES
create policy "profiles_read_all" on public.profiles
  for select using (auth.role() = 'authenticated');
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- TASKS
create policy "tasks_read_all" on public.tasks
  for select using (auth.role() = 'authenticated');
create policy "tasks_insert_own" on public.tasks
  for insert with check (auth.uid() = user_id);
create policy "tasks_update_all" on public.tasks
  for update using (auth.role() = 'authenticated');
create policy "tasks_delete_own" on public.tasks
  for delete using (auth.uid() = user_id);

-- SCENES (write через service_role, read для всіх авторизованих)
create policy "scenes_read_all" on public.scenes
  for select using (auth.role() = 'authenticated');

-- VERSIONS
create policy "versions_read_all" on public.versions
  for select using (auth.role() = 'authenticated');
create policy "versions_insert_all" on public.versions
  for insert with check (auth.role() = 'authenticated');
create policy "versions_update_all" on public.versions
  for update using (auth.role() = 'authenticated');

-- VERSION_SEGMENTS
create policy "version_segments_read_all" on public.version_segments
  for select using (auth.role() = 'authenticated');
create policy "version_segments_insert_all" on public.version_segments
  for insert with check (auth.role() = 'authenticated');
create policy "version_segments_update_all" on public.version_segments
  for update using (auth.role() = 'authenticated');
create policy "version_segments_delete_all" on public.version_segments
  for delete using (auth.role() = 'authenticated');

-- COMMENTS
create policy "comments_read_all" on public.comments
  for select using (auth.role() = 'authenticated');
create policy "comments_insert_own" on public.comments
  for insert with check (auth.uid() = user_id);
create policy "comments_update_own" on public.comments
  for update using (auth.uid() = user_id);
create policy "comments_delete_own" on public.comments
  for delete using (auth.uid() = user_id);

-- ERROR_LOGS: тільки адміни читають, пишуть через service_role
create policy "error_logs_read_admin" on public.error_logs
  for select using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.is_admin = true
    )
  );

-- =============================================
-- STORAGE POLICIES
-- Виконати ПІСЛЯ створення bucket'ів source-videos і rendered-videos.
-- =============================================

create policy "source_videos_read_authenticated" on storage.objects
  for select using (
    bucket_id = 'source-videos' and auth.role() = 'authenticated'
  );

create policy "source_videos_insert_authenticated" on storage.objects
  for insert with check (
    bucket_id = 'source-videos' and auth.role() = 'authenticated'
  );

create policy "rendered_videos_read_authenticated" on storage.objects
  for select using (
    bucket_id = 'rendered-videos' and auth.role() = 'authenticated'
  );

create policy "rendered_videos_insert_authenticated" on storage.objects
  for insert with check (
    bucket_id = 'rendered-videos' and auth.role() = 'authenticated'
  );

-- =============================================
-- RPC FUNCTIONS (для адмінки)
-- =============================================

create or replace function public.get_tasks_stats_by_user()
returns table (
  user_id uuid,
  full_name text,
  email text,
  total_tasks bigint,
  todo_count bigint,
  in_progress_count bigint,
  review_count bigint,
  done_count bigint
)
language sql
security definer
set search_path = public
as $$
  select
    p.id as user_id,
    p.full_name,
    p.email,
    count(t.id) as total_tasks,
    count(t.id) filter (where t.status = 'todo') as todo_count,
    count(t.id) filter (where t.status = 'in_progress') as in_progress_count,
    count(t.id) filter (where t.status = 'review') as review_count,
    count(t.id) filter (where t.status = 'done') as done_count
  from public.profiles p
  left join public.tasks t on t.user_id = p.id
  group by p.id, p.full_name, p.email
  order by total_tasks desc, p.email asc;
$$;