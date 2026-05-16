import React, { useState, useEffect } from 'react';
import { Plus, Search, MonitorDot, X, Archive, History, RefreshCcw, Filter, LogOut, Lock, ExternalLink, Edit, Trash2, Calendar, Wrench, CheckCircle, AlertTriangle } from 'lucide-react';
import { supabase } from './supabaseClient';

function App() {
  const [sessao, setSessao] = useState(null);
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [carregandoLogin, setCarregandoLogin] = useState(false);

  const [modalAberto, setModalAberto] = useState(false);
  const [modalArquivadosAberto, setModalArquivadosAberto] = useState(false);
  const [modalEdicaoAberto, setModalEdicaoAberto] = useState(false);
  const [equipEditando, setEquipEditando] = useState(null);

  // --- NOVOS ESTADOS PARA ALERTAS E CONFIRMAÇÕES CUSTOMIZADAS ---
  const [notificacao, setNotificacao] = useState(null); // { mensagem: '', tipo: 'sucesso' | 'erro' }
  const [confirmacaoModal, setConfirmacaoModal] = useState(null); // { acao: () => {}, titulo: '', msg: '' }

  const [equipamentos, setEquipamentos] = useState([]);
  const [equipamentosArquivados, setEquipamentosArquivados] = useState([]);
  const [termoBusca, setTermoBusca] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState('Todos');

  const [novoChamado, setNovoChamado] = useState('');
  const [novaLoja, setNovaLoja] = useState('');
  const [novaCategoria, setNovaCategoria] = useState('');
  const [novaIdentificacao, setNovaIdentificacao] = useState('');

  const categoriasDisponiveis = ["Todos", "Nobreak", "Leitor", "Monitor", "Impressora", "Outro"];
  const GLPI_URL_BASE = "https://suporteti.mercatus.com.br/front/ticket.form.php?id=";

  // Função para disparar a notificação bonita temporizada
  const mostrarNotificacao = (mensagem, tipo = 'sucesso') => {
    setNotificacao({ mensagem, tipo });
    setTimeout(() => setNotificacao(null), 3000);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { setSessao(session); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => { setSessao(session); });
    return () => subscription.unsubscribe();
  }, []);

  const fazerLogin = async (e) => {
    e.preventDefault();
    setCarregandoLogin(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email, password: senha });
    if (error) mostrarNotificacao("Erro ao entrar: " + error.message, 'erro');
    setCarregandoLogin(false);
  };

  const fazerLogout = async () => { await supabase.auth.signOut(); };

  const buscarEquipamentos = async () => {
    const { data, error } = await supabase.from('equipamentos').select('*').neq('status', 'Arquivado').order('criado_em', { ascending: false });
    if (!error) setEquipamentos(data);
  };

  const buscarArquivados = async () => {
    const { data, error } = await supabase.from('equipamentos').select('*').eq('status', 'Arquivado').order('atualizado_em', { ascending: false });
    if (!error) setEquipamentosArquivados(data);
  };

  useEffect(() => { if (sessao) buscarEquipamentos(); }, [sessao]);

  const abrirHistorico = () => { buscarArquivados(); setModalArquivadosAberto(true); };

  const salvarEquipamento = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('equipamentos').insert([{
      chamado_glpi: novoChamado, loja: novaLoja.toUpperCase(), categoria: novaCategoria, identificacao: novaIdentificacao, status: 'P/ Manutenção'
    }]);
    if (!error) {
      setNovoChamado(''); setNovaLoja(''); setNovaCategoria(''); setNovaIdentificacao('');
      setModalAberto(false); buscarEquipamentos();
      mostrarNotificacao("Equipamento cadastrado com sucesso!");
    } else {
      mostrarNotificacao("Erro ao cadastrar equipamento", "erro");
    }
  };

  const abrirEdicao = (eq) => {
    setEquipEditando({
      ...eq,
      criado_em: eq.criado_em ? eq.criado_em.split('T')[0] : '',
      data_assistencia: eq.data_assistencia ? eq.data_assistencia.split('T')[0] : '',
      data_finalizado: eq.data_finalizado ? eq.data_finalizado.split('T')[0] : ''
    });
    setModalEdicaoAberto(true);
  };

  const salvarEdicao = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('equipamentos').update({
      chamado_glpi: equipEditando.chamado_glpi,
      loja: equipEditando.loja.toUpperCase(),
      categoria: equipEditando.categoria,
      identificacao: equipEditando.identificacao,
      criado_em: equipEditando.criado_em || null,
      data_assistencia: equipEditando.data_assistencia || null,
      data_finalizado: equipEditando.data_finalizado || null
    }).eq('id', equipEditando.id);

    if (!error) {
      setModalEdicaoAberto(false);
      buscarEquipamentos();
      buscarArquivados();
      mostrarNotificacao("Alterações salvas no banco!");
    } else {
      mostrarNotificacao("Erro ao atualizar dados", "erro");
    }
  };

  const atualizarStatus = async (id, novoStatus) => {
    let dadosAtualizacao = { status: novoStatus, atualizado_em: new Date().toISOString() };
    if (novoStatus === 'Assistência') dadosAtualizacao.data_assistencia = new Date().toISOString();
    else if (novoStatus === 'Pronto p/ retirada' || novoStatus === 'Sem conserto') dadosAtualizacao.data_finalizado = new Date().toISOString();

    setEquipamentos(prev => prev.map(eq => eq.id === id ? { ...eq, ...dadosAtualizacao } : eq));
    const { error } = await supabase.from('equipamentos').update(dadosAtualizacao).eq('id', id);
    if (error) { mostrarNotificacao("Erro ao mover equipamento", "erro"); buscarEquipamentos(); }
  };

  // Substituídos os windows.confirm antigos por chamadas ao modal customizado
  const requisitarArquivamento = (id) => {
    setConfirmacaoModal({
      titulo: "Confirmar Arquivamento",
      msg: "Este equipamento sairá do painel ativo e irá para o histórico. Confirmar?",
      acao: () => executarArquivamento(id)
    });
  };

  const executarArquivamento = async (id) => {
    setEquipamentos(prev => prev.filter(eq => eq.id !== id));
    await supabase.from('equipamentos').update({ status: 'Arquivado' }).eq('id', id);
    setConfirmacaoModal(null);
    mostrarNotificacao("Equipamento enviado para o histórico!");
  };

  const requisitarExclusao = (id) => {
    setConfirmacaoModal({
      titulo: "⚠️ EXCLUIR DEFINITIVAMENTE",
      msg: "Tem certeza absoluta? Essa ação apagará o registro para sempre e não pode ser desfeita.",
      acao: () => executarExclusao(id)
    });
  };

  const executarExclusao = async (id) => {
    setEquipamentos(prev => prev.filter(eq => eq.id !== id));
    setEquipamentosArquivados(prev => prev.filter(eq => eq.id !== id));
    setModalEdicaoAberto(false);
    const { error } = await supabase.from('equipamentos').delete().eq('id', id);
    setConfirmacaoModal(null);
    if (!error) mostrarNotificacao("Equipamento deletado do sistema.", "erro");
  };

  const restaurarEquipamento = async (id) => {
    const { error } = await supabase.from('equipamentos').update({ status: 'Pronto p/ retirada' }).eq('id', id);
    if (!error) {
      buscarArquivados();
      buscarEquipamentos();
      mostrarNotificacao("Equipamento restaurado para o painel!");
    }
  };

  const handleDragStart = (e, id) => { e.dataTransfer.setData("equipamentoId", id); };
  const handleDragOver = (e) => { e.preventDefault(); };
  const handleDrop = (e, novoStatus) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("equipamentoId");
    if (id) atualizarStatus(parseInt(id), novoStatus);
  };

  const equipamentosFiltrados = equipamentos.filter(eq => {
    const atendeCategoria = categoriaFiltro === 'Todos' || eq.categoria === categoriaFiltro;
    const termo = termoBusca.toLowerCase();
    const atendeBusca = eq.chamado_glpi.toLowerCase().includes(termo) || eq.loja.toLowerCase().includes(termo) || (eq.identificacao && eq.identificacao.toLowerCase().includes(termo));
    return atendeCategoria && atendeBusca;
  });

  const colunas = [
    { titulo: "P/ Manutenção", dot: "bg-blue-500", headerBorder: "border-blue-500" },
    { titulo: "Assistência", dot: "bg-yellow-500", headerBorder: "border-yellow-500" },
    { titulo: "Pronto p/ retirada", dot: "bg-emerald-500", headerBorder: "border-emerald-500" },
    { titulo: "Sem conserto", dot: "bg-red-500", headerBorder: "border-red-500" }
  ];

  const formatarData = (dataString) => {
    if (!dataString) return '';
    return new Date(dataString).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
  };

  if (!sessao) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
        <div className="bg-white p-10 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] w-full max-w-md border-t-[6px] border-[#002f6c]">
          <div className="flex flex-col items-center mb-10">
            <img src="/logo-shibata.png" alt="Shibata Supermercados" className="h-16 mb-6 object-contain" onError={(e) => { e.target.onerror = null; e.target.src = "https://placehold.co/200x80/002f6c/ffffff?text=SHIBATA"; }} />
            <h1 className="text-2xl font-black text-slate-800 tracking-tight text-center">Portal TI</h1>
            <p className="text-sm text-slate-500 font-medium mt-1">Gestão de Manutenção de Equipamentos</p>
          </div>
          <form onSubmit={fazerLogin} className="flex flex-col gap-5">
            <div>
              <label className="text-sm font-bold text-slate-700 mb-1.5 block">E-mail corporativo</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full border-2 border-slate-200 p-3 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:border-[#002f6c] transition-all font-medium" placeholder="nome@shibata.com.br" />
            </div>
            <div>
              <label className="text-sm font-bold text-slate-700 mb-1.5 block">Senha</label>
              <input type="password" required value={senha} onChange={(e) => setSenha(e.target.value)} className="w-full border-2 border-slate-200 p-3 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:border-[#002f6c] transition-all font-medium" placeholder="••••••••" />
            </div>
            <button type="submit" disabled={carregandoLogin} className="bg-[#002f6c] text-white font-bold py-3.5 rounded-xl mt-4 hover:bg-[#001f4d] shadow-lg shadow-blue-900/20 transition-all flex justify-center items-center gap-2 text-base">
              {carregandoLogin ? 'Entrando...' : <><Lock className="w-5 h-5" /> Acessar Sistema</>}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f7f9] font-sans text-slate-800 relative flex flex-col">

      {/* NOTIFICAÇÃO TOAST CUSTOMIZADA */}
      {notificacao && (
        <div className={`fixed bottom-5 right-5 z-50 flex items-center gap-3 p-4 rounded-xl shadow-2xl text-white font-bold animate-bounce transition-all ${notificacao.tipo === 'erro' ? 'bg-red-600' : 'bg-emerald-600'}`}>
          {notificacao.tipo === 'erro' ? <AlertTriangle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
          <span>{notificacao.mensagem}</span>
        </div>
      )}

      {/* HEADER */}
      <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-20">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center gap-4">
              <img src="/logo-shibata.png" alt="Logo Shibata" className="h-10 object-contain" onError={(e) => { e.target.onerror = null; e.target.src = "https://placehold.co/120x40/002f6c/ffffff?text=SHIBATA"; }} />
              <div className="border-l-2 border-slate-200 pl-4 ml-2">
                <h1 className="text-xl font-black text-[#002f6c] tracking-tight leading-none mb-1">Manutenção TI</h1>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Painel de Controle</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative hidden md:block">
                <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                <input type="text" placeholder="Buscar por loja, chamado ou ID..." value={termoBusca} onChange={(e) => setTermoBusca(e.target.value)} className="bg-slate-100 text-slate-700 placeholder-slate-400 font-medium text-sm rounded-full pl-10 pr-4 py-2.5 w-72 focus:outline-none focus:ring-2 focus:ring-[#002f6c]/20 focus:bg-white border border-transparent transition-all" />
              </div>
              <div className="h-8 w-px bg-slate-200 mx-2"></div>
              <button onClick={abrirHistorico} className="text-slate-600 hover:text-[#002f6c] hover:bg-slate-100 font-semibold text-sm px-4 py-2.5 rounded-lg flex items-center gap-2 transition-all"><History className="w-4 h-4" /> Histórico</button>
              <button onClick={() => setModalAberto(true)} className="bg-[#ffcc00] hover:bg-[#e6b800] text-[#002f6c] font-bold text-sm px-5 py-2.5 rounded-lg shadow-sm flex items-center gap-2 transition-all"><Plus className="w-4 h-4" /> Novo Chamado</button>
              <button onClick={fazerLogout} className="ml-2 bg-slate-100 text-slate-500 hover:text-red-600 hover:bg-red-50 p-2.5 rounded-lg transition-all" title="Sair"><LogOut className="w-4 h-4" /></button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1 flex flex-col">
        <div className="flex items-center gap-3 mb-8 overflow-x-auto pb-2 scrollbar-hide">
          <div className="flex items-center justify-center bg-white border border-slate-200 p-2 rounded-lg shadow-sm text-slate-400 mr-2"><Filter className="w-4 h-4" /></div>
          {categoriasDisponiveis.map(cat => (
            <button key={cat} onClick={() => setCategoriaFiltro(cat)} className={`px-5 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap shadow-sm border ${categoriaFiltro === cat ? 'bg-[#002f6c] text-white border-[#002f6c]' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}>{cat}</button>
          ))}
        </div>

        {/* KANBAN BOARD */}
        <div className="flex gap-6 overflow-x-auto pb-4 flex-1 items-start scrollbar-hide">
          {colunas.map((coluna, index) => {
            const equipamentosDaColuna = equipamentosFiltrados.filter(eq => eq.status === coluna.titulo);
            return (
              <div key={index} className="flex-1 min-w-[320px] max-w-[400px] flex flex-col bg-slate-100/50 rounded-2xl p-4 border border-slate-200/60" onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, coluna.titulo)}>
                <div className={`flex items-center justify-between mb-4 pb-3 border-b-2 ${coluna.headerBorder}`}>
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${coluna.dot}`}></div>
                    <h2 className="font-black text-sm uppercase text-slate-700 tracking-wider">{coluna.titulo}</h2>
                  </div>
                  <span className="bg-white text-slate-600 px-2.5 py-1 rounded-md text-xs font-bold shadow-sm border border-slate-200">{equipamentosDaColuna.length}</span>
                </div>

                <div className="flex-1 flex flex-col gap-4 min-h-[100px]">
                  {equipamentosDaColuna.length > 0 ? (
                    equipamentosDaColuna.map((eq) => (
                      <div key={eq.id} draggable onDragStart={(e) => handleDragStart(e, eq.id)} className="bg-white p-5 rounded-xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-slate-200 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] hover:border-[#002f6c]/30 transition-all cursor-grab active:cursor-grabbing relative group flex flex-col gap-3">
                        <div className="flex justify-between items-start">
                          <span className="text-[11px] font-black text-[#002f6c] bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-md uppercase tracking-wider">{eq.categoria}</span>
                          <span className="text-[13px] font-black bg-[#ffcc00] text-[#002f6c] px-3 py-1 rounded-md shadow-sm">LOJA {eq.loja}</span>
                        </div>
                        <div className="flex flex-col gap-1">
                          {eq.identificacao ? <div className="text-lg font-black text-slate-800 tracking-tight leading-none">{eq.identificacao}</div> : <div className="text-sm font-semibold text-slate-400 italic">Sem ID informado</div>}
                          <a href={`${GLPI_URL_BASE}${eq.chamado_glpi}`} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 mt-1 w-fit">GLPI: {eq.chamado_glpi} <ExternalLink className="w-3 h-3" /></a>
                        </div>
                        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 mt-2 flex flex-col gap-1.5">
                          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500"><Calendar className="w-3.5 h-3.5 text-slate-400" /> Cadastrado: <span className="text-slate-700">{formatarData(eq.criado_em)}</span></div>
                          {eq.data_assistencia && <div className="flex items-center gap-1.5 text-[11px] font-semibold text-yellow-600"><Wrench className="w-3.5 h-3.5 text-yellow-500" /> Assistência: <span className="text-yellow-700">{formatarData(eq.data_assistencia)}</span></div>}
                          {eq.data_finalizado && (eq.status === 'Pronto p/ retirada' || eq.status === 'Sem conserto') && (
                            <div className={`flex items-center gap-1.5 text-[11px] font-semibold ${eq.status === 'Sem conserto' ? 'text-red-600' : 'text-emerald-600'}`}><CheckCircle className={`w-3.5 h-3.5 ${eq.status === 'Sem conserto' ? 'text-red-500' : 'text-emerald-500'}`} /> {eq.status === 'Sem conserto' ? 'Descartado:' : 'Concluído:'} <span className={eq.status === 'Sem conserto' ? 'text-red-700' : 'text-emerald-700'}>{formatarData(eq.data_finalizado)}</span></div>
                          )}
                        </div>
                        <div className="absolute top-4 right-4 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 backdrop-blur-sm p-1 rounded-lg shadow-sm border border-slate-200">
                          <button onClick={() => abrirEdicao(eq)} className="text-slate-500 hover:text-[#002f6c] hover:bg-slate-100 p-1.5 rounded-md transition-colors"><Edit className="w-4 h-4" /></button>
                          {(coluna.titulo === "Pronto p/ retirada" || coluna.titulo === "Sem conserto") && (
                            <button onClick={() => requisitarArquivamento(eq.id)} className="text-slate-500 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-md transition-colors"><Archive className="w-4 h-4" /></button>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="flex items-center justify-center h-24 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50"><span className="text-sm font-semibold text-slate-400">Solte o card aqui</span></div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* MODAL HISTORICO */}
      {modalArquivadosAberto && (
        <div className="absolute top-0 left-0 w-full h-full bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-center p-6 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="bg-blue-50 p-2 rounded-lg"><History className="w-6 h-6 text-[#002f6c]" /></div>
                <div>
                  <h3 className="text-xl font-black text-slate-800">Histórico de Manutenções</h3>
                  <p className="text-xs font-bold text-slate-400">Equipamentos baixados ou descartados</p>
                </div>
              </div>
              <button onClick={() => setModalArquivadosAberto(false)} className="text-slate-400 hover:bg-slate-100 hover:text-slate-600 p-2 rounded-lg transition-colors"><X className="w-6 h-6" /></button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 bg-slate-50/50">
              {equipamentosArquivados.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12"><Archive className="w-12 h-12 text-slate-300 mb-4" /><p className="text-lg font-bold text-slate-500">Nenhum equipamento no histórico.</p></div>
              ) : (
                <div className="flex flex-col gap-4">
                  {equipamentosArquivados.map((eq) => (
                    <div key={eq.id} className="flex flex-col md:flex-row md:items-center justify-between bg-white p-5 rounded-xl border border-slate-200 shadow-sm gap-4 hover:border-slate-300 transition-colors">
                      <div className="flex flex-col gap-2 flex-1">
                        <div className="flex items-center gap-3"><span className="text-[11px] font-black text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md uppercase tracking-wider">{eq.categoria}</span><span className="text-[13px] font-black bg-[#002f6c] text-white px-3 py-1 rounded-md">LOJA {eq.loja}</span>{eq.identificacao && <span className="font-black text-slate-800 ml-2">ID: {eq.identificacao}</span>}</div>
                        <div className="flex items-center gap-4 text-xs font-semibold text-slate-500">
                          <a href={`${GLPI_URL_BASE}${eq.chamado_glpi}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 bg-blue-50 px-2 py-1 rounded-md">GLPI: {eq.chamado_glpi} <ExternalLink className="w-3 h-3" /></a>
                          <div className="flex items-center gap-3 border-l border-slate-200 pl-4"><span><Calendar className="w-3 h-3 inline mr-1 text-slate-400" /> {formatarData(eq.criado_em)}</span>{eq.data_finalizado && <span><CheckCircle className="w-3 h-3 inline mr-1 text-emerald-500" /> Baixa: {formatarData(eq.data_finalizado)}</span>}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 border-t md:border-t-0 md:border-l border-slate-100 pt-3 md:pt-0 md:pl-4">
                        <button onClick={() => abrirEdicao(eq)} className="text-slate-500 hover:text-[#002f6c] hover:bg-slate-100 p-2.5 rounded-lg transition-colors"><Edit className="w-4 h-4" /></button>
                        <button onClick={() => restaurarEquipamento(eq.id)} className="text-blue-600 hover:bg-blue-50 p-2.5 rounded-lg transition-colors"><RefreshCcw className="w-4 h-4" /></button>
                        <button onClick={() => requisitarExclusao(eq.id)} className="text-red-500 hover:bg-red-50 p-2.5 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL CADASTRO / EDIÇÃO */}
      {(modalAberto || modalEdicaoAberto) && (
        <div className="absolute top-0 left-0 w-full h-full bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white p-8 rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">{modalEdicaoAberto ? <><Edit className="w-6 h-6 text-[#002f6c]" /> Editar Equipamento</> : <><Plus className="w-6 h-6 text-[#002f6c]" /> Novo Equipamento</>}</h3>
              <button onClick={() => { setModalAberto(false); setModalEdicaoAberto(false); }} className="text-slate-400 hover:bg-slate-100 p-2 rounded-lg"><X className="w-6 h-6" /></button>
            </div>
            <form onSubmit={modalEdicaoAberto ? salvarEdicao : salvarEquipamento} className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-1 block">GLPI / Chamado</label>
                  <input required type="text" value={modalEdicaoAberto ? equipEditando.chamado_glpi : novoChamado} onChange={(e) => modalEdicaoAberto ? setEquipEditando({ ...equipEditando, chamado_glpi: e.target.value }) : setNovoChamado(e.target.value)} className="w-full border-2 border-slate-200 p-2.5 rounded-lg font-bold text-slate-800 focus:border-[#002f6c] focus:outline-none transition-colors" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-1 block">Loja</label>
                  <input required type="text" value={modalEdicaoAberto ? equipEditando.loja : novaLoja} onChange={(e) => modalEdicaoAberto ? setEquipEditando({ ...equipEditando, loja: e.target.value }) : setNovaLoja(e.target.value)} className="w-full border-2 border-slate-200 p-2.5 rounded-lg font-bold text-slate-800 uppercase focus:border-[#002f6c] focus:outline-none transition-colors" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-1 block">Categoria</label>
                  <select required value={modalEdicaoAberto ? equipEditando.categoria : novaCategoria} onChange={(e) => modalEdicaoAberto ? setEquipEditando({ ...equipEditando, category: e.target.value }) : setNovaCategoria(e.target.value)} className="w-full border-2 border-slate-200 p-2.5 rounded-lg font-bold text-slate-800 focus:border-[#002f6c] focus:outline-none transition-colors bg-white">
                    <option value="">Selecione...</option>
                    <option value="Nobreak">Nobreak</option>
                    <option value="Leitor">Leitor</option>
                    <option value="Monitor">Monitor</option>
                    <option value="Impressora">Impressora</option>
                    <option value="Outro">Outro...</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-1 block">Patrimônio / ID</label>
                  <input type="text" value={modalEdicaoAberto ? (equipEditando.identificacao || '') : novaIdentificacao} onChange={(e) => modalEdicaoAberto ? setEquipEditando({ ...equipEditando, identificacao: e.target.value }) : setNovaIdentificacao(e.target.value)} className="w-full border-2 border-slate-200 p-2.5 rounded-lg font-bold text-slate-800 focus:border-[#002f6c] focus:outline-none transition-colors" />
                </div>
              </div>

              {modalEdicaoAberto && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mt-2">
                  <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-2"><Calendar className="w-4 h-4" /> Ajuste de Datas</h4>
                  <div className="grid grid-cols-1 gap-3">
                    <div className="flex items-center justify-between"><label className="text-sm font-bold text-slate-600">Cadastrado em</label><input type="date" value={equipEditando.criado_em} onChange={(e) => setEquipEditando({ ...equipEditando, criado_em: e.target.value })} className="border-2 border-slate-200 p-1.5 text-sm font-bold rounded-lg focus:border-[#002f6c] outline-none" /></div>
                    <div className="flex items-center justify-between"><label className="text-sm font-bold text-slate-600">Enviado para Assistência</label><input type="date" value={equipEditando.data_assistencia} onChange={(e) => setEquipEditando({ ...equipEditando, data_assistencia: e.target.value })} className="border-2 border-slate-200 p-1.5 text-sm font-bold rounded-lg focus:border-[#002f6c] outline-none" /></div>
                    <div className="flex items-center justify-between"><label className="text-sm font-bold text-slate-600">Data de Finalização</label><input type="date" value={equipEditando.data_finalizado} onChange={(e) => setEquipEditando({ ...equipEditando, data_finalizado: e.target.value })} className="border-2 border-slate-200 p-1.5 text-sm font-bold rounded-lg focus:border-[#002f6c] outline-none" /></div>
                  </div>
                </div>
              )}

              <div className="flex justify-between items-center mt-6 pt-4 border-t border-slate-100">
                {modalEdicaoAberto ? (
                  <>
                    <button type="button" onClick={() => requisitarExclusao(equipEditando.id)} className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2.5 rounded-lg flex items-center gap-2 text-sm font-bold transition-colors"><Trash2 className="w-4 h-4" /> Excluir</button>
                    <button type="submit" className="bg-[#002f6c] hover:bg-[#001f4d] text-white font-bold py-3 px-8 rounded-xl transition-all shadow-md">Atualizar</button>
                  </>
                ) : (
                  <button type="submit" className="w-full bg-[#002f6c] hover:bg-[#001f4d] text-[#ffcc00] font-black py-3.5 rounded-xl transition-all shadow-md text-lg">CADASTRAR</button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL DE CONFIRMAÇÃO CUSTOMIZADO (SUBSTITUI O WINDOW.CONFIRM) --- */}
      {confirmacaoModal && (
        <div className="absolute top-0 left-0 w-full h-full bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white p-6 rounded-2xl w-full max-w-sm shadow-2xl border-t-4 border-amber-500">
            <h3 className="text-lg font-black text-slate-800 flex items-center gap-2 mb-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              {confirmacaoModal.titulo}
            </h3>
            <p className="text-sm font-medium text-slate-600 mb-6">{confirmacaoModal.msg}</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmacaoModal(null)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2 rounded-xl text-sm transition-all">Cancelar</button>
              <button onClick={confirmacaoModal.acao} className="bg-amber-500 hover:bg-amber-600 text-[#002f6c] font-black px-5 py-2 rounded-xl text-sm shadow-sm transition-all">Confirmar</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;