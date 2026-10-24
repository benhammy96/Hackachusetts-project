/**
 * Translations for the offline brief template.
 *
 * Only *labels and narrative* are translated. Measured values keep the units
 * and wording of the dataset that published them, because restating a
 * measurement in another language risks changing it. Each language therefore
 * carries a `measurementNote` that tells the reader exactly that.
 *
 * `{tokens}` are substituted by `fill()` in lib/brief.ts.
 */

import type { FactorKey, Lens } from "./types";

export const LANGUAGES = [
  { code: "en", label: "English", endonym: "English" },
  { code: "es", label: "Spanish", endonym: "Español" },
  { code: "pt", label: "Portuguese", endonym: "Português" },
  { code: "ht", label: "Haitian Creole", endonym: "Kreyòl ayisyen" },
  { code: "vi", label: "Vietnamese", endonym: "Tiếng Việt" },
  { code: "zh", label: "Chinese", endonym: "中文" },
  { code: "sq", label: "Albanian", endonym: "Shqip" },
] as const;

export type LangCode = (typeof LANGUAGES)[number]["code"];
export type BandKey = "strong" | "workable" | "contested" | "avoid" | "fatal";

export interface Strings {
  briefTitle: string;
  reportTitle: string;
  s1: string;
  s2: string;
  s3: string;
  nextSteps: string;
  alternatives: string;

  score: string;
  buildability: string;
  community: string;
  strongest: string;
  weakest: string;
  bonuses: string;
  lensGap: string;
  lensGapNote: string;

  excludedLead: string;
  hardScreenNote: string;

  unmeasured: string;
  unmeasuredBody: string;
  measurementNote: string;

  alwaysUnverified: string;
  gridCapacity: string;
  zoning: string;
  availability: string;

  modelledSpend: string;

  templateNote: string;

  bands: Record<BandKey, string>;
  factors: Record<FactorKey, string>;
  lenses: Record<Lens, string>;

  q: {
    capacity: string;
    cleanEnergy: string;
    underThreshold: string;
    ej: string;
    residents: string;
    waterEvap: string;
    waterClosed: string;
    reporting: string;
  };

  steps: string[];
}

const EN: Strings = {
  briefTitle: "Town-meeting brief",
  reportTitle: "Developer screening report",
  s1: "What the score means",
  s2: "What Executive Order 658 requires at this size",
  s3: "Questions to ask the developer",
  nextSteps: "Next due-diligence steps",
  alternatives: "Higher-scoring cells within 25 km",

  score: "Screening score",
  buildability: "Buildability",
  community: "Community",
  strongest: "Strongest factor",
  weakest: "Weakest factor",
  bonuses: "Bonuses applied",
  lensGap: "The developer view and the neighbour view differ by {gap} points.",
  lensGapNote:
    "A low score is a model label, not a prediction of how anyone will vote, and a high score is not approval.",

  excludedLead: "Atlas screens this location as a fatal flaw, scoring 0 out of 10.",
  hardScreenNote:
    "A hard screen returns zero before any bonus is applied. This is a preliminary screen from published map layers, not a legal determination for a specific parcel.",

  unmeasured: "Not everything is measured",
  unmeasuredBody:
    "{factors} {verb} no data in this build, so {pronoun} dropped from the score rather than guessed. {b}% of the buildability weight and {c}% of the community weight is actually measured.",
  measurementNote:
    "Measured values are quoted in the words and units of the dataset that published them.",

  alwaysUnverified: "Three things this screen can never tell you",
  gridCapacity:
    "Grid capacity is unverified. Atlas knows the distance to the nearest mapped line, which is not available capacity and not an interconnection study.",
  zoning: "Zoning is unknown. No municipal district or special-permit status is loaded.",
  availability:
    "Availability is unknown. This is a geographic screening cell, not a parcel, and nothing here says any land is for sale.",

  modelledSpend: "Modelled annual electricity spend at this size is {usd}.",

  templateNote:
    "Written offline from measured values using a fixed template, with no language model involved.",

  bands: {
    strong: "Strong site",
    workable: "Workable with conditions",
    contested: "Contested site",
    avoid: "Do not build here",
    fatal: "Fatal flaw",
  },
  factors: {
    grid_access: "Grid access",
    clean_power: "Clean power proximity",
    fiber: "Fiber and latency",
    land_readiness: "Land readiness",
    residents: "Residents nearby",
    environmental_justice: "Environmental justice",
    water: "Water",
    climate_risk: "Climate risk",
  },
  lenses: { resident: "Resident", balanced: "Balanced", developer: "Developer" },

  q: {
    capacity:
      "Has the utility confirmed that {mw} MW can actually be delivered here? Atlas only knows that the nearest mapped {kv} kV or higher line is {dist} away, which says nothing about available capacity.",
    cleanEnergy:
      "Which specific new clean generation will cover this project's annual electricity use under Executive Order 658 section 5, and if you pay into the Ratepayer Protection Fund instead, what does that mean for our bills?",
    underThreshold:
      "At {mw} MW this project stays under the Executive Order 658 threshold of 25 MW. What stops it from being expanded past 25 MW later, and would that expansion trigger the order?",
    ej: "This block group is designated an environmental justice population. Who have you negotiated a community benefits agreement with, and has the state Office of Environmental Justice and Equity accepted it?",
    residents:
      "There are {pop} residents within 1 km. What noise, traffic and air modelling have you done for them, and who have you signed a community benefits agreement with?",
    waterEvap:
      "How many litres of water per day will evaporative cooling consume in a dry summer, which supply will provide it, and what happens to the discharge?",
    waterClosed:
      "You have shown a {design} design. Will that be a binding permit condition, and what energy penalty are you accepting in exchange?",
    reporting:
      "What will you publish every year once you are operating — actual energy use, water use and emissions — and will the town have the right to audit it?",
  },

  steps: [
    "Request a feasibility or system impact study from the distribution and transmission owner. Atlas cannot see hosting capacity or the interconnection queue.",
    "Confirm the zoning district, use classification and any special-permit path with the municipality.",
    "Establish ownership and whether any land is actually available. Atlas holds no parcel, owner or listing record.",
    "Order a parcel-level wetlands delineation and a FEMA flood determination. The screens here are generalised polygon intersections.",
    "Model water supply and discharge for the chosen cooling design, including a dry-year case.",
  ],
};

