alter table public.appointments
    add column if not exists slots jsonb;

update public.appointments
set slots = '[]'::jsonb
where slots is null;

alter table public.appointments
    alter column slots set default '[]'::jsonb,
    alter column slots set not null;

alter table public.votes
    add column if not exists selected_indices jsonb not null default '[]'::jsonb;

create unique index if not exists votes_one_per_voter_per_appointment
    on public.votes (appointment_id, voter_name);

alter table public.appointments enable row level security;
alter table public.votes enable row level security;

drop policy if exists "Anyone can read appointments" on public.appointments;
create policy "Anyone can read appointments"
    on public.appointments for select
    to anon, authenticated
    using (true);

drop policy if exists "Anyone can create appointments" on public.appointments;
create policy "Anyone can create appointments"
    on public.appointments for insert
    to anon, authenticated
    with check (
        title is not null
        and char_length(btrim(title)) between 1 and 100
        and host_name is not null
        and char_length(btrim(host_name)) between 1 and 20
        and memo is not null
        and jsonb_typeof(slots) = 'array'
        and jsonb_array_length(slots) between 1 and 200
    );

drop policy if exists "Anyone can read appointment votes" on public.votes;
create policy "Anyone can read appointment votes"
    on public.votes for select
    to anon, authenticated
    using (true);

drop policy if exists "Anyone can submit appointment votes" on public.votes;
create policy "Anyone can submit appointment votes"
    on public.votes for insert
    to anon, authenticated
    with check (
        char_length(btrim(voter_name)) between 1 and 20
        and jsonb_typeof(selected_indices) = 'array'
        and jsonb_array_length(selected_indices) between 1 and 200
        and exists (
            select 1
            from public.appointments
            where appointments.id = votes.appointment_id
        )
    );

grant select, insert on public.appointments to anon, authenticated;
grant select, insert on public.votes to anon, authenticated;
