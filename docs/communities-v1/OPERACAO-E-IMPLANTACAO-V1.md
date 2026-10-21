# Comunidades V1 — operação futura, checklist e implantação

Plano documental da Fase 5. **Não foi executado em produção.** Não cria scheduler, credencial, usuário oficial, pagamento ou ambiente hospedado. Reutiliza as migrations e instruções anteriores; qualquer execução futura depende de autorização do usuário e da validação crítica pendente.

## 1. Notificações de eventos

Rotina: `public.dispatch_community_event_notifications(integer DEFAULT 100)`, execução restrita a operador confiável/service_role; máximo 500 assinaturas por chamada. O retorno conta assinaturas processadas, não notificações inseridas. Uma assinatura pode gerar atualização e lembrete na mesma passagem.

Autoridade é o backend: RSVP interessado/confirmado com opt-in, comunidade ativa, associação atual, ausência de banimento e acesso ao canal. Lembrete somente para início futuro dentro de 15 minutos. Atualização/cancelamento depende da revisão ainda não notificada. Locks com `SKIP LOCKED` e chave única evitam entrega persistida duplicada entre workers. Repetir em lotes drena pendências; falha de transação desfaz a passagem. Não remover a unicidade para “corrigir” retries.

**Estado instalado:** função e testes SQL, sem cron/worker operacional. O cliente consulta inbox a cada 20 s com o app aberto; isso não executa o dispatcher. Notificação do sistema requer permissão já concedida e disponibilidade do app; app fechado não tem push instalado.

Configuração proposta para avaliação futura: worker confiável a cada 60 s, lote inicial 100, timeout/retry com backoff, limite de lotes por execução e segredo exclusivamente no backend. Essa cadência é proposta, não medição de capacidade. Antes de habilitar: testar dois workers, mudanças de horário/fuso/canal, saída/banimento, opt-out, comunidade desativada, cancelamento, perda de permissão e eventos que já começaram. Monitorar pendências/revisões, duração, erros e atraso sem registrar títulos/evidências pessoais em logs operacionais. Não prometer horário exato de entrega ao usuário.

## 2. Retenção de moderação

Rotina: `public.prune_community_moderation_data(integer DEFAULT 100)`, somente operador/service_role. Limite de 1–500 **por conjunto/tabela**, não global. Atua em cinco conjuntos; uma passagem pode afetar mais que o valor do argumento. Retorna a soma de linhas afetadas; utiliza `SKIP LOCKED`.

| Dados                                                      | Regra atual                                                         |
| ---------------------------------------------------------- | ------------------------------------------------------------------- |
| Evidência textual                                          | Até 30 dias; máximo 1000 caracteres; sem arquivos anexados copiados |
| Descrição/referências pessoais de denúncia                 | 90 dias                                                             |
| Motivos e referências de advertências/decisões             | 90 dias                                                             |
| Cópia de apresentação retirada                             | 90 dias; não apaga apresentação ainda publicada                     |
| Vínculo pessoal em auditoria privada de identidade oficial | Dissociação após 90 dias                                            |

Tombstones técnicos de tipo/estado/data/servidor permanecem após anonimização. Autoridade oficial/suspensão vigente não é revogada pela limpeza; auditoria geral preexistente tem sua própria política. RPCs ocultam campos vencidos mesmo sem limpeza física. Isso **não garante** anonimização física no prazo enquanto não houver operação agendada.

**Estado instalado:** nenhum scheduler. Configuração futura proposta: passagem diária com lotes de 100 e janela máxima de processamento; aumentar frequência somente após medir backlog. Validar vencimento, concorrência, repetição, recuperação após falha e ausência de texto/identidade nas projeções. Monitorar idade da fila e registros afetados por conjunto, evitando exportar evidências. Auditoria operacional não deve copiar novamente dados que a retenção remove.

## 3. Autoridades separadas

- Gestão comunitária: proprietário ou delegação explícita de `manage_community`, validada pelo backend. `administrator` genérico não equivale à delegação.
- Moderação: capacidades específicas, posição/limites e revisão no backend. Não atribuir permissões administrativas pelo onboarding.
- Equipe oficial: tabela privada `platform_safety_staff`; nenhuma migration concede autoridade por email/nome/cargo comum. Provisionamento humano precisa de procedimento, justificativa, revisão e autorização próprios.
- Fontes de XP: mantidas desligadas. Scheduler de eventos/retenção não pode conceder XP ou habilitar o verificador. Mensagens, RSVP e permanência em voz não viram provas de participação.
- Orçamentos SQL não bastam contra abuso inválido/distribuído; exigir limite HTTP/gateway durável antes de lançamento.

## 4. Checklist da avaliação na prévia

Os itens abaixo são roteiro para o usuário; não são marcados como aprovação de produção:

