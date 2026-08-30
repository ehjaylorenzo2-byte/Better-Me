.bm-cal-page {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* ---- Heading ------------------------------------------------------------- */
.bm-cal-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.bm-cal-year {
  font-size: 13px;
  color: var(--text-secondary);
  margin-top: 4px;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.bm-cal-count::before {
  content: '·';
  margin-right: 8px;
}

.bm-cal-nav {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
  padding-top: 4px;
}

.bm-cal-nav button {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--text-primary);
  display: flex;
  align-items: center;
  justify-content: center;
}

.bm-cal-today-btn {
  align-self: flex-start;
  padding: 8px 16px;
  border-radius: var(--radius-pill);
  background: var(--accent);
  color: var(--accent-contrast);
  border: none;
  font-family: var(--font-medium);
  font-size: 13px;
  min-height: 40px;
}

/* ---- Grid ---------------------------------------------------------------- */
.bm-cal-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  padding: 16px 12px 14px;
  box-shadow: var(--shadow-soft);
  overflow: hidden;
}

.bm-cal-weekday-row {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  text-align: center;
  font-size: 11px;
  font-family: var(--font-medium);
  letter-spacing: 0.08em;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.bm-cal-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
}

.bm-cal-slide-next { animation: bm-cal-in-next 260ms cubic-bezier(0.22, 1, 0.36, 1) both; }
.bm-cal-slide-prev { animation: bm-cal-in-prev 260ms cubic-bezier(0.22, 1, 0.36, 1) both; }

@keyframes bm-cal-in-next {
  from { opacity: 0; transform: translateX(14px); }
  to   { opacity: 1; transform: translateX(0); }
}

@keyframes bm-cal-in-prev {
  from { opacity: 0; transform: translateX(-14px); }
  to   { opacity: 1; transform: translateX(0); }
}

@media (prefers-reduced-motion: reduce) {
  .bm-cal-slide-next,
  .bm-cal-slide-prev {
    animation: none;
  }
}

.bm-cal-cell {
  aspect-ratio: 1 / 1.12;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5px;
  background: none;
  border: none;
  border-radius: var(--radius-md);
  color: var(--text-primary);
  padding: 2px;
  transition: background 140ms ease;
}

.bm-cal-day-num {
  font-family: var(--font-medium);
  font-size: 14.5px;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 160ms ease, color 160ms ease;
}

/* Ghosted rather than blank, so the grid keeps its shape at the edges. */
.bm-cal-cell.outside .bm-cal-day-num {
  color: var(--text-tertiary);
  opacity: 0.6;
}

.bm-cal-cell.today .bm-cal-day-num {
  background: var(--accent);
  color: var(--ink);
}

.bm-cal-cell.selected .bm-cal-day-num {
  background: var(--text-primary);
  color: var(--bg-primary);
}

/* Selected wins over today, but today keeps a ring so you never lose it. */
.bm-cal-cell.today.selected .bm-cal-day-num {
  box-shadow: 0 0 0 2px var(--accent);
}

.bm-cal-dots {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
  height: 9px;
}

.bm-cal-more {
  font-size: 9px;
  color: var(--text-secondary);
  line-height: 1;
}

@media (hover: hover) and (pointer: fine) {
  .bm-cal-cell:hover:not(.outside) {
    background: var(--surface-sunken);
  }
}

/* ---- Legend -------------------------------------------------------------- */
.bm-cal-legend {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
  font-size: 11.5px;
  color: var(--text-secondary);
  padding: 0 4px;
}

.bm-cal-legend span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.bm-cal-legend-swatch {
  width: 11px;
  height: 11px;
  border-radius: 50%;
}

.bm-cal-legend-swatch.today {
  background: var(--accent);
}

.bm-cal-legend-swatch.selected {
  background: var(--text-primary);
}

/* ---- Day detail page (kept for the /calendar/:date route) ---------------- */
.bm-cal-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 16px;
}

.bm-cal-month-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.bm-cal-month-nav button {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--text-primary);
  font-size: 18px;
}

