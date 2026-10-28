const $ = id => document.getElementById(id);
let mode = 'single';
let outputDirectory = null;
let pendingDelivery = null;
const api = (url, body = {}) => fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then(async response => { const data = await response.json(); if (!response.ok) { const error = Error(data.error || 'REQUEST_FAILED'); error.details = data; throw error; } return data; });
const status = value => { $('status').textContent = value; };
const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const exclusion = event => event.rejectedCount ? `／除外 ${event.rejectedCount}件（${event.rejectionReasons.map(reason => `${reason.code}: ${reason.count}件`).join('、')}）` : '';
const progress = events => status(events.map(event => `${event.status}: ${event.company || '配送処理'}（成功 ${event.completed}／失敗 ${event.failed}／全 ${event.total}${exclusion(event)}）`).join('\n') || 'CSVを開始しました…');
const inputError = error => {
  const rejected = error.details?.rejectedRows;
  if (!rejected?.length) return error.message;
  const reasons = Object.entries(rejected.reduce((counts, row) => ({ ...counts, [row.code]: (counts[row.code] || 0) + 1 }), {})).map(([code, count]) => `${code}: ${count}件`);
  return `${error.message}\n除外 ${rejected.length}件（${reasons.join('、')}）`;
};
const requireOutputPermission = async () => outputDirectory && (await outputDirectory.queryPermission({ mode: 'readwrite' }) === 'granted' || await outputDirectory.requestPermission({ mode: 'readwrite' }) === 'granted');
const saveArtifacts = async delivery => {
  if (!await requireOutputPermission()) throw Error('OUTPUT_FOLDER_PERMISSION_REQUIRED');
  for (const artifact of delivery.artifacts) {
    if (delivery.saved.has(artifact.name)) continue;
    let exists = false;
    try { await outputDirectory.getFileHandle(artifact.name); exists = true; } catch (error) { if (error.name !== 'NotFoundError') throw error; }
    if (exists) throw Error(`OUTPUT_FILENAME_EXISTS: ${artifact.name}`);
    const response = await fetch(artifact.url); if (!response.ok) throw Error(`ARTIFACT_DOWNLOAD_FAILED: ${artifact.name}`);
    const writable = await (await outputDirectory.getFileHandle(artifact.name, { create: true })).createWritable();
    await writable.write(await response.arrayBuffer()); await writable.close(); delivery.saved.add(artifact.name);
  }
};
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
$('chooseFolder').onclick = async () => { try { const selected = await window.showDirectoryPicker({ mode: 'readwrite' }); outputDirectory = selected; $('outputFolder').textContent = `出力先：${selected.name}`; } catch (error) { if (error.name !== 'AbortError') status(`出力先フォルダを選択できませんでした: ${error.message}`); } };
$('start').onclick = async () => {
  if (!outputDirectory) return status('出力先フォルダを選択してください。');
  if (!await requireOutputPermission()) return status('出力先フォルダへの保存権限を許可してください。');
  $('start').disabled = true;
  try {
    if (pendingDelivery) { await saveArtifacts(pendingDelivery); pendingDelivery = null; status('保存が完了しました。'); return; }
    if (mode === 'single') {
      status('診断を実行しています…'); const result = await api('/api/run-single', { name: $('name').value, url: $('url').value }); pendingDelivery = { artifacts: result.artifacts, saved: new Set() }; await saveArtifacts(pendingDelivery); pendingDelivery = null; status('PDFの保存が完了しました。');
    } else {
      const csvFile = $('csvFile').files[0];
      if (!csvFile) throw Error('CSV_FILE_REQUIRED');
      const { jobId } = await api('/api/run-csv', { csv: await csvFile.text() });
      const job = await waitForCsvJob(jobId);
      pendingDelivery = { artifacts: job.result.artifacts, saved: new Set() }; await saveArtifacts(pendingDelivery); pendingDelivery = null;
      status(`${$('status').textContent}\n完了: HTML成功 ${job.result.completed}／取得失敗 ${job.result.failed}\nPDF・ZIPの保存が完了しました。`);
    }
  } catch (error) { status(`失敗: ${inputError(error)}`); } finally { $('start').disabled = false; }
};
