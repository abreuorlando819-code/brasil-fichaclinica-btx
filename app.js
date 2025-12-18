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
    );
    renderMedsList(filtered);
  });

  // Quick templates
  qsa(".pill[data-quick]").forEach(p=>{
    p.addEventListener("click", ()=>{
      const key = p.dataset.quick;
      const ids = quickTemplates[key] || [];
      ids.forEach(id => addMedToRx(id));
    });
  });

  // Manual item
  $("btnManual").addEventListener("click", openManualModal);
  $("btnCancelManual").addEventListener("click", closeManualModal);
  $("modalBackdrop").addEventListener("click", closeManualModal);
  $("btnAddManual").addEventListener("click", addManualItem);

  // Clear RX
  $("btnClearRx").addEventListener("click", ()=>{
    if (!confirm("Limpar receituário (itens e textos)?")) return;
    state.rxSelected = [];
    $("rx_texto").value = "";
    $("rx_obs").value = "";
    renderRxChips();
  });

  // Config save/reset
  $("btnSaveCfg").addEventListener("click", saveCfg);
  $("btnResetCfg").addEventListener("click", ()=>{
    if (!confirm("Restaurar configurações (limpar dados salvos)?")) return;
    localStorage.removeItem(STORAGE_CFG);
    ["cfg_nome","cfg_registro","cfg_tel","cfg_cidade","cfg_end"].forEach(id=>$(id).value="");
    alert("Configurações restauradas.");
  });

  // Atestado tempo -> atualizar texto se vazio
  $("at_tempo").addEventListener("input", ()=>{
    const t = $("at_tempo").value.trim();
    if (!t) return;
    const cur = $("at_texto").value || "";
    if (cur.includes("necessitando afastar-se")){
      $("at_texto").value =
`Declaro para os devidos fins que o(a) paciente acima identificado(a) esteve sob meus cuidados, necessitando afastar-se de suas atividades por ${t}.
`;
    }
  });
}

function switchTab(tab){
  state.tab = tab;

  qsa(".navbtn").forEach(b=>b.classList.toggle("active", b.dataset.tab===tab));
  qsa(".tab").forEach(sec=>sec.classList.add("hidden"));
  $("tab-"+tab).classList.remove("hidden");

  // Title/sub
  const titles = {
    receituario:["Receituário","Selecione itens, ajuste e imprima."],
    laudo:["Laudo","Modelo livre para PDF."],
    recibo:["Recibo","Simples e profissional."],
    orcamento:["Orçamento","Texto livre (sem soma automática)."],
    atestado:["Atestado","Com afastamento e CID opcional."],
    ficha:["Ficha Clínica","Essencial e rápida."],
    config:["Configurações","Dados do profissional para cabeçalho/assinatura."]
  };
  $("pageTitle").textContent = titles[tab]?.[0] || "BTX";
  $("pageSub").textContent = titles[tab]?.[1] || "";

  // close sidebar on mobile
  $("sidebar").classList.remove("open");
}

function renderMedsList(list){
  const box = $("rx_list");
  box.innerHTML = "";
  list.forEach(m=>{
    const div = document.createElement("div");
    div.className = "rx-item";
    div.innerHTML = `<div class="name">${escapeHtml(m.name)}</div><div class="meta">${escapeHtml(m.meta||"")}</div>`;
    div.addEventListener("click", ()=> addMedToRx(m.id));
    box.appendChild(div);
  });
}

function addMedToRx(id){
  const m = medsBase.find(x=>x.id===id);
  if (!m) return;

  if (!state.rxSelected.some(x=>x.id===id)){
    state.rxSelected.push({id:m.id, name:m.name});
    renderRxChips();
  }

  const mode = state.rxMode;
  const chunk = mode==="adulto" ? m.textAdulto : mode==="pediatria" ? m.textPedi : m.textLivre;

  const cur = $("rx_texto").value || "";
  if (!cur.includes(chunk.trim())){
    $("rx_texto").value = (cur ? (cur.trimEnd()+"\n") : "") + chunk;
  }
}

function renderRxChips(){
  const el = $("rx_chips");
  el.innerHTML = "";
  state.rxSelected.forEach(item=>{
    const chip = document.createElement("div");
    chip.className = "chip";
    chip.innerHTML = `<span>${escapeHtml(item.name)}</span>`;
    const btn = document.createElement("button");
    btn.textContent = "×";
    btn.title = "Remover";
    btn.addEventListener("click", ()=>{
      state.rxSelected = state.rxSelected.filter(x=>x.id!==item.id);
      renderRxChips();
    });
    chip.appendChild(btn);
    el.appendChild(chip);
  });
}

