// Theme utilities — no chart imports (avoids circular deps)

export function isDark() {
  return document.documentElement.style.colorScheme !== 'light';
}

export function applyChartDefaults() {
  const dark = isDark();
  Chart.defaults.color = dark ? '#94a3b8' : '#475569';
  Chart.defaults.font.family = "'Inter', sans-serif";
  Chart.defaults.font.size = 11;
  Chart.defaults.plugins.legend.labels.usePointStyle = true;
  Chart.defaults.plugins.legend.labels.pointStyleWidth = 10;
  Chart.defaults.plugins.tooltip.backgroundColor = dark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)';
  Chart.defaults.plugins.tooltip.titleColor = dark ? '#f1f5f9' : '#1e293b';
  Chart.defaults.plugins.tooltip.bodyColor = dark ? '#cbd5e1' : '#475569';
  Chart.defaults.plugins.tooltip.borderColor = dark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
  Chart.defaults.plugins.tooltip.borderWidth = 1;
  Chart.defaults.plugins.tooltip.cornerRadius = 8;
  Chart.defaults.plugins.tooltip.padding = 12;
  Chart.defaults.plugins.tooltip.titleFont = { size: 13, weight: '600' };
  Chart.defaults.plugins.tooltip.bodyFont = { size: 12 };
  Chart.defaults.scale.grid.color = dark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.06)';
  Chart.defaults.scale.border.color = dark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.08)';
}

export function restoreTheme() {
  const saved = localStorage.getItem('theme');
  if (saved === 'light') {
    document.documentElement.style.colorScheme = 'light';
    document.getElementById('themeToggle').innerHTML = '&#9728;';
  }
}
