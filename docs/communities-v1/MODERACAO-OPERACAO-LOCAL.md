# Operação local da moderação — fundação

Não executar este documento contra produção sem autorização específica.
Não há identidade oficial provisionada pela migration, por email ou por cargo.

## Identidades oficiais

A fonte de autoridade é `security_private.platform_safety_staff`, com UUID de Auth
e `enabled`. Somente operador confiável do banco/backend pode administrá-la. O schema
não tem USAGE de navegador e não há RPC pública para conceder esse acesso. O frontend
consulta apenas sua capacidade atual e não decide quem é oficial.

Provisionamento/revogação usa procedimento controlado do operador: conferir o ambiente
isolado, conferir o UUID da identidade e registrar a aprovação externa necessária.
Fixtures SQL demonstram isso com usuários sintéticos e rollback; não reutilizar seus IDs.
O trigger registra INSERT/UPDATE/DELETE e operador do banco na auditoria privada.
Uma política humana de concessão, justificativa e revisão precisa ser definida antes de
habilitar a plataforma em produção. Não usar a chave service_role em frontend ou prévia.

Revogação por `enabled=false` é revalidada e serializada com ações oficiais. A reversão
de suspensão exige outra identidade; não republica conteúdo nem concede gestão interna.

## Retenção

Rotina disponível para owner confiável/service_role:

```sql
SELECT public.prune_community_moderation_data(100);
```

Limite de 1 a 500 **por conjunto/tabela**, não total global; retorna linhas afetadas.
Concorrência usa SKIP LOCKED. Não há agendamento instalado ou chamada por navegador.

- Evidência: 30 dias, máximo 1000 caracteres, sem arquivos/anexos copiados.
- Descrição e referências pessoais de denúncias, motivos de advertências/decisões: 90 dias.
- Cópia de apresentação retirada: 90 dias. Conteúdo ainda publicado permanece público.
- Auditoria privada de identidade: vínculo do usuário dissociado após 90 dias.
- Tombstones técnicos de tipo/estado/data/servidor podem permanecer; não contêm texto ou
  identidade de denunciante/alvo/revisor após a anonimização.
- Identidade atualmente autorizada e autoridade de suspensão vigente são mantidas enquanto
  a autorização/suspensão existir. A auditoria geral anterior segue sua política preexistente.

RPCs ocultam campos vencidos mesmo antes da limpeza física. Garantia operacional de
anonimização física exige scheduler/monitoramento autorizado, filas, retries e testes de
recuperação. Nenhum scheduler ou credencial de operação foi instalado nesta entrega.

## Proteção de tráfego

Os orçamentos SQL são transacionais. Chamadas que levantam exception desfazem o contador.
Configurar um limite HTTP/gateway durável para tentativas inválidas e abuso distribuído
antes de publicação. Não tratar os testes SQL como comprovação desse controle externo.
Filtros de conteúdo continuam opt-in e não geram punições automáticas ou serviço externo.
