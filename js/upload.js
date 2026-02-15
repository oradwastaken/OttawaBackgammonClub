import { state } from './state.js';
import { saveDataToStorage } from './data.js';
import { parseExcelToData } from './excel.js';
import { showPublishActions } from './github.js';
import { rebuildAll } from './charts.js';

export function openUploadModal() {
  document.getElementById('uploadModal').classList.add('active');
  document.getElementById('upload-status').innerHTML = '';
  document.getElementById('upload-actions').style.display = 'none';
  document.getElementById('upload-file-input').value = '';
  state.pendingParsedData = null;
  document.getElementById('publish-actions').style.display = 'none';
  document.getElementById('github-settings').style.display = 'none';
  const publishStatus = document.getElementById('publish-status');
  if (publishStatus) { publishStatus.textContent = ''; publishStatus.className = 'publish-status'; }
}

export function closeUploadModal() {
  document.getElementById('uploadModal').classList.remove('active');
  state.pendingParsedData = null;
}

export function handleFileUpload(file) {
  if (!file) return;
  const ext = file.name.split('.').pop().toLowerCase();
  if (!['xlsx', 'xls'].includes(ext)) {
    showUploadStatus('Please select an Excel file (.xlsx or .xls)', 'error');
    return;
  }
  showUploadStatus('Parsing spreadsheet...', 'loading');
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const wb = XLSX.read(e.target.result, { type: 'array', cellDates: true });
      const parsed = parseExcelToData(wb);
      state.pendingParsedData = { data: parsed, fileName: file.name };
      showUploadStatus(
        `Found <strong>${parsed.players.length} players</strong> across <strong>${parsed.total_tournaments} tournaments</strong> (${parsed.years[0]}&ndash;${parsed.years[parsed.years.length - 1]})`,
        'success'
      );
      document.getElementById('upload-actions').style.display = 'flex';
    } catch (err) {
      showUploadStatus('Error: ' + err.message, 'error');
      document.getElementById('upload-actions').style.display = 'none';
    }
  };
  reader.readAsArrayBuffer(file);
}

function showUploadStatus(msg, type) {
  const el = document.getElementById('upload-status');
  el.innerHTML = msg;
  el.className = 'upload-status ' + (type || '');
}

export function applyUploadedData() {
  if (!state.pendingParsedData) return;
  state.DATA = state.pendingParsedData.data;
  saveDataToStorage(state.pendingParsedData.data, state.pendingParsedData.fileName);
  rebuildAll();
  document.getElementById('upload-actions').style.display = 'none';
  showUploadStatus('Data applied successfully!', 'success');
  showPublishActions(true);
}