function openManualModal(){
  $("manualText").value = "";
  $("modal").classList.remove("hidden");
  setTimeout(()=> $("manualText").focus(), 50);
}
function closeManualModal(){
  $("modal").classList.add("hidden");
}
function addManualItem(){
  const t = ($("manualText").value || "").trim();
  if (!t) { alert("Digite o texto do item."); return; }
  const cur = $("rx_texto").value || "";
  $("rx_texto").value = (cur ? (cur.trimEnd()+"\n") : "") + t + "\n";
  closeManualModal();
}

function saveCfg(){
  const cfg = {
    nome: $("cfg_nome").value.trim(),
    registro: $("cfg_registro").value.trim(),
    tel: $("cfg_tel").value.trim(),
    cidade: $("cfg_cidade").value.trim(),
    end: $("cfg_end").value.trim()
  };
  saveJSON(STORAGE_CFG, cfg);
  alert("Configurações salvas.");
}

function resetCurrentTab(){
  const t = state.tab;
  if (!confirm("Criar novo documento nesta aba (limpar campos)?")) return;

  if (t==="receituario"){
    $("rx_paciente").value = "";
    $("rx_data").value = todayBR();
    $("rx_search").value = "";
    $("rx_texto").value = "";
    $("rx_obs").value = "";
    state.rxSelected = [];
    renderRxChips();
    renderMedsList(medsBase);
  }
  if (t==="laudo"){
    $("ld_paciente").value="";
    $("ld_data").value=todayBR();
    $("ld_titulo").value="";
    $("ld_solic").value="";
    $("ld_texto").value="";
  }
  if (t==="recibo"){
    $("rc_pagador").value="";
    $("rc_doc").value="";
    $("rc_valor").value="";
    $("rc_data").value=todayBR();
    $("rc_ref").value="";
  }
  if (t==="orcamento"){
    $("or_paciente").value="";
    $("or_data").value=todayBR();
    $("or_texto").value="";
  }
  if (t==="atestado"){
    $("at_paciente").value="";
    $("at_data").value=todayBR();
    $("at_tempo").value="";
    $("at_cid").value="";
    $("at_texto").value="Declaro para os devidos fins que o(a) paciente acima identificado(a) esteve sob meus cuidados, necessitando afastar-se de suas atividades por ____.\n";
  }
  if (t==="ficha"){
    $("fc_paciente").value="";
    $("fc_data").value=todayBR();
    $("fc_qp").value="";
    $("fc_hist").value="";
    $("fc_exame").value="";
    $("fc_conduta").value="";
  }
}

