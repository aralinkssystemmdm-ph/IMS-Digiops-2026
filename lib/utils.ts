
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

export function getBundleColor(bundleName: string) {
  const raw = bundleName.toLowerCase();
  const clean = raw.replace(/[^a-z0-9]/g, '');
  
  if (clean.includes('littlebits') || clean.includes('aftools') || raw.includes('af tools')) return { bg: '#22c55e', text: '#ffffff', lightBg: '#f0fdf4', border: '#bcf0da' }; // Green
  if (clean.includes('makeymakey')) return { bg: '#f97316', text: '#ffffff', lightBg: '#fff7ed', border: '#fed7aa' }; // Orange
  if (clean.includes('microbit')) return { bg: '#3b82f6', text: '#ffffff', lightBg: '#eff6ff', border: '#bfdbfe' }; // Blue
  if (clean.includes('arduino')) return { bg: '#8b5cf6', text: '#ffffff', lightBg: '#f5f3ff', border: '#ddd6fe' }; // Violet
  if (clean.includes('raspberry')) return { bg: '#ec4899', text: '#ffffff', lightBg: '#fdf2f8', border: '#fbcfe8' }; // Pink
  return null;
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
  return 'bg-slate-100 text-slate-705 dark:bg-slate-800 dark:text-slate-300 border border-slate-200/50';
}

