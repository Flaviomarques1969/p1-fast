import { createRequire } from 'node:module';
const { createClient } = createRequire(new URL('../../package.json', import.meta.url).pathname)('@supabase/supabase-js');
const n = createClient('https://fvhwltzhytpnhlqbttmd.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ2aHdsdHpoeXRwbmhscWJ0dG1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4MTExNDAsImV4cCI6MjA5MzM4NzE0MH0._ZpxksUnuVFhLzCB5x7bBiZ_VLQQR5cH4A1T-0-mvrA');
const conta = {};
for (const c of ['cockpit-bubi-dev-teste','cockpit-bubi-live']) { conta[c]=0; n.channel(c).on('broadcast',{event:'*'},()=>conta[c]++).subscribe(); }
setTimeout(()=>{ console.log(new Date().toLocaleTimeString('pt-BR'), 'mensagens em 8 s:', JSON.stringify(conta)); process.exit(0); }, 8000);
