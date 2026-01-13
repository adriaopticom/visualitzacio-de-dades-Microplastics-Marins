// Main application file
// Carrega les dades i inicialitza la visualització
// d3 està disponible globalment des de index.html

import { loadData, processData } from "./src/utils/data-processing.js";
import { initGeographicViz } from "./src/visualizations/geographic.js";
// Comentat: només utilitzem la visualització bàsica per ara
// import { initGeographicSmallMultiples } from "./src/visualizations/geographic.js";
// import { initGeographicVizInteractive } from "./src/visualizations/geographic-interactive.js";
// import { initGeographicVizWithCurrents } from "./src/visualizations/geographic-currents.js";
import { initTemporalViz } from "./src/visualizations/temporal.js";
import { initFactorsViz } from "./src/visualizations/factors.js";

// Estat global de l'aplicació
let appState = {
    data: null,
    processedData: null,
    currentSection: 'intro'
};

// Inicialització
async function init() {
    console.log("Inicialitzant aplicació...");
    
    // Crear estructura HTML
    createAppStructure();
    
    // Carregar dades preprocessades
    try {
        const rawData = await loadData();
        appState.data = rawData;
        appState.processedData = processData(rawData);
        console.log("Dades carregades correctament");
        
        // Inicialitzar visualitzacions
        initAllVisualizations();
        
        // Configurar navegació
        setupNavigation();
        
    } catch (error) {
        console.error("Error carregant dades:", error);
        showError(`Error carregant les dades: ${error.message}<br><br>Assegura't d'haver executat el script de processament primer:<br><code>python3 src/process_data.py</code>`);
    }
}

