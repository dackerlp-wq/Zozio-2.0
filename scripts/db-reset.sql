-- Drop partial migration state — safe to re-run.
drop table if exists notifications cascade;
drop table if exists application_events cascade;
drop table if exists applications cascade;
drop table if exists applicant_profiles cascade;
drop table if exists vet_records cascade;
drop table if exists vaccinations cascade;
drop table if exists animals cascade;
drop table if exists kennels cascade;
drop table if exists institution_members cascade;
drop table if exists institutions cascade;

drop function if exists is_institution_member(uuid) cascade;
drop function if exists institution_role(uuid) cascade;
drop function if exists set_updated_at() cascade;
drop function if exists immutable_unaccent(text) cascade;

drop type if exists notification_type cascade;
drop type if exists application_status cascade;
drop type if exists adopter_experience cascade;
drop type if exists compatibility cascade;
drop type if exists energy_level cascade;
drop type if exists health_status cascade;
drop type if exists adoption_status cascade;
drop type if exists animal_size cascade;
drop type if exists sex cascade;
drop type if exists species cascade;
drop type if exists member_role cascade;
drop type if exists institution_type cascade;
