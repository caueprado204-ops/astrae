# Estudo piloto — Temperatura e dengue em Campinas (SP), 2015–2025

**Status:** protocolo definido e análise implementada na plataforma (página *Clima e Saúde*, botão "Usar configuração do piloto"). Os resultados numéricos são gerados ao vivo a partir das fontes e ainda não foram revisados por pesquisadores.

## Por que dengue, e não mortalidade por calor

A pergunta original era sobre temperaturas elevadas e indicadores públicos de saúde. A disponibilidade dos dados foi avaliada antes de fechar o desenho:

| Indicador | Fonte | Acesso verificado | Situação |
|---|---|---|---|
| Casos de dengue, chikungunya e zika por semana | InfoDengue (Fiocruz/FGV), a partir do SINAN | API pública JSON. Resposta real de Campinas conferida em 20/10/2026. | **Usado no piloto** |
| Óbitos por dia e causa | SIM / DATASUS | Arquivos DBC por UF e ano, sem API | Roteiro pronto em `scripts/datasus/`, não executado |
| Internações SUS | SIH / DATASUS | Arquivos mensais por UF, sem API | Mesmo roteiro |

A dengue tem série municipal semanal pronta e é uma doença sensível ao clima. Serve para validar o método (agregação, defasagens, sazonalidade, documentação) antes de incluir os desfechos de calor, que dependem do processamento do SIM.

## Protocolo

| Item | Definição |
|---|---|
| Pergunta | Em Campinas, entre 2015 e 2025, a temperatura semanal está associada aos casos notificados de dengue nas semanas seguintes? |
| Desenho | Ecológico de séries temporais, exploratório. Unidade: município × semana epidemiológica. |
| Desfecho | Casos notificados por semana (InfoDengue, campo `casos`), transformados em log(1 + casos). |
| Exposição | Temperatura média do ar a 2 m (T2M, NASA POWER), média dos dias da semana epidemiológica. Também disponíveis: máxima, mínima, chuva e umidade. |
| Ponto climático | Centróide da malha municipal do IBGE (código 3509502). |
| Faltantes | Uma semana só recebe valor climático se tiver pelo menos 5 dos 7 dias válidos. Nada é imputado. O n efetivo é informado em cada defasagem. |
| Análises | Descritivas; perfil sazonal médio por semana epidemiológica; correlação de Spearman entre clima em t e casos em t + k (k = 0…12), nas séries brutas e após subtrair a média de cada semana epidemiológica. |
| Inferência | Nenhum teste de significância: as séries são autocorrelacionadas e sazonais, o que invalida os testes clássicos. |
| Reprodutibilidade | A página exporta os dados semanais (CSV com cabeçalho de proveniência) e os parâmetros e resultados (JSON). A investigação pode ser criada a partir do protocolo em *Investigações*. |

## Limitações

- Associação não é causalidade. Não são controlados:
  - chuva (a não ser como variável separada);
  - imunidade da população;
  - sorotipos circulantes;
  - ações de controle vetorial;
  - mudanças na notificação.
- O clima é reanálise em grade de cerca de 50 km, não medição de estação. A comparação com a estação do INMET é a próxima etapa.
- As semanas recentes ainda são revisadas pela vigilância.
- O POWER publica com alguns dias de atraso, então as últimas semanas podem ficar sem clima.

## Próximos passos

1. Rodar a análise na plataforma e salvar o resultado na investigação do piloto.
2. Pedir revisão metodológica (status "em revisão" e parecer).
3. Executar o roteiro do SIM para Campinas e comparar semanas de calor extremo com as demais (mortalidade total e cardiorrespiratória).
4. Discutir com orientadores a passagem para modelos de contagem com defasagens distribuídas.
