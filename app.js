/* BTX Docs Saúde - versão estável SEM PWA
   - Sem service worker: evita cache/congelamento.
   - Tudo local, simples e previsível.
*/

const $ = (id) => document.getElementById(id);
const qs = (sel, el=document) => el.querySelector(sel);
const qsa = (sel, el=document) => [...el.querySelectorAll(sel)];

function todayBR(){
  const d = new Date();
  const dd = String(d.getDate()).padStart(2,'0');
  const mm = String(d.getMonth()+1).padStart(2,'0');
  const yy = d.getFullYear();
  return `${dd}/${mm}/${yy}`;
}

function setIfEmpty(input, value){
  if (!input) return;
  if (!input.value || !String(input.value).trim()) input.value = value;
}

function saveJSON(key, obj){
  localStorage.setItem(key, JSON.stringify(obj));
}
function loadJSON(key, fallback){
  try{
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  }catch(e){
    return fallback;
  }
}

const STORAGE_CFG = "btx_cfg_v1";

const state = {
  tab: "receituario",
  rxMode: "adulto",
  rxSelected: [], // {id, name}
};

const medsBase = [
  { id:"dip500", name:"Dipirona 500 mg (comprimido)", meta:"Analgésico/antitérmico", cat:"analgesico",
    textAdulto:"Dipirona 500 mg — 1 comp VO a cada 6–8h se dor/febre, por até 3 dias.\n",
    textPedi:"Dipirona (gotas) — dose conforme peso (mg/kg), a cada 6–8h se dor/febre.\n",
    textLivre:"Dipirona — (ajustar dose e via).\n"
  },
  { id:"para500", name:"Paracetamol 500 mg (comprimido)", meta:"Analgésico/antitérmico", cat:"analgesico",
    textAdulto:"Paracetamol 500 mg — 1 comp VO a cada 6–8h se dor/febre, por até 3 dias.\n",
    textPedi:"Paracetamol — dose conforme peso (mg/kg), a cada 6–8h se dor/febre.\n",
    textLivre:"Paracetamol — (ajustar dose e via).\n"
  },
  { id:"ibu600", name:"Ibuprofeno 600 mg (comprimido)", meta:"AINE", cat:"antiinflamatorio",
    textAdulto:"Ibuprofeno 600 mg — 1 comp VO a cada 8–12h após alimentação, por 3 dias.\n",
    textPedi:"Ibuprofeno — dose conforme peso (mg/kg) a cada 8h, se indicado.\n",
    textLivre:"Ibuprofeno — (ajustar dose e via).\n"
  },
  { id:"amox500", name:"Amoxicilina 500 mg (cápsula)", meta:"Antibiótico", cat:"antibiotico",
    textAdulto:"Amoxicilina 500 mg — 1 cáps VO a cada 8h por 7 dias.\n",
    textPedi:"Amoxicilina — dose conforme peso (mg/kg/dia), dividir em 8/8h, por 7 dias.\n",
    textLivre:"Amoxicilina — (ajustar dose e duração).\n"
  },
  { id:"clx012", name:"Clorexidina 0,12% (enxaguante)", meta:"Antisséptico bucal", cat:"antibiotico",
    textAdulto:"Clorexidina 0,12% — bochechar 15 mL por 30s, 2x/dia por 7 dias.\n",
    textPedi:"Clorexidina 0,12% — uso conforme orientação (avaliar idade/risco de deglutição).\n",
    textLivre:"Clorexidina — (ajustar concentração e uso).\n"
  }
];

const quickTemplates = {
  analgesico: ["dip500","para500"],
  antiinflamatorio: ["ibu600"],
  antibiotico: ["amox500","clx012"]
};

function init(){
  // Datas padrão
  setIfEmpty($("rx_data"), todayBR());
  setIfEmpty($("ld_data"), todayBR());
  setIfEmpty($("rc_data"), todayBR());
  setIfEmpty($("or_data"), todayBR());
  setIfEmpty($("at_data"), todayBR());
  setIfEmpty($("fc_data"), todayBR());

  // Atestado texto padrão
  setIfEmpty($("at_texto"),
`Declaro para os devidos fins que o(a) paciente acima identificado(a) esteve sob meus cuidados, necessitando afastar-se de suas atividades por ${$("at_tempo").value || "____"}.
`);

  // Config carregar
  const cfg = loadJSON(STORAGE_CFG, null);
  if (cfg){
    $("cfg_nome").value = cfg.nome || "";
    $("cfg_registro").value = cfg.registro || "";
    $("cfg_tel").value = cfg.tel || "";
    $("cfg_cidade").value = cfg.cidade || "";
    $("cfg_end").value = cfg.end || "";
  }

  // Sidebar nav
  qsa(".navbtn").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      switchTab(btn.dataset.tab);
    });
  });

  // Mobile menu
  $("menuBtn").addEventListener("click", ()=>{
    $("sidebar").classList.toggle("open");
  });

  // Top actions
  $("btnPrint").addEventListener("click", ()=> doPrint(false));
  $("btnPreview").addEventListener("click", ()=> doPrint(true));
  $("btnNew").addEventListener("click", resetCurrentTab);

  // RX mode
  qsa(".segbtn").forEach(b=>{
    b.addEventListener("click", ()=>{
      qsa(".segbtn").forEach(x=>x.classList.remove("active"));
      b.classList.add("active");
      state.rxMode = b.dataset.mode;
    });
  });

  // RX search + list
  renderMedsList(medsBase);
  $("rx_search").addEventListener("input", ()=>{
    const q = $("rx_search").value.trim().toLowerCase();
    const filtered = medsBase.filter(m =>
      m.name.toLowerCase().includes(q) || (m.meta||"").toLowerCase().includes(q)