const ES: Strings = {
  briefTitle: "Informe para la asamblea municipal",
  reportTitle: "Informe de evaluación para promotores",
  s1: "Qué significa la puntuación",
  s2: "Qué exige la Orden Ejecutiva 658 a este tamaño",
  s3: "Preguntas para el promotor",
  nextSteps: "Próximos pasos de diligencia debida",
  alternatives: "Celdas con mejor puntuación a menos de 25 km",

  score: "Puntuación de evaluación",
  buildability: "Viabilidad de construcción",
  community: "Comunidad",
  strongest: "Factor más favorable",
  weakest: "Factor más débil",
  bonuses: "Bonificaciones aplicadas",
  lensGap: "La perspectiva del promotor y la del vecindario difieren en {gap} puntos.",
  lensGapNote:
    "Una puntuación baja es una etiqueta del modelo, no una predicción de cómo votará nadie, y una puntuación alta no es una aprobación.",

  excludedLead: "Atlas califica esta ubicación como defecto fatal, con 0 de 10 puntos.",
  hardScreenNote:
    "Un criterio excluyente devuelve cero antes de aplicar cualquier bonificación. Es una evaluación preliminar basada en capas cartográficas publicadas, no una determinación legal para una parcela concreta.",

  unmeasured: "No todo está medido",
  unmeasuredBody:
    "{factors} no {verb} datos en esta versión, por lo que {pronoun} excluye del cálculo en lugar de estimarse. Se mide realmente el {b}% del peso de viabilidad de construcción y el {c}% del peso de comunidad.",
  measurementNote:
    "Los valores medidos se citan con las palabras y unidades del conjunto de datos que los publicó.",

  alwaysUnverified: "Tres cosas que esta evaluación nunca puede decirle",
  gridCapacity:
    "La capacidad de la red no está verificada. Atlas conoce la distancia a la línea cartografiada más cercana, que no es capacidad disponible ni un estudio de interconexión.",
  zoning:
    "La zonificación es desconocida. No se ha cargado ningún distrito municipal ni estado de permiso especial.",
  availability:
    "La disponibilidad es desconocida. Esta es una celda geográfica de evaluación, no una parcela, y nada aquí indica que haya terreno en venta.",

  modelledSpend: "El gasto anual de electricidad modelado a este tamaño es de {usd}.",

  templateNote:
    "Redactado sin conexión a partir de valores medidos con una plantilla fija, sin ningún modelo de lenguaje.",

  bands: {
    strong: "Emplazamiento sólido",
    workable: "Viable con condiciones",
    contested: "Emplazamiento controvertido",
    avoid: "No construir aquí",
    fatal: "Defecto fatal",
  },
  factors: {
    grid_access: "Acceso a la red eléctrica",
    clean_power: "Proximidad a generación limpia",
    fiber: "Fibra y latencia",
    land_readiness: "Aptitud del suelo",
    residents: "Residentes cercanos",
    environmental_justice: "Justicia ambiental",
    water: "Agua",
    climate_risk: "Riesgo climático",
  },
  lenses: { resident: "Residente", balanced: "Equilibrado", developer: "Promotor" },

  q: {
    capacity:
      "¿Ha confirmado la compañía eléctrica que realmente se pueden suministrar {mw} MW aquí? Atlas solo sabe que la línea cartografiada más cercana de {kv} kV o más está a {dist}, lo cual no dice nada sobre la capacidad disponible.",
    cleanEnergy:
      "¿Qué generación limpia nueva y concreta cubrirá el consumo anual de electricidad de este proyecto según la sección 5 de la Orden Ejecutiva 658 y, si en su lugar paga al Fondo de Protección de los Contribuyentes, qué significa eso para nuestras facturas?",
    underThreshold:
      "Con {mw} MW este proyecto se mantiene por debajo del umbral de 25 MW de la Orden Ejecutiva 658. ¿Qué impide ampliarlo más adelante por encima de 25 MW y activaría esa ampliación la orden?",
    ej: "Este grupo de bloques está designado como población de justicia ambiental. ¿Con quién ha negociado un acuerdo de beneficios comunitarios y lo ha aceptado la Oficina estatal de Justicia y Equidad Ambiental?",
    residents:
      "Hay {pop} residentes en un radio de 1 km. ¿Qué modelización de ruido, tráfico y aire ha realizado para ellos y con quién ha firmado un acuerdo de beneficios comunitarios?",
    waterEvap:
      "¿Cuántos litros de agua al día consumirá la refrigeración evaporativa en un verano seco, qué suministro la proporcionará y qué ocurre con el vertido?",
    waterClosed:
      "Ha presentado un diseño {design}. ¿Será una condición vinculante del permiso y qué penalización energética acepta a cambio?",
    reporting:
      "¿Qué publicará cada año cuando esté en funcionamiento — consumo real de energía, consumo de agua y emisiones — y tendrá el municipio derecho a auditarlo?",
  },

  steps: [
    "Solicite un estudio de viabilidad o de impacto en el sistema al propietario de la distribución y la transmisión. Atlas no puede ver la capacidad de acogida ni la cola de interconexión.",
    "Confirme con el municipio el distrito de zonificación, la clasificación de uso y cualquier vía de permiso especial.",
    "Determine la propiedad y si realmente hay terreno disponible. Atlas no dispone de registros de parcelas, propietarios ni anuncios.",
    "Encargue una delimitación de humedales a nivel de parcela y una determinación de inundación de FEMA. Las evaluaciones aquí son intersecciones de polígonos generalizados.",
    "Modele el suministro y el vertido de agua para el diseño de refrigeración elegido, incluido un escenario de año seco.",
  ],
};

