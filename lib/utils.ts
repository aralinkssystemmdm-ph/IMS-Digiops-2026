
export function parseAssignedTeams(teamStr: string | null | undefined): string[] {
  if (!teamStr) return ['Aralinks'];
  const rawParts = teamStr.split(/[,;/|]+/).map(p => p.trim()).filter(Boolean);
  const result: string[] = [];

  for (const part of rawParts) {
    const lower = part.toLowerCase();
    let canonical = '';
    if (lower === 'aralinks' || lower === 'aralink') {
      canonical = 'Aralinks';
    } else if (lower === 'protrack' || lower === 'pro-track' || lower === 'pro track') {
      canonical = 'Protrack';
    } else if (part.length > 0) {
      canonical = toTitleCase(part);
    }

    if (canonical && !result.some(existing => existing.toLowerCase() === canonical.toLowerCase())) {
      result.push(canonical);
    }
  }

  return result.length > 0 ? result : ['Aralinks'];
}

export function isTeamAccessible(
  itemTeam: string | null | undefined, 
  userTeam: string | null | undefined, 
  userRole?: string | null
): boolean {
  if (userRole === 'Super admin' || userRole === 'Super Admin') return true;
  
  const assigned = parseAssignedTeams(userTeam);
  // If user has access to both main teams, allow all
  if (assigned.some(t => t.toLowerCase() === 'aralinks') && assigned.some(t => t.toLowerCase() === 'protrack')) {
    return true;
  }

  const cleanItemTeam = (itemTeam || 'Aralinks').trim().toLowerCase();
  return assigned.some(t => t.toLowerCase() === cleanItemTeam);
}

export function toTitleCase(text: string) {
  return text.replace(/\w\S*/g, (word) =>
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  );
}

export function cleanPONumber(poString: string | null | undefined): string {
  if (!poString) return '';
  
  return poString.split(';')
    .map(part => {
      // Regex to match: PO_NUMBER [SUPPLIER] {CODE:QTY,...}
      const match = part.match(/^(.*?)\s*(?:\[(.*?)\])?\s*\{(.*)\}$|^(.*?)\s*\[(.*?)\]$|^(.*)$/);
      if (match) {
        if (match[1] !== undefined) return match[1].trim();
        if (match[4] !== undefined) return match[4].trim();
        return match[6].trim();
      }
      return part.trim();
    })
    .join(', ');
}

const DYNAMIC_BUNDLE_PALETTES = [
  { bg: '#2563eb', text: '#ffffff', lightBg: '#eff6ff', border: '#bfdbfe' }, // Blue
  { bg: '#7c3aed', text: '#ffffff', lightBg: '#f5f3ff', border: '#ddd6fe' }, // Violet
  { bg: '#0891b2', text: '#ffffff', lightBg: '#ecfeff', border: '#a5f3fc' }, // Cyan
  { bg: '#059669', text: '#ffffff', lightBg: '#ecfdf5', border: '#a7f3d0' }, // Emerald
  { bg: '#d97706', text: '#ffffff', lightBg: '#fffbeb', border: '#fde68a' }, // Amber
  { bg: '#db2777', text: '#ffffff', lightBg: '#fdf2f8', border: '#fbcfe8' }, // Pink
  { bg: '#4f46e5', text: '#ffffff', lightBg: '#eef2ff', border: '#c7d2fe' }, // Indigo
  { bg: '#ea580c', text: '#ffffff', lightBg: '#fff7ed', border: '#fed7aa' }, // Orange
  { bg: '#0d9488', text: '#ffffff', lightBg: '#f0fdfa', border: '#99f6e4' }, // Teal
  { bg: '#c026d3', text: '#ffffff', lightBg: '#fdf4ff', border: '#f5d0fe' }  // Fuchsia
];

export function getBundleColor(bundleName: string) {
  if (!bundleName) return null;
  const raw = bundleName.toLowerCase();
  const clean = raw.replace(/[^a-z0-9]/g, '');
  
  if (clean.includes('littlebits') || clean.includes('aftools') || raw.includes('af tools')) return { bg: '#22c55e', text: '#ffffff', lightBg: '#f0fdf4', border: '#bcf0da' }; // Green
  if (clean.includes('makeymakey')) return { bg: '#f97316', text: '#ffffff', lightBg: '#fff7ed', border: '#fed7aa' }; // Orange
  if (clean.includes('microbit')) return { bg: '#3b82f6', text: '#ffffff', lightBg: '#eff6ff', border: '#bfdbfe' }; // Blue
  if (clean.includes('arduino')) return { bg: '#8b5cf6', text: '#ffffff', lightBg: '#f5f3ff', border: '#ddd6fe' }; // Violet
  if (clean.includes('raspberry')) return { bg: '#ec4899', text: '#ffffff', lightBg: '#fdf2f8', border: '#fbcfe8' }; // Pink

  // Deterministic palette pick based on string hash for all other bundles
  let hash = 0;
  for (let i = 0; i < bundleName.length; i++) {
    hash = (hash << 5) - hash + bundleName.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % DYNAMIC_BUNDLE_PALETTES.length;
  return DYNAMIC_BUNDLE_PALETTES[index];
}

export function getProgramBadgeClass(program: string | null | undefined): string {
  if (!program) return 'bg-slate-55 dark:bg-slate-805 text-slate-400 border border-slate-200/30';
  const prog = program.toUpperCase();
  if (prog === 'ACE') return 'bg-orange-100 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400 border border-orange-200/50';
  if (prog === 'HUB') return 'bg-blue-100 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 border border-blue-200/50';
  if (prog === 'NGS') return 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-200/50';
  if (prog === 'TNL') return 'bg-indigo-100 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400 border border-indigo-200/50';
  if (prog.includes('ACE') && prog.includes('NGS')) {
    return 'bg-purple-100 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400 border border-purple-200/50';
  }
  if (prog.includes('ACE') && prog.includes('HUB')) {
    return 'bg-sky-100 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400 border border-sky-200/50';
  }
  if (prog.includes('PELS')) {
    return 'bg-teal-100 text-teal-650 dark:bg-teal-500/10 dark:text-teal-400 border border-teal-200/50';
  }
  if (prog.includes('ABDL')) {
    return 'bg-rose-100 text-rose-650 dark:bg-rose-500/10 dark:text-rose-400 border border-rose-200/50';
  }
  if (prog.includes('GATEKEEPING')) {
    return 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-300 border border-cyan-200/50';
  }
  if (prog.includes('CASHLESS')) {
    return 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300 border border-amber-200/50';
  }
  if (prog.includes('PARENT PORTAL')) {
    return 'bg-violet-100 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300 border border-violet-200/50';
  }
  if (prog.includes('GRADING')) {
    return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300 border border-emerald-200/50';
  }
  return 'bg-slate-100 text-slate-705 dark:bg-slate-800 dark:text-slate-300 border border-slate-200/50';
}

