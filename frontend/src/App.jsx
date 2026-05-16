import React, { useState, useEffect } from 'react';
import { Plus, Search, MonitorDot, X, Archive, History, RefreshCcw, Filter } from 'lucide-react';
import { supabase } from './supabaseClient';

function App() {
  const [modalAberto, setModalAberto] = useState(false);
  const [modalArquivadosAberto, setModalArquivadosAberto] = useState(false);

  const [equipamentos, setEquipamentos] = useState([]);
  const [equipamentosArquivados, setEquipamentosArquivados] = useState([]);

  // --- NOVOS ESTADOS PARA BUSCA E FILTRO ---
  const [termoBusca, setTermoBusca] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState('Todos');

  const [novoChamado, setNovoChamado] = useState('');
  const [novaLoja, setNovaLoja] = useState('');
  const [novaCategoria, setNovaCategoria] = useState('');
  const [novaIdentificacao, setNovaIdentificacao] = useState('');

  const categoriasDisponiveis = ["Todos", "Nobreak", "Leitor", "Monitor", "Impressora", "Outro"];

  const buscarEquipamentos = async () => {
    const { data, error } = await supabase
      .from('equipamentos')
      .select('*')
      .neq('status', 'Arquivado')
      .order('criado_em', { ascending: false });
    if (!error) setEquipamentos(data);
  };

  const buscarArquivados = async () => {
    const { data, error } = await supabase
      .from('equipamentos')
      .select('*')
      .eq('status', 'Arquivado')
      .order('atualizado_em', { ascending: false });
    if (!error) setEquipamentosArquivados(data);
  };

  useEffect(() => {
    buscarEquipamentos();
  }, []);

  const abrirHistorico = () => {
    buscarArquivados();
    setModalArquivadosAberto(true);
  };

  const salvarEquipamento = async (e) => {
    e.preventDefault();
    const { error } = await supabase
      .from('equipamentos')
      .insert([{
        chamado_glpi: novoChamado,
        loja: novaLoja.toUpperCase(),
        categoria: novaCategoria,
        identificacao: novaIdentificacao,
        status: 'P/ Manutenção'
      }]);

    if (!error) {
      setNovoChamado(''); setNovaLoja(''); setNovaCategoria(''); setNovaIdentificacao('');
      setModalAberto(false);
      buscarEquipamentos();
    }
  };

  const atualizarStatus = async (id, novoStatus) => {
    setEquipamentos(prev => prev.map(eq => eq.id === id ? { ...eq, status: novoStatus } : eq));
    const { error } = await supabase.from('equipamentos').update({ status: novoStatus }).eq('id', id);
    if (error) {
      alert("Erro ao mover: " + error.message);
      buscarEquipamentos();
    }
  };

  const arquivarEquipamento = async (id) => {
    const confirmar = window.confirm("Deseja realmente dar baixa/arquivar este equipamento?");
    if (!confirmar) return;

    setEquipamentos(prev => prev.filter(eq => eq.id !== id));
    const { error } = await supabase.from('equipamentos').update({ status: 'Arquivado' }).eq('id', id);
    if (error) {
      alert("Erro ao arquivar: " + error.message);
      buscarEquipamentos();
    }
  };

  const restaurarEquipamento = async (id) => {
    const { error } = await supabase.from('equipamentos').update({ status: 'Pronto p/ retirada' }).eq('id', id);
    if (!error) {
      buscarArquivados();
      buscarEquipamentos();
    }
  };

  const handleDragStart = (e, id) => { e.dataTransfer.setData("equipamentoId", id); };
  const handleDragOver = (e) => { e.preventDefault(); };
  const handleDrop = (e, novoStatus) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("equipamentoId");
    if (id) atualizarStatus(parseInt(id), novoStatus);
  };

  // --- LÓGICA DE FILTRAGEM ---
  const equipamentosFiltrados = equipamentos.filter(eq => {
    // Verifica aba de categoria
    const atendeCategoria = categoriaFiltro === 'Todos' || eq.categoria === categoriaFiltro;
    // Verifica texto da busca
    const termo = termoBusca.toLowerCase();
    const atendeBusca =
      eq.chamado_glpi.toLowerCase().includes(termo) ||
      eq.loja.toLowerCase().includes(termo) ||
      (eq.identificacao && eq.identificacao.toLowerCase().includes(termo));

    return atendeCategoria && atendeBusca;
  });

  const colunas = [
    { titulo: "P/ Manutenção", corBorda: "border-blue-500", corFundo: "bg-blue-50", corTexto: "text-blue-700" },
    { titulo: "Assistência", corBorda: "border-yellow-500", corFundo: "bg-yellow-50", corTexto: "text-yellow-700" },
    { titulo: "Pronto p/ retirada", corBorda: "border-emerald-500", corFundo: "bg-emerald-50", corTexto: "text-emerald-700" },
    { titulo: "Sem conserto", corBorda: "border-red-500", corFundo: "bg-red-50", corTexto: "text-red-700" }
  ];

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-800 relative flex flex-col">

      <header className="bg-[#002f6c] text-white shadow-md z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <MonitorDot className="w-8 h-8 text-[#ffcc00]" />
              <div>
                <h1 className="text-xl font-bold leading-tight">Controle de Manutenção</h1>
                <p className="text-xs text-blue-200">Shibata Supermercados • TI</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="relative hidden md:block">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar chamado, loja ou ID..."
                  value={termoBusca}
                  onChange={(e) => setTermoBusca(e.target.value)}
                  className="bg-blue-800 text-white placeholder-blue-300 text-sm rounded-full pl-9 pr-4 py-2 w-72 focus:outline-none focus:ring-2 focus:ring-[#ffcc00] transition-all"
                />
              </div>

              <button onClick={abrirHistorico} className="bg-blue-800 hover:bg-blue-700 text-white font-semibold text-sm px-4 py-2 rounded-md flex items-center gap-2 transition-all">
                <History className="w-4 h-4" /> Histórico
              </button>

              <button onClick={() => setModalAberto(true)} className="bg-[#ffcc00] hover:bg-yellow-400 text-blue-900 font-semibold text-sm px-4 py-2 rounded-md flex items-center gap-2 transition-all">
                <Plus className="w-4 h-4" /> Novo
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-screen-2xl mx-auto px-4 py-6 w-full flex-1 flex flex-col">

        {/* BARRA DE FILTROS (Abas) */}
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2 border-b border-slate-200">
          <Filter className="w-4 h-4 text-slate-400 mr-2" />
          {categoriasDisponiveis.map(cat => (
            <button
              key={cat}
              onClick={() => setCategoriaFiltro(cat)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all whitespace-nowrap ${categoriaFiltro === cat
                  ? 'bg-[#002f6c] text-white shadow-md'
                  : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* KANBAN */}
        <div className="flex gap-6 overflow-x-auto pb-4 flex-1">
          {colunas.map((coluna, index) => {
            // Usa a lista filtrada em vez da lista total!
            const equipamentosDaColuna = equipamentosFiltrados.filter(eq => eq.status === coluna.titulo);

            return (
              <div
                key={index}
                className="flex-1 min-w-[300px] flex flex-col bg-slate-200/50 rounded-xl p-3 border border-slate-200"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, coluna.titulo)}
              >
                <div className={`flex items-center justify-between mb-3 px-3 py-2 rounded-lg border-l-4 ${coluna.corBorda} ${coluna.corFundo}`}>
                  <h2 className={`font-bold text-sm uppercase ${coluna.corTexto}`}>{coluna.titulo}</h2>
                  <span className="bg-white px-2 py-0.5 rounded-full text-xs font-bold text-slate-500 shadow-sm">
                    {equipamentosDaColuna.length}
                  </span>
                </div>

                <div className="flex-1 flex flex-col gap-3 min-h-[50px]">
                  {equipamentosDaColuna.length > 0 ? (
                    equipamentosDaColuna.map((eq) => (
                      <div
                        key={eq.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, eq.id)}
                        className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 hover:shadow-md transition-all cursor-grab active:cursor-grabbing border-l-4 border-l-[#002f6c] relative group"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-xs font-bold text-[#002f6c] bg-blue-50 px-2 py-1 rounded">{eq.categoria}</span>
                          <span className="text-xs font-bold bg-slate-100 px-2 py-1 rounded text-slate-600">Loja {eq.loja}</span>
                        </div>
                        <p className="text-sm font-semibold text-slate-700 mb-2">Chamado: {eq.chamado_glpi}</p>
                        {eq.identificacao && (
                          <div className="text-xs text-slate-500 font-medium">ID: {eq.identificacao}</div>
                        )}

                        {(coluna.titulo === "Pronto p/ retirada" || coluna.titulo === "Sem conserto") && (
                          <button
                            onClick={() => arquivarEquipamento(eq.id)}
                            className="absolute bottom-3 right-3 text-slate-400 hover:text-red-600 transition-colors bg-white p-1 rounded-full opacity-0 group-hover:opacity-100 shadow-sm border border-slate-200"
                            title="Dar Baixa / Arquivar"
                          >
                            <Archive className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="flex items-center justify-center h-20 border-2 border-dashed border-slate-300 rounded-lg">
                      <span className="text-sm text-slate-400 font-medium">Solte o card aqui</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* MODAL DE HISTÓRICO MANTIDO IGUAL */}
      {modalArquivadosAberto && (
        <div className="absolute top-0 left-0 w-full h-full bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-3xl shadow-xl flex flex-col max-h-[80vh]">
            <div className="flex justify-between items-center p-6 border-b">
              <h3 className="text-lg font-bold flex items-center gap-2"><History className="w-5 h-5 text-[#002f6c]" /> Histórico de Equipamentos</h3>
              <button onClick={() => setModalArquivadosAberto(false)}><X className="w-5 h-5 text-gray-500 hover:text-red-500" /></button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              {equipamentosArquivados.length === 0 ? (
                <p className="text-center text-gray-500 my-8">Nenhum equipamento arquivado ainda.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {equipamentosArquivados.map((eq) => (
                    <div key={eq.id} className="flex items-center justify-between bg-slate-50 p-4 rounded border">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold text-white bg-slate-500 px-2 py-0.5 rounded">{eq.categoria}</span>
                          <span className="text-sm font-bold text-slate-700">Loja {eq.loja}</span>
                        </div>
                        <p className="text-sm text-slate-600">Chamado: {eq.chamado_glpi} {eq.identificacao ? ` | ID: ${eq.identificacao}` : ''}</p>
                      </div>
                      <button onClick={() => restaurarEquipamento(eq.id)} className="text-blue-600 hover:bg-blue-100 p-2 rounded flex items-center gap-1 text-sm font-medium transition-colors">
                        <RefreshCcw className="w-4 h-4" /> Restaurar
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CADASTRO MANTIDO IGUAL */}
      {modalAberto && (
        <div className="absolute top-0 left-0 w-full h-full bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-96 shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Cadastrar Equipamento</h3>
              <button onClick={() => setModalAberto(false)}><X className="w-5 h-5 text-gray-500 hover:text-red-500" /></button>
            </div>
            <form onSubmit={salvarEquipamento} className="flex flex-col gap-4">
              <div>
                <label className="text-sm font-semibold">Nº do Chamado (GLPI)</label>
                <input required type="text" value={novoChamado} onChange={(e) => setNovoChamado(e.target.value)} className="w-full border p-2 rounded mt-1" placeholder="Ex: 13990" />
              </div>
              <div>
                <label className="text-sm font-semibold">Loja</label>
                <input required type="text" value={novaLoja} onChange={(e) => setNovaLoja(e.target.value)} className="w-full border p-2 rounded mt-1 uppercase" placeholder="Ex: A01, S15..." />
              </div>
              <div>
                <label className="text-sm font-semibold">Categoria</label>
                <select required value={novaCategoria} onChange={(e) => setNovaCategoria(e.target.value)} className="w-full border p-2 rounded mt-1">
                  <option value="">Selecione...</option>
                  <option value="Nobreak">Nobreak</option>
                  <option value="Leitor">Leitor</option>
                  <option value="Monitor">Monitor</option>
                  <option value="Impressora">Impressora</option>
                  <option value="Outro">Outro...</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-semibold">Identificação (Patrimônio/Série)</label>
                <input type="text" value={novaIdentificacao} onChange={(e) => setNovaIdentificacao(e.target.value)} className="w-full border p-2 rounded mt-1" placeholder="Deixe em branco se não tiver" />
              </div>
              <button type="submit" className="bg-[#002f6c] text-white font-bold py-2 rounded mt-2 hover:bg-blue-800 transition-colors">
                Salvar
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;