const PT: Strings = {
  briefTitle: "Resumo para a assembleia municipal",
  reportTitle: "Relatório de triagem para promotores",
  s1: "O que significa a pontuação",
  s2: "O que a Ordem Executiva 658 exige neste tamanho",
  s3: "Perguntas para o promotor",
  nextSteps: "Próximos passos de diligência",
  alternatives: "Células com pontuação mais alta num raio de 25 km",

  score: "Pontuação de triagem",
  buildability: "Viabilidade de construção",
  community: "Comunidade",
  strongest: "Fator mais favorável",
  weakest: "Fator mais fraco",
  bonuses: "Bónus aplicados",
  lensGap: "A visão do promotor e a visão da vizinhança diferem em {gap} pontos.",
  lensGapNote:
    "Uma pontuação baixa é um rótulo do modelo, não uma previsão de como alguém irá votar, e uma pontuação alta não é uma aprovação.",

  excludedLead: "O Atlas classifica este local como falha fatal, com 0 de 10 pontos.",
  hardScreenNote:
    "Um critério eliminatório devolve zero antes de qualquer bónus. É uma triagem preliminar a partir de camadas cartográficas publicadas, não uma determinação legal para uma parcela concreta.",

  unmeasured: "Não está tudo medido",
  unmeasuredBody:
    "{factors} não {verb} dados nesta versão, pelo que {pronoun} excluído da pontuação em vez de ser estimado. Mede-se efetivamente {b}% do peso de viabilidade de construção e {c}% do peso de comunidade.",
  measurementNote:
    "Os valores medidos são citados nas palavras e unidades do conjunto de dados que os publicou.",

  alwaysUnverified: "Três coisas que esta triagem nunca lhe pode dizer",
  gridCapacity:
    "A capacidade da rede não está verificada. O Atlas conhece a distância à linha cartografada mais próxima, o que não é capacidade disponível nem um estudo de interligação.",
  zoning:
    "O zonamento é desconhecido. Nenhum distrito municipal nem estado de licença especial foi carregado.",
  availability:
    "A disponibilidade é desconhecida. Esta é uma célula geográfica de triagem, não uma parcela, e nada aqui indica que haja terreno para venda.",

  modelledSpend: "A despesa anual de eletricidade modelada neste tamanho é de {usd}.",

  templateNote:
    "Escrito offline a partir de valores medidos com um modelo fixo, sem qualquer modelo de linguagem.",

  bands: {
    strong: "Local forte",
    workable: "Viável com condições",
    contested: "Local contestado",
    avoid: "Não construir aqui",
    fatal: "Falha fatal",
  },
  factors: {
    grid_access: "Acesso à rede elétrica",
    clean_power: "Proximidade de geração limpa",
    fiber: "Fibra e latência",
    land_readiness: "Aptidão do terreno",
    residents: "Residentes próximos",
    environmental_justice: "Justiça ambiental",
    water: "Água",
    climate_risk: "Risco climático",
  },
  lenses: { resident: "Residente", balanced: "Equilibrado", developer: "Promotor" },

  q: {
    capacity:
      "A empresa de eletricidade confirmou que {mw} MW podem realmente ser entregues aqui? O Atlas sabe apenas que a linha cartografada mais próxima de {kv} kV ou superior está a {dist}, o que nada diz sobre a capacidade disponível.",
    cleanEnergy:
      "Que nova geração limpa concreta cobrirá o consumo anual de eletricidade deste projeto nos termos da secção 5 da Ordem Executiva 658 e, se em vez disso pagar ao Fundo de Proteção dos Consumidores, o que significa isso para as nossas faturas?",
    underThreshold:
      "Com {mw} MW este projeto fica abaixo do limiar de 25 MW da Ordem Executiva 658. O que impede uma ampliação futura acima de 25 MW e essa ampliação acionaria a ordem?",
    ej: "Este grupo de blocos está designado como população de justiça ambiental. Com quem negociou um acordo de benefícios comunitários e o Gabinete estadual de Justiça e Equidade Ambiental aceitou-o?",
    residents:
      "Existem {pop} residentes num raio de 1 km. Que modelação de ruído, trânsito e ar fez para eles e com quem assinou um acordo de benefícios comunitários?",
    waterEvap:
      "Quantos litros de água por dia consumirá o arrefecimento evaporativo num verão seco, que origem a fornecerá e o que acontece à descarga?",
    waterClosed:
      "Apresentou um projeto {design}. Será uma condição vinculativa da licença e que penalização energética aceita em troca?",
    reporting:
      "O que publicará todos os anos quando estiver em operação — consumo real de energia, consumo de água e emissões — e terá o município o direito de auditar?",
  },

  steps: [
    "Peça um estudo de viabilidade ou de impacto no sistema ao proprietário da distribuição e do transporte. O Atlas não vê capacidade de acolhimento nem a fila de interligação.",
    "Confirme com o município o distrito de zonamento, a classificação de uso e qualquer via de licença especial.",
    "Determine a propriedade e se existe terreno realmente disponível. O Atlas não tem registos de parcelas, proprietários ou anúncios.",
    "Encomende uma delimitação de zonas húmidas à escala da parcela e uma determinação de inundação da FEMA. As triagens aqui são interseções de polígonos generalizados.",
    "Modele o abastecimento e a descarga de água para o sistema de arrefecimento escolhido, incluindo um cenário de ano seco.",
  ],
};

