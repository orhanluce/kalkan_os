-- Dikey E, E1 (ADR §7): Proof Room 4. polimorfik hedef —
-- cloud_assurance_profile_snapshots. "Tam olarak bir hedef" CHECK'i 3'ten
-- 4'e genişler (GÜNCEL sürüm temel alındı: 20260720200000).

alter table public.proof_room_links
  drop constraint proof_room_links_tek_hedef,
  add column cloud_assurance_profile_id uuid references public.cloud_assurance_profile_snapshots (id) on delete cascade,
  add constraint proof_room_links_tek_hedef check (
    (case when test_run_id is not null then 1 else 0 end)
    + (case when roi_export_run_id is not null then 1 else 0 end)
    + (case when graph_snapshot_id is not null then 1 else 0 end)
    + (case when cloud_assurance_profile_id is not null then 1 else 0 end)
    = 1
  );

create index proof_room_links_cloud_assurance_idx on public.proof_room_links (cloud_assurance_profile_id) where cloud_assurance_profile_id is not null;