/*
  Week / Month / Year.

  The switcher is a recessed track with a raised pill on the selection, which
  is the same "pressed groove holding a raised object" idea the nav uses. It
  keeps the selection legible by depth as well as by colour.
*/
.bm-cal-views {
  display: flex;
  gap: var(--space-1);
  padding: var(--space-1);
  border-radius: var(--radius-pill);
  background: var(--surface);
  box-shadow: var(--shadow-press);
  margin-bottom: var(--space-4);
}

.bm-cal-view-btn {
  flex: 1 1 0;
  min-width: 0;
  border: 0;
  background: transparent;
  border-radius: var(--radius-pill);
  min-height: 44px;
  font-family: var(--font-medium);
  font-size: 13px;
  color: var(--text-secondary);
  transition: box-shadow 160ms ease, color 160ms ease;
}

.bm-cal-view-btn.active {
  background: var(--surface);
  color: var(--text-primary);
  box-shadow: var(--shadow-raise-sm);
}

/* ---- Week: an agenda of seven rows ---- */

.bm-cal-week {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.bm-cal-week-day {
  display: flex;
  align-items: flex-start;
  gap: var(--space-4);
  width: 100%;
  text-align: left;
  border: 0;
  padding: var(--space-4);
  border-radius: var(--radius-md);
  background: var(--surface);
  box-shadow: var(--shadow-raise-sm);
  min-height: 64px;
}

.bm-cal-week-day:active {
  box-shadow: var(--shadow-press);
}

/* Today is marked by depth and an accent number, never by colour alone. */
.bm-cal-week-day.today .bm-cal-week-num {
  color: var(--accent-text);
}

.bm-cal-week-date {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  flex: none;
  width: 34px;
}

.bm-cal-week-dow {
  font-size: 11px;
  color: var(--text-tertiary);
  text-transform: uppercase;
}

.bm-cal-week-num {
  font-family: var(--font-bold);
  font-size: 18px;
  color: var(--text-primary);
}

.bm-cal-week-items {
  display: flex;
  flex-direction: column;
  gap: 4px;
  /* Long names ellipse instead of widening the row past its card. */
  min-width: 0;
  flex: 1 1 auto;
}

.bm-cal-week-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
  font-size: 13px;
  color: var(--text-primary);
}

.bm-cal-week-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bm-cal-week-time {
  flex: none;
  margin-left: auto;
  padding-left: var(--space-2);
  font-size: 12px;
  color: var(--text-secondary);
}

.bm-cal-week-empty {
  font-size: 12.5px;
  color: var(--text-tertiary);
}

/* ---- Year: twelve months, shaded by how full each one is ---- */

.bm-cal-year-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-3);
}

@media (min-width: 700px) {
  .bm-cal-year-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

.bm-cal-year-month {
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-2);
  border: 0;
  padding: var(--space-4);
  min-height: 84px;
  border-radius: var(--radius-md);
  background: var(--surface);
  box-shadow: var(--shadow-raise-sm);
}

.bm-cal-year-month:active {
  box-shadow: var(--shadow-press);
}

/*
  The shading is a separate layer behind the text rather than a background on
  the button, so its opacity never drags the label's contrast down with it.
*/
.bm-cal-year-fill {
  position: absolute;
  inset: 0;
  background: var(--gradient-accent);
  pointer-events: none;
}

.bm-cal-year-label,
.bm-cal-year-count {
  position: relative;
  z-index: 1;
}

.bm-cal-year-label {
  font-family: var(--font-medium);
  font-size: 13px;
  color: var(--text-primary);
}

.bm-cal-year-count {
  font-family: var(--font-bold);
  font-size: 20px;
  color: var(--text-primary);
}

.bm-cal-year-month.today {
  box-shadow: var(--shadow-raise), inset 0 0 0 2px var(--accent);
}

@media (prefers-reduced-motion: reduce) {
  .bm-cal-view-btn {
    transition: none;
  }
}

/* "Aug 30 – Sep 5" is far longer than "August" and wraps at phone width. */
.bm-cal-title-week {
  font-size: 26px;
  line-height: 1.15;
}