const HT: Strings = {
  briefTitle: "Rezime pou reyinyon vil la",
  reportTitle: "Rapò tryaj pou devlopè",
  s1: "Sa nòt la vle di",
  s2: "Sa Lòd Egzekitif 658 egzije nan gwosè sa a",
  s3: "Kesyon pou poze devlopè a",
  nextSteps: "Pwochen etap verifikasyon",
  alternatives: "Selil ki gen pi bon nòt nan 25 km",

  score: "Nòt tryaj",
  buildability: "Kapasite pou konstwi",
  community: "Kominote",
  strongest: "Faktè ki pi favorab",
  weakest: "Faktè ki pi fèb",
  bonuses: "Bonis yo aplike",
  lensGap: "Pwen de vi devlopè a ak pwen de vi vwazen yo diferan pa {gap} pwen.",
  lensGapNote:
    "Yon nòt ki ba se yon etikèt modèl, se pa yon prediksyon sou kijan moun pral vote, e yon nòt ki wo pa vle di apwobasyon.",

  excludedLead: "Atlas klase kote sa a kòm yon pwoblèm fatal, ak 0 sou 10.",
  hardScreenNote:
    "Yon kritè eliminatwa bay zewo anvan nenpòt bonis. Sa a se yon tryaj preliminè ki soti nan kat ki pibliye, se pa yon desizyon legal pou yon pasèl espesifik.",

  unmeasured: "Tout bagay pa mezire",
  unmeasuredBody:
    "{factors} pa gen done nan vèsyon sa a, kidonk nou retire {pronoun} nan nòt la olye nou devine. {b}% nan pwa kapasite pou konstwi ak {c}% nan pwa kominote a mezire vre.",
  measurementNote:
    "Valè mezire yo site nan mo ak inite baz done ki pibliye yo.",

  alwaysUnverified: "Twa bagay tryaj sa a pa janm ka di ou",
  gridCapacity:
    "Kapasite rezo elektrik la pa verifye. Atlas konnen distans jiska liy ki pi pre ki sou kat la, men sa se pa kapasite ki disponib ni yon etid koneksyon.",
  zoning: "Zonaj la enkoni. Pa gen distrik minisipal ni pèmi espesyal ki chaje.",
  availability:
    "Disponiblite a enkoni. Sa a se yon selil jeyografik pou tryaj, se pa yon pasèl, e anyen isit la pa di gen tè pou vann.",

  modelledSpend: "Depans elektrisite anyèl modle nan gwosè sa a se {usd}.",

  templateNote:
    "Ekri san entènèt soti nan valè mezire ak yon modèl fiks, san okenn modèl lang.",

  bands: {
    strong: "Bon kote",
    workable: "Posib ak kondisyon",
    contested: "Kote konteste",
    avoid: "Pa konstwi isit la",
    fatal: "Pwoblèm fatal",
  },
  factors: {
    grid_access: "Aksè nan rezo elektrik",
    clean_power: "Pwoksimite ak enèji pwòp",
    fiber: "Fib ak latans",
    land_readiness: "Kondisyon tè a",
    residents: "Rezidan toupre",
    environmental_justice: "Jistis anviwonmantal",
    water: "Dlo",
    climate_risk: "Risk klimatik",
  },
  lenses: { resident: "Rezidan", balanced: "Balanse", developer: "Devlopè" },

  q: {
    capacity:
      "Èske konpayi elektrik la konfime ke yo ka reyèlman bay {mw} MW isit la? Atlas konnen sèlman ke liy ki pi pre ki gen {kv} kV oswa plis se {dist} lwen, e sa pa di anyen sou kapasite ki disponib.",
    cleanEnergy:
      "Ki nouvo enèji pwòp espesifik ki pral kouvri konsomasyon elektrik anyèl pwojè sa a dapre seksyon 5 Lòd Egzekitif 658, e si ou peye nan Fon Pwoteksyon Konsomatè a olye, ki sa sa vle di pou bòdwo nou yo?",
    underThreshold:
      "Ak {mw} MW, pwojè sa a rete anba limit 25 MW Lòd Egzekitif 658 la. Ki sa ki anpeche yo agrandi l pi devan pase 25 MW, e èske agrandisman sa a ta deklanche lòd la?",
    ej: "Gwoup blòk sa a deziyen kòm yon popilasyon jistis anviwonmantal. Ak ki moun ou negosye yon akò benefis kominotè, e èske Biwo Jistis ak Ekite Anviwonmantal eta a aksepte l?",
    residents:
      "Gen {pop} rezidan nan yon reyon 1 km. Ki modelizasyon bri, trafik ak lè ou fè pou yo, e ak ki moun ou siyen yon akò benefis kominotè?",
    waterEvap:
      "Konbyen lit dlo pa jou refrijerasyon evaporatif la pral konsome nan yon ete sèk, ki sous ki pral bay li, e ki sa ki rive ak dechaj la?",
    waterClosed:
      "Ou prezante yon konsepsyon {design}. Èske sa pral yon kondisyon obligatwa nan pèmi an, e ki pèt enèji ou aksepte an echanj?",
    reporting:
      "Ki sa ou pral pibliye chak ane lè w ap opere — konsomasyon enèji reyèl, konsomasyon dlo ak emisyon — e èske vil la ap gen dwa pou verifye l?",
  },

  steps: [
    "Mande yon etid fezabilite oswa enpak sistèm nan men pwopriyetè distribisyon ak transmisyon an. Atlas pa ka wè kapasite akèy ni ranje koneksyon an.",
    "Konfime distrik zonaj, klasifikasyon itilizasyon ak nenpòt chemen pèmi espesyal ak minisipalite a.",
    "Etabli pwopriyetè a ak si gen tè ki reyèlman disponib. Atlas pa gen dosye pasèl, pwopriyetè ni anons.",
    "Kòmande yon delimitasyon marekaj nan nivo pasèl ak yon desizyon inondasyon FEMA. Tryaj isit la se entèseksyon polygon jeneralize.",
    "Modle apwovizyònman ak dechaj dlo pou konsepsyon refrijerasyon ou chwazi, ki gen ladan yon ka ane sèk.",
  ],
};

