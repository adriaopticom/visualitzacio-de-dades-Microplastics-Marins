# Visualització Interactiva de Microplàstics Marins

Visualització interactiva de dades sobre microplàstics marins del dataset de NOAA (1972-2023).

## Descripció

Aquest projecte presenta una visualització interactiva que respon a tres preguntes principals de recerca sobre microplàstics marins:

1. **Distribució Geogràfica**: On es troben les concentracions més altes de microplàstics?
2. **Evolució Temporal**: Com ha canviat la concentració al llarg del temps?
3. **Factors que Influeixen**: Quins factors estan relacionats amb les concentracions?

## Estructura del Projecte

```
part-2/
├── data/
│   ├── raw/
│   │   └── microplastics.csv          # Dataset original
│   └── processed/                      # Dades processades (generades)
│       ├── by_region.json             # Dades agregades per regió
│       ├── by_year.json                # Dades agregades per any
│       ├── by_year_region.json         # Dades agregades per any i regió
│       ├── scatter_data.json           # Dades per scatterplots
│       ├── method_data.json            # Dades per mètodes de mostreig
│       ├── treemap_data.json           # Dades per treemap
│       ├── parallel_data.json          # Dades per parallel coordinates
│       ├── violin_data.json            # Dades per violin plots
│       ├── sankey_data.json            # Dades per Sankey diagrams
│       └── metrics.json                # Mètriques calculades (ICR, TCT, etc.)
├── src/
│   ├── process_data.py                # Script de processament (Python)
│   ├── process_data.R                 # Script de processament (R - alternatiu)
│   ├── utils/
│   │   └── data-processing.js         # Carregar dades preprocessades
│   └── visualizations/
│       ├── geographic.js              # Visualització geogràfica principal
│       ├── geographic-interactive.js   # Mapa interactiu amb Leaflet (opcional)
│       ├── geographic-currents.js      # Mapa amb corrents oceàniques (opcional)
│       ├── temporal.js                 # Visualització temporal principal
│       ├── temporal-extended.js        # Visualitzacions temporals avançades
│       ├── factors.js                  # Visualització de factors principal
│       └── factors-extended.js         # Visualitzacions de factors avançades
├── index.html                          # Pàgina principal
├── main.js                             # Aplicació principal
├── styles.css                          # Estils CSS
├── .nojekyll                           # Fitxer per GitHub Pages
├── DEPLOY.md                           # Instruccions de desplegament
├── GUIO_VIDEO.md                       # Guió del vídeo explicatiu
└── README.md                           # Aquest fitxer
```

## Requisits

### Per al processament de dades:
- **Python 3.7+** amb les següents llibreries:
  - `pandas`
  - `numpy`

### Instal·lació de dependències

**Utilitzant un entorn virtual**

```bash
# Crear un entorn virtual
python3 -m venv venv

# Activar l'entorn virtual
# A Linux/Mac:
source venv/bin/activate

# Instal·lar dependències
pip install -r requirements.txt

# O manualment:
pip install pandas numpy
```
## Instal·lació i Execució

### Pas 1: Processar les dades

**Amb Python :**

```bash
source venv/bin/activate  # Linux/Mac

python src/process_data.py
```
Això generarà els fitxers JSON a `data/processed/`.

### Pas 2: Executar la visualització

**Servidor HTTP Simple (Python)**
```bash
python3 -m http.server 8080
```

Obrir al navegador: `http://localhost:8080`


**Executar en mode detached (per servidors remots):**
```bash
# Opció ràpida amb nohup
nohup python3 -m http.server 8080 > server.log 2>&1 &
```

## Funcionalitats

### 1. Distribució Geogràfica
- **Mapa interactiu** amb punts que representen regions agregades
- **Color progressiu** segons concentració (verd = baixa, negre = alta)
- **Filtre per any** per veure l'evolució geogràfica
- **Filtre per concentració** clicant a la llegenda
- **Gràfic de barres ICR** (Índex de Contaminació Regional) per totes les regions
- **Gràfic de Completitud de Dades** per avaluar la qualitat de les dades per regió
- **Tooltips detallats** amb estadístiques completes (mitjana, mediana, desviació estàndard, ICR, etc.)

### 2. Evolució Temporal
- **Gràfic de línia** amb evolució de la concentració mitjana anual
- **Gràfic de Taxa de Canvi Temporal (TCT)** per identificar períodes de canvi ràpid
- **Streamgraph** (àrea apilada) per veure la contribució de cada oceà al total temporal
- **Violin plots** per mostrar la distribució completa de concentracions per any
- **Ridgeline plots** per visualitzar l'evolució de la distribució al llarg del temps
- **Controls de zoom temporal** per explorar períodes específics
- **Tooltips informatius** amb valors detallats per any

### 3. Factors que Influeixen
- **Box plots amb jitter** per comparar distribucions de concentració per mètode de mostreig
- **Índex de Diversitat de Mètodes** per avaluar la varietat metodològica per regió
- **IGRM Simplificat** (Índex Global de Risc de Microplàstics) com a mètrica composta
- **Treemap** per mostrar combinacions de mètode i ambient marí (mida = nombre de mostres, color = concentració)
- **Parallel Coordinates Plot** per explorar múltiples dimensions simultàniament (concentració, profunditat, any, oceà)
- **Tooltips detallats** amb estadístiques completes per cada visualització

## Mètriques Calculades

- **ICR (Índex de Contaminació Regional)**: Combinació normalitzada de concentració mitjana, variabilitat i nombre de mostres per classificar regions segons el seu nivell de contaminació relativa
- **TCT (Taxa de Canvi Temporal)**: Canvi percentual anual de la concentració, identificant períodes de canvi ràpid
- **Índex de Completitud de Dades**: Mesura la qualitat de les dades per regió, basant-se en variables crítiques i generals (ponderació 60% crítiques, 40% generals)
- **Índex de Diversitat de Mètodes de Mostreig**: Utilitza l'índex de Shannon (H') normalitzat per mesurar la varietat de mètodes utilitzats per regió
- **IGRM Simplificat (Índex Global de Risc de Microplàstics)**: Mètrica composta que integra ICR (40%), completitud de dades inversa (30%) i diversitat de mètodes inversa (30%)

## Tecnologies Utilitzades

- **Python 3 + Pandas + NumPy**: Per al processament de dades i càlcul de mètriques
- **D3.js v7**: Per a visualitzacions interactives i manipulació de dades
- **HTML5/CSS3**: Estructura i estils
- **JavaScript ES6 Modules**: Lògica de l'aplicació amb arquitectura modular
- **GeoJSON**: Per al fons del mapa mundial


## Llicència

Aquest projecte està sota llicència MIT. Veure `LICENSE` per més detalls.

## Dades

Les dades provenen del **Global Marine Microplastics Database 1972 to Present** de la **NOAA National Centers for Environmental Information (NCEI)**.

- **Font**: https://www.ncei.noaa.gov/products/microplastics
- **Dataset**: Marine_Microplastics_WGS84_8553846406879449657.csv
- **Registres**: 22.530
- **Període**: 1972 - Febrer 2023

## Autor

Adrià Gonzalez Copado  
Projecte: Visualització de Dades - UOC