- [ ] Abrir `npm run preview:communities`, conferir aviso permanente de fixtures e navegar pelos sete módulos.
- [ ] Home: identidade, aviso, canal, interesses, nível e atalhos; verificar largura desktop/móvel e teclado.
- [ ] Boas-vindas: interromper/salvar/reabrir; aceitar regra obrigatória, selecionar interesse/cargo e concluir.
- [ ] Configurações: editar apresentação, ordem dos módulos, avisos e etapas; voltar à Home e revisar o resultado.
- [ ] Ativação: selecionar servidor comum e abrir assistente; revisar regras/canal/identidade antes de confirmar na fixture.
- [ ] Eventos: carregar exemplo, responder/retirar, editar/cancelar e alternar listas. Criar um novo evento manualmente, incluindo o campo nativo de data/hora, ainda não concluído pela automação de UI.
- [ ] Explorar: carregar exemplo, buscar, ver apresentação, simular solicitação/retirada, vazio/erro/carregamento; publicação somente por escolha da fixture de proprietário.
- [ ] Moderação: revisar evidência, exigir justificativa, conferir advertência/histórico/segurança e distinguir a fixture oficial.
- [ ] Evolução: verificador desligado e ausência de ganhos; abrir detalhes/galeria/histórico.
- [ ] Estatísticas: período, vazio, aviso sobre RSVP e métricas indisponíveis.
- [ ] Cosméticos: prévia/aplicar/remover, verificar Home e banner original; moldura bloqueada.
- [ ] Trocar conta fictícia/reiniciar: confirmar reset; alternar comum/comunidade: preservar dados da fixture. Não interpretar isso como sessão Auth real.

## 5. Critérios críticos antes de recomendar lançamento

Continuam **pendentes**, não substituídos por SQL sintético ou por esta prévia:

- [ ] Autenticação real GoTrue/PostgREST em infraestrutura isolada autorizada, sem reutilizar banco/usuários/credenciais reais. Não criar essa infraestrutura automaticamente.
- [ ] Matriz de proprietário, delegado, administrador sem delegação, membro, estranho e equipe oficial; duas sessões com revogação e alteração de regras/cargos durante uma operação.
- [ ] Trocar conta e servidor no WEB/EXE; respostas atrasadas, cache e desconexão não podem mostrar dados de outra identidade.
- [ ] Upload autenticado de banner, tipos/tamanho, URLs assinadas e renovação/expiração; remover cosmético sem perder o banner original.
- [ ] WEB→WEB, WEB→EXE, EXE→WEB e EXE→EXE: mensagens, notificações, voz, entrada/saída, compartilhamento, áudio suportado e reconexão; não deixar chamada em “Conectando”.
- [ ] Entrega de evento com o worker real e app em primeiro/segundo plano; documentar app fechado sem infraestrutura de push.
- [ ] Retenção física e projeções vencidas após indisponibilidade/retry; validação das regras humanas de autoridade oficial.
- [ ] Volume representativo: SQL/planos, paginação, sessões longas, CPU/GPU/memória, rede instável e Modo Desempenho.
- [ ] Fonte confiável/antifraude antes de qualquer proposta separada de XP. A V1 pode ser avaliada com fontes desligadas; não destravar a moldura para simular completude.
- [ ] Triagem do lint global legado: 55 erros e 51 avisos na auditoria desta fase; arquivos alterados estão limpos.

## 6. Plano de implantação futura — não executar agora

1. Congelar um commit revisado, inventário de artefatos, relatório e evidências. Preservar 0.1.58 e feature desligada; não fazer push/publicar só porque o build passou.
2. Concluir a matriz crítica acima, corrigir falhas e obter avaliação explícita do usuário. Nenhum resultado SQL equivale a autenticação ponta a ponta.
3. Mediante autorização específica de cada migration, preparar backup privado, ensaio da cadeia incremental, timeouts, conferência de ACL/RLS, índices e plano de contenção. Não recriar servidores, alterar IDs ou fazer backfill de recompensas antigas.
4. Verificar estado remoto apenas quando autorizado; confrontar migrations já existentes para não repeti-las. Se houver erro, interromper a implantação e registrar o rollback/estado real antes de nova tentativa.
5. Publicação WEB somente com autorização explícita, inicialmente com feature desligada. Ativar Comunidade por escolha do proprietário, mantendo diretório opt-in separado e fontes de XP desligadas.
6. Preparar instalador local de nova versão somente quando autorizado. Solicitar teste de abertura/login/voz/fluxos comunitários e autorização separada para distribuição automática, seguindo o procedimento anterior do projeto.
7. Schedulers, equipe oficial e limites HTTP exigem configuração operacional e autorização próprias; não habilitá-los como efeito colateral de uma migration ou build.
8. Observar erros, permissões, filas e consultas sem registrar dados pessoais desnecessários. Na contenção inicial, desligar feature/publicação do diretório conforme procedimento autorizado, preservando dados e ledger. Não executar rollback destrutivo automático de schema após gravações reais.

Aguardar avaliação da Fase 5. Nenhuma etapa de implantação foi executada.
