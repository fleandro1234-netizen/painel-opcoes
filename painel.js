'use strict';
// Decifra no navegador com a Web Crypto API e monta a tela. Nenhum dado mora aqui.

const $ = (id) => document.getElementById(id);
const bytes = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

async function abrir(senha) {
  const pacote = window.OPC_ENC;
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(senha), 'PBKDF2',
                                             false, ['deriveKey']);
  const chave = await crypto.subtle.deriveKey(
    {name: 'PBKDF2', salt: bytes(pacote.s), iterations: pacote.it, hash: 'SHA-256'},
    base, {name: 'AES-GCM', length: 256}, false, ['decrypt']);
  const aberto = await crypto.subtle.decrypt({name: 'AES-GCM', iv: bytes(pacote.iv)}, chave,
                                             bytes(pacote.d));
  const fluxo = new Blob([aberto]).stream().pipeThrough(new DecompressionStream('gzip'));
  return JSON.parse(await new Response(fluxo).text());
}

// ---- formatação (a mesma do Excel: vírgula decimal, ponto de milhar) ----
const nBR = (v, casas = 2) => (v === null || v === undefined || Number.isNaN(v)) ? '—'
  : v.toLocaleString('pt-BR', {minimumFractionDigits: casas, maximumFractionDigits: casas});
const pct = (v, casas = 1) => (v === null || v === undefined || Number.isNaN(v)) ? '—'
  : nBR(v * 100, casas) + '%';
const reais = (v) => (v === null || v === undefined || Number.isNaN(v)) ? '—' : 'R$ ' + nBR(v);
const data = (v) => !v ? '—' : v.slice(8, 10) + '/' + v.slice(5, 7) + '/' + v.slice(0, 4);

const PCT = new Set(['distancia_pct', 'retorno_mes_pct', 'vol_implicita', 'chance_po_mercado',
                     'chance_po_historia', 'chance_po_prova', 'ganho_esperado_pct', 'resultado_pct']);
const DINHEIRO = new Set(['preco_acao', 'strike', 'premio', 'premio_por_lote', 'garantia_por_lote',
                          'equilibrio', 'pl_se_cair_10', 'pl_se_cair_20', 'preco_medio_venda',
                          'preco_recompra', 'premio_aberto', 'resultado_aberto', 'credito_liquido',
                          'resultado', 'alvo_medio', 'preco']);
const TEXTO = new Set(['acao', 'put', 'posicao', 'nota_acao', 'alerta', 'explicacao', 'sinal',
                       'motivo', 'como', 'texto', 'estilo']);

function celula(coluna, valor) {
  if (valor === null || valor === undefined) return '—';
  if (coluna === 'vencimento') return data(valor);
  if (PCT.has(coluna)) return pct(valor);
  if (DINHEIRO.has(coluna)) return reais(valor);
  if (typeof valor === 'number') return Number.isInteger(valor) ? nBR(valor, 0) : nBR(valor);
  return String(valor);
}

function tabela(bloco, ordenarPor) {
  if (!bloco || !bloco.linhas.length) return '<p class="vazio">Nada aqui hoje.</p>';
  const cols = bloco.colunas.filter((c) => bloco.linhas.some((l) => l[c] !== null && l[c] !== undefined));
  const linhas = ordenarPor ? [...bloco.linhas].sort((a, b) => (b[ordenarPor] ?? -Infinity) - (a[ordenarPor] ?? -Infinity))
                            : bloco.linhas;
  const cabecalho = cols.map((c) => `<th class="${TEXTO.has(c) ? 'txt' : ''}" data-col="${c}">`
    + `${bloco.rotulos[c] || c}</th>`).join('');
  const corpo = linhas.map((l) => '<tr>' + cols.map((c) =>
    `<td class="${TEXTO.has(c) ? 'txt' : ''}">${celula(c, l[c])}</td>`).join('') + '</tr>').join('');
  return `<table><thead><tr>${cabecalho}</tr></thead><tbody>${corpo}</tbody></table>`;
}

