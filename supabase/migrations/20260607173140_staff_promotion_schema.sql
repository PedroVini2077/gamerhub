-- Coluna de controle: desde quando o usuário está no cargo atual.
-- Necessária para validar a regra de "1 ano como admin" antes de virar super_admin.
alter table profiles add column if not exists role_changed_at timestamptz not null default now();
update profiles set role_changed_at = created_at where role_changed_at = now() and created_at is not null;

-- Indicações/auto-indicações para staff (admin/super_admin), com avaliação (trial) e decisão final.
-- Uma única linha acompanha todo o ciclo: pending -> trial_active -> confirmed/reverted (ou rejected/cancelled).
create table staff_nominations (
  id                   uuid primary key default gen_random_uuid(),
  candidate_id         uuid not null references profiles(id) on delete cascade,
  nominated_by         uuid references profiles(id) on delete set null,
  target_role          text not null check (target_role in ('admin','super_admin')),
  status               text not null default 'pending'
                         check (status in ('pending','rejected','trial_active','confirmed','reverted','cancelled')),
  eligibility_snapshot jsonb,
  review_notes         text,
  reviewed_by          uuid references profiles(id) on delete set null,
  decided_at           timestamptz,
  trial_started_at     timestamptz,
  trial_review_date    timestamptz,
  final_decision_notes text,
  final_decided_by     uuid references profiles(id) on delete set null,
  final_decided_at     timestamptz,
  created_at           timestamptz not null default now()
);

create index idx_staff_nominations_candidate on staff_nominations(candidate_id);
create index idx_staff_nominations_status on staff_nominations(status);

-- Solicitações de rebaixamento — fluxo simétrico ao de promoção: motivo obrigatório + análise/aprovação.
create table role_change_requests (
  id            uuid primary key default gen_random_uuid(),
  target_id     uuid not null references profiles(id) on delete cascade,
  requested_by  uuid not null references profiles(id) on delete set null,
  previous_role text not null,
  proposed_role text not null,
  reason        text not null,
  status        text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_by   uuid references profiles(id) on delete set null,
  review_notes  text,
  decided_at    timestamptz,
  created_at    timestamptz not null default now()
);

create index idx_role_change_requests_target on role_change_requests(target_id);
create index idx_role_change_requests_status on role_change_requests(status);

-- RLS: tudo passa pelas RPCs (SECURITY DEFINER, dono postgres com BYPASSRLS).
-- Cliente só pode ler — e só o que faz sentido pra ele ver.
alter table staff_nominations enable row level security;
alter table role_change_requests enable row level security;

create policy staff_nominations_select on staff_nominations for select
  using (
    auth.uid() = candidate_id
    or auth.uid() = nominated_by
    or exists (select 1 from profiles where id = auth.uid() and role in ('super_admin','owner'))
  );

create policy role_change_requests_select on role_change_requests for select
  using (
    auth.uid() = requested_by
    or exists (select 1 from profiles where id = auth.uid() and role in ('super_admin','owner'))
  );
;
