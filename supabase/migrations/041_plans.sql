-- Migration 041 - Planos de assinatura nos tenants

alter table public.tenants
  add column if not exists plan text not null default 'starter'
    check (plan in ('starter', 'pro', 'enterprise'));

comment on column public.tenants.plan is 'starter | pro | enterprise';
