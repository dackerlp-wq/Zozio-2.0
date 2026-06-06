-- Nová role „Dobrovolník". Musí běžet samostatně (ALTER TYPE ADD VALUE
-- nelze v transakci s dalšími příkazy).
alter type member_role add value if not exists 'volunteer';
