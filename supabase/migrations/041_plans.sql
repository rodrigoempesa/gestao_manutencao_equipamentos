-- Migration 041 - Planos de assinatura + trial de 7 dias

alter table public.tenants
  add column if not exists plan text not null default 'starter'
    check (plan in ('starter', 'pro', 'enterprise')),
  add column if not exists trial_ends_at timestamptz,
  add column if not exists paid boolean not null default false;

comment on column public.tenants.plan is 'starter | pro | enterprise';
comment on column public.tenants.trial_ends_at is 'Data de expiração do período gratuito de 7 dias';
comment on column public.tenants.paid is 'true = assinatura ativa (pago ou liberado manualmente)';
