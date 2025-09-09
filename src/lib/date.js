// ISO week helpers (Mon-Sun)
export function startOfISOWeek(d) { const x=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate())); const day=x.getUTCDay()||7; if(day!==1)x.setUTCDate(x.getUTCDate()-(day-1)); x.setUTCHours(0,0,0,0); return x }
export function addDays(d,n){const x=new Date(d); x.setUTCDate(x.getUTCDate()+n); return x}
export function endOfISOWeek(d){const s=startOfISOWeek(d); const e=addDays(s,6); e.setUTCHours(23,59,59,999); return e}
export function nextISOWeekStart(d){const s=startOfISOWeek(d); return addDays(s,7)}
export function formatYMD(d){return d.toISOString().slice(0,10)}
