export function exportCSV(rows, data) {
  if (!rows || !rows.length) {
    alert('Nessun dato da esportare');
    return;
  }
  const commesse = data?.commesse || [];
  const posizioni = data?.posizioni || [];
  const profiles = data?.profiles || [];
  const header = ['Data','Dipendente','Commessa','Posizione','Ore','Descrizione','Stato'];
  const lines = [header.join(',')];
  for (const r of rows) {
    const user = profiles.find(p=>p.id===r.user_id);
    const comm = commesse.find(c=>c.id===r.commessa_id);
    const pos = posizioni.find(p=>p.id===r.posizione_id);
    const vals = [
      new Date(r.data).toISOString().slice(0,10),
      escapeCsv(user?.full_name || user?.email || ''),
      escapeCsv(comm?.code || ''),
      escapeCsv(pos?.name || ''),
      String(r.ore ?? ''),
      escapeCsv(r.descrizione || ''),
      escapeCsv(r.stato || ''),
    ];
    lines.push(vals.join(','));
  }
  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `rapportini_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function escapeCsv(v){
  const s = String(v ?? '');
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g,'""') + '"';
  return s;
}

export function exportPDF(rows, data) {
  if (!rows || !rows.length) {
    alert('Nessun dato da esportare');
    return;
  }
  const commesse = data?.commesse || [];
  const posizioni = data?.posizioni || [];
  const profiles = data?.profiles || [];
  const w = window.open('', '_blank');
  const css = `
    body{ font-family: Arial, sans-serif; padding:16px }
    h2{ margin:0 0 12px 0 }
    table{ width:100%; border-collapse:collapse }
    th,td{ border:1px solid #ddd; padding:6px; font-size:12px; text-align:left }
    thead{ background:#f3f4f6 }
  `;
  const rowsHtml = rows.map(r=>{
    const user = profiles.find(p=>p.id===r.user_id);
    const comm = commesse.find(c=>c.id===r.commessa_id);
    const pos = posizioni.find(p=>p.id===r.posizione_id);
    return `<tr>
      <td>${new Date(r.data).toLocaleDateString()}</td>
      <td>${escapeHtml(user?.full_name || user?.email || '')}</td>
      <td>${escapeHtml(comm?.code || '')}</td>
      <td>${escapeHtml(pos?.name || '')}</td>
      <td>${escapeHtml(r.ore ?? '')}</td>
      <td>${escapeHtml(r.descrizione || '')}</td>
      <td>${escapeHtml(r.stato || '')}</td>
    </tr>`;
  }).join('');
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Export Report</title><style>${css}</style></head><body>
    <h2>Report Rapportini</h2>
    <table>
      <thead><tr><th>Data</th><th>Dipendente</th><th>Commessa</th><th>Posizione</th><th>Ore</th><th>Descrizione</th><th>Stato</th></tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>
    <script>window.onload = function(){ window.print(); setTimeout(()=>window.close(), 300); }<\/script>
  </body></html>`);
  w.document.close();
}

function escapeHtml(s){
  return String(s).replace(/[&<>\"']/g, c=> ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;','\'':'&#39;'}[c]));
}