// Crear estructura HTML de l'aplicació
function createAppStructure() {
    const app = d3.select("#app");
    
    app.html(`
        <header>
            <div class="header-content">
                <h1>Microplàstics Marins</h1>
                <p class="subtitle">Anàlisi global de la contaminació per microplàstics (1972-2023)</p>
            </div>
        </header>
        <nav>
            <div class="nav-content">
                <a href="#intro" class="nav-link active">Introducció</a>
                <a href="#geographic" class="nav-link">Distribució Geogràfica</a>
                <a href="#temporal" class="nav-link">Evolució Temporal</a>
                <a href="#factors" class="nav-link">Factors que Influeixen</a>
            </div>
        </nav>
        <main>
            <section id="intro">
                <h2>Introducció</h2>
                <p>Benvingut a la visualització interactiva de dades sobre microplàstics marins. Aquest projecte analitza més de 22.000 mostres recollides entre 1972 i 2023 per la <strong>National Oceanic and Atmospheric Administration (NOAA)</strong> i gestionades pel <strong>National Centers for Environmental Information (NCEI)</strong>.</p>
                
                <h3>Conjunt de Dades</h3>
                <p>El dataset utilitzat conté <strong>22.000+ mostres</strong> de microplàstics recollides a través dels oceans del món durant més de 50 anys. Les dades inclouen informació sobre:</p>
                <ul>
                    <li><strong>Localització geogràfica</strong>: Coordenades, oceà, regió, país</li>
                    <li><strong>Concentració de microplàstics</strong>: Mesurada en pieces/m³ o pieces/kg segons el tipus de mostra</li>
                    <li><strong>Mètodes de mostreig</strong>: Tipus de xarxa, profunditat, ambient marí</li>
                    <li><strong>Informació temporal</strong>: Data de recollida des de 1972 fins a 2023</li>
                </ul>
                
                <h3>Preparació de les Dades</h3>
                <p>Abans de la visualització, les dades s'han processat per:</p>
                <ul>
                    <li><strong>Netega i validació</strong>: Eliminació de valors invàlids, normalització d'unitats</li>
                    <li><strong>Agregació geogràfica</strong>: Agrupació de mostres per regió/oceà/país per calcular estadístiques agregades</li>
                    <li><strong>Càlcul de mètriques</strong>: Índex de Contaminació Regional (ICR), Taxa de Canvi Temporal (TCT), Índex de Diversitat de Mètodes, Índex de Completitud de Dades, IGRM simplificat</li>
                    <li><strong>Preparació per visualització</strong>: Transformació a formats JSON optimitzats per a la visualització interactiva</li>
                </ul>
                
                <h3>Preguntes de Recerca</h3>
                <p>Aquesta visualització respon a <strong>tres preguntes principals de recerca</strong> que permeten entendre millor el problema dels microplàstics marins:</p>
                <ul>
                    <li><strong>Distribució Geogràfica</strong>: <em>Com es distribueixen els microplàstics a través dels diferents oceans i regions del món?</em> Aquesta pregunta busca identificar regions amb concentracions significativament més altes i zones crítiques que requereixen acció immediata.</li>
                    <li><strong>Evolució Temporal</strong>: <em>Com ha canviat la concentració de microplàstics al llarg del temps?</em> Aquesta pregunta analitza les tendències temporals per entendre si la contaminació augmenta, disminueix o es manté estable.</li>
                    <li><strong>Factors que Influeixen</strong>: <em>Quins factors estan més relacionats amb les concentracions de microplàstics?</em> Aquesta pregunta explora la relació entre profunditat, mètodes de mostreig, ambient marí i les concentracions observades.</li>
                </ul>
                
                <h3>Interactivitat</h3>
                <p>Cada visualització inclou elements interactius que permeten:</p>
                <ul>
                    <li><strong>Exploració detallada</strong>: Passar el cursor sobre elements per veure informació detallada</li>
                    <li><strong>Filtres</strong>: Filtrar dades per any, regió o rang de concentració</li>
                    <li><strong>Zoom i navegació</strong>: Explorar diferents nivells de detall</li>
                    <li><strong>Comparacions</strong>: Comparar diferents regions, períodes o factors</li>
                </ul>
                
                <p style="margin-top: 2rem; padding: 1rem; background-color: #e3f2fd; border-radius: 5px;">
                    <strong>Utilitza la navegació superior</strong> per explorar cada pregunta de recerca i descobrir els patrons i tendències que revelen les dades.
                </p>
            </section>
            <section id="geographic">
                <h2>Distribució Geogràfica dels Microplàstics</h2>
                <p><strong>Pregunta de recerca:</strong> <em>Com es distribueixen els microplàstics a través dels diferents oceans i regions del món?</em></p>
                <p>Aquesta secció respon a la primera pregunta de recerca, identificant regions amb concentracions significativament més altes i zones crítiques que requereixen acció immediata. Les visualitzacions permeten explorar els patrons globals de contaminació i comparar diferents regions oceàniques.</p>
                
                <h3>Processament de Dades</h3>
                <p style="color: #666; font-size: 14px; line-height: 1.6;">
                    Les <strong>mostres individuals</strong> s'han agregat per regió/oceà/país (<code>Ocean</code>, <code>Region</code>, <code>Country</code>). 
                    Per a cada agrupació geogràfica es calculen <strong>estadístiques agregades</strong>: nombre de mostres, concentració mitjana, mediana i desviació estàndard, 
                    així com les coordenades geogràfiques (latitud i longitud mitjanes, mínimes i màximes). A cada regió s'hi afegeix 
                    l'<strong>Índex de Contaminació Regional (ICR)</strong> - una mètrica normalitzada que classifica regions segons el seu nivell de contaminació relativa - 
                    i l'<strong>Índex de Completitud de Dades</strong> - que mesura la qualitat i completitud de les dades per regió. 
                    Les regions sense coordenades geogràfiques vàlides s'han exclòs de la visualització.
                </p>
                
                <h3>Elements Interactius</h3>
                <p style="color: #666; font-size: 14px; line-height: 1.6;">
                    <strong>Filtre per any:</strong> Selecciona un any específic o visualitza totes les mostres per veure l'evolució geogràfica.<br>
                    <strong>Filtre per concentració:</strong> Clica sobre els cercles de la llegenda per filtrar mostres per rang de concentració.<br>
                    <strong>Tooltips informatius:</strong> Passa el cursor sobre els punts del mapa per veure estadístiques detallades de cada regió.<br>
                    <strong>Gràfics complementaris:</strong> Els gràfics d'ICR i Completitud de Dades permeten comparar regions i identificar zones amb dades més fiables.
                </p>
                
                <!-- Comentat: només utilitzem la visualització bàsica per ara
                <div class="viz-tabs">
                    <button class="tab-button active" data-tab="basic">Visualització Bàsica</button>
                    <button class="tab-button" data-tab="interactive">Mapa Interactiu (Millorat)</button>
                    <button class="tab-button" data-tab="currents">Mapa amb Corrents Oceàniques</button>
                    <button class="tab-button" data-tab="small-multiples">Small Multiples per Oceà</button>
                </div>
                -->
                
                <div id="geographic-viz-basic" class="visualization-container">
                    <div class="loading">Carregant visualització...</div>
                </div>
                
                <!-- Comentat: altres visualitzacions geogràfiques
                <div id="geographic-viz-interactive" class="visualization-container tab-content" style="display: none;">
                    <div class="loading">Carregant mapa interactiu...</div>
                </div>
                
                <div id="geographic-viz-currents" class="visualization-container tab-content" style="display: none;">
                    <div class="loading">Carregant mapa amb corrents oceàniques...</div>
                </div>
                
                <div id="geographic-viz-small-multiples" class="visualization-container tab-content" style="display: none;">
                    <div class="loading">Carregant small multiples...</div>
                </div>
                -->
            </section>
            <section id="temporal">
                <h2>Evolució Temporal</h2>
                <p><strong>Pregunta de recerca:</strong> <em>Com ha canviat la concentració de microplàstics al llarg del temps?</em></p>
                <p>Aquesta secció respon a la segona pregunta de recerca, analitzant les tendències temporals per entendre si la contaminació augmenta, disminueix o es manté estable. Les visualitzacions mostren l'evolució de les concentracions des de 1972 fins a 2023, permetent identificar períodes de canvi significatiu i comparar tendències entre diferents oceans.</p>
                
                <h3>Processament de Dades</h3>
                <p style="color: #666; font-size: 14px; line-height: 1.6;">
                    Les dades s'agreguen per <strong>any</strong> i per <strong>any i regió</strong> per calcular la concentració mitjana anual. 
                    S'utilitza la <strong>Taxa de Canvi Temporal (TCT)</strong> per quantificar la velocitat i direcció del canvi entre anys consecutius. 
                    Les visualitzacions de distribució (violin plots i ridgeline plots) mostren la variabilitat completa de les concentracions per any, 
                    no només les mitjanes, permetent identificar canvis en la distribució al llarg del temps.
                </p>
                
                <h3>Elements Interactius</h3>
                <p style="color: #666; font-size: 14px; line-height: 1.6;">
                    <strong>Controls de zoom temporal:</strong> Filtra per rang d'anys per explorar períodes específics.<br>
                    <strong>Tooltips informatius:</strong> Passa el cursor sobre les línies, àrees i distribucions per veure valors detallats.<br>
                    <strong>Comparació multi-dimensional:</strong> El streamgraph permet veure simultàniament la contribució de cada oceà al total temporal.
                </p>
                <div id="temporal-viz" class="visualization-container">
                    <div class="loading">Carregant visualització...</div>
                </div>
            </section>
            <section id="factors">
                <h2>Factors que Influeixen en la Concentració</h2>
                <p><strong>Pregunta de recerca:</strong> <em>Quins factors estan més relacionats amb les concentracions de microplàstics?</em></p>
                <p>Aquesta secció respon a la tercera pregunta de recerca, explorant la relació entre múltiples factors (profunditat, mètodes de mostreig, ambient marí) i les concentracions observades. Les visualitzacions permeten identificar patrons causals que poden explicar les diferències observades entre regions o períodes, i avaluar la robustesa metodològica de les dades.</p>
                
                <h3>Processament de Dades</h3>
                <p style="color: #666; font-size: 14px; line-height: 1.6;">
                    Les dades s'analitzen per <strong>mètode de mostreig</strong>, <strong>ambient marí</strong> i <strong>profunditat</strong> per identificar diferències en les concentracions. 
                    S'utilitza l'<strong>Índex de Diversitat de Mètodes de Mostreig</strong> (Shannon H') per avaluar la varietat de mètodes utilitzats per regió, 
                    i l'<strong>IGRM simplificat</strong> (Índex Global de Risc de Microplàstics) com a mètrica composta que integra contaminació, completitud de dades i diversitat metodològica.
                </p>
                
                <h3>Elements Interactius</h3>
                <p style="color: #666; font-size: 14px; line-height: 1.6;">
                    <strong>Tooltips detallats:</strong> Passa el cursor sobre box plots, barres i rectangles per veure estadístiques completes.<br>
                    <strong>Exploració multi-dimensional:</strong> El parallel coordinates plot permet explorar múltiples factors simultàniament i identificar patrons complexos.<br>
                    <strong>Comparació visual:</strong> El treemap permet comparar ràpidament diferents combinacions de mètode i ambient marí.
                </p>
                <div id="factors-viz" class="visualization-container">
                    <div class="loading">Carregant visualització...</div>
                </div>
            </section>
        </main>
        <footer>
            <p>Dades: NOAA National Centers for Environmental Information (NCEI)</p>
            <p>Projecte: Visualització de Dades - UOC</p>
            <p>Autor: Adrià Gonzalez Copado</p>
        </footer>
    `);
}