const VI: Strings = {
  briefTitle: "Bản tóm lược cho cuộc họp thị trấn",
  reportTitle: "Báo cáo sàng lọc cho nhà phát triển",
  s1: "Điểm số có nghĩa là gì",
  s2: "Sắc lệnh 658 yêu cầu gì ở quy mô này",
  s3: "Câu hỏi dành cho nhà phát triển",
  nextSteps: "Các bước thẩm định tiếp theo",
  alternatives: "Các ô có điểm cao hơn trong vòng 25 km",

  score: "Điểm sàng lọc",
  buildability: "Khả năng xây dựng",
  community: "Cộng đồng",
  strongest: "Yếu tố thuận lợi nhất",
  weakest: "Yếu tố yếu nhất",
  bonuses: "Điểm thưởng đã áp dụng",
  lensGap: "Góc nhìn của nhà phát triển và của người dân lân cận chênh nhau {gap} điểm.",
  lensGapNote:
    "Điểm thấp là nhãn của mô hình, không phải dự đoán về cách ai sẽ bỏ phiếu, và điểm cao không phải là sự chấp thuận.",

  excludedLead: "Atlas xếp vị trí này là lỗi nghiêm trọng, 0 trên 10 điểm.",
  hardScreenNote:
    "Tiêu chí loại trừ trả về 0 trước khi áp dụng bất kỳ điểm thưởng nào. Đây là sàng lọc sơ bộ từ các lớp bản đồ đã công bố, không phải kết luận pháp lý cho một thửa đất cụ thể.",

  unmeasured: "Không phải mọi thứ đều được đo",
  unmeasuredBody:
    "{factors} không có dữ liệu trong bản dựng này, nên {pronoun} bị loại khỏi điểm số thay vì được phỏng đoán. Thực tế chỉ {b}% trọng số khả năng xây dựng và {c}% trọng số cộng đồng được đo.",
  measurementNote:
    "Các giá trị đo được dẫn lại theo đúng từ ngữ và đơn vị của bộ dữ liệu đã công bố.",

  alwaysUnverified: "Ba điều mà đợt sàng lọc này không bao giờ cho bạn biết",
  gridCapacity:
    "Công suất lưới điện chưa được xác minh. Atlas chỉ biết khoảng cách tới đường dây gần nhất trên bản đồ, đó không phải công suất khả dụng và cũng không phải nghiên cứu kết nối.",
  zoning:
    "Quy hoạch phân vùng chưa rõ. Không có dữ liệu phân khu đô thị hay giấy phép đặc biệt nào được nạp.",
  availability:
    "Tình trạng sẵn có chưa rõ. Đây là một ô sàng lọc địa lý, không phải thửa đất, và không có gì ở đây cho biết có đất đang bán.",

  modelledSpend: "Chi phí điện hằng năm theo mô hình ở quy mô này là {usd}.",

  templateNote:
    "Được viết ngoại tuyến từ các giá trị đã đo bằng một mẫu cố định, không dùng mô hình ngôn ngữ.",

  bands: {
    strong: "Vị trí tốt",
    workable: "Khả thi có điều kiện",
    contested: "Vị trí gây tranh cãi",
    avoid: "Không nên xây ở đây",
    fatal: "Lỗi nghiêm trọng",
  },
  factors: {
    grid_access: "Khả năng tiếp cận lưới điện",
    clean_power: "Khoảng cách tới nguồn điện sạch",
    fiber: "Cáp quang và độ trễ",
    land_readiness: "Mức độ sẵn sàng của đất",
    residents: "Người dân lân cận",
    environmental_justice: "Công bằng môi trường",
    water: "Nước",
    climate_risk: "Rủi ro khí hậu",
  },
  lenses: { resident: "Người dân", balanced: "Cân bằng", developer: "Nhà phát triển" },

  q: {
    capacity:
      "Công ty điện đã xác nhận rằng {mw} MW thực sự có thể được cấp ở đây chưa? Atlas chỉ biết đường dây {kv} kV trở lên gần nhất trên bản đồ cách {dist}, điều đó không nói gì về công suất khả dụng.",
    cleanEnergy:
      "Nguồn điện sạch mới cụ thể nào sẽ bù đắp lượng điện tiêu thụ hằng năm của dự án theo mục 5 của Sắc lệnh 658, và nếu thay vào đó quý vị nộp tiền vào Quỹ Bảo vệ Người dùng điện thì hóa đơn của chúng tôi sẽ thế nào?",
    underThreshold:
      "Ở mức {mw} MW, dự án này vẫn dưới ngưỡng 25 MW của Sắc lệnh 658. Điều gì ngăn việc mở rộng vượt 25 MW sau này, và việc mở rộng đó có kích hoạt sắc lệnh không?",
    ej: "Nhóm khối này được xác định là cộng đồng công bằng môi trường. Quý vị đã thương lượng thỏa thuận lợi ích cộng đồng với ai, và Sở Công bằng Môi trường của bang đã chấp nhận chưa?",
    residents:
      "Có {pop} người dân trong vòng 1 km. Quý vị đã mô hình hóa tiếng ồn, giao thông và không khí cho họ ra sao, và đã ký thỏa thuận lợi ích cộng đồng với ai?",
    waterEvap:
      "Hệ thống làm mát bay hơi sẽ tiêu thụ bao nhiêu lít nước mỗi ngày trong một mùa hè khô, nguồn nào cung cấp, và nước thải sẽ đi đâu?",
    waterClosed:
      "Quý vị đã trình bày thiết kế {design}. Điều đó có trở thành điều kiện giấy phép bắt buộc không, và quý vị chấp nhận tổn thất năng lượng nào để đổi lấy?",
    reporting:
      "Khi đi vào hoạt động, mỗi năm quý vị sẽ công bố những gì — lượng điện, lượng nước và phát thải thực tế — và thị trấn có quyền kiểm toán không?",
  },

  steps: [
    "Yêu cầu nghiên cứu khả thi hoặc nghiên cứu tác động hệ thống từ đơn vị phân phối và truyền tải. Atlas không thấy được công suất tiếp nhận hay hàng đợi kết nối.",
    "Xác nhận phân khu quy hoạch, phân loại sử dụng và lộ trình giấy phép đặc biệt với chính quyền địa phương.",
    "Xác định chủ sở hữu và liệu có đất thực sự sẵn có. Atlas không có dữ liệu thửa đất, chủ sở hữu hay niêm yết.",
    "Đặt hàng phân định đất ngập nước ở cấp thửa đất và kết luận ngập lụt của FEMA. Các sàng lọc ở đây là giao cắt đa giác đã được tổng quát hóa.",
    "Mô hình hóa nguồn cấp và xả nước cho thiết kế làm mát đã chọn, bao gồm trường hợp năm khô.",
  ],
};

