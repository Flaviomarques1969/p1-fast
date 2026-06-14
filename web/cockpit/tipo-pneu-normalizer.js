const SINONIMOS = {
  'radial-185-14': ['radial 185/14','radial-185/14','radial 185-14','radial-185-14'],
  'semi-slick': ['semi slick','semislick','semi-slick'],
  'slick': ['slick'],
  'westlake-z108-185-60-r14': ['westlake z108 185/60 r14','westlake-z108-185-60-r14'],
};
export function normalizarTipoPneu(input){
  if(!input || typeof input!=='string') return 'desconhecido';
  const t = input.trim().toLowerCase();
  if(Object.keys(SINONIMOS).includes(t)) return t;
  for(const [c,sin] of Object.entries(SINONIMOS)){ if(sin.map(s=>s.toLowerCase()).includes(t)) return c; }
  console.warn('[tipo-pneu-normalizer] valor desconhecido: "'+input+'" -> usando "'+t+'"');
  return t;
}
export const TIPOS_PNEU_CANONICOS = Object.keys(SINONIMOS);
