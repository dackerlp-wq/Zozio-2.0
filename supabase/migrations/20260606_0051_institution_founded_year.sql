-- Krok 30: rok založení útulku pro veřejný profil („od roku …", „X let pomáháme").
-- Když je null, statistika se na webu nezobrazí.
alter table institutions add column if not exists founded_year integer;