const ZH: Strings = {
  briefTitle: "镇民大会简报",
  reportTitle: "开发方筛查报告",
  s1: "这个评分意味着什么",
  s2: "在此规模下第658号行政令的要求",
  s3: "向开发商提出的问题",
  nextSteps: "下一步尽职调查",
  alternatives: "25 公里内评分更高的网格",

  score: "筛查评分",
  buildability: "可建设性",
  community: "社区影响",
  strongest: "最有利的因素",
  weakest: "最薄弱的因素",
  bonuses: "已计入的加分",
  lensGap: "开发方视角与邻里视角相差 {gap} 分。",
  lensGapNote: "低分是模型标签，并非对任何人投票意向的预测；高分也不等于批准。",

  excludedLead: "Atlas 将该地点判定为致命缺陷，评分为 0 分（满分 10 分）。",
  hardScreenNote:
    "硬性排除项在计入任何加分之前即返回零分。这是基于已公布地图图层的初步筛查，并非针对某一地块的法律认定。",

  unmeasured: "并非所有项目都已测量",
  unmeasuredBody:
    "{factors} 在本版本中没有数据，因此{pronoun}从评分中剔除，而不是以默认值填补。实际测量的仅占可建设性权重的 {b}% 和社区权重的 {c}%。",
  measurementNote: "实测值按发布该数据集的原始措辞和单位引用。",

  alwaysUnverified: "本次筛查永远无法告知的三件事",
  gridCapacity:
    "电网容量未经核实。Atlas 只知道到最近已标注线路的距离，这既不是可用容量，也不是并网研究。",
  zoning: "分区规划未知。未载入任何市镇分区或特别许可状态。",
  availability:
    "可获得性未知。这是一个地理筛查网格，不是地块，这里没有任何信息表明有土地出售。",

  modelledSpend: "该规模下建模的年度电费为 {usd}。",

  templateNote: "离线根据实测值按固定模板生成，未使用任何语言模型。",

  bands: {
    strong: "优良选址",
    workable: "有条件可行",
    contested: "存在争议的选址",
    avoid: "不宜在此建设",
    fatal: "致命缺陷",
  },
  factors: {
    grid_access: "电网接入",
    clean_power: "清洁电源邻近度",
    fiber: "光纤与时延",
    land_readiness: "土地适建性",
    residents: "周边居民",
    environmental_justice: "环境正义",
    water: "水资源",
    climate_risk: "气候风险",
  },
  lenses: { resident: "居民", balanced: "均衡", developer: "开发方" },

  q: {
    capacity:
      "电力公司是否已确认此处确实可以供应 {mw} MW？Atlas 只知道最近的 {kv} kV 及以上已标注线路距离 {dist}，这并不说明可用容量。",
    cleanEnergy:
      "根据第658号行政令第5节，哪些具体的新增清洁电源将覆盖本项目的年度用电量？如果改为向电费保护基金缴费，对我们的电费意味着什么？",
    underThreshold:
      "在 {mw} MW 规模下，本项目低于第658号行政令的 25 MW 门槛。有什么能阻止日后扩建超过 25 MW，该扩建是否会触发该行政令？",
    ej: "本街区组被认定为环境正义人口区。您与谁谈成了社区利益协议，州环境正义与公平办公室是否已接受？",
    residents:
      "1 公里范围内有 {pop} 位居民。您为他们做了哪些噪声、交通和空气建模，并与谁签署了社区利益协议？",
    waterEvap:
      "在干旱的夏季，蒸发冷却每天将消耗多少升水？由哪个水源供应？排放的水如何处理？",
    waterClosed:
      "您提出的是{design}方案。这会成为具有约束力的许可条件吗？为此您接受多少能耗代价？",
    reporting:
      "投运后您每年将公布什么——实际能耗、用水量和排放——镇政府是否有权进行审计？",
  },

  steps: [
    "向配电和输电所有方申请可行性研究或系统影响研究。Atlas 无法看到接入容量或并网排队情况。",
    "与市镇确认分区区划、用途分类以及任何特别许可路径。",
    "确认产权以及是否确有可用土地。Atlas 不掌握地块、业主或挂牌记录。",
    "委托开展地块级湿地界定和 FEMA 洪水认定。此处的筛查是概化多边形相交的结果。",
    "针对所选冷却方案建模供水与排水，并包含干旱年情形。",
  ],
};