// Configurar navegació
function setupNavigation() {
    d3.selectAll(".nav-link").on("click", function(event) {
        event.preventDefault();
        const target = d3.select(this).attr("href").substring(1);
        
        // Actualitzar classe active
        d3.selectAll(".nav-link").classed("active", false);
        d3.select(this).classed("active", true);
        
        // Scroll suau a la secció
        const section = document.getElementById(target);
        if (section) {
            section.scrollIntoView({ behavior: "smooth", block: "start" });
        }
        
        appState.currentSection = target;
    });
}

// Inicialitzar totes les visualitzacions
function initAllVisualizations() {
    if (!appState.processedData) {
        console.error("Dades no processades");
        return;
    }
    
    // Inicialitzar cada visualització
    initGeographicViz("#geographic-viz-basic", appState.processedData);
    // Comentat: només utilitzem la visualització bàsica per ara
    // initGeographicVizInteractive("#geographic-viz-interactive", appState.processedData);
    // initGeographicVizWithCurrents("#geographic-viz-currents", appState.processedData);
    // initGeographicSmallMultiples("#geographic-viz-small-multiples", appState.processedData);
    initTemporalViz("#temporal-viz", appState.processedData);
    initFactorsViz("#factors-viz", appState.processedData);
    
    // Configurar tabs (comentat: només visualització bàsica)
    // setupTabs();
}

// Configurar sistema de tabs
function setupTabs() {
    d3.selectAll(".tab-button").on("click", function() {
        const button = d3.select(this);
        const tabName = button.attr("data-tab");
        const section = button.node().closest("section");
        
        // Actualitzar botons
        d3.select(section).selectAll(".tab-button").classed("active", false);
        button.classed("active", true);
        
        // Mostrar/ocultar contingut
        d3.select(section).selectAll(".tab-content").style("display", "none");
        if (tabName === "basic") {
            d3.select(section).select("#geographic-viz-basic").style("display", "block");
        } else if (tabName === "interactive") {
            d3.select(section).select("#geographic-viz-interactive").style("display", "block");
        } else if (tabName === "currents") {
            d3.select(section).select("#geographic-viz-currents").style("display", "block");
        } else if (tabName === "small-multiples") {
            d3.select(section).select("#geographic-viz-small-multiples").style("display", "block");
        }
    });
}

// Mostrar error
function showError(message) {
    d3.select("#app").html(`
        <div style="padding: 2rem; text-align: center; color: #d32f2f;">
            <h2>Error</h2>
            <p>${message}</p>
        </div>
    `);
}

// Iniciar quan el DOM estigui carregat
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
