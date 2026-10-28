const $ = id => document.getElementById(id);
let mode = 'single';
let lastOutput = localStorage.getItem('wsc.outputRoot') || '';
$('outputRoot').value = lastOutput;
const api = (url, body = {}) => fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then(async response => { const data = await response.json(); if (!response.ok) throw Error(data.error || 'REQUEST_FAILED'); return data; });
const status = value => { $('status').textContent = value; };
const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const progress = events => status(events.map(event => `${event.status}: ${event.company || '配送処理'}（成功 ${event.completed}／失敗 ${event.failed}／全 ${event.total}）`).join('\n') || 'CSVを開始しました…');
const waitForCsvJob = async jobId => {
  for (;;) {
    let job;
    try {
      const response = await fetch(`/api/job/${jobId}`);
      job = await response.json();
      if (!response.ok) throw Error(job.error || 'JOB_STATUS_FAILED');
    } catch (error) {
      status(`CSV実行中です。接続状態を確認しています…（${error.message}）`);
      // The server-side execution lock remains authoritative. Keep this button
      // disabled until the existing job reaches a known terminal state.
      await wait(1000);
      continue;
    }
    progress(job.events || []);
    if (job.status === 'RUNNING') { await wait(700); continue; }
    if (job.status === 'COMPLETE') return job;
    if (job.status === 'FAILED' || job.status === 'FAILED_DELIVERY') throw Error(job.error || job.result?.deliveryError || 'PDF_EXPORT_FAILED');
    throw Error('JOB_STATUS_UNKNOWN');
  }
};
document.querySelectorAll('[data-mode]').forEach(button => button.onclick = () => { mode = button.dataset.mode; document.querySelectorAll('[data-mode]').forEach(item => item.classList.toggle('selected', item === button)); $('single').hidden = mode !== 'single'; $('csv').hidden = mode !== 'csv'; });
$('chooseCsv').onclick = async () => { $('csvPath').value = (await api('/api/choose-csv')).path || $('csvPath').value; };
$('chooseFolder').onclick = async () => { $('outputRoot').value = (await api('/api/choose-folder')).path || $('outputRoot').value; };
$('openFolder').onclick = () => api('/api/open-folder', { path: lastOutput });
$('start').onclick = async () => {
  const outputRoot = $('outputRoot').value;
  if (!outputRoot) return status('出力先フォルダを選択してください。');
  lastOutput = outputRoot; localStorage.setItem('wsc.outputRoot', outputRoot); $('openFolder').hidden = false; $('start').disabled = true;
  try {
    if (mode === 'single') {
      status('診断を実行しています…'); const result = await api('/api/run-single', { name: $('name').value, url: $('url').value, outputRoot }); status(`完了\nPDF: ${result.pdfPath}`); lastOutput = result.runRoot;
    } else {
      if (!$('csvPath').value) throw Error('CSV_FILE_REQUIRED');
      const { jobId } = await api('/api/run-csv', { csvPath: $('csvPath').value, outputRoot });
      const job = await waitForCsvJob(jobId);
      lastOutput = job.result.publicOutputRoot;
      status(`${$('status').textContent}\n完了: HTML成功 ${job.result.completed}／取得失敗 ${job.result.failed}\nPDF・ZIP: 完了\n出力: ${job.result.publicOutputRoot}`);
    }
  } catch (error) { status(`失敗: ${error.message}`); } finally { $('start').disabled = false; }
};
