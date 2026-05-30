-- ===========================================================================
-- Fáze 13 — Pohledový zdravotní stav při příjmu
-- Zdravotní stav na kartě zvířete slouží jako příjmová informace o tom, jaký
-- byl pohledový (vizuální) stav zvířete při převzetí. Rozšiřujeme enum o
-- „nemocné" a „neznámo", aby personál mohl při příjmu vybrat i tyto stavy.
-- ===========================================================================

alter type health_status add value if not exists 'sick' after 'healthy';
alter type health_status add value if not exists 'unknown' after 'special_needs';