function ordenavel(raiz, bloco) {
  const tab = raiz.querySelector('table');
  if (!tab) return;
  let crescente = false;
  tab.querySelectorAll('th').forEach((th, i) => th.addEventListener('click', () => {
    const corpo = tab.tBodies[0];
    const linhas = [...corpo.rows];
    const num = !TEXTO.has(th.dataset.col);
    linhas.sort((a, b) => {
      const x = a.cells[i].textContent, y = b.cells[i].textContent;
      if (num) {
        const f = (t) => parseFloat(t.replace(/[^0-9,\-]/g, '').replace(',', '.'));
        return (crescente ? 1 : -1) * ((f(x) || 0) - (f(y) || 0));
      }
      return (crescente ? 1 : -1) * x.localeCompare(y, 'pt-BR');
    });
    crescente = !crescente;
    linhas.forEach((l) => corpo.appendChild(l));
  }));
}

// a cor sai da nota (verde/amarelo/vermelho/cinza), nunca do rótulo: vocabulário do conteúdo não
// mora na casca, senão a trava contra dado em claro passa a ter exceção
const CORES = {verde: 'verde', amarelo: 'amarelo', vermelho: 'vermelho', cinza: ''};

function abaPuts(d) {
  const acoes = [...new Set(d.puts.linhas.map((l) => l.acao))].sort();
  return {titulo: `Puts na regra (${d.puts.linhas.length})`, montar: (alvo) => {
    alvo.innerHTML = `<div class="ferramentas">
      <label>Ação <select id="f-acao"><option value="">todas</option>
        ${acoes.map((a) => `<option>${a}</option>`).join('')}</select></label>
      <label>Chance mínima (mercado) <input id="f-chance" type="number" min="0" max="100" step="5" value="0"> %</label>
      <label><input type="checkbox" id="f-alerta"> só sem alerta</label>
      <span id="f-conta"></span></div><div id="tab"></div>`;
    const desenhar = () => {
      const acao = $('f-acao').value, minima = (parseFloat($('f-chance').value) || 0) / 100;
      const semAlerta = $('f-alerta').checked;
      const linhas = d.puts.linhas.filter((l) => (!acao || l.acao === acao)
        && (l.chance_po_mercado ?? 0) >= minima && (!semAlerta || !l.alerta));
      $('tab').innerHTML = tabela({...d.puts, linhas});
      $('f-conta').textContent = `${linhas.length} de ${d.puts.linhas.length}`;
      ordenavel($('tab'), d.puts);
    };
    ['f-acao', 'f-chance', 'f-alerta'].forEach((id) => $(id).addEventListener('input', desenhar));
    desenhar();
  }};
}

function abaAcoes(d) {
  return {titulo: `Análise das ações (${d.acoes.length})`, montar: (alvo) => {
    alvo.innerHTML = '<div class="cartoes">' + d.acoes.map((a) => {
      const motivos = Object.entries(a.motivos || {}).flatMap(([, lista]) => lista);
      return `<div class="cartao"><h3>${a.acao}
        <span class="${CORES[a.nota] || ''}">${a.rotulo || a.nota || ''}</span></h3>
        <div>${reais(a.preco)} · 12 meses ${pct(a.ret_12m)} · vol ${pct(a.vol_12m)}</div>
        <div>alvo dos analistas ${reais(a.alvo_medio)} (${a.n_analistas ?? '—'} casas)
             · potencial ${pct(a.potencial_alvo)}</div>
        <div>próximo balanço: ${a.proximo_resultado ? data(a.proximo_resultado) : '—'}</div>
        <ul>${motivos.map((m) => `<li>${m}</li>`).join('') || '<li>sem motivos registrados</li>'}</ul>
      </div>`;
    }).join('') + '</div>';
  }};
}

function abaMinhas(d) {
  const m = d.minhas, n = m.abertas.linhas.length;
  return {titulo: `Minhas puts (${n})`, montar: (alvo) => {
    if (m.aviso) { alvo.innerHTML = `<p class="vazio">${m.aviso}</p>`; return; }
    alvo.innerHTML = `<h3>Em aberto</h3>${tabela(m.abertas)}
      <h3>Rolagem sugerida</h3>${tabela(m.rolagens)}
      <h3>Encerradas</h3>${tabela(m.encerradas)}`;
  }};
}