function doPrint(preview){
  const docHtml = buildDocHTML();
  $("printArea").innerHTML = docHtml;

  if (preview){
    // abre uma janela com o HTML de impressão (sem depender de cache)
    const w = window.open("", "_blank");
    if (!w){ alert("Pop-up bloqueado. Use 'Imprimir / PDF'."); return; }
    w.document.open();
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Pré-visualização</title>${printStyleTag()}</head><body>${$("printArea").innerHTML}<script>window.focus();</script></body></html>`);
    w.document.close();
    return;
  }

  // impressão direta
  setTimeout(()=> window.print(), 80);
}

function buildDocHTML(){
  const cfg = loadJSON(STORAGE_CFG, {nome:"",registro:"",tel:"",cidade:"",end:""});
  const tab = state.tab;

  const head = `
    <div class="head">
      <img src="logo.png" alt="BTX" onerror="this.style.display='none'">
      <div>
        <div class="h1">BTX Docs Saúde</div>
        <div class="h2">${escapeHtml(cfg.nome || "Profissional")} ${cfg.registro ? "— "+escapeHtml(cfg.registro) : ""}</div>
        <div class="h2">${escapeHtml([cfg.tel,cfg.cidade,cfg.end].filter(Boolean).join(" • "))}</div>
      </div>
    </div>
  `;

  let title = "";
  let meta = [];
  let body = "";
  let signLeft = cfg.nome ? `${cfg.nome}${cfg.registro ? " — "+cfg.registro : ""}` : "Assinatura";
  let signRight = "Assinatura";

  if (tab==="receituario"){
    title = "Receituário";
    meta = [
      ["Paciente", $("rx_paciente").value || "—"],
      ["Data", $("rx_data").value || todayBR()]
    ];
    body =
`RECEITA:
${$("rx_texto").value || ""}

OBSERVAÇÕES:
${$("rx_obs").value || ""}`.trim();
  }

  if (tab==="laudo"){
    title = $("ld_titulo").value.trim() || "Laudo";
    meta = [
      ["Paciente", $("ld_paciente").value || "—"],
      ["Data", $("ld_data").value || todayBR()],
      ["Solicitante", $("ld_solic").value || "—"]
    ];
    body = ($("ld_texto").value || "").trim();
  }

  if (tab==="recibo"){
    title = "Recibo";
    meta = [
      ["Recebi de", $("rc_pagador").value || "—"],
      ["Documento", $("rc_doc").value || "—"],
      ["Valor", $("rc_valor").value ? `R$ ${$("rc_valor").value}` : "—"],
      ["Data", $("rc_data").value || todayBR()]
    ];
    body = `Declaro que recebi de ${$("rc_pagador").value || "________________"} a quantia de R$ ${$("rc_valor").value || "________"} referente a:\n\n${$("rc_ref").value || ""}`.trim();
  }

  if (tab==="orcamento"){
    title = "Orçamento";
    meta = [
      ["Paciente", $("or_paciente").value || "—"],
      ["Data", $("or_data").value || todayBR()]
    ];
    body = ($("or_texto").value || "").trim();
  }

  if (tab==="atestado"){
    title = "Atestado";
    meta = [
      ["Paciente", $("at_paciente").value || "—"],
      ["Data", $("at_data").value || todayBR()],
      ["CID", $("at_cid").value || "—"]
    ];
    body = ($("at_texto").value || "").trim();
  }

  if (tab==="ficha"){
    title = "Ficha Clínica";
    meta = [
      ["Paciente", $("fc_paciente").value || "—"],
      ["Data", $("fc_data").value || todayBR()]
    ];
    body =
`QUEIXA PRINCIPAL:
${$("fc_qp").value || ""}

HISTÓRIA / OBSERVAÇÕES:
${$("fc_hist").value || ""}

EXAME:
${$("fc_exame").value || ""}

CONDUTA:
${$("fc_conduta").value || ""}`.trim();
  }

  if (tab==="config"){
    title = "Configurações";
    meta = [["Info","Esta aba não gera documento."]];
    body = "Use esta aba para salvar os dados do profissional.";
  }

  const metaHtml = meta.map(([k,v]) => `<span><b>${escapeHtml(k)}:</b> ${escapeHtml(v)}</span>`).join(" ");

  return `
    <div class="doc">
      <div class="frame">
        ${head}
        <div class="h1">${escapeHtml(title)}</div>
        <div class="meta">${metaHtml}</div>
        <div class="box">${escapeHtml(body)}</div>

        <div class="sign">
          <div class="line">${escapeHtml(signLeft)}</div>
          <div class="line">${escapeHtml(signRight)}</div>
        </div>
      </div>
    </div>
  `;
}

function printStyleTag(){
  // reaproveita as regras @media print do CSS, mas aqui é uma forma simples:
  // a janela de preview precisa do CSS base para o bloco.
  return `<style>
    body{margin:0;background:#fff;color:#000;font-family:Arial,sans-serif}
    .doc{padding:18mm 16mm}
    .frame{border:1px solid #222;padding:14mm 12mm;border-radius:10px}
    .head{display:flex;gap:12px;align-items:center;padding-bottom:10px;border-bottom:1px solid #999;margin-bottom:10px}
    .head img{width:34mm;height:34mm;object-fit:contain}
    .h1{font-size:16pt;font-weight:700}
    .h2{font-size:11pt;color:#333;margin-top:2px}
    .meta{display:flex;flex-wrap:wrap;gap:10px;font-size:10.5pt;margin:8px 0 10px}
    .box{margin-top:10px;white-space:pre-wrap;font-size:11pt;line-height:1.35}
    .sign{margin-top:18mm;display:grid;grid-template-columns:1fr 1fr;gap:12mm}
    .line{border-top:1px solid #000;padding-top:4mm;font-size:10pt;text-align:center}
  </style>`;
}

function escapeHtml(str){
  return String(str ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

document.addEventListener("DOMContentLoaded", init);
