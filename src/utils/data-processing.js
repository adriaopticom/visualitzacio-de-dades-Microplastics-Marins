// Utilitats per carregar dades preprocessades
// Les dades han estat processades prèviament amb process_data.py

/**
 * Carrega les dades preprocessades des dels fitxers JSON
 */
export async function loadData() {
    try {
        // Carregar tots els fitxers JSON en paral·lel
        const [
            byRegion,
            byYear,
            byYearRegion,
            scatterData,
            methodData,
            treemapData,
            parallelData,
            violinData,
            sankeyData,
            metrics
        ] = await Promise.all([
            fetch('data/processed/by_region.json').then(r => r.json()),
            fetch('data/processed/by_year.json').then(r => r.json()),
            fetch('data/processed/by_year_region.json').then(r => r.json()),
            fetch('data/processed/scatter_data.json').then(r => r.json()),
            fetch('data/processed/method_data.json').then(r => r.json()),
            fetch('data/processed/treemap_data.json').then(r => r.json()),
            fetch('data/processed/parallel_data.json').then(r => r.json()),
            fetch('data/processed/violin_data.json').then(r => r.json()),
            fetch('data/processed/sankey_data.json').then(r => r.json()),
            fetch('data/processed/metrics.json').then(r => r.json())
        ]);
        
        console.log("Dades preprocessades carregades:");
        console.log(`  - ${byRegion.length} regions`);
        console.log(`  - ${byYear.length} anys`);
        console.log(`  - ${scatterData.length} mostres per scatterplot`);
        console.log(`  - ${methodData.length} mètodes de mostreig`);
        console.log(`  - Metrics keys:`, metrics ? Object.keys(metrics) : 'No metrics');
        console.log(`  - DataCompleteness:`, metrics?.dataCompleteness ? `${metrics.dataCompleteness.length} regions` : 'No disponible');
        
        return {
            byRegion,
            byYear,
            byYearRegion,
            scatterData,
            methodData,
            treemapData,
            parallelData,
            violinData,
            sankeyData,
            metrics
        };
        
    } catch (error) {
        console.error("Error carregant dades preprocessades:", error);
        throw new Error(`Error carregant dades: ${error.message}. Assegura't d'haver executat process_data.py primer.`);
    }
}

/**
 * Organitza les dades per a les visualitzacions
 * Les dades ja estan processades, només cal organitzar-les
 */
export function processData(data) {
    return {
        // Dades per visualització geogràfica
        geographic: {
            byRegion: data.byRegion,
            ICR: data.metrics.ICR
        },
        
        // Dades per visualització temporal
        temporal: {
            byYear: (data.byYear || []).filter(d => d.year != null && d.meanConcentration != null),
            byYearRegion: data.byYearRegion || [],
            // Filtrar TCT: excloure null, undefined i NaN (el primer any sempre té TCT = null)
            TCT: (data.byYear || []).filter(d => 
                d.year != null && 
                d.TCT != null && 
                d.TCT !== null && 
                d.TCT !== undefined &&
                !isNaN(d.TCT) &&
                isFinite(d.TCT)
            )
        },
        
        // Dades per visualització de factors
        factors: {
            scatterData: data.scatterData,
            methodData: data.methodData,
            depthCorrelation: data.metrics.depthCorrelation,
            treemapData: data.treemapData,
            parallelData: data.parallelData || [],
            sankeyData: data.sankeyData || [],
            methodDiversity: data.metrics.methodDiversity || [],
            IGRM: data.metrics.IGRM || []
        },
        
        // Dades per visualitzacions temporals avançades
        temporalAdvanced: {
            violinData: data.violinData || []
        },
        
        // Mètriques generals
        metrics: data.metrics,
        
        // Resum
        summary: data.metrics.summary
    };
}