function abaProva(d) {
  return {titulo: 'A prova (backtest)', montar: (alvo) => {
    const cols = ['acao', 'vencimentos', 'acerto', 'mercado_dizia', 'resultado_medio', 'resultado_mid',
                  'mediana', 'com_garantia', 'cdi_periodo', 'pior', 'pior_em', 'vencimentos_negativos'];
    const rotulos = {acao: 'Ação', vencimentos: 'Ciclos', acerto: 'Acerto',
                     mercado_dizia: 'O mercado dizia', resultado_medio: 'Resultado do ciclo',
                     resultado_mid: 'No meio das ofertas', mediana: 'Mediana',
                     com_garantia: 'Com garantia em Selic', cdi_periodo: 'CDI no prazo',
                     pior: 'Pior ciclo', pior_em: 'Quando',
                     vencimentos_negativos: 'Ciclos negativos'};
    const pctCols = new Set(['acerto', 'mercado_dizia', 'resultado_medio', 'resultado_mid', 'mediana',
                             'com_garantia', 'cdi_periodo', 'pior']);
    const cor = (c, v) => (c === 'resultado_medio' || c === 'com_garantia') && v !== null
      ? (v >= 0 ? 'verde' : 'vermelho') : '';
    const linhas = d.prova.map((p) => '<tr>' + cols.map((c) =>
      `<td class="${c === 'acao' ? 'txt' : cor(c, p[c])}">`
      + (pctCols.has(c) ? pct(p[c], 2) : (c === 'pior_em' ? data(p[c]) : (p[c] ?? '—')))
      + '</td>').join('') + '</tr>').join('');
    alvo.innerHTML = `<p class="vazio">Vendendo na oferta de compra e carregando até o vencimento,
      sem gestão no meio. Cada vencimento pesa igual: quem vende put abre uma posição por ciclo,
      não uma por série.</p>
      <table><thead><tr>${cols.map((c) =>
      `<th class="${c === 'acao' ? 'txt' : ''}">${rotulos[c]}</th>`).join('')}</tr></thead>
      <tbody>${linhas}</tbody></table>`;
  }};
}

function abaFontes(d) {
  return {titulo: 'Fontes', montar: (alvo) => {
    alvo.innerHTML = `<p class="vazio">Regra: ${d.regra.dias_min} a ${d.regra.dias_max} dias,
      delta de ${nBR(d.regra.delta_min)} a ${nBR(d.regra.delta_max)},
      mínimo de ${d.regra.negocios_min} negócios. ${d.regra.acoes.length} ações
      (${d.regra.fonte_dos_ativos}).</p>
      <table><thead><tr><th class="txt">O quê</th><th class="txt">Arquivo</th>
      <th>Tamanho</th><th class="txt">sha256</th></tr></thead><tbody>` +
      d.fontes.map((f) => `<tr><td class="txt">${f.o_que}</td><td class="txt">${f.arquivo}</td>
        <td>${f.tamanho ? nBR(f.tamanho, 0) : '—'}</td>
        <td class="txt">${(f.sha256 || '').slice(0, 16)}…</td></tr>`).join('') + '</tbody></table>';
  }};
}

function montarPainel(d) {
  $('trava').hidden = true;
  $('painel').hidden = false;
  $('cabecalho').textContent = `pregão de ${data(d.pregao)} · ${d.puts.linhas.length} puts na regra`;
  $('rodape').textContent = d.aviso;
  const abas = [abaPuts(d), abaAcoes(d), abaMinhas(d), abaProva(d), abaFontes(d)];
  $('abas').innerHTML = abas.map((a, i) =>
    `<button data-i="${i}" class="${i === 0 ? 'ativa' : ''}">${a.titulo}</button>`).join('');
  const trocar = (i) => {
    $('abas').querySelectorAll('button').forEach((b, j) => b.classList.toggle('ativa', i === j));
    abas[i].montar($('conteudo'));
  };
  $('abas').addEventListener('click', (e) => {
    if (e.target.dataset.i !== undefined) trocar(Number(e.target.dataset.i));
  });
  trocar(0);
}

$('forma').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('entrar').disabled = true;
  $('recado').textContent = 'abrindo...';
  try {
    montarPainel(await abrir($('senha').value.trim().toUpperCase()));
  } catch (erro) {
    $('recado').textContent = 'senha não confere.';
    $('entrar').disabled = false;
    $('senha').select();
  }
});