const SQ: Strings = {
  briefTitle: "Përmbledhje për mbledhjen e bashkisë",
  reportTitle: "Raport filtrimi për zhvilluesin",
  s1: "Çfarë kuptimi ka pikëzimi",
  s2: "Çfarë kërkon Urdhri Ekzekutiv 658 në këtë përmasë",
  s3: "Pyetje për zhvilluesin",
  nextSteps: "Hapat e mëtejshëm të verifikimit",
  alternatives: "Qeli me pikëzim më të lartë brenda 25 km",

  score: "Pikëzimi i filtrimit",
  buildability: "Ndërtueshmëria",
  community: "Komuniteti",
  strongest: "Faktori më i favorshëm",
  weakest: "Faktori më i dobët",
  bonuses: "Bonuset e zbatuara",
  lensGap: "Pamja e zhvilluesit dhe pamja e fqinjësisë ndryshojnë me {gap} pikë.",
  lensGapNote:
    "Një pikëzim i ulët është një etiketë e modelit, jo një parashikim se si do të votojë kushdo, dhe një pikëzim i lartë nuk është miratim.",

  excludedLead: "Atlas e klasifikon këtë vendndodhje si defekt fatal, me 0 nga 10 pikë.",
  hardScreenNote:
    "Një kriter përjashtues kthen zero para se të zbatohet çdo bonus. Ky është një filtrim paraprak nga shtresa kartografike të publikuara, jo një përcaktim ligjor për një parcelë konkrete.",

  unmeasured: "Jo çdo gjë është matur",
  unmeasuredBody:
    "{factors} nuk {verb} të dhëna në këtë version, ndaj {pronoun} përjashtuar nga pikëzimi në vend që të hamendësohet. Në fakt matet {b}% e peshës së ndërtueshmërisë dhe {c}% e peshës së komunitetit.",
  measurementNote:
    "Vlerat e matura citohen me fjalët dhe njësitë e bazës së të dhënave që i publikoi.",

  alwaysUnverified: "Tri gjëra që këtë filtrim nuk mund t'i thotë kurrë",
  gridCapacity:
    "Kapaciteti i rrjetit është i paverifikuar. Atlas di distancën deri te linja më e afërt e kartografuar, që nuk është kapacitet i disponueshëm dhe nuk është studim i lidhjes.",
  zoning:
    "Zonimi është i panjohur. Nuk është ngarkuar asnjë zonë bashkiake ose status leje e posaçme.",
  availability:
    "Disponueshmëria është e panjohur. Kjo është një qeli gjeografike filtrimi, nuk është parcelë, dhe asgjë këtu nuk thotë se ka tokë për shitje.",

  modelledSpend: "Shpenzimi vjetor i modeluar i energjisë në këtë përmasë është {usd}.",

  templateNote:
    "Shkruar jashtë linje nga vlera të matura me një shabllon fiks, pa asnjë model gjuhësor.",

  bands: {
    strong: "Vendndodhje e fortë",
    workable: "E realizueshme me kushte",
    contested: "Vendndodhje e kontestuar",
    avoid: "Të mos ndërtohet këtu",
    fatal: "Defekt fatal",
  },
  factors: {
    grid_access: "Qasja në rrjetin elektrik",
    clean_power: "Afërsia me energji të pastër",
    fiber: "Fibra dhe vonesa",
    land_readiness: "Gatishmëria e tokës",
    residents: "Banorët përreth",
    environmental_justice: "Drejtësia mjedisore",
    water: "Uji",
    climate_risk: "Rreziku klimatik",
  },
  lenses: { resident: "Banor", balanced: "I balancuar", developer: "Zhvillues" },

  q: {
    capacity:
      "A ka konfirmuar kompania e energjisë që {mw} MW mund të furnizohen vërtet këtu? Atlas di vetëm që linja më e afërt e kartografuar me {kv} kV ose më shumë është {dist} larg, dhe kjo nuk thotë asgjë për kapacitetin e disponueshëm.",
    cleanEnergy:
      "Cila energji e re e pastër konkretisht do të mbulojë konsumin vjetor të energjisë së këtij projekti sipas seksionit 5 të Urdhrit Ekzekutiv 658, dhe nëse paguani në Fondin e Mbrojtjes së Konsumatorëve, çfarë do të thotë kjo për faturat tona?",
    underThreshold:
      "Me {mw} MW ky projekt qëndron nën pragun 25 MW të Urdhrit Ekzekutiv 658. Çfarë e pengon zgjerimin mbi 25 MW më vonë, dhe a do ta aktivizonte urdhrin ai zgjerim?",
    ej: "Ky grup blloku është caktuar si popullatë e drejtësisë mjedisore. Me kë kini negociuar një marrëveshje përfitimesh për komunitetin, dhe a e ka pranuar Zyra shtetërore e Drejtësisë dhe Ekuitetit Mjedisor?",
    residents:
      "Brenda 1 km janë {pop} banorë. Çfarë modelimi të zhurmës, trafikut dhe ajrit kini bërë për ata, dhe me kë kini nënshkruar një marrëveshje përfitimesh për komunitetin?",
    waterEvap:
      "Sa litra ujë në ditë do të konsumojë ftohja me avullim në një verë të thatë, nga ku do të furnizohet, dhe çfarë ndodh me shkarkimin?",
    waterClosed:
      "Kini paraqitur një dizajn {design}. A do të bëhet kjo kusht i detyrueshëm i lejes, dhe çfarë humbje energjie pranoni në shkëmbim?",
    reporting:
      "Çfarë do të publikoni çdo vit kur të operoni — konsumin real të energjisë, të ujit dhe emetimet — dhe a do të ketë bashkia të drejtë auditimi?",
  },

  steps: [
    "Kërkoni një studim fizibiliteti ose studim të ndikimit në sistem nga pronari i distribucionit dhe transmetimit. Atlas nuk e shikon kapacitetin pritës ose radhën e lidhjes.",
    "Konfirmoni me bashkinë zonën e zonimit, klasifikimin e përdorimit dhe çdo rrugë leje të posaçme.",
    "Përcaktoni pronësinë dhe nëse ka tokë vërtet të disponueshme. Atlas nuk mban të dhëna parcelash, pronarësh ose shpalljesh.",
    "Kërkoni një përcaktim të ligatinave në nivel parcele dhe një përcaktim përmbytjeje të FEMA. Filtrimet këtu janë prerje poligonesh të përgjithësuara.",
    "Modeloni furnizimin dhe shkarkimin e ujit për dizajnin e zgjedhur të ftohjes, përfshirë një rast të një viti të thatë.",
  ],
};

export const STRINGS: Record<LangCode, Strings> = {
  en: EN,
  es: ES,
  pt: PT,
  ht: HT,
  vi: VI,
  zh: ZH,
  sq: SQ,
};

/** Replaces {token} placeholders. */
export function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) =>
    k in vars ? String(vars[k]) : `{${k}}`,
  );
}

/** Joins a list with the language's conjunction. */
export function listJoin(items: string[], lang: LangCode): string {
  if (items.length <= 1) return items[0] ?? "";
  const and: Record<LangCode, string> = {
    en: "and",
    es: "y",
    pt: "e",
    ht: "ak",
    vi: "và",
    zh: "、",
    sq: "dhe",
  };
  const sep = lang === "zh" ? "、" : ", ";
  const conj = and[lang];
  if (lang === "zh") return items.join("、");
  return `${items.slice(0, -1).join(sep)} ${conj} ${items[items.length - 1]}`;
}
