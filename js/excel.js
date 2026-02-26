import { toTitleCase } from './state.js';

// Excel parser — uses global XLSX from CDN

export function parseExcelToData(workbook) {
  // Find the data sheet (try "Club Points" first, else first sheet)
  let sheetName = workbook.SheetNames.find(n => n.toLowerCase().includes('club') || n.toLowerCase().includes('point'));
  if (!sheetName) sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

  if (rows.length < 2) throw new Error('Spreadsheet appears empty');

  // Find header row (look for "Date" and "Player" columns)
  let headerIdx = 0;
  for (let i = 0; i < Math.min(5, rows.length); i++) {
    const row = rows[i];
    if (row && row.some(c => String(c).toLowerCase() === 'date') && row.some(c => String(c).toLowerCase() === 'player')) {
      headerIdx = i;
      break;
    }
  }

  const header = rows[headerIdx].map(h => String(h || '').trim().toLowerCase());
  const dateCol = header.findIndex(h => h === 'date');
  const playerCol = header.findIndex(h => h === 'player');
  const winsCol = header.findIndex(h => h === 'wins');
  const lossesCol = header.findIndex(h => h.startsWith('lose') || h.startsWith('loss'));
  const placingCol = header.findIndex(h => h.includes('placing') || h.includes('points for'));

  if (dateCol < 0 || playerCol < 0) throw new Error('Could not find "Date" and "Player" columns');
  if (winsCol < 0) throw new Error('Could not find "Wins" column');
  if (lossesCol < 0) throw new Error('Could not find "Losses" column');

  // Parse data rows
  const dataRows = rows.slice(headerIdx + 1);
  const tournamentDates = new Set();
  const playerMap = {};      // player -> { wins, losses, placing_pts, tournamentsSet, yearlyMap }
  const attendance = {};     // dateStr -> count
  const tournamentHistory = {}; // player -> [{date, wins, losses}, ...]

  for (const row of dataRows) {
    if (!row || !row[dateCol] || !row[playerCol]) continue;

    // Parse date
    let dateVal = row[dateCol];
    let dateStr;
    if (dateVal instanceof Date) {
      dateStr = dateVal.toISOString().slice(0, 10);
    } else if (typeof dateVal === 'number') {
      // Excel serial date
      const d = XLSX.SSF.parse_date_code(dateVal);
      dateStr = `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
    } else {
      dateStr = String(dateVal).trim().slice(0, 10);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) continue;

    const name = toTitleCase(String(row[playerCol]).trim());
    if (!name) continue;

    const wins = Number(row[winsCol]) || 0;
    const losses = Number(row[lossesCol]) || 0;
    const placing = (placingCol >= 0 && row[placingCol] != null && String(row[placingCol]).trim() !== '')
      ? Number(row[placingCol]) || 0 : 0;

    const year = dateStr.slice(0, 4);
    tournamentDates.add(dateStr);

    if (!attendance[dateStr]) attendance[dateStr] = 0;
    attendance[dateStr]++;

    if (!playerMap[name]) {
      playerMap[name] = { wins: 0, losses: 0, placing_pts: 0, tournament_win_pts: 0, advancement_pts: 0, tournamentsSet: new Set(), placed_dates: new Set(), yearlyMap: {} };
    }
    const p = playerMap[name];
    p.wins += wins;
    p.losses += losses;
    p.placing_pts += placing;
    if (placing === 4) p.tournament_win_pts += 4;
    else if (placing > 0) p.advancement_pts += placing;
    p.tournamentsSet.add(dateStr);
    if (placing > 0) p.placed_dates.add(dateStr);

    if (!p.yearlyMap[year]) p.yearlyMap[year] = { tournaments: new Set(), wins: 0, losses: 0, placing_pts: 0, tournament_win_pts: 0, advancement_pts: 0, placed: new Set() };
    const ym = p.yearlyMap[year];
    ym.tournaments.add(dateStr);
    ym.wins += wins;
    ym.losses += losses;
    ym.placing_pts += placing;
    if (placing === 4) ym.tournament_win_pts += 4;
    else if (placing > 0) ym.advancement_pts += placing;
    if (placing > 0) ym.placed.add(dateStr);

    // Collect per-tournament history for rolling win % charts
    if (!tournamentHistory[name]) tournamentHistory[name] = [];
    tournamentHistory[name].push({ date: dateStr, wins, losses, placing });
  }

  const total_tournaments = tournamentDates.size;
  const sortedDates = [...tournamentDates].sort();
  const yearsSet = new Set(sortedDates.map(d => d.slice(0, 4)));
  const years = [...yearsSet].sort();

  // Build players array
  const playersArr = Object.entries(playerMap).map(([name, p]) => {
    const tournaments = p.tournamentsSet.size;
    const total_matches = p.wins + p.losses;
    const total_points = p.wins + p.placing_pts;
    const win_pct = total_matches > 0 ? +((p.wins / total_matches) * 100).toFixed(1) : 0;
    const ppt = tournaments > 0 ? +(total_points / tournaments).toFixed(2) : 0;
    const placed_count = p.placed_dates.size;
    const placed_pct = tournaments > 0 ? +((placed_count / tournaments) * 100).toFixed(1) : 0;
    const participation_pct = total_tournaments > 0 ? +((tournaments / total_tournaments) * 100).toFixed(1) : 0;
    return { player: name, total_points, wins: p.wins, losses: p.losses, total_matches, win_pct, tournaments, ppt, placed_count, placed_pct, placing_pts: p.placing_pts, tournament_win_pts: p.tournament_win_pts, advancement_pts: p.advancement_pts, participation_pct };
  });

  // Sort by total_points desc for top 10 selection
  const sortedByPoints = [...playersArr].sort((a, b) => b.total_points - a.total_points);
  const top10Names = sortedByPoints.slice(0, 10).map(p => p.player);

  // Build yearly_performance for ALL players (needed for year filtering)
  const yearly_performance = {};
  for (const [name, p] of Object.entries(playerMap)) {
    yearly_performance[name] = years.map(y => {
      const ym = p.yearlyMap[y];
      if (!ym || ym.tournaments.size === 0) return { year: y, tournaments: 0, wins: 0, losses: 0, points: 0, placing_pts: 0, placed_count: 0, ppt: 0, win_pct: 0 };
      const t = ym.tournaments.size;
      const pts = ym.wins + ym.placing_pts;
      const matches = ym.wins + ym.losses;
      return {
        year: y, tournaments: t, wins: ym.wins, losses: ym.losses,
        points: pts, placing_pts: ym.placing_pts, placed_count: ym.placed.size,
        tournament_win_pts: ym.tournament_win_pts, advancement_pts: ym.advancement_pts,
        ppt: t > 0 ? +(pts / t).toFixed(2) : 0,
        win_pct: matches > 0 ? +((ym.wins / matches) * 100).toFixed(1) : 0
      };
    });
  }

  // Build cumulative for all players (top 10 used as default selection)
  const cumulative = {};
  for (const name of Object.keys(yearly_performance)) {
    let running = 0;
    cumulative[name] = years.map(y => {
      const yp = yearly_performance[name].find(yy => yy.year === y);
      running += yp ? yp.points : 0;
      return { year: y, cumulative: running };
    });
  }

  // Count unique players per year
  const unique_players_per_year = {};
  for (const y of years) {
    let count = 0;
    for (const entries of Object.values(yearly_performance)) {
      const yp = entries.find(e => e.year === y);
      if (yp && yp.tournaments > 0) count++;
    }
    unique_players_per_year[y] = count;
  }

  // Sort each player's tournament history chronologically
  for (const name in tournamentHistory) {
    tournamentHistory[name].sort((a, b) => a.date.localeCompare(b.date));
  }

  return { players: playersArr, total_tournaments, attendance, cumulative, yearly_performance, years, unique_players_per_year, tournament_history: tournamentHistory };
}
