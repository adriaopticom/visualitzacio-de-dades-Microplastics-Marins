// Bundle generat automàticament per GitHub Pages
// Generat el: 2026-01-13T19:25:11.432876
// d3 està disponible globalment des de index.html


// ===== src/utils/data-processing.js =====

// Utilitats per carregar dades preprocessades
// Les dades han estat processades prèviament amb process_data.py

/**
 * Carrega les dades preprocessades des dels fitxers JSON
 */
async function loadData() {
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
function processData(data) {
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



// ===== src/visualizations/geographic.js =====

// Visualització de distribució geogràfica
// d3 està disponible globalment des de index.html

function initGeographicViz(selector, processedData) {
    const container = d3.select(selector);
    container.html(''); // Netejar el container
    
    const byRegion = processedData.geographic.byRegion;
    const ICR = processedData.geographic.ICR;
    const byYearRegion = processedData.temporal?.byYearRegion || [];
    // Afegir referència a metrics per accedir a dataCompleteness
    if (!processedData.metrics) {
        processedData.metrics = {};
    }
    
    // Funció per crear dades de punts del mapa (pot ser filtrada per any)
    function createMapPoints(yearFilter = null) {
        if (yearFilter == null) {
            // Sense filtre: utilitzar dades agregades per regió (totes les mostres)
            return byRegion.map(d => ({
                lat: d.meanLat,
                lon: d.meanLon,
                concentration: d.meanConcentration,
                region: d.region,
                ocean: d.ocean,
                country: d.country,
                nSamples: d.nSamples,
                medianConcentration: d.medianConcentration,
                sdConcentration: d.sdConcentration,
                ICR: d.ICR,
                minLat: d.minLat,
                maxLat: d.maxLat,
                minLon: d.minLon,
                maxLon: d.maxLon,
                year: null // Totes les mostres
            }));
        } else {
            // Amb filtre: agregar per regió només per l'any seleccionat
            const filteredByYear = byYearRegion.filter(d => d.year === yearFilter);
            
            // Agregar per regió per l'any seleccionat
            const aggregatedByRegion = {};
            filteredByYear.forEach(d => {
                const key = `${d.ocean || 'Unknown'}_${d.region || 'Unknown'}`;
                if (!aggregatedByRegion[key]) {
                    aggregatedByRegion[key] = {
                        ocean: d.ocean,
                        region: d.region,
                        concentrations: [],
                        nSamples: 0,
                        years: new Set()
                    };
                }
                if (d.meanConcentration != null) {
                    aggregatedByRegion[key].concentrations.push(d.meanConcentration);
                    aggregatedByRegion[key].nSamples += (d.nSamples || 1);
                    if (d.year) aggregatedByRegion[key].years.add(d.year);
                }
            });
            
            // Crear punts agregats i buscar coordenades de la regió original
            const mapPointsFiltered = [];
            Object.values(aggregatedByRegion).forEach(agg => {
                if (agg.concentrations.length === 0) return;
                
                // Buscar coordenades de la regió original
                const originalRegion = byRegion.find(r => 
                    r.ocean === agg.ocean && r.region === agg.region
                );
                
                if (originalRegion) {
                    const meanConcentration = agg.concentrations.reduce((a, b) => a + b, 0) / agg.concentrations.length;
                    mapPointsFiltered.push({
                        lat: originalRegion.meanLat,
                        lon: originalRegion.meanLon,
                        concentration: meanConcentration,
                        region: agg.region,
                        ocean: agg.ocean,
                        country: originalRegion.country,
                        nSamples: agg.nSamples,
                        medianConcentration: d3.median(agg.concentrations),
                        sdConcentration: d3.deviation(agg.concentrations) || 0,
                        ICR: originalRegion.ICR, // Mantenir ICR original
                        minLat: originalRegion.minLat,
                        maxLat: originalRegion.maxLat,
                        minLon: originalRegion.minLon,
                        maxLon: originalRegion.maxLon,
                        year: yearFilter
                    });
                }
            });
            
            return mapPointsFiltered;
        }
    }
    
    // Crear dades inicials (totes les mostres)
    let mapPoints = createMapPoints(null);
    
    // Obtenir llista d'anys disponibles per al filtre
    const availableYears = Array.from(new Set(byYearRegion.map(d => d.year).filter(y => y != null))).sort((a, b) => a - b);
    
    // Crear controls de filtre per any (abans del mapa)
    const filterContainer = container.append('div')
        .attr('class', 'year-filter-container')
        .style('margin-bottom', '1rem')
        .style('padding', '1rem')
        .style('background', '#f0f0f0')
        .style('border-radius', '5px')
        .style('display', 'flex')
        .style('align-items', 'center')
        .style('gap', '10px');
    
    filterContainer.append('label')
        .text('Filtrar per any: ')
        .style('font-weight', 'bold')
        .style('margin-right', '5px');
    
    const yearSelect = filterContainer.append('select')
        .attr('id', 'year-filter-select')
        .style('padding', '5px 10px')
        .style('border-radius', '3px')
        .style('border', '1px solid #ccc')
        .style('font-size', '14px')
        .style('cursor', 'pointer');
    
    // Opció "Totes"
    yearSelect.append('option')
        .attr('value', 'all')
        .text('Totes les mostres')
        .property('selected', true);
    
    // Opcions per cada any
    availableYears.forEach(year => {
        yearSelect.append('option')
            .attr('value', year)
            .text(year);
    });
    
    // Afegir esdeveniment de canvi al selector
    yearSelect.on('change', function() {
        const selectedYear = this.value;
        if (selectedYear === 'all') {
            updateMapByYear(null);
        } else {
            updateMapByYear(parseInt(selectedYear));
        }
    });
    
    // Dimensions
    const width = 1000;
    const height = 600;
    const margin = { top: 20, right: 20, bottom: 40, left: 20 };
    
    // Crear un contenidor per al mapa (sense netejar el filtre)
    const mapContainer = container.append('div')
        .attr('class', 'map-container');
    
    // Crear SVG dins del contenidor del mapa
    const svg = mapContainer
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .attr('viewBox', `0 0 ${width} ${height}`)
        .style('background', '#e8f4f8');
    
    // Projecció del mapa
    const projection = d3.geoMercator()
        .scale(150)
        .translate([width / 2, height / 2]);
    
    // Generador de path per al mapa
    const path = d3.geoPath().projection(projection);
    
    // Carregar un mapa simplificat del món com a fons
    // Usem un GeoJSON simple del món des d'un CDN públic
    const worldGeoJsonUrl = 'https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson';
    
    // Carregar i renderitzar el mapa del món
    d3.json(worldGeoJsonUrl)
        .then(worldData => {
            if (worldData && worldData.features) {
                svg.append('g')
                    .attr('class', 'world-map')
                    .selectAll('path')
                    .data(worldData.features)
                    .enter()
                    .append('path')
                    .attr('d', path)
                    .attr('fill', '#d0e0d0') // Fons més neutre per millor contrast
                    .attr('stroke', '#a0b0a0')
                    .attr('stroke-width', 0.5)
                    .attr('opacity', 0.5)
                    .lower(); // Enviar al fons
                
                // Afegir etiquetes dels oceans després que el mapa estigui renderitzat
                addOceanLabels(svg, projection, width, height);
            }
        })
        .catch(err => {
            console.log('No s\'ha pogut carregar el mapa del món, usant mapa simplificat inline');
            // Mapa simplificat inline com a fallback
            const simpleWorld = {
                type: "FeatureCollection",
                features: [
                    {type: "Feature", geometry: {type: "Polygon", coordinates: [[[-170, 25], [-50, 25], [-50, 75], [-170, 75], [-170, 25]]]}},
                    {type: "Feature", geometry: {type: "Polygon", coordinates: [[[-85, -55], [-35, -55], [-35, 12], [-85, 12], [-85, -55]]]}},
                    {type: "Feature", geometry: {type: "Polygon", coordinates: [[[-10, 36], [40, 36], [40, 71], [-10, 71], [-10, 36]]]}},
                    {type: "Feature", geometry: {type: "Polygon", coordinates: [[[-20, -35], [55, -35], [55, 38], [-20, 38], [-20, -35]]]}},
                    {type: "Feature", geometry: {type: "Polygon", coordinates: [[[40, 10], [180, 10], [180, 78], [40, 78], [40, 10]]]}},
                    {type: "Feature", geometry: {type: "Polygon", coordinates: [[[110, -50], [180, -50], [180, -10], [110, -10], [110, -50]]]}}
                ]
            };
            svg.append('g')
                .attr('class', 'world-map-simple')
                .selectAll('path')
                .data(simpleWorld.features)
                .enter()
                .append('path')
                .attr('d', path)
                .attr('fill', '#d0e0d0') // Fons més neutre per millor contrast
                .attr('stroke', '#a0b0a0')
                .attr('stroke-width', 0.5)
                .attr('opacity', 0.5)
                .lower();
            
            // Afegir etiquetes dels oceans també amb el mapa simplificat
            addOceanLabels(svg, projection, width, height);
        });
    
    // Funció per afegir etiquetes dels oceans
    function addOceanLabels(svg, projection, width, height) {
        const oceanLabels = [
            { name: 'Oceà Atlàntic', lon: -40, lat: 25 },
            { name: 'Oceà Pacífic', lon: -150, lat: 10 },
            { name: 'Oceà Pacífic', lon: 150, lat: 10 }, // Etiqueta per la banda est
            { name: 'Oceà Índic', lon: 75, lat: -20 },
            { name: 'Oceà Àrtic', lon: 0, lat: 75 },
            { name: 'Oceà Antàrtic', lon: 0, lat: -65 }
        ];
        
        const oceanGroup = svg.append('g')
            .attr('class', 'ocean-labels');
        
        // Assegurar que les etiquetes estan sota els punts de dades però sobre el mapa
        oceanGroup.lower();
        
        oceanLabels.forEach(ocean => {
            const coords = projection([ocean.lon, ocean.lat]);
            
            // Només afegir etiqueta si està dins del viewBox
            if (coords && coords[0] >= 0 && coords[0] <= width && coords[1] >= 0 && coords[1] <= height) {
                oceanGroup.append('text')
                    .attr('x', coords[0])
                    .attr('y', coords[1])
                    .attr('text-anchor', 'middle')
                    .attr('font-size', '16px')
                    .attr('font-weight', 'bold')
                    .attr('fill', '#2c3e50')
                    .attr('opacity', 0.5)
                    .attr('pointer-events', 'none')
                    .style('user-select', 'none')
                    .text(ocean.name);
            }
        });
    }
    
    // Funció per actualitzar el mapa quan canvia l'any
    function updateMapByYear(selectedYear) {
        // Obtenir noves dades segons l'any seleccionat
        const newMapPoints = (selectedYear === null || selectedYear === 'all') ? createMapPoints(null) : createMapPoints(selectedYear);
        
        // Recalcular l'extent de concentració amb les noves dades
        const newConcentrationExtent = d3.extent(newMapPoints, d => d.concentration);
        
        // Actualitzar l'escala de colors (necessitem una funció que utilitzi el nou extent)
        const updateConcentrationScale = (value) => {
            if (value < threshold) {
                const normalized = Math.min(1, Math.max(0, value / threshold));
                return d3.interpolateRgb("#1e8449", "#2ecc71")(normalized);
            } else {
                const logMin = Math.log10(threshold);
                const logMax = Math.log10(newConcentrationExtent[1]);
                const logValue = Math.log10(value);
                const normalized = (logValue - logMin) / (logMax - logMin);
                const t = Math.min(1, Math.max(0, normalized));
                
                const colorStops = [
                    { pos: 0.00, color: "#f39c12" },
                    { pos: 0.15, color: "#f1c40f" },
                    { pos: 0.30, color: "#e67e22" },
                    { pos: 0.45, color: "#e74c3c" },
                    { pos: 0.60, color: "#c0392b" },
                    { pos: 0.72, color: "#922b21" },
                    { pos: 0.84, color: "#7b241c" },
                    { pos: 0.90, color: "#6c3483" },
                    { pos: 0.95, color: "#512e5f" },
                    { pos: 1.00, color: "#000000" }
                ];
                
                for (let i = 0; i < colorStops.length - 1; i++) {
                    const current = colorStops[i];
                    const next = colorStops[i + 1];
                    if (t >= current.pos && t <= next.pos) {
                        const localT = (t - current.pos) / (next.pos - current.pos);
                        return d3.interpolateRgb(current.color, next.color)(localT);
                    }
                }
                return colorStops[colorStops.length - 1].color;
            }
        };
        
        // Actualitzar els punts del mapa
        const circles = pointsGroup.selectAll('circle')
            .data(newMapPoints, d => `${d.region}_${d.ocean}_${d.lat}_${d.lon}`);
        
        // Eliminar punts que ja no existeixen
        circles.exit().remove();
        
        // Afegir nous punts
        const newCircles = circles.enter()
            .append('circle')
            .attr('r', fixedRadius)
            .attr('opacity', 0.85)
            .attr('stroke', '#fff')
            .attr('stroke-width', 1)
            .merge(circles);
        
        // Actualitzar posicions i colors de tots els punts
        newCircles
            .attr('cx', d => projection([d.lon, d.lat])[0])
            .attr('cy', d => projection([d.lon, d.lat])[1])
            .attr('fill', d => updateConcentrationScale(d.concentration))
            .attr('data-concentration', d => d.concentration)
            .on('mouseover', function(event, d) {
                d3.select(this).attr('opacity', 1).attr('stroke-width', 2).attr('stroke', '#000');
                
                const tooltip = container.select('.tooltip').size() > 0 
                    ? container.select('.tooltip')
                    : container.append('div')
                        .attr('class', 'tooltip')
                        .style('position', 'absolute')
                        .style('background', 'rgba(0,0,0,0.9)')
                        .style('color', 'white')
                        .style('padding', '12px')
                        .style('border-radius', '6px')
                        .style('pointer-events', 'none')
                        .style('z-index', 1000)
                        .style('max-width', '320px')
                        .style('box-shadow', '0 4px 8px rgba(0,0,0,0.3)')
                        .style('font-family', 'Arial, sans-serif');
                
                const regionName = d.region || (d.ocean ? `${d.ocean} (general)` : 'Regió desconeguda');
                const hasStats = d.medianConcentration != null || d.sdConcentration != null;
                const hasICR = d.ICR != null && !isNaN(d.ICR);
                const hasGeoRange = d.minLat != null && d.maxLat != null && d.minLon != null && d.maxLon != null;
                
                let tooltipContent = `
                    <div style="font-size: 13px; line-height: 1.5;">
                        <div style="font-size: 15px; font-weight: bold; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px solid rgba(255,255,255,0.3);">
                            ${regionName}
                        </div>
                        <div style="margin-bottom: 8px;">
                            ${d.ocean ? `<div style="margin-bottom: 4px;"><span style="opacity: 0.9;">Oceà:</span> <strong>${d.ocean}</strong></div>` : ''}
                            ${d.country ? `<div><span style="opacity: 0.9;">País:</span> <strong>${d.country}</strong></div>` : ''}
                            ${d.year ? `<div style="margin-top: 4px;"><span style="opacity: 0.9;">Any:</span> <strong>${d.year}</strong></div>` : ''}
                        </div>
                        <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.2);">
                            <div style="margin-bottom: 6px;">
                                <span style="opacity: 0.9;">Nombre de mostres:</span> <strong>${d.nSamples.toLocaleString()}</strong>
                            </div>
                            <div style="margin-bottom: 4px;">
                                <span style="opacity: 0.9;">Concentració mitjana:</span> <strong>${d.concentration.toFixed(4)}</strong> pieces/m³
                            </div>
                            ${hasStats ? `
                                ${d.medianConcentration != null ? `
                                    <div style="margin-bottom: 4px; margin-left: 12px; font-size: 12px; opacity: 0.85;">
                                        • Mediana: ${d.medianConcentration.toFixed(4)} pieces/m³
                                    </div>
                                ` : ''}
                                ${d.sdConcentration != null && d.sdConcentration > 0 ? `
                                    <div style="margin-bottom: 4px; margin-left: 12px; font-size: 12px; opacity: 0.85;">
                                        • Desv. est.: ${d.sdConcentration.toFixed(4)} pieces/m³
                                    </div>
                                ` : ''}
                            ` : ''}
                        </div>
                        ${hasICR ? `
                            <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.2);">
                                <div>
                                    <span style="opacity: 0.9;">ICR (Índex de Contaminació Regional):</span> 
                                    <strong style="color: #ffd700;">${d.ICR.toFixed(4)}</strong>
                                </div>
                            </div>
                        ` : ''}
                        ${hasGeoRange ? `
                            <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.2); font-size: 11px; opacity: 0.85;">
                                <div style="margin-bottom: 4px;"><strong>Rang geogràfic:</strong></div>
                                <div style="margin-left: 8px; margin-bottom: 2px;">
                                    Lat: ${d.minLat.toFixed(2)}° - ${d.maxLat.toFixed(2)}°
                                </div>
                                <div style="margin-left: 8px; margin-bottom: 4px;">
                                    Lon: ${d.minLon.toFixed(2)}° - ${d.maxLon.toFixed(2)}°
                                </div>
                                <div>
                                    <strong>Centre:</strong> ${d.lat.toFixed(2)}°, ${d.lon.toFixed(2)}°
                                </div>
                            </div>
                        ` : ''}
                    </div>
                `;
                
                tooltip.html(tooltipContent);
            })
            .on('mousemove', function(event) {
                const tooltip = container.select('.tooltip');
                tooltip
                    .style('left', (event.pageX + 10) + 'px')
                    .style('top', (event.pageY - 10) + 'px');
            })
            .on('mouseout', function() {
                d3.select(this).attr('opacity', 0.85).attr('stroke-width', 1).attr('stroke', '#fff');
                container.select('.tooltip').remove();
            });
        
        // Actualitzar la llegenda amb les noves dades
        updateLegend(newMapPoints, newConcentrationExtent, updateConcentrationScale);
        
        // Actualitzar mapPoints global per a la llegenda
        mapPoints = newMapPoints;
    }
    
    // Funció per actualitzar la llegenda amb noves dades
    function updateLegend(dataPoints, extent, scaleFunc) {
        const logMin = Math.log10(threshold);
        const logMax = Math.log10(extent[1]);
        
        const ranges = [];
        
        if (extent[0] < threshold) {
            ranges.push({
                min: extent[0],
                max: threshold,
                color: scaleFunc(threshold * 0.5),
                label: `${extent[0].toFixed(2)} - ${threshold.toFixed(1)}`
            });
        }
        
        const unifiedMin = 1.0;
        const unifiedMax = 6.0;
        const unifiedMidVal = (unifiedMin + unifiedMax) / 2;
        ranges.push({
            min: unifiedMin,
            max: unifiedMax,
            color: scaleFunc(unifiedMidVal),
            label: `${unifiedMin.toFixed(1)} - ${unifiedMax.toFixed(1)}`
        });
        
        const logMinUnified = Math.log10(unifiedMax);
        const numRanges = 10;
        
        for (let i = 0; i < numRanges; i++) {
            const logT = i / numRanges;
            const logTNext = (i + 1) / numRanges;
            
            const minVal = Math.pow(10, logMinUnified + (logMax - logMinUnified) * logT);
            const maxVal = Math.pow(10, logMinUnified + (logMax - logMinUnified) * logTNext);
            
            const midLogT = (logT + logTNext) / 2;
            const midVal = Math.pow(10, logMinUnified + (logMax - logMinUnified) * midLogT);
            const color = scaleFunc(midVal);
            
            ranges.push({
                min: minVal,
                max: maxVal,
                color: color,
                label: `${minVal.toFixed(1)} - ${maxVal.toFixed(1)}`
            });
        }
        
        // Actualitzar cercles de la llegenda
        const legendCircles = legend.selectAll('.legend-circle')
            .data(ranges, d => d.label);
        
        legendCircles.exit().remove();
        
        const newLegendCircles = legendCircles.enter()
            .append('circle')
            .attr('class', 'legend-circle')
            .attr('cx', (d, i) => {
                const circlesPerRow = 13;
                const row = Math.floor(i / circlesPerRow);
                const col = i % circlesPerRow;
                return 30 + col * 70;
            })
            .attr('cy', (d, i) => {
                const circlesPerRow = 13;
                const row = Math.floor(i / circlesPerRow);
                return 50 + row * 45;
            })
            .attr('r', 12)
            .attr('fill', d => d.color)
            .attr('stroke', '#fff')
            .attr('stroke-width', 1.5)
            .style('cursor', 'pointer')
            .merge(legendCircles);
        
        newLegendCircles
            .attr('fill', d => d.color);
        
        // Actualitzar etiquetes
        const legendLabels = legend.selectAll('.legend-label')
            .data(ranges, d => d.label);
        
        legendLabels.exit().remove();
        
        const newLegendLabels = legendLabels.enter()
            .append('text')
            .attr('class', 'legend-label')
            .attr('x', (d, i) => {
                const circlesPerRow = 13;
                const col = i % circlesPerRow;
                return 30 + col * 70;
            })
            .attr('y', (d, i) => {
                const circlesPerRow = 13;
                const row = Math.floor(i / circlesPerRow);
                return 50 + row * 45 + 25;
            })
            .attr('text-anchor', 'middle')
            .attr('font-size', '10px')
            .style('pointer-events', 'none')
            .merge(legendLabels);
        
        newLegendLabels.text(d => d.label);
    }
    
    // Escales amb millor contrast
    const concentrationExtent = d3.extent(mapPoints, d => d.concentration);
    const threshold = 1.0; // Threshold: verd només per valors < 1 piece/m³
    
    // Utilitzar una escala de colors personalitzada amb progressió suau i continua
    // IMPORTANT: Verd només per valors < 1 piece/m³
    // Progressió completa i suau per valors >= 1
    const concentrationScale = (value) => {
        if (value < threshold) {
            // Per valors < 1 piece/m³: només tons de verd
            // Normalitzar entre 0 i 1 dins del rang [0, threshold]
            const normalized = Math.min(1, Math.max(0, value / threshold));
            // Progressió suau de verd fosc a verd clar
            return d3.interpolateRgb("#1e8449", "#2ecc71")(normalized);
        } else {
            // Per valors >= 1 piece/m³: progressió completa i suau de colors
            // Utilitzar escala logarítmica per millor distribució (el rang és molt ampli)
            const logMin = Math.log10(threshold);
            const logMax = Math.log10(concentrationExtent[1]);
            const logValue = Math.log10(value);
            const normalized = (logValue - logMin) / (logMax - logMin);
            const t = Math.min(1, Math.max(0, normalized));
            
            // Progressió clara: verd, groc, taronja, vermell, granat, morat, negre
            const colorStops = [
                // Verd groguenc (transició des de verd < 1)
                { pos: 0.00, color: "#f39c12" },    // Verd groguenc
                
                // Groc (zona reduïda)
                { pos: 0.15, color: "#f1c40f" },    // Groc
                
                // Taronja
                { pos: 0.30, color: "#e67e22" },    // Taronja
                
                // Vermell
                { pos: 0.45, color: "#e74c3c" },    // Vermell
                { pos: 0.60, color: "#c0392b" },    // Vermell intens
                
                // Granat
                { pos: 0.72, color: "#922b21" },    // Granat
                { pos: 0.84, color: "#7b241c" },    // Granat intens
                
                // Morat
                { pos: 0.90, color: "#6c3483" },    // Morat
                { pos: 0.95, color: "#512e5f" },    // Morat intens
                
                // Negre (màxim)
                { pos: 1.00, color: "#000000" }     // Negre (màxim)
            ];
            
            // Trobar entre quins punts estem
            for (let i = 0; i < colorStops.length - 1; i++) {
                const current = colorStops[i];
                const next = colorStops[i + 1];
                
                if (t >= current.pos && t <= next.pos) {
                    // Interpolar entre aquests dos colors
                    const localT = (t - current.pos) / (next.pos - current.pos);
                    return d3.interpolateRgb(current.color, next.color)(localT);
                }
            }
            
            // Fallback (no hauria d'arribar aquí)
            return colorStops[colorStops.length - 1].color;
        }
    };
    
    // Tamany fix per a tots els cercles - només el color variarà segons la concentració
    const fixedRadius = 6;
    

    // Crear punts al mapa (en una capa superior)
    // Guardar referència als punts per poder filtrar-los
    const pointsGroup = svg.append('g')
        .attr('class', 'data-points');
    
    const points = pointsGroup
        .selectAll('circle')
        .data(mapPoints)
        .enter()
        .append('circle')
        .attr('cx', d => projection([d.lon, d.lat])[0])
        .attr('cy', d => projection([d.lon, d.lat])[1])
        .attr('r', fixedRadius) // Tots els cercles tenen el mateix tamany
        .attr('fill', d => concentrationScale(d.concentration)) // Només el color varia
        .attr('opacity', 0.85) // Augmentar opacitat per millor visibilitat
        .attr('stroke', '#fff') // Vora blanca per millor contrast
        .attr('stroke-width', 1) // Vora més gruixuda
        .attr('data-concentration', d => d.concentration) // Guardar concentració per filtrar
        .on('mouseover', function(event, d) {
            d3.select(this).attr('opacity', 1).attr('stroke-width', 2).attr('stroke', '#000');
            
            // Tooltip
            const tooltip = container.append('div')
                .attr('class', 'tooltip')
                .style('position', 'absolute')
                .style('background', 'rgba(0,0,0,0.9)')
                .style('color', 'white')
                .style('padding', '12px')
                .style('border-radius', '6px')
                .style('pointer-events', 'none')
                .style('z-index', 1000)
                .style('max-width', '320px')
                .style('box-shadow', '0 4px 8px rgba(0,0,0,0.3)')
                .style('font-family', 'Arial, sans-serif');
            
            // Construir el tooltip amb més informació de la regió
            const regionName = d.region || (d.ocean ? `${d.ocean} (general)` : 'Regió desconeguda');
            const hasStats = d.medianConcentration != null || d.sdConcentration != null;
            const hasICR = d.ICR != null && !isNaN(d.ICR);
            const hasGeoRange = d.minLat != null && d.maxLat != null && d.minLon != null && d.maxLon != null;
            
            let tooltipContent = `
                <div style="font-size: 13px; line-height: 1.5;">
                    <div style="font-size: 15px; font-weight: bold; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px solid rgba(255,255,255,0.3);">
                        ${regionName}
                    </div>
                    <div style="margin-bottom: 8px;">
                        ${d.ocean ? `<div style="margin-bottom: 4px;"><span style="opacity: 0.9;">Oceà:</span> <strong>${d.ocean}</strong></div>` : ''}
                        ${d.country ? `<div><span style="opacity: 0.9;">País:</span> <strong>${d.country}</strong></div>` : ''}
                    </div>
                    <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.2);">
                        <div style="margin-bottom: 6px;">
                            <span style="opacity: 0.9;">Nombre de mostres:</span> <strong>${d.nSamples.toLocaleString()}</strong>
                        </div>
                        <div style="margin-bottom: 4px;">
                            <span style="opacity: 0.9;">Concentració mitjana:</span> <strong>${d.concentration.toFixed(4)}</strong> pieces/m³
                        </div>
                        ${hasStats ? `
                            ${d.medianConcentration != null ? `
                                <div style="margin-bottom: 4px; margin-left: 12px; font-size: 12px; opacity: 0.85;">
                                    • Mediana: ${d.medianConcentration.toFixed(4)} pieces/m³
                                </div>
                            ` : ''}
                            ${d.sdConcentration != null && d.sdConcentration > 0 ? `
                                <div style="margin-bottom: 4px; margin-left: 12px; font-size: 12px; opacity: 0.85;">
                                    • Desv. est.: ${d.sdConcentration.toFixed(4)} pieces/m³
                                </div>
                            ` : ''}
                        ` : ''}
                    </div>
                    ${hasICR ? `
                        <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.2);">
                            <div>
                                <span style="opacity: 0.9;">ICR (Índex de Contaminació Regional):</span> 
                                <strong style="color: #ffd700;">${d.ICR.toFixed(4)}</strong>
                            </div>
                        </div>
                    ` : ''}
                    ${hasGeoRange ? `
                        <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.2); font-size: 11px; opacity: 0.85;">
                            <div style="margin-bottom: 4px;"><strong>Rang geogràfic:</strong></div>
                            <div style="margin-left: 8px; margin-bottom: 2px;">
                                Lat: ${d.minLat.toFixed(2)}° - ${d.maxLat.toFixed(2)}°
                            </div>
                            <div style="margin-left: 8px; margin-bottom: 4px;">
                                Lon: ${d.minLon.toFixed(2)}° - ${d.maxLon.toFixed(2)}°
                            </div>
                            <div>
                                <strong>Centre:</strong> ${d.lat.toFixed(2)}°, ${d.lon.toFixed(2)}°
                            </div>
                        </div>
                    ` : ''}
                </div>
            `;
            
            tooltip.html(tooltipContent);
        })
        .on('mousemove', function(event) {
            const tooltip = container.select('.tooltip');
            tooltip
                .style('left', (event.pageX + 10) + 'px')
                .style('top', (event.pageY - 10) + 'px');
        })
        .on('mouseout', function() {
            d3.select(this).attr('opacity', 0.85).attr('stroke-width', 1).attr('stroke', '#fff');
            container.select('.tooltip').remove();
        });
    
    // Afegir llegenda visual sota el mapa amb cercles per cada tram
    const legendWidth = width - 40;
    const legendHeight = 150; // Més altura per acollir cercles i etiquetes
    const legendX = 20;
    
    // Crear un nou SVG per la llegenda fora del mapa principal
    const legendSvg = container.append('svg')
        .attr('width', width)
        .attr('height', legendHeight)
        .style('margin-top', '10px');
    
    const legend = legendSvg.append('g')
        .attr('class', 'legend')
        .attr('transform', `translate(${legendX}, 0)`);
    
    // Fons de la llegenda
    legend.append('rect')
        .attr('width', legendWidth)
        .attr('height', legendHeight)
        .attr('fill', 'white')
        .attr('stroke', '#333')
        .attr('stroke-width', 1)
        .attr('opacity', 0.9)
        .attr('rx', 5);
    
    // Títol de la llegenda i botó "Mostrar tots" al costat
    const titleGroup = legend.append('g')
        .attr('class', 'legend-title-group');
    
    // Títol a l'esquerra
    titleGroup.append('text')
        .attr('x', 10)
        .attr('y', 20)
        .attr('text-anchor', 'start')
        .attr('font-size', '14px')
        .attr('font-weight', 'bold')
        .text('Concentració (pieces/m³)');
    
    // Botó "Mostrar tots" a la dreta del títol
    const resetButton = titleGroup.append('g')
        .attr('class', 'reset-filter-button')
        .attr('transform', `translate(${legendWidth - 100}, 5)`)
        .style('cursor', 'pointer')
        .on('click', resetFilter);
    
    resetButton.append('rect')
        .attr('width', 80)
        .attr('height', 25)
        .attr('rx', 5)
        .attr('fill', '#667eea')
        .attr('stroke', '#333')
        .attr('stroke-width', 1);
    
    resetButton.append('text')
        .attr('x', 40)
        .attr('y', 17)
        .attr('text-anchor', 'middle')
        .attr('font-size', '11px')
        .attr('font-weight', 'bold')
        .attr('fill', 'white')
        .text('Mostrar tots');
    
    resetButton.on('mouseover', function() {
        resetButton.select('rect')
            .attr('fill', '#5568d3');
    })
    .on('mouseout', function() {
        resetButton.select('rect')
            .attr('fill', '#667eea');
    });
    
    // Definir trams de concentració basats en l'escala de colors
    // Utilitzant escala logarítmica per valors >= 1
    const logMin = Math.log10(threshold);
    const logMax = Math.log10(concentrationExtent[1]);
    
    // Crear trams representatius
    const ranges = [];
    
    // Tram verd (< 1)
    if (concentrationExtent[0] < threshold) {
        ranges.push({
            min: concentrationExtent[0],
            max: threshold,
            color: concentrationScale(threshold * 0.5), // Color representatiu del tram verd
            label: `${concentrationExtent[0].toFixed(2)} - ${threshold.toFixed(1)}`
        });
    }
    
    // Trams per valors >= 1 (utilitzant escala logarítmica)
    // Unificar el tram de 1 a 6 peces en un sol tram
    const unifiedMin = 1.0;
    const unifiedMax = 6.0;
    
    // Primer, crear el tram unificat de 1 a 6
    const unifiedMidVal = (unifiedMin + unifiedMax) / 2;
    ranges.push({
        min: unifiedMin,
        max: unifiedMax,
        color: concentrationScale(unifiedMidVal),
        label: `${unifiedMin.toFixed(1)} - ${unifiedMax.toFixed(1)}`
    });
    
    // Ara crear trams per valors > 6 (utilitzant escala logarítmica)
    const logMinUnified = Math.log10(unifiedMax); // Començar des de 6
    const numRanges = 10; // Nombre de trams per valors > 6
    
    for (let i = 0; i < numRanges; i++) {
        const logT = i / numRanges;
        const logTNext = (i + 1) / numRanges;
        
        const minVal = Math.pow(10, logMinUnified + (logMax - logMinUnified) * logT);
        const maxVal = Math.pow(10, logMinUnified + (logMax - logMinUnified) * logTNext);
        
        // Color representatiu (punt mig del tram en escala logarítmica)
        const midLogT = (logT + logTNext) / 2;
        const midVal = Math.pow(10, logMinUnified + (logMax - logMinUnified) * midLogT);
        const color = concentrationScale(midVal);
        
        ranges.push({
            min: minVal,
            max: maxVal,
            color: color,
            label: `${minVal.toFixed(1)} - ${maxVal.toFixed(1)}`
        });
    }
    
    // Organitzar cercles en files (4 cercles per fila)
    const circlesPerRow = 4;
    const numRows = Math.ceil(ranges.length / circlesPerRow);
    const circleSpacing = legendWidth / circlesPerRow;
    const rowHeight = 30;
    const startY = 45;
    const circleRadius = fixedRadius;
    
    // Variable per guardar el filtre actiu
    let activeFilter = null;
    
    // Funció per filtrar els punts del mapa (utilitza sempre els punts actuals)
    function filterMapPoints(minVal, maxVal) {
        // Utilitzar sempre els punts actuals del mapa, no una referència estàtica
        pointsGroup.selectAll('circle')
            .attr('opacity', d => {
                if (d.concentration >= minVal && d.concentration < maxVal) {
                    return 0.85; // Mostrar
                } else {
                    return 0.1; // Ocultar (opacitat baixa)
                }
            })
            .attr('stroke-width', d => {
                if (d.concentration >= minVal && d.concentration < maxVal) {
                    return 2; // Destacar
                } else {
                    return 1;
                }
            });
    }
    
    // Funció per desactivar el filtre
    function resetFilter() {
        // Utilitzar sempre els punts actuals del mapa
        pointsGroup.selectAll('circle')
            .attr('opacity', 0.85)
            .attr('stroke-width', 1);
        activeFilter = null;
        
        // Restaurar estil dels cercles de la llegenda
        legend.selectAll('.legend-circle')
            .attr('stroke', '#fff')
            .attr('stroke-width', 1.5)
            .attr('r', circleRadius);
    }
    
    ranges.forEach((range, index) => {
        const row = Math.floor(index / circlesPerRow);
        const col = index % circlesPerRow;
        const x = col * circleSpacing + circleSpacing / 2;
        const y = startY + row * rowHeight;
        
        // Cercle amb classe per poder seleccionar-lo
        const legendCircle = legend.append('circle')
            .attr('class', 'legend-circle')
            .attr('cx', x)
            .attr('cy', y)
            .attr('r', circleRadius)
            .attr('fill', range.color)
            .attr('stroke', '#fff')
            .attr('stroke-width', 1.5)
            .attr('opacity', 0.9)
            .style('cursor', 'pointer')
            .on('click', function() {
                // Si ja està seleccionat, desactivar filtre
                if (activeFilter === index) {
                    resetFilter();
                } else {
                    // Activar filtre per aquest tram
                    activeFilter = index;
                    
                    // Filtrar punts del mapa
                    filterMapPoints(range.min, range.max);
                    
                    // Destacar el cercle seleccionat
                    legend.selectAll('.legend-circle')
                        .attr('stroke', '#fff')
                        .attr('stroke-width', 1.5)
                        .attr('r', circleRadius);
                    
                    d3.select(this)
                        .attr('stroke', '#000')
                        .attr('stroke-width', 3)
                        .attr('r', circleRadius + 2);
                }
            })
            .on('mouseover', function() {
                if (activeFilter !== index) {
                    d3.select(this)
                        .attr('stroke', '#333')
                        .attr('stroke-width', 2.5)
                        .attr('r', circleRadius + 1);
                }
            })
            .on('mouseout', function() {
                if (activeFilter !== index) {
                    d3.select(this)
                        .attr('stroke', '#fff')
                        .attr('stroke-width', 1.5)
                        .attr('r', circleRadius);
                }
            });
        
        // Etiqueta amb el rang
        legend.append('text')
            .attr('x', x)
            .attr('y', y + circleRadius + 15)
            .attr('text-anchor', 'middle')
            .attr('font-size', '10px')
            .attr('fill', '#333')
            .text(range.label);
    });
    
    // El botó "Mostrar tots" ja està creat al costat del títol
    
    // Gràfic de barres per ICR per regió
    const barChartContainer = container.append('div')
        .style('margin-top', '2rem');
    
    barChartContainer.append('h3')
        .text('Índex de Contaminació Regional (ICR) per Regió');
    
    // Descripció de com es calcula l'ICR
    barChartContainer.append('p')
        .style('color', '#666')
        .style('margin-bottom', '1rem')
        .style('margin-top', '0.5rem')
        .style('font-size', '14px')
        .style('line-height', '1.6')
        .html(`
            L'ICR és un índex compòsit que combina tres components normalitzats (0-1) per regió/oceà:
            <strong>concentració mitjana</strong> (pes 40%), <strong>variabilitat</strong> (coeficient de variació, pes 30%) 
            i <strong>nombre de mostres</strong> (pes 30%). Valors més alts indiquen regions amb major contaminació relativa, 
            major variabilitat en les mesures i més mostres recollides.
        `);
    
    // Contenidor amb scroll horitzontal per al gràfic ICR
    const icrScrollContainer = barChartContainer.append('div')
        .style('overflow-x', 'auto')
        .style('overflow-y', 'hidden')
        .style('width', '100%')
        .style('max-width', '100%')
        .style('margin-top', '1rem');
    
    // Filtrar i preparar dades ICR: gestionar regions null i assegurar nom únic
    const processedICR = ICR.map(d => ({
        ...d,
        label: d.region || `${d.ocean} (general)`, // Si no hi ha regió, usar oceà
        key: d.region ? `${d.ocean}_${d.region}` : `${d.ocean}_general` // Clau única
    }));
    
    // Totes les regions per ICR, eliminant duplicats i ordenant per ICR descendent
    const uniqueICR = [];
    const seenKeys = new Set();
    
    processedICR.forEach(d => {
        if (!seenKeys.has(d.key) && d.ICR != null && !isNaN(d.ICR)) {
            uniqueICR.push(d);
            seenKeys.add(d.key);
        }
    });
    
    const topRegions = uniqueICR
        .sort((a, b) => b.ICR - a.ICR);
    
    // Ajustar amplada segons nombre de regions
    const numRegions = topRegions.length;
    const minBarWidth = 50; // Amplada mínima per barra
    const barWidth = Math.max(800, numRegions * minBarWidth + 200); // Mínim 800, més si cal
    const barHeight = 400;
    const barMargin = { top: 20, right: 20, bottom: 100, left: 60 };
    
    const barSvg = icrScrollContainer.append('svg')
        .attr('width', barWidth)
        .attr('height', barHeight)
        .attr('viewBox', `0 0 ${barWidth} ${barHeight}`)
        .style('min-width', `${barWidth}px`); // Assegurar amplada mínima
    
    // Escala de colors per ICR (utilitza la mateixa paleta que el mapa)
    const icrExtent = d3.extent(topRegions, d => d.ICR);
    const icrColorScale = (value) => {
        // Normalitzar el valor ICR al rang [0, 1]
        const normalized = (value - icrExtent[0]) / (icrExtent[1] - icrExtent[0]);
        const t = Math.min(1, Math.max(0, normalized));
        
        // Utilitzar la mateixa progressió de colors que el mapa:
        // verd, groc, taronja, vermell, granat, morat, negre
        const colorStops = [
            { pos: 0.00, color: "#2ecc71" },    // Verd (valors baixos d'ICR)
            { pos: 0.15, color: "#f1c40f" },    // Groc
            { pos: 0.30, color: "#e67e22" },    // Taronja
            { pos: 0.45, color: "#e74c3c" },    // Vermell
            { pos: 0.60, color: "#c0392b" },    // Vermell intens
            { pos: 0.72, color: "#922b21" },    // Granat
            { pos: 0.84, color: "#7b241c" },    // Granat intens
            { pos: 0.90, color: "#6c3483" },    // Morat
            { pos: 0.95, color: "#512e5f" },    // Morat intens
            { pos: 1.00, color: "#000000" }     // Negre (màxim ICR)
        ];
        
        // Trobar entre quins punts estem i interpolar
        for (let i = 0; i < colorStops.length - 1; i++) {
            const current = colorStops[i];
            const next = colorStops[i + 1];
            
            if (t >= current.pos && t <= next.pos) {
                // Interpolar entre aquests dos colors
                const localT = (t - current.pos) / (next.pos - current.pos);
                return d3.interpolateRgb(current.color, next.color)(localT);
            }
        }
        
        // Fallback (no hauria d'arribar aquí)
        return colorStops[colorStops.length - 1].color;
    };
    
    const xScale = d3.scaleBand()
        .domain(topRegions.map(d => d.label))
        .range([barMargin.left, barWidth - barMargin.right])
        .padding(0.2);
    
    const yScale = d3.scaleLinear()
        .domain([0, d3.max(topRegions, d => d.ICR)])
        .nice()
        .range([barHeight - barMargin.bottom, barMargin.top]);
    
    // Bars - assegurar que cada barra té un sol color
    const bars = barSvg.selectAll('rect')
        .data(topRegions)
        .enter()
        .append('rect')
        .attr('x', d => xScale(d.label))
        .attr('y', d => yScale(d.ICR))
        .attr('width', xScale.bandwidth())
        .attr('height', d => barHeight - barMargin.bottom - yScale(d.ICR))
        .attr('fill', d => icrColorScale(d.ICR))
        .attr('stroke', '#fff')
        .attr('stroke-width', 1.5)
        .attr('opacity', 0.9)
        .on('mouseover', function(event, d) {
            d3.select(this)
                .attr('opacity', 1)
                .attr('stroke', '#000')
                .attr('stroke-width', 2);
            
            // Tooltip
            const tooltip = barChartContainer.append('div')
                .attr('class', 'tooltip')
                .style('position', 'absolute')
                .style('background', 'rgba(0,0,0,0.9)')
                .style('color', 'white')
                .style('padding', '10px')
                .style('border-radius', '5px')
                .style('pointer-events', 'none')
                .style('z-index', 1000);
            
            tooltip.html(`
                <strong>${d.label}</strong><br>
                ICR: ${d.ICR.toFixed(3)}<br>
                ${d.ocean ? `Oceà: ${d.ocean}<br>` : ''}
                ${d.country ? `País: ${d.country || 'N/A'}<br>` : ''}
                Mostres: ${d.nSamples || 0}
            `);
        })
        .on('mousemove', function(event) {
            const tooltip = barChartContainer.select('.tooltip');
            tooltip
                .style('left', (event.pageX + 10) + 'px')
                .style('top', (event.pageY - 10) + 'px');
        })
        .on('mouseout', function() {
            d3.select(this)
                .attr('opacity', 0.9)
                .attr('stroke', '#fff')
                .attr('stroke-width', 1.5);
            barChartContainer.select('.tooltip').remove();
        });
    
    // Afegir valors ICR a les barres (opcional, per millor llegibilitat)
    barSvg.selectAll('.icr-value')
        .data(topRegions)
        .enter()
        .append('text')
        .attr('class', 'icr-value')
        .attr('x', d => xScale(d.label) + xScale.bandwidth() / 2)
        .attr('y', d => yScale(d.ICR) - 5)
        .attr('text-anchor', 'middle')
        .attr('font-size', '10px')
        .attr('font-weight', 'bold')
        .attr('fill', '#333')
        .text(d => d.ICR.toFixed(3));
    
    // Eixos
    barSvg.append('g')
        .attr('transform', `translate(0,${barHeight - barMargin.bottom})`)
        .call(d3.axisBottom(xScale))
        .selectAll('text')
        .attr('transform', 'rotate(-45)')
        .style('text-anchor', 'end')
        .style('font-size', '10px');
    
    barSvg.append('g')
        .attr('transform', `translate(${barMargin.left},0)`)
        .call(d3.axisLeft(yScale));
    
    barSvg.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('y', 15)
        .attr('x', -barHeight / 2)
        .style('text-anchor', 'middle')
        .text('ICR');
    
    // Gràfic de barres per Completitud de Dades per Regió
    const completenessContainer = container.append('div')
        .style('margin-top', '2rem');
    
    completenessContainer.append('h3')
        .text('Índex de Completitud de Dades per Regió');
    
    completenessContainer.append('p')
        .style('color', '#666')
        .style('margin-bottom', '1rem')
        .style('margin-top', '0.5rem')
        .style('font-size', '14px')
        .style('line-height', '1.6')
        .html(`
            L'índex de completitud mesura el percentatge de variables completes per regió, avaluant <strong>14 variables importants</strong> 
            (coordenades, oceà, regió, país, ambient marí, mètode de mostreig, profunditats, mesura de microplàstics, data, unitat, etc.). 
            El càlcul combina dues components: <strong>variables crítiques</strong> (concentració de microplàstics, latitud, longitud i data - 4 variables essencials, pes 60%) 
            i <strong>completitud mitjana general</strong> (totes les 14 variables, pes 40%). Valors més alts indiquen dades més fiables i completes.
        `);
    
    // Contenidor amb scroll horitzontal per al gràfic de completitud
    const compScrollContainer = completenessContainer.append('div')
        .style('overflow-x', 'auto')
        .style('overflow-y', 'hidden')
        .style('width', '100%')
        .style('max-width', '100%')
        .style('margin-top', '1rem');
    
    // Accedir a les dades de completitud
    // Intentar múltiples camins per assegurar que trobem les dades
    let completenessData = [];
    
    if (processedData.metrics?.dataCompleteness) {
        completenessData = processedData.metrics.dataCompleteness;
    } else if (processedData.metrics && Array.isArray(processedData.metrics.dataCompleteness)) {
        completenessData = processedData.metrics.dataCompleteness;
    } else {
        console.warn('No s\'han trobat dades de completitud. processedData.metrics:', processedData.metrics);
        completenessContainer.append('p')
            .style('color', '#999')
            .style('font-style', 'italic')
            .text('No hi ha dades de completitud disponibles. Assegura\'t d\'haver executat process_data.py després d\'afegir aquesta mètrica.');
        return;
    }
    
    if (!completenessData || completenessData.length === 0) {
        completenessContainer.append('p')
            .style('color', '#999')
            .style('font-style', 'italic')
            .text('No hi ha dades de completitud disponibles.');
        return;
    }
    
    // Totes les regions per completitud
    const topCompleteness = completenessData
        .filter(d => d.completenessIndex != null && !isNaN(d.completenessIndex))
        .sort((a, b) => b.completenessIndex - a.completenessIndex);
    
    if (topCompleteness.length === 0) {
        completenessContainer.append('p')
            .style('color', '#999')
            .style('font-style', 'italic')
            .text('No hi ha dades vàlides de completitud.');
        return;
    }
    
    // Ajustar amplada segons nombre de regions
    const numCompRegions = topCompleteness.length;
    const minCompBarWidth = 50; // Amplada mínima per barra
    const compWidth = Math.max(800, numCompRegions * minCompBarWidth + 200); // Mínim 800, més si cal
    const compHeight = 400;
    const compMargin = { top: 20, right: 20, bottom: 100, left: 80 };
    
    const compSvg = compScrollContainer.append('svg')
        .attr('width', compWidth)
        .attr('height', compHeight)
        .attr('viewBox', `0 0 ${compWidth} ${compHeight}`)
        .style('min-width', `${compWidth}px`); // Assegurar amplada mínima
    
    // No utilitzar colors per completitud, només l'escala vertical
    // Color uniforme per a totes les barres
    const compBarColor = '#667eea'; // Color blau uniforme
    
    const compXScale = d3.scaleBand()
        .domain(topCompleteness.map(d => d.region || `${d.ocean} (general)`))
        .range([compMargin.left, compWidth - compMargin.right])
        .padding(0.2);
    
    const compYScale = d3.scaleLinear()
        .domain([0, 100]) // Percentatge (0-100%)
        .nice()
        .range([compHeight - compMargin.bottom, compMargin.top]);
    
    // Bars
    compSvg.selectAll('rect')
        .data(topCompleteness)
        .enter()
        .append('rect')
        .attr('x', d => compXScale(d.region || `${d.ocean} (general)`))
        .attr('y', d => compYScale(d.completenessIndex))
        .attr('width', compXScale.bandwidth())
        .attr('height', d => compHeight - compMargin.bottom - compYScale(d.completenessIndex))
        .attr('fill', compBarColor) // Color uniforme
        .attr('stroke', '#fff')
        .attr('stroke-width', 1.5)
        .attr('opacity', 0.9)
        .on('mouseover', function(event, d) {
            d3.select(this)
                .attr('opacity', 1)
                .attr('stroke', '#000')
                .attr('stroke-width', 2);
            
            const tooltip = completenessContainer.append('div')
                .attr('class', 'tooltip')
                .style('position', 'absolute')
                .style('background', 'rgba(0,0,0,0.9)')
                .style('color', 'white')
                .style('padding', '10px')
                .style('border-radius', '5px')
                .style('pointer-events', 'none')
                .style('z-index', 1000);
            
            tooltip.html(`
                <strong>${d.region || `${d.ocean} (general)`}</strong><br>
                Completitud: ${d.completenessIndex.toFixed(2)}%<br>
                ${d.avgCompleteness ? `Mitjana general: ${d.avgCompleteness.toFixed(2)}%<br>` : ''}
                ${d.criticalCompleteness ? `Crítiques: ${d.criticalCompleteness.toFixed(2)}%<br>` : ''}
                ${d.ocean ? `Oceà: ${d.ocean}<br>` : ''}
                Mostres: ${d.nSamples || 0}
            `);
        })
        .on('mousemove', function(event) {
            const tooltip = completenessContainer.select('.tooltip');
            tooltip
                .style('left', (event.pageX + 10) + 'px')
                .style('top', (event.pageY - 10) + 'px');
        })
        .on('mouseout', function() {
            d3.select(this)
                .attr('opacity', 0.9)
                .attr('stroke', '#fff')
                .attr('stroke-width', 1.5);
            completenessContainer.select('.tooltip').remove();
        });
    
    // Valors sobre les barres
    compSvg.selectAll('.completeness-value')
        .data(topCompleteness)
        .enter()
        .append('text')
        .attr('class', 'completeness-value')
        .attr('x', d => compXScale(d.region || `${d.ocean} (general)`) + compXScale.bandwidth() / 2)
        .attr('y', d => compYScale(d.completenessIndex) - 5)
        .attr('text-anchor', 'middle')
        .attr('font-size', '10px')
        .attr('font-weight', 'bold')
        .attr('fill', '#333')
        .text(d => `${d.completenessIndex.toFixed(1)}%`);
    
    // Eixos
    compSvg.append('g')
        .attr('transform', `translate(0,${compHeight - compMargin.bottom})`)
        .call(d3.axisBottom(compXScale))
        .selectAll('text')
        .attr('transform', 'rotate(-45)')
        .style('text-anchor', 'end')
        .style('font-size', '10px');
    
    compSvg.append('g')
        .attr('transform', `translate(${compMargin.left},0)`)
        .call(d3.axisLeft(compYScale));
    
    compSvg.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('y', 15)
        .attr('x', -compHeight / 2)
        .style('text-anchor', 'middle')
        .text('Completitud (%)');
    
    // No cal llegenda de colors perquè no utilitzem colors diferents
}

// Small Multiples geogràfics per oceà
function initGeographicSmallMultiples(selector, processedData) {
    const container = d3.select(selector);
    container.html('<div class="loading">Carregant small multiples geogràfics...</div>');
    
    const byRegion = processedData.geographic.byRegion || [];
    
    if (!byRegion || byRegion.length === 0) {
        container.html('<div class="error">No hi ha dades geogràfiques disponibles.</div>');
        return;
    }
    
    container.append('h3')
        .text('Small Multiples: Distribució per Oceà')
        .style('margin-bottom', '1rem');
    
    container.append('p')
        .style('color', '#666')
        .style('margin-bottom', '2rem')
        .style('font-size', '14px')
        .text('Visualització comparativa de la distribució de microplàstics per cada oceà.');
    
    // Agregar dades per oceà
    const byOcean = d3.group(byRegion, d => d.ocean);
    const oceans = Array.from(byOcean.keys()).filter(o => o != null && o !== '').sort();
    
    if (oceans.length === 0) {
        container.html('<div class="error">No hi ha dades d\'oceans disponibles.</div>');
        return;
    }
    
    // Dimensions per cada mapa
    const mapWidth = 450;
    const mapHeight = 300;
    const margin = { top: 40, right: 20, bottom: 40, left: 20 };
    
    // Crear grid de mapes
    const cols = 2;
    const rows = Math.ceil(oceans.length / cols);
    const containerWidth = cols * (mapWidth + 40);
    const containerHeight = rows * (mapHeight + 80);
    
    const svgContainer = container.append('div')
        .style('width', '100%')
        .style('overflow-x', 'auto');
    
    const svg = svgContainer.append('svg')
        .attr('width', containerWidth)
        .attr('height', containerHeight)
        .style('background', '#fafafa');
    
    // Projecció base (compartida per tots els mapes)
    const baseProjection = d3.geoMercator()
        .scale(150)
        .translate([mapWidth / 2, mapHeight / 2]);
    
    // Carregar mapa del món
    const worldGeoJsonUrl = 'https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson';
    
    d3.json(worldGeoJsonUrl)
        .then(worldData => {
            const path = d3.geoPath().projection(baseProjection);
            
            // Crear un mapa per cada oceà
            oceans.forEach((ocean, i) => {
                const oceanData = byOcean.get(ocean) || [];
                
                if (oceanData.length === 0) return;
                
                const col = i % cols;
                const row = Math.floor(i / cols);
                const xOffset = col * (mapWidth + 40) + 20;
                const yOffset = row * (mapHeight + 80) + 60;
                
                // Crear grup per aquest oceà
                const g = svg.append('g')
                    .attr('class', `ocean-map-${i}`)
                    .attr('transform', `translate(${xOffset},${yOffset})`);
                
                // Projecció específica per aquest mapa (ajustar al rang de l'oceà)
                const oceanLats = oceanData.map(d => d.meanLat).filter(v => v != null);
                const oceanLons = oceanData.map(d => d.meanLon).filter(v => v != null);
                
                if (oceanLats.length === 0 || oceanLons.length === 0) return;
                
                const latExtent = d3.extent(oceanLats);
                const lonExtent = d3.extent(oceanLons);
                
                // Escalar i centrar la projecció per aquest oceà
                const projection = d3.geoMercator()
                    .scale(Math.min(
                        (mapWidth - margin.left - margin.right) / (lonExtent[1] - lonExtent[0]) * 360,
                        (mapHeight - margin.top - margin.bottom) / (latExtent[1] - latExtent[0]) * 180
                    ) * 150)
                    .translate([mapWidth / 2, mapHeight / 2])
                    .center([(lonExtent[0] + lonExtent[1]) / 2, (latExtent[0] + latExtent[1]) / 2]);
                
                const oceanPath = d3.geoPath().projection(projection);
                
                // Dibuixar mapa del món
                g.append('g')
                    .attr('class', 'world-map')
                    .selectAll('path')
                    .data(worldData.features)
                    .enter()
                    .append('path')
                    .attr('d', oceanPath)
                    .attr('fill', '#e8f4f8')
                    .attr('stroke', '#ccc')
                    .attr('stroke-width', 0.5);
                
                // Calcular escala de color per aquest oceà
                const concentrations = oceanData.map(d => d.concentration).filter(v => v != null && v > 0);
                if (concentrations.length === 0) return;
                
                const concExtent = d3.extent(concentrations);
                const colorScale = d3.scaleSequential(d3.interpolateViridis)
                    .domain(concExtent);
                
                // Dibuixar punts
                oceanData.forEach(d => {
                    if (d.meanLat != null && d.meanLon != null && d.concentration != null && d.concentration > 0) {
                        const coords = projection([d.meanLon, d.meanLat]);
                        if (coords && coords[0] >= 0 && coords[0] <= mapWidth && coords[1] >= 0 && coords[1] <= mapHeight) {
                            g.append('circle')
                                .attr('cx', coords[0])
                                .attr('cy', coords[1])
                                .attr('r', 4)
                                .attr('fill', colorScale(d.concentration))
                                .attr('opacity', 0.7)
                                .attr('stroke', '#fff')
                                .attr('stroke-width', 0.5)
                                .on('mouseover', function(event, pointData) {
                                    d3.select(this).attr('opacity', 1).attr('r', 6);
                                    
                                    const tooltip = container.append('div')
                                        .attr('class', 'tooltip')
                                        .style('position', 'absolute')
                                        .style('background', 'rgba(0,0,0,0.9)')
                                        .style('color', 'white')
                                        .style('padding', '10px')
                                        .style('border-radius', '5px')
                                        .style('pointer-events', 'none')
                                        .style('z-index', 1000);
                                    
                                    tooltip.html(`
                                        <strong>${pointData.region || pointData.ocean}</strong><br>
                                        Concentració: ${pointData.concentration.toFixed(4)} pieces/m³<br>
                                        Mostres: ${pointData.nSamples || 0}
                                    `);
                                })
                                .on('mousemove', function(event) {
                                    const tooltip = container.select('.tooltip');
                                    tooltip
                                        .style('left', (event.pageX + 10) + 'px')
                                        .style('top', (event.pageY + 10) + 'px');
                                })
                                .on('mouseout', function() {
                                    d3.select(this).attr('opacity', 0.7).attr('r', 4);
                                    container.select('.tooltip').remove();
                                });
                        }
                    }
                });
                
                // Títol
                g.append('text')
                    .attr('x', mapWidth / 2)
                    .attr('y', -10)
                    .attr('text-anchor', 'middle')
                    .style('font-size', '14px')
                    .style('font-weight', 'bold')
                    .text(ocean);
                
                // Llegenda de color (simplificada)
                const legendWidth = 150;
                const legendHeight = 10;
                const legendX = (mapWidth - legendWidth) / 2;
                const legendY = mapHeight + 25;
                
                const defs = svg.append('defs');
                const gradient = defs.append('linearGradient')
                    .attr('id', `gradient-${i}`)
                    .attr('x1', '0%')
                    .attr('x2', '100%');
                
                for (let j = 0; j <= 10; j++) {
                    const value = concExtent[0] + (concExtent[1] - concExtent[0]) * (j / 10);
                    gradient.append('stop')
                        .attr('offset', `${(j / 10) * 100}%`)
                        .attr('stop-color', colorScale(value));
                }
                
                g.append('rect')
                    .attr('x', legendX)
                    .attr('y', legendY)
                    .attr('width', legendWidth)
                    .attr('height', legendHeight)
                    .attr('fill', `url(#gradient-${i})`)
                    .attr('stroke', '#333');
                
                g.append('text')
                    .attr('x', legendX)
                    .attr('y', legendY + legendHeight + 12)
                    .style('font-size', '9px')
                    .text(concExtent[0].toFixed(3));
                
                g.append('text')
                    .attr('x', legendX + legendWidth)
                    .attr('y', legendY + legendHeight + 12)
                    .style('font-size', '9px')
                    .style('text-anchor', 'end')
                    .text(concExtent[1].toFixed(3));
            });
        })
        .catch(error => {
            console.error('Error carregant mapa del món:', error);
            container.html('<div class="error">Error carregant el mapa del món per als small multiples.</div>');
        });
}



// ===== src/visualizations/geographic.js =====



// ===== src/visualizations/geographic-interactive.js =====

// Visualització geogràfica interactiva amb Leaflet
// Mapa de fons amb zoom i pan

function initGeographicVizInteractive(selector, processedData) {
    const container = d3.select(selector);
    container.html('<div class="loading">Carregant mapa interactiu...</div>');
    
    const byRegion = processedData.geographic.byRegion;
    const ICR = processedData.geographic.ICR;
    
    // Netejar el contenidor
    container.html('');
    
    // Crear contenidor per al mapa amb ID únic per evitar conflictes
    const mapId = 'interactive-map-' + Date.now();
    const mapContainer = container.append('div')
        .attr('id', mapId)
        .style('width', '100%')
        .style('height', '600px')
        .style('border-radius', '8px')
        .style('overflow', 'hidden')
        .style('box-shadow', '0 2px 10px rgba(0,0,0,0.1)');
    
    // Esperar una mica per assegurar que el contenidor està renderitzat
    setTimeout(() => {
        // Inicialitzar mapa Leaflet
        const map = L.map(mapId, {
            zoomControl: true,
            scrollWheelZoom: true
        }).setView([20, 0], 2);
        
        // Afegir capa de fons (OpenStreetMap)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 18
        }).addTo(map);
        
        // Forçar actualització de mida del mapa
        map.invalidateSize();
        
        // Continuar amb la creació de marcadors després que el mapa estigui llest
        createMarkers(map);
    }, 100);
    
    // Funció per crear marcadors
    function createMarkers(map) {
    
        // Escales per a mida i color dels marcadors
        const concentrationExtent = d3.extent(byRegion, d => d.meanConcentration);
        const sizeScale = d3.scaleSqrt()
            .domain(concentrationExtent)
            .range([5, 30]);
        
        const colorScale = d3.scaleSequential(d3.interpolateYlOrRd)
            .domain(concentrationExtent);
        
        // Crear marcadors per cada regió
        byRegion.forEach(d => {
            if (d.meanLat == null || d.meanLon == null || isNaN(d.meanLat) || isNaN(d.meanLon)) {
                return; // Saltar regions sense coordenades vàlides
            }
            
            const concentration = d.meanConcentration || 0;
            const size = sizeScale(concentration);
            const color = colorScale(concentration);
            
            // Usar L.circleMarker que és més compatible amb popups i clics
            const marker = L.circleMarker([d.meanLat, d.meanLon], {
                radius: size,
                fillColor: color,
                color: 'white',
                weight: 2,
                opacity: 0.9,
                fillOpacity: 0.8,
                interactive: true,
                className: 'microplastic-marker'
            }).addTo(map);
            
            // Informació del popup (format similar a la visualització bàsica)
            const popupContent = `
                <div style="min-width: 220px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: white; line-height: 1.6;">
                    <div style="font-weight: bold; font-size: 16px; margin-bottom: 10px; color: white;">
                        ${d.region || 'Desconegut'}
                    </div>
                    <div style="font-size: 13px;">
                        <strong>Concentració:</strong> ${concentration.toFixed(2)} pieces/m³<br>
                        ${d.ocean ? `<strong>Oceà:</strong> ${d.ocean}<br>` : ''}
                        ${d.country ? `<strong>País:</strong> ${d.country}` : ''}
                        ${d.nSamples ? `<br><strong>Mostres:</strong> ${d.nSamples}` : ''}
                        ${d.ICR != null ? `<br><strong>ICR:</strong> ${d.ICR.toFixed(3)}` : ''}
                    </div>
                </div>
            `;
            
            // Bind popup amb opcions millorades
            marker.bindPopup(popupContent, {
                maxWidth: 300,
                className: 'custom-popup',
                closeButton: true,
                autoPan: true,
                autoPanPadding: {topLeft: [50, 50], bottomRight: [50, 50]},
                autoClose: true,
                closeOnClick: false
            });
            
            // Afegir hover effect
            marker.on('mouseover', function() {
                this.setStyle({
                    radius: size * 1.2,
                    weight: 3,
                    color: '#667eea',
                    fillOpacity: 1
                });
            });
            
            marker.on('mouseout', function() {
                this.setStyle({
                    radius: size,
                    weight: 2,
                    color: 'white',
                    fillOpacity: 0.8
                });
            });
            
            // Afegir event de clic explícit per obrir popup
            marker.on('click', function(e) {
                e.originalEvent.stopPropagation();
                this.openPopup();
            });
            
            // També obrir popup en hover (opcional, comentat per defecte)
            // marker.on('mouseover', function() {
            //     this.openPopup();
            // });
        });
        
        // Forçar actualització del mapa després d'afegir marcadors
        map.invalidateSize();
        
        // Crear llegenda i gràfic de barres
        createLegend(map, concentrationExtent, colorScale);
        createBarChart(container, byRegion, ICR, map);
    }
    
    // Funció per crear llegenda
    function createLegend(map, concentrationExtent, colorScale) {
        const legend = L.control({ position: 'bottomright' });
        
        legend.onAdd = function(map) {
            const div = L.DomUtil.create('div', 'map-legend');
            div.style.backgroundColor = 'white';
            div.style.padding = '15px';
            div.style.borderRadius = '5px';
            div.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
            div.style.fontSize = '12px';
            
            div.innerHTML = `
                <h4 style="margin: 0 0 10px 0; font-size: 14px;">Concentració de Microplàstics</h4>
                <div style="margin-bottom: 10px;">
                    <div style="display: flex; align-items: center; margin-bottom: 5px;">
                        <div style="width: 20px; height: 20px; border-radius: 50%; background: ${colorScale(concentrationExtent[0])}; border: 1px solid #333; margin-right: 8px;"></div>
                        <span>Baixa (${concentrationExtent[0].toFixed(2)} pieces/m³)</span>
                    </div>
                    <div style="display: flex; align-items: center; margin-bottom: 5px;">
                        <div style="width: 30px; height: 30px; border-radius: 50%; background: ${colorScale((concentrationExtent[0] + concentrationExtent[1]) / 2)}; border: 1px solid #333; margin-right: 8px;"></div>
                        <span>Mitjana (${((concentrationExtent[0] + concentrationExtent[1]) / 2).toFixed(2)} pieces/m³)</span>
                    </div>
                    <div style="display: flex; align-items: center;">
                        <div style="width: 30px; height: 30px; border-radius: 50%; background: ${colorScale(concentrationExtent[1])}; border: 1px solid #333; margin-right: 8px;"></div>
                        <span>Alta (${concentrationExtent[1].toFixed(2)} pieces/m³)</span>
                    </div>
                </div>
                <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #ddd;">
                    <strong>Instruccions:</strong><br>
                    • Clica als marcadors per veure detalls<br>
                    • Utilitza el zoom per explorar regions<br>
                    • Arrossega el mapa per navegar
                </div>
            `;
            
            return div;
        };
        
        legend.addTo(map);
    }
    
    // Funció per crear gràfic de barres
    function createBarChart(container, byRegion, ICR, map) {
        const barChartContainer = container.append('div')
            .style('margin-top', '2rem');
        
        barChartContainer.append('h3')
            .text('Índex de Contaminació Regional (ICR) - Top 15 Regions');
        
        const barWidth = 1000;
        const barHeight = 400;
        const barMargin = { top: 20, right: 20, bottom: 100, left: 60 };
        
        const barSvg = barChartContainer.append('svg')
            .attr('width', barWidth)
            .attr('height', barHeight)
            .attr('viewBox', `0 0 ${barWidth} ${barHeight}`);
        
        // Top 15 regions per ICR
        const topRegions = ICR.slice(0, 15);
        
        const xScale = d3.scaleBand()
            .domain(topRegions.map(d => d.region))
            .range([barMargin.left, barWidth - barMargin.right])
            .padding(0.2);
        
        const yScale = d3.scaleLinear()
            .domain([0, d3.max(topRegions, d => d.ICR)])
            .nice()
            .range([barHeight - barMargin.bottom, barMargin.top]);
        
        // Bars
        barSvg.selectAll('rect')
            .data(topRegions)
            .enter()
            .append('rect')
            .attr('x', d => xScale(d.region))
            .attr('y', d => yScale(d.ICR))
            .attr('width', xScale.bandwidth())
            .attr('height', d => barHeight - barMargin.bottom - yScale(d.ICR))
            .attr('fill', d => d3.interpolateYlOrRd(d.ICR / d3.max(topRegions, d => d.ICR)))
            .attr('stroke', '#333')
            .attr('stroke-width', 1)
            .on('mouseover', function(event, d) {
                d3.select(this).attr('opacity', 0.7);
                
                // Resaltar regió al mapa
                const regionData = byRegion.find(r => r.region === d.region);
                if (regionData && regionData.meanLat && regionData.meanLon) {
                    map.setView([regionData.meanLat, regionData.meanLon], 5, {
                        animate: true,
                        duration: 1.0
                    });
                }
            })
            .on('mouseout', function() {
                d3.select(this).attr('opacity', 1);
            });
        
        // Eixos
        barSvg.append('g')
            .attr('transform', `translate(0,${barHeight - barMargin.bottom})`)
            .call(d3.axisBottom(xScale))
            .selectAll('text')
            .attr('transform', 'rotate(-45)')
            .style('text-anchor', 'end')
            .style('font-size', '10px');
        
        barSvg.append('g')
            .attr('transform', `translate(${barMargin.left},0)`)
            .call(d3.axisLeft(yScale));
        
        barSvg.append('text')
            .attr('transform', 'rotate(-90)')
            .attr('y', 15)
            .attr('x', -barHeight / 2)
            .style('text-anchor', 'middle')
            .text('ICR');
    }
    
    console.log("Mapa interactiu inicialitzat, esperant càrrega...");
}



// ===== src/visualizations/geographic-currents.js =====

// Visualització de distribució geogràfica amb corrents oceàniques
// d3 està disponible globalment des de index.html

function initGeographicVizWithCurrents(selector, processedData) {
    const container = d3.select(selector);
    container.html('<div class="loading">Carregant visualització geogràfica amb corrents...</div>');
    
    const byRegion = processedData.geographic.byRegion;
    const ICR = processedData.geographic.ICR;
    
    // Crear dades de punts per al mapa (agregades per regió)
    const mapPoints = byRegion.map(d => ({
        lat: d.meanLat,
        lon: d.meanLon,
        concentration: d.meanConcentration,
        region: d.region,
        ocean: d.ocean,
        country: d.country,
        nSamples: d.nSamples,
        medianConcentration: d.medianConcentration,
        sdConcentration: d.sdConcentration,
        ICR: d.ICR,
        minLat: d.minLat,
        maxLat: d.maxLat,
        minLon: d.minLon,
        maxLon: d.maxLon
    }));
    
    // Dimensions
    const width = 1000;
    const height = 600;
    const margin = { top: 20, right: 20, bottom: 40, left: 20 };
    
    // Crear SVG
    const svg = container
        .html('')
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .attr('viewBox', `0 0 ${width} ${height}`)
        .style('background', '#e8f4f8');
    
    // Projecció del mapa
    const projection = d3.geoMercator()
        .scale(150)
        .translate([width / 2, height / 2]);
    
    // Generador de path per al mapa
    const path = d3.geoPath().projection(projection);
    
    // Carregar un mapa simplificat del món com a fons
    const worldGeoJsonUrl = 'https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson';
    
    // Carregar i renderitzar el mapa del món
    d3.json(worldGeoJsonUrl)
        .then(worldData => {
            if (worldData && worldData.features) {
                // Mapa del món de fons
                svg.append('g')
                    .attr('class', 'world-map')
                    .selectAll('path')
                    .data(worldData.features)
                    .enter()
                    .append('path')
                    .attr('d', path)
                    .attr('fill', '#d0e0d0')
                    .attr('stroke', '#a0b0a0')
                    .attr('stroke-width', 0.5)
                    .attr('opacity', 0.5)
                    .lower();
                
                // Afegir corrents oceàniques i noms dels oceans
                addOceanCurrents(svg, projection, width, height);
                addOceanLabels(svg, projection, width, height);
            }
        })
        .catch(err => {
            console.log('No s\'ha pogut carregar el mapa del món, usant mapa simplificat inline');
            // Mapa simplificat inline com a fallback
            const simpleWorld = {
                type: "FeatureCollection",
                features: [
                    {type: "Feature", geometry: {type: "Polygon", coordinates: [[[-170, 25], [-50, 25], [-50, 75], [-170, 75], [-170, 25]]]}},
                    {type: "Feature", geometry: {type: "Polygon", coordinates: [[[-85, -55], [-35, -55], [-35, 12], [-85, 12], [-85, -55]]]}},
                    {type: "Feature", geometry: {type: "Polygon", coordinates: [[[-10, 36], [40, 36], [40, 71], [-10, 71], [-10, 36]]]}},
                    {type: "Feature", geometry: {type: "Polygon", coordinates: [[[-20, -35], [55, -35], [55, 38], [-20, 38], [-20, -35]]]}},
                    {type: "Feature", geometry: {type: "Polygon", coordinates: [[[40, 10], [180, 10], [180, 78], [40, 78], [40, 10]]]}},
                    {type: "Feature", geometry: {type: "Polygon", coordinates: [[[110, -50], [180, -50], [180, -10], [110, -10], [110, -50]]]}}
                ]
            };
            svg.append('g')
                .attr('class', 'world-map-simple')
                .selectAll('path')
                .data(simpleWorld.features)
                .enter()
                .append('path')
                .attr('d', path)
                .attr('fill', '#d0e0d0')
                .attr('stroke', '#a0b0a0')
                .attr('stroke-width', 0.5)
                .attr('opacity', 0.5)
                .lower();
            
            addOceanCurrents(svg, projection, width, height);
            addOceanLabels(svg, projection, width, height);
        });
    
    // Funció per afegir corrents oceàniques principals
    function addOceanCurrents(svg, projection, width, height) {
        // Definir les corrents oceàniques principals amb coordenades
        const currents = [
            // Atlàntic Nord
            {
                name: 'Corrent del Golf',
                points: [[-80, 25], [-70, 30], [-60, 35], [-50, 40], [-40, 42], [-30, 45], [-20, 48]],
                color: '#4169E1',
                width: 3
            },
            {
                name: 'Corrent de Canàries',
                points: [[-15, 35], [-20, 28], [-25, 22], [-30, 18]],
                color: '#4682B4',
                width: 2
            },
            {
                name: 'Corrent del Labrador',
                points: [[-60, 65], [-55, 60], [-50, 55], [-45, 50]],
                color: '#5F9EA0',
                width: 2
            },
            // Atlàntic Sud
            {
                name: 'Corrent del Brasil',
                points: [[-40, -35], [-35, -30], [-30, -25], [-25, -20], [-20, -15]],
                color: '#4169E1',
                width: 2.5
            },
            {
                name: 'Corrent de Benguela',
                points: [[10, -25], [5, -28], [0, -30], [-5, -32]],
                color: '#4682B4',
                width: 2
            },
            // Pacífic Nord
            {
                name: 'Corrent de Kuroshio',
                points: [[130, 25], [140, 30], [150, 35], [160, 38], [170, 40]],
                color: '#FF6347',
                width: 3
            },
            {
                name: 'Corrent de Califòrnia',
                points: [[-125, 45], [-120, 40], [-115, 35], [-110, 30], [-105, 25]],
                color: '#4682B4',
                width: 2
            },
            {
                name: 'Corrent del Pacífic Nord',
                points: [[150, 45], [160, 50], [170, 48], [-160, 45], [-150, 42]],
                color: '#87CEEB',
                width: 2.5
            },
            // Pacífic Sud
            {
                name: 'Corrent de Humboldt',
                points: [[-75, -5], [-80, -10], [-85, -15], [-90, -20], [-95, -25]],
                color: '#4682B4',
                width: 2.5
            },
            {
                name: 'Corrent d\'Austràlia Oriental',
                points: [[155, -35], [150, -30], [145, -25], [140, -20]],
                color: '#4169E1',
                width: 2
            },
            // Índic
            {
                name: 'Corrent d\'Agulhas',
                points: [[30, -35], [25, -30], [20, -25], [15, -20]],
                color: '#FF6347',
                width: 2.5
            },
            {
                name: 'Corrent de Monzó',
                points: [[70, 5], [75, 10], [80, 15], [75, 20], [70, 15], [65, 10]],
                color: '#87CEEB',
                width: 2
            },
            // Antàrtic
            {
                name: 'Corrent Circumpolar Antàrtic',
                points: [[-180, -55], [-120, -55], [-60, -55], [0, -55], [60, -55], [120, -55], [180, -55]],
                color: '#4682B4',
                width: 3
            }
        ];
        
        const currentsGroup = svg.append('g')
            .attr('class', 'ocean-currents')
            .lower(); // Sota els punts de dades però sobre el mapa
        
        // Crear línies de corrents com a camins amb fletxes
        currents.forEach(current => {
            const line = d3.line()
                .x(d => projection(d)[0])
                .y(d => projection(d)[1])
                .curve(d3.curveCardinal.tension(0.5));
            
            const pathData = current.points.map(p => [p[0], p[1]]);
            const path = line(pathData);
            
            if (path) {
                // Línia principal del corrent
                currentsGroup.append('path')
                    .attr('d', path)
                    .attr('fill', 'none')
                    .attr('stroke', current.color)
                    .attr('stroke-width', current.width)
                    .attr('opacity', 0.6)
                    .attr('stroke-linecap', 'round')
                    .attr('stroke-linejoin', 'round');
                
                // Afegir fletxes per indicar direcció (cada 2-3 punts)
                for (let i = 1; i < current.points.length - 1; i += 3) {
                    const point = current.points[i];
                    const nextPoint = current.points[i + 1] || current.points[current.points.length - 1];
                    if (nextPoint) {
                        const start = projection(point);
                        const end = projection(nextPoint);
                        if (start && end && 
                            start[0] >= 0 && start[0] <= width && start[1] >= 0 && start[1] <= height &&
                            !isNaN(start[0]) && !isNaN(start[1]) && !isNaN(end[0]) && !isNaN(end[1])) {
                            
                            // Calcular angle de la fletxa
                            const dx = end[0] - start[0];
                            const dy = end[1] - start[1];
                            const angle = Math.atan2(dy, dx);
                            const arrowLength = 10;
                            
                            // Crear fletxa
                            const arrowX = start[0] + Math.cos(angle) * arrowLength;
                            const arrowY = start[1] + Math.sin(angle) * arrowLength;
                            
                            currentsGroup.append('path')
                                .attr('d', `M ${start[0]} ${start[1]} L ${arrowX} ${arrowY}`)
                                .attr('stroke', current.color)
                                .attr('stroke-width', current.width * 1.2)
                                .attr('opacity', 0.8)
                                .attr('stroke-linecap', 'round');
                        }
                    }
                }
            }
        });
        
    }
    
    // Funció per afegir etiquetes dels oceans
    function addOceanLabels(svg, projection, width, height) {
        const oceanLabels = [
            { name: 'Oceà Atlàntic', lon: -40, lat: 25 },
            { name: 'Oceà Pacífic', lon: -150, lat: 10 },
            { name: 'Oceà Pacífic', lon: 150, lat: 10 }, // Etiqueta per la banda est
            { name: 'Oceà Índic', lon: 75, lat: -20 },
            { name: 'Oceà Àrtic', lon: 0, lat: 75 },
            { name: 'Oceà Antàrtic', lon: 0, lat: -65 }
        ];
        
        const oceanGroup = svg.append('g')
            .attr('class', 'ocean-labels');
        
        // Assegurar que les etiquetes estan sota els punts de dades però sobre el mapa
        oceanGroup.lower();
        
        oceanLabels.forEach(ocean => {
            const coords = projection([ocean.lon, ocean.lat]);
            
            // Només afegir etiqueta si està dins del viewBox
            if (coords && coords[0] >= 0 && coords[0] <= width && coords[1] >= 0 && coords[1] <= height) {
                // Fons semitransparent per llegibilitat
                oceanGroup.append('text')
                    .attr('x', coords[0])
                    .attr('y', coords[1])
                    .attr('text-anchor', 'middle')
                    .attr('font-size', '18px')
                    .attr('font-weight', 'bold')
                    .attr('fill', '#1a3a5a')
                    .attr('opacity', 0.7)
                    .attr('pointer-events', 'none')
                    .style('user-select', 'none')
                    .style('text-shadow', '1px 1px 2px rgba(255,255,255,0.8)')
                    .text(ocean.name);
            }
        });
    }
    
    // Escales amb millor contrast
    const concentrationExtent = d3.extent(mapPoints, d => d.concentration);
    
    // Utilitzar una escala de colors personalitzada amb millor contrast
    const concentrationScale = d3.scaleSequential()
        .domain(concentrationExtent)
        .interpolator((t) => {
            if (t < 0.25) {
                return d3.interpolateRgb("#34495e", "#3498db")(t / 0.25);
            } else if (t < 0.5) {
                return d3.interpolateRgb("#3498db", "#f1c40f")((t - 0.25) / 0.25);
            } else if (t < 0.75) {
                return d3.interpolateRgb("#f1c40f", "#e67e22")((t - 0.5) / 0.25);
            } else {
                return d3.interpolateRgb("#e67e22", "#c0392b")((t - 0.75) / 0.25);
            }
        });
    
    // Tamany fix per a tots els cercles - només el color variarà segons la concentració
    const fixedRadius = 6;
    
    // Crear punts al mapa (en una capa superior)
    const points = svg.append('g')
        .attr('class', 'data-points')
        .selectAll('circle')
        .data(mapPoints)
        .enter()
        .append('circle')
        .attr('cx', d => projection([d.lon, d.lat])[0])
        .attr('cy', d => projection([d.lon, d.lat])[1])
        .attr('r', fixedRadius) // Tots els cercles tenen el mateix tamany
        .attr('fill', d => concentrationScale(d.concentration)) // Només el color varia
        .attr('opacity', 0.85)
        .attr('stroke', '#fff')
        .attr('stroke-width', 1)
        .on('mouseover', function(event, d) {
            d3.select(this).attr('opacity', 1).attr('stroke-width', 2).attr('stroke', '#000');
            
            // Tooltip (codi similar a la versió bàsica)
            const tooltip = container.append('div')
                .attr('class', 'tooltip')
                .style('position', 'absolute')
                .style('background', 'rgba(0,0,0,0.9)')
                .style('color', 'white')
                .style('padding', '12px')
                .style('border-radius', '6px')
                .style('pointer-events', 'none')
                .style('z-index', 1000)
                .style('max-width', '320px')
                .style('box-shadow', '0 4px 8px rgba(0,0,0,0.3)')
                .style('font-family', 'Arial, sans-serif');
            
            const regionName = d.region || (d.ocean ? `${d.ocean} (general)` : 'Regió desconeguda');
            const hasStats = d.medianConcentration != null || d.sdConcentration != null;
            const hasICR = d.ICR != null && !isNaN(d.ICR);
            const hasGeoRange = d.minLat != null && d.maxLat != null && d.minLon != null && d.maxLon != null;
            
            let tooltipContent = `
                <div style="font-size: 13px; line-height: 1.5;">
                    <div style="font-size: 15px; font-weight: bold; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px solid rgba(255,255,255,0.3);">
                        ${regionName}
                    </div>
                    <div style="margin-bottom: 8px;">
                        ${d.ocean ? `<div style="margin-bottom: 4px;"><span style="opacity: 0.9;">Oceà:</span> <strong>${d.ocean}</strong></div>` : ''}
                        ${d.country ? `<div><span style="opacity: 0.9;">País:</span> <strong>${d.country}</strong></div>` : ''}
                    </div>
                    <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.2);">
                        <div style="margin-bottom: 6px;">
                            <span style="opacity: 0.9;">Nombre de mostres:</span> <strong>${d.nSamples.toLocaleString()}</strong>
                        </div>
                        <div style="margin-bottom: 4px;">
                            <span style="opacity: 0.9;">Concentració mitjana:</span> <strong>${d.concentration.toFixed(4)}</strong> pieces/m³
                        </div>
                        ${hasStats ? `
                            ${d.medianConcentration != null ? `
                                <div style="margin-bottom: 4px; margin-left: 12px; font-size: 12px; opacity: 0.85;">
                                    • Mediana: ${d.medianConcentration.toFixed(4)} pieces/m³
                                </div>
                            ` : ''}
                            ${d.sdConcentration != null && d.sdConcentration > 0 ? `
                                <div style="margin-bottom: 4px; margin-left: 12px; font-size: 12px; opacity: 0.85;">
                                    • Desv. est.: ${d.sdConcentration.toFixed(4)} pieces/m³
                                </div>
                            ` : ''}
                        ` : ''}
                    </div>
                    ${hasICR ? `
                        <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.2);">
                            <div>
                                <span style="opacity: 0.9;">ICR (Índex de Contaminació Regional):</span> 
                                <strong style="color: #ffd700;">${d.ICR.toFixed(4)}</strong>
                            </div>
                        </div>
                    ` : ''}
                    ${hasGeoRange ? `
                        <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.2); font-size: 11px; opacity: 0.85;">
                            <div style="margin-bottom: 4px;"><strong>Rang geogràfic:</strong></div>
                            <div style="margin-left: 8px; margin-bottom: 2px;">
                                Lat: ${d.minLat.toFixed(2)}° - ${d.maxLat.toFixed(2)}°
                            </div>
                            <div style="margin-left: 8px; margin-bottom: 4px;">
                                Lon: ${d.minLon.toFixed(2)}° - ${d.maxLon.toFixed(2)}°
                            </div>
                            <div>
                                <strong>Centre:</strong> ${d.lat.toFixed(2)}°, ${d.lon.toFixed(2)}°
                            </div>
                        </div>
                    ` : ''}
                </div>
            `;
            
            tooltip.html(tooltipContent);
        })
        .on('mousemove', function(event) {
            const tooltip = container.select('.tooltip');
            tooltip
                .style('left', (event.pageX + 10) + 'px')
                .style('top', (event.pageY - 10) + 'px');
        })
        .on('mouseout', function() {
            d3.select(this).attr('opacity', 0.85).attr('stroke-width', 1).attr('stroke', '#fff');
            container.select('.tooltip').remove();
        });
    
    // Llegenda simplificada (només colors, ja que els cercles són de mida fixa)
    const legendWidth = width - 40;
    const legendHeight = 80;
    const legendX = 20;
    
    const legendSvg = container.append('svg')
        .attr('width', width)
        .attr('height', legendHeight)
        .style('margin-top', '10px');
    
    const legend = legendSvg.append('g')
        .attr('class', 'legend')
        .attr('transform', `translate(${legendX}, 0)`);
    
    legend.append('rect')
        .attr('width', legendWidth)
        .attr('height', legendHeight)
        .attr('fill', 'white')
        .attr('stroke', '#333')
        .attr('stroke-width', 1)
        .attr('opacity', 0.9)
        .attr('rx', 5);
    
    legend.append('text')
        .attr('x', legendWidth / 2)
        .attr('y', 18)
        .attr('text-anchor', 'middle')
        .attr('font-size', '13px')
        .attr('font-weight', 'bold')
        .text('Concentració de Microplàstics (pieces/m³)');
    
    const colorLegendY = 45;
    const colorLegendWidth = legendWidth - 80;
    const colorLegendHeight = 18;
    const colorLegendX = (legendWidth - colorLegendWidth) / 2;
    
    const defs = legendSvg.append('defs');
    const gradient = defs.append('linearGradient')
        .attr('id', 'concentration-gradient-currents')
        .attr('x1', '0%')
        .attr('x2', '100%');
    
    const steps = 10;
    for (let i = 0; i <= steps; i++) {
        const val = concentrationExtent[0] + (concentrationExtent[1] - concentrationExtent[0]) * (i / steps);
        gradient.append('stop')
            .attr('offset', `${(i / steps) * 100}%`)
            .attr('stop-color', concentrationScale(val));
    }
    
    legend.append('rect')
        .attr('x', colorLegendX)
        .attr('y', colorLegendY)
        .attr('width', colorLegendWidth)
        .attr('height', colorLegendHeight)
        .attr('fill', 'url(#concentration-gradient-currents)')
        .attr('stroke', '#333')
        .attr('stroke-width', 0.5);
    
    legend.append('text')
        .attr('x', colorLegendX)
        .attr('y', colorLegendY + colorLegendHeight + 13)
        .attr('text-anchor', 'start')
        .attr('font-size', '10px')
        .attr('fill', '#333')
        .text(concentrationExtent[0].toFixed(2));
    
    legend.append('text')
        .attr('x', colorLegendX + colorLegendWidth)
        .attr('y', colorLegendY + colorLegendHeight + 13)
        .attr('text-anchor', 'end')
        .attr('font-size', '10px')
        .attr('fill', '#333')
        .text(concentrationExtent[1].toFixed(2));
    
    // Llegenda de corrents
    const currentsLegend = container.append('div')
        .style('margin-top', '10px')
        .style('padding', '10px')
        .style('background', 'rgba(255,255,255,0.9)')
        .style('border-radius', '5px')
        .style('font-size', '11px');
    
    currentsLegend.html(`
        <strong>Corrents Oceàniques Principals:</strong><br>
        <span style="color: #4169E1; font-weight: bold;">━━━</span> Corrents càlids (Golf, Kuroshio, Brasil) | 
        <span style="color: #4682B4; font-weight: bold;">━━━</span> Corrents freds (Canàries, Califòrnia, Humboldt) | 
        <span style="color: #87CEEB; font-weight: bold;">━━━</span> Altres corrents
    `);
}



// ===== src/visualizations/temporal.js =====

// ===== src/visualizations/temporal-extended.js =====

// Funcions addicionals per visualitzacions temporals
// d3 està disponible globalment des de index.html

// Small multiples per oceà
function createByOceanViz(container, processedData) {
    const byYearRegion = processedData.temporal.byYearRegion || [];
    
    if (!byYearRegion || byYearRegion.length === 0) {
        container.html('<div class="error">No hi ha dades per oceà disponibles.</div>');
        return;
    }
    
    // Agregar dades per oceà i any
    const oceanData = {};
    byYearRegion.forEach(d => {
        if (d.ocean && d.year && d.meanConcentration != null) {
            const key = `${d.ocean}_${d.year}`;
            if (!oceanData[key]) {
                oceanData[key] = {
                    ocean: d.ocean,
                    year: d.year,
                    concentrations: [],
                    nSamples: 0
                };
            }
            oceanData[key].concentrations.push(d.meanConcentration);
            oceanData[key].nSamples += (d.nSamples || 1);
        }
    });
    
    // Calcular mitjana per oceà i any
    const oceans = ['Atlantic Ocean', 'Pacific Ocean', 'Indian Ocean', 'Arctic Ocean', 'Southern Ocean'];
    const oceanSeries = {};
    
    oceans.forEach(ocean => {
        oceanSeries[ocean] = [];
        Object.keys(oceanData).forEach(key => {
            const data = oceanData[key];
            if (data.ocean === ocean && data.concentrations.length > 0) {
                const mean = data.concentrations.reduce((a, b) => a + b, 0) / data.concentrations.length;
                oceanSeries[ocean].push({
                    year: data.year,
                    meanConcentration: mean,
                    nSamples: data.nSamples
                });
            }
        });
        oceanSeries[ocean].sort((a, b) => a.year - b.year);
    });
    
    container.append('h3')
        .text('Evolució Temporal per Oceà')
        .style('margin-bottom', '1rem');
    
    container.append('p')
        .style('color', '#666')
        .style('margin-bottom', '2rem')
        .style('font-size', '14px')
        .text('Comparació de l\'evolució de la concentració de microplàstics per cada oceà al llarg del temps.');
    
    // Crear small multiples
    const width = 480;
    const height = 200;
    const margin = { top: 30, right: 20, bottom: 40, left: 50 };
    
    const allYears = [...new Set(byYearRegion.map(d => d.year).filter(y => y != null))].sort((a, b) => a - b);
    const yearExtent = d3.extent(allYears);
    const concMax = d3.max(Object.values(oceanSeries).flat(), d => d.meanConcentration);
    
    const svg = container.append('svg')
        .attr('width', width * 2 + 40)
        .attr('height', height * 3 + 40)
        .style('background', '#fafafa');
    
    const colors = {
        'Atlantic Ocean': '#3498db',
        'Pacific Ocean': '#e74c3c',
        'Indian Ocean': '#f39c12',
        'Arctic Ocean': '#9b59b6',
        'Southern Ocean': '#1abc9c'
    };
    
    let row = 0, col = 0;
    oceans.forEach((ocean, i) => {
        if (!oceanSeries[ocean] || oceanSeries[ocean].length === 0) return;
        
        const g = svg.append('g')
            .attr('transform', `translate(${col * (width + 20) + 20}, ${row * (height + 20) + 20})`);
        
        const xScale = d3.scaleLinear()
            .domain(yearExtent)
            .range([margin.left, width - margin.right]);
        
        const yScale = d3.scaleLinear()
            .domain([0, concMax * 1.1])
            .nice()
            .range([height - margin.bottom, margin.top]);
        
        // Línia
        const line = d3.line()
            .x(d => xScale(d.year))
            .y(d => yScale(d.meanConcentration))
            .curve(d3.curveMonotoneX);
        
        g.append('path')
            .datum(oceanSeries[ocean])
            .attr('fill', 'none')
            .attr('stroke', colors[ocean] || '#333')
            .attr('stroke-width', 2)
            .attr('d', line);
        
        // Punts
        g.selectAll('circle')
            .data(oceanSeries[ocean])
            .enter()
            .append('circle')
            .attr('cx', d => xScale(d.year))
            .attr('cy', d => yScale(d.meanConcentration))
            .attr('r', 2.5)
            .attr('fill', colors[ocean] || '#333')
            .attr('opacity', 0.7);
        
        // Eixos
        g.append('g')
            .attr('transform', `translate(0,${height - margin.bottom})`)
            .call(d3.axisBottom(xScale).ticks(5).tickFormat(d3.format('d')))
            .selectAll('text')
            .style('font-size', '9px');
        
        g.append('g')
            .attr('transform', `translate(${margin.left},0)`)
            .call(d3.axisLeft(yScale).ticks(4))
            .selectAll('text')
            .style('font-size', '9px');
        
        // Títol
        g.append('text')
            .attr('x', width / 2)
            .attr('y', 15)
            .attr('text-anchor', 'middle')
            .style('font-size', '12px')
            .style('font-weight', 'bold')
            .style('fill', colors[ocean] || '#333')
            .text(ocean);
        
        col++;
        if (col >= 2) {
            col = 0;
            row++;
        }
    });
}

// Heatmap temporal
function createHeatmapViz(container, processedData) {
    const byYearRegion = processedData.temporal.byYearRegion || [];
    
    if (!byYearRegion || byYearRegion.length === 0) {
        container.html('<div class="error">No hi ha dades per crear el heatmap.</div>');
        return;
    }
    
    container.append('h3')
        .text('Heatmap Temporal per Oceà i Regió')
        .style('margin-bottom', '1rem');
    
    container.append('p')
        .style('color', '#666')
        .style('margin-bottom', '2rem')
        .style('font-size', '14px')
        .text('Matriu de calor mostrant la concentració de microplàstics per oceà i any. Els colors més intensos indiquen concentracions més altes.');
    
    // Agregar dades per oceà i any (similar a createByOceanViz)
    const oceanYearData = {};
    byYearRegion.forEach(d => {
        if (d.ocean && d.year && d.meanConcentration != null) {
            const key = `${d.ocean}_${d.year}`;
            if (!oceanYearData[key]) {
                oceanYearData[key] = {
                    ocean: d.ocean,
                    year: d.year,
                    concentrations: []
                };
            }
            oceanYearData[key].concentrations.push(d.meanConcentration);
        }
    });
    
    const oceans = [...new Set(byYearRegion.map(d => d.ocean).filter(o => o != null))].sort();
    const years = [...new Set(byYearRegion.map(d => d.year).filter(y => y != null))].sort((a, b) => a - b);
    
    const heatmapData = [];
    oceans.forEach(ocean => {
        years.forEach(year => {
            const key = `${ocean}_${year}`;
            const data = oceanYearData[key];
            if (data && data.concentrations.length > 0) {
                const mean = data.concentrations.reduce((a, b) => a + b, 0) / data.concentrations.length;
                heatmapData.push({
                    ocean,
                    year,
                    value: mean
                });
            }
        });
    });
    
    const maxValue = d3.max(heatmapData, d => d.value);
    const colorScale = d3.scaleSequential(d3.interpolateYlOrRd)
        .domain([0, maxValue]);
    
    const width = 1000;
    const height = 400;
    const margin = { top: 80, right: 100, bottom: 60, left: 100 };
    
    const svg = container.append('svg')
        .attr('width', width)
        .attr('height', height)
        .style('background', '#fafafa');
    
    const cellWidth = (width - margin.left - margin.right) / years.length;
    const cellHeight = (height - margin.top - margin.bottom) / oceans.length;
    
    const xScale = d3.scaleBand()
        .domain(years)
        .range([margin.left, width - margin.right]);
    
    const yScale = d3.scaleBand()
        .domain(oceans)
        .range([margin.top, height - margin.bottom]);
    
    // Cel·les del heatmap
    svg.selectAll('rect')
        .data(heatmapData)
        .enter()
        .append('rect')
        .attr('x', d => xScale(d.year))
        .attr('y', d => yScale(d.ocean))
        .attr('width', xScale.bandwidth())
        .attr('height', yScale.bandwidth())
        .attr('fill', d => colorScale(d.value))
        .attr('stroke', '#fff')
        .attr('stroke-width', 1)
        .on('mouseover', function(event, d) {
            d3.select(this).attr('stroke-width', 2).attr('stroke', '#000');
            
            const tooltip = container.append('div')
                .attr('class', 'tooltip')
                .style('position', 'absolute')
                .style('background', 'rgba(0,0,0,0.9)')
                .style('color', 'white')
                .style('padding', '8px')
                .style('border-radius', '4px')
                .style('pointer-events', 'none')
                .style('z-index', 1000);
            
            tooltip.html(`
                <strong>${d.ocean}</strong><br>
                Any: ${d.year}<br>
                Conc.: ${d.value.toFixed(4)} pieces/m³
            `);
        })
        .on('mousemove', function(event) {
            const tooltip = container.select('.tooltip');
            tooltip
                .style('left', (event.pageX + 10) + 'px')
                .style('top', (event.pageY - 10) + 'px');
        })
        .on('mouseout', function() {
            d3.select(this).attr('stroke-width', 1).attr('stroke', '#fff');
            container.select('.tooltip').remove();
        });
    
    // Eixos
    svg.append('g')
        .attr('transform', `translate(0,${height - margin.bottom})`)
        .call(d3.axisBottom(xScale).tickFormat(d3.format('d')))
        .selectAll('text')
        .attr('transform', 'rotate(-45)')
        .style('text-anchor', 'end')
        .style('font-size', '10px');
    
    svg.append('g')
        .attr('transform', `translate(${margin.left},0)`)
        .call(d3.axisLeft(yScale))
        .selectAll('text')
        .style('font-size', '11px');
    
    // Llegenda
    const legendWidth = 200;
    const legendHeight = 15;
    const legendX = width - margin.right - legendWidth;
    const legendY = margin.top - 30;
    
    const defs = svg.append('defs');
    const gradient = defs.append('linearGradient')
        .attr('id', 'heatmap-gradient')
        .attr('x1', '0%')
        .attr('x2', '100%');
    
    for (let i = 0; i <= 10; i++) {
        gradient.append('stop')
            .attr('offset', `${(i / 10) * 100}%`)
            .attr('stop-color', colorScale((i / 10) * maxValue));
    }
    
    svg.append('rect')
        .attr('x', legendX)
        .attr('y', legendY)
        .attr('width', legendWidth)
        .attr('height', legendHeight)
        .attr('fill', 'url(#heatmap-gradient)')
        .attr('stroke', '#333');
    
    svg.append('text')
        .attr('x', legendX)
        .attr('y', legendY - 5)
        .style('font-size', '11px')
        .style('font-weight', 'bold')
        .text('Concentració (pieces/m³)');
    
    svg.append('text')
        .attr('x', legendX)
        .attr('y', legendY + legendHeight + 12)
        .style('font-size', '10px')
        .text('0');
    
    svg.append('text')
        .attr('x', legendX + legendWidth)
        .attr('y', legendY + legendHeight + 12)
        .style('font-size', '10px')
        .style('text-anchor', 'end')
        .text(maxValue.toFixed(2));
}

// Streamgraph per oceà
function createStreamgraphViz(container, processedData) {
    const byYearRegion = processedData.temporal.byYearRegion || [];
    
    if (!byYearRegion || byYearRegion.length === 0) {
        container.html('<div class="error">No hi ha dades per crear el streamgraph.</div>');
        return;
    }
    
    container.append('h3')
        .text('Evolució per Oceà (Àrea Apilada)')
        .style('margin-bottom', '1rem');
    
    container.append('p')
        .style('color', '#666')
        .style('margin-bottom', '1rem')
        .style('margin-top', '0.5rem')
        .style('font-size', '14px')
        .style('line-height', '1.6')
        .html(`
            <strong>Processament de dades:</strong> Les mostres s'agreguen per oceà i any, calculant la concentració mitjana 
            de cada oceà per any. Les àrees s'apilen verticalment per mostrar la contribució de cada oceà a la concentració 
            total global. L'alçada total de la pila representa la concentració total global, mentre que cada secció de color 
            representa la contribució d'un oceà específic.
        `);
    
    // Preparar dades (similar a createByOceanViz)
    const oceanData = {};
    byYearRegion.forEach(d => {
        if (d.ocean && d.year && d.meanConcentration != null) {
            const key = `${d.ocean}_${d.year}`;
            if (!oceanData[key]) {
                oceanData[key] = {
                    ocean: d.ocean,
                    year: d.year,
                    concentrations: []
                };
            }
            oceanData[key].concentrations.push(d.meanConcentration);
        }
    });
    
    const oceans = [...new Set(byYearRegion.map(d => d.ocean).filter(o => o != null))].sort();
    const years = [...new Set(byYearRegion.map(d => d.year).filter(y => y != null))].sort((a, b) => a - b);
    
    // Calcular mitjana per oceà i any
    const oceanSeries = {};
    oceans.forEach(ocean => {
        oceanSeries[ocean] = years.map(year => {
            const key = `${ocean}_${year}`;
            const data = oceanData[key];
            if (data && data.concentrations.length > 0) {
                return data.concentrations.reduce((a, b) => a + b, 0) / data.concentrations.length;
            }
            return 0;
        });
    });
    
    const colors = {
        'Atlantic Ocean': '#3498db',
        'Pacific Ocean': '#e74c3c',
        'Indian Ocean': '#f39c12',
        'Arctic Ocean': '#9b59b6',
        'Southern Ocean': '#1abc9c'
    };
    
    const width = 1000;
    const height = 450;
    const margin = { top: 20, right: 80, bottom: 60, left: 60 };
    
    const svg = container.append('svg')
        .attr('width', width)
        .attr('height', height)
        .style('background', '#fafafa');
    
    const xScale = d3.scaleLinear()
        .domain(d3.extent(years))
        .range([margin.left, width - margin.right]);
    
    // Calcular valors apilats
    const stackedData = years.map((year, i) => {
        const stack = {};
        let base = 0;
        oceans.forEach(ocean => {
            const value = oceanSeries[ocean][i] || 0;
            stack[ocean] = { base, value, top: base + value };
            base += value;
        });
        return { year, ...stack };
    });
    
    const maxStack = d3.max(stackedData, d => 
        oceans.reduce((sum, ocean) => sum + (d[ocean]?.top || 0), 0)
    );
    
    const yScale = d3.scaleLinear()
        .domain([0, maxStack * 1.1])
        .range([height - margin.bottom, margin.top]);
    
    // Crear àrees apilades
    const area = d3.area()
        .x(d => xScale(d.year))
        .y0(d => yScale(d.base))
        .y1(d => yScale(d.top))
        .curve(d3.curveMonotoneX);
    
    oceans.forEach(ocean => {
        const areaData = stackedData.map(d => ({
            year: d.year,
            base: d[ocean]?.base || 0,
            top: d[ocean]?.top || 0,
            value: (d[ocean]?.top || 0) - (d[ocean]?.base || 0)
        }));
        
        svg.append('path')
            .datum(areaData)
            .attr('fill', colors[ocean] || '#999')
            .attr('opacity', 0.7)
            .attr('stroke', '#fff')
            .attr('stroke-width', 1)
            .attr('d', area)
            .on('mouseover', function(event) {
                d3.select(this).attr('opacity', 0.9);
                
                const tooltip = container.append('div')
                    .attr('class', 'tooltip')
                    .style('position', 'absolute')
                    .style('background', 'rgba(0,0,0,0.9)')
                    .style('color', 'white')
                    .style('padding', '10px')
                    .style('border-radius', '5px')
                    .style('pointer-events', 'none')
                    .style('z-index', 1000);
                
                // Trobar el punt més proper al cursor
                const [mouseX] = d3.pointer(event);
                const year = xScale.invert(mouseX);
                const closest = areaData.reduce((prev, curr) => 
                    Math.abs(curr.year - year) < Math.abs(prev.year - year) ? curr : prev
                );
                
                // Calcular total per aquest any
                const yearData = stackedData.find(s => s.year === closest.year);
                const total = yearData ? oceans.reduce((sum, o) => {
                    const val = (yearData[o]?.top || 0) - (yearData[o]?.base || 0);
                    return sum + val;
                }, 0) : 0;
                
                const percentage = total > 0 ? ((closest.value / total) * 100).toFixed(1) : '0.0';
                
                tooltip.html(`
                    <strong>${ocean}</strong><br>
                    Any: ${closest.year}<br>
                    Concentració: ${closest.value.toLocaleString('ca-ES', {maximumFractionDigits: 2})} pieces/m³<br>
                    Contribució a la total: ${percentage}%
                `);
            })
            .on('mousemove', function(event) {
                const tooltip = container.select('.tooltip');
                tooltip
                    .style('left', (event.pageX + 10) + 'px')
                    .style('top', (event.pageY - 10) + 'px');
            })
            .on('mouseout', function() {
                d3.select(this).attr('opacity', 0.7);
                container.select('.tooltip').remove();
            });
    });
    
    // Línies separadores
    oceans.slice(0, -1).forEach(ocean => {
        const line = d3.line()
            .x(d => xScale(d.year))
            .y(d => yScale(d[ocean]?.top || 0))
            .curve(d3.curveMonotoneX);
        
        svg.append('path')
            .datum(stackedData)
            .attr('fill', 'none')
            .attr('stroke', '#fff')
            .attr('stroke-width', 1)
            .attr('d', line);
    });
    
    // Eixos
    svg.append('g')
        .attr('transform', `translate(0,${height - margin.bottom})`)
        .call(d3.axisBottom(xScale).tickFormat(d3.format('d')));
    
    svg.append('g')
        .attr('transform', `translate(${margin.left},0)`)
        .call(d3.axisLeft(yScale));
    
    // Llegenda
    const legendX = width - margin.right + 10;
    const legendY = margin.top;
    
    oceans.forEach((ocean, i) => {
        const legendItem = svg.append('g')
            .attr('transform', `translate(${legendX}, ${legendY + i * 25})`);
        
        legendItem.append('rect')
            .attr('width', 15)
            .attr('height', 15)
            .attr('fill', colors[ocean] || '#999')
            .attr('opacity', 0.7);
        
        legendItem.append('text')
            .attr('x', 20)
            .attr('y', 12)
            .style('font-size', '11px')
            .text(ocean);
    });
}

// Violin Plots per any
function createViolinPlots(container, processedData) {
    const violinData = processedData.temporalAdvanced?.violinData || [];
    
    if (!violinData || violinData.length === 0) {
        container.html('<div class="error">No hi ha dades per crear violin plots.</div>');
        return;
    }
    
    container.append('h3')
        .text('Violin Plots: Distribució de Concentracions per Any')
        .style('margin-bottom', '1rem');
    
    container.append('p')
        .style('color', '#666')
        .style('margin-bottom', '1rem')
        .style('margin-top', '0.5rem')
        .style('font-size', '14px')
        .style('line-height', '1.6')
        .html(`
            <strong>Processament de dades:</strong> Per a cada any, es recopilen totes les concentracions individuals de les mostres. 
            La forma del violin representa la densitat de probabilitat de les concentracions: l'amplada en cada punt indica quantes 
            mostres tenen concentracions similars. La línia vertical central representa la mediana (valor que divideix les dades per la meitat). 
            L'escala és logarítmica per visualitzar millor el rang ampli de concentracions.
        `);
    
    // Filtrar dades vàlides
    const validData = violinData
        .filter(d => 
            d.year != null && 
            d.concentrations && 
            Array.isArray(d.concentrations) && 
            d.concentrations.length >= 5
        )
        .sort((a, b) => a.year - b.year)
        .slice(0, 30); // Top 30 anys per rendiment
    
    if (validData.length === 0) {
        container.html('<div class="error">No hi ha suficients dades vàlides per mostrar violin plots.</div>');
        return;
    }
    
    const width = 1000;
    const height = 500;
    const margin = { top: 40, right: 40, bottom: 80, left: 80 };
    
    const svg = container.append('svg')
        .attr('width', width)
        .attr('height', height)
        .style('background', '#fafafa');
    
    // Escales
    const xScale = d3.scaleBand()
        .domain(validData.map(d => d.year))
        .range([margin.left, width - margin.right])
        .padding(0.3);
    
    const allConcentrations = validData.flatMap(d => d.concentrations).filter(c => c > 0);
    const yScale = d3.scaleLog()
        .domain(d3.extent(allConcentrations))
        .nice()
        .range([height - margin.bottom, margin.top]);
    
    // Crear violin plot per cada any
    validData.forEach((d, i) => {
        const x = xScale(d.year);
        const bandwidth = xScale.bandwidth();
        const concentrations = d.concentrations.filter(c => c > 0 && !isNaN(c));
        
        if (concentrations.length === 0) return;
        
        // Calcular estadístiques
        const sorted = [...concentrations].sort((a, b) => a - b);
        const q1 = d3.quantile(sorted, 0.25);
        const median = d3.median(sorted);
        const q3 = d3.quantile(sorted, 0.75);
        const iqr = q3 - q1;
        const min = Math.max(d3.min(sorted), q1 - 1.5 * iqr);
        const max = Math.min(d3.max(sorted), q3 + 1.5 * iqr);
        
        // Crear histograma per la forma del violin
        const bins = d3.bin()
            .domain([min, max])
            .thresholds(15)(concentrations);
        
        const maxCount = d3.max(bins.map(b => b.length));
        const countScale = d3.scaleLinear()
            .domain([0, maxCount])
            .range([0, bandwidth / 2 - 5]);
        
        // Crear grup per aquest violin
        const g = svg.append('g')
            .attr('class', `violin-${d.year}`)
            .attr('transform', `translate(${x},0)`);
        
        // Crear punts per violin (simetria bilateral)
        const violinPoints = [];
        bins.forEach(bin => {
            if (bin.length > 0) {
                const value = bin.x0 + (bin.x1 - bin.x0) / 2;
                const width = countScale(bin.length);
                violinPoints.push({
                    value: value,
                    width: width,
                    y: yScale(value)
                });
            }
        });
        
        if (violinPoints.length === 0) return;
        
        // Crear path simètric (esquerra invertida + dreta)
        const baseY = yScale(max); // Base del violin (part inferior)
        const leftSide = violinPoints.map(p => [bandwidth / 2 - p.width, p.y]).reverse();
        const rightSide = violinPoints.map(p => [bandwidth / 2 + p.width, p.y]);
        
        // Crear path tancat
        const allPoints = [
            [bandwidth / 2, baseY], // Punt base esquerra
            ...leftSide,
            [bandwidth / 2, violinPoints[violinPoints.length - 1].y], // Top
            ...rightSide,
            [bandwidth / 2, baseY] // Tancar path
        ];
        
        const pathString = allPoints.map((point, i) => {
            return i === 0 ? `M ${point[0]} ${point[1]}` : `L ${point[0]} ${point[1]}`;
        }).join(' ') + ' Z';
        
        g.append('path')
            .attr('d', pathString)
            .attr('fill', '#667eea')
            .attr('opacity', 0.6)
            .attr('stroke', '#333')
            .attr('stroke-width', 1);
        
        // Línia de mediana (més subtil, sense box plot)
        g.append('line')
            .attr('x1', bandwidth * 0.1)
            .attr('x2', bandwidth * 0.9)
            .attr('y1', yScale(median))
            .attr('y2', yScale(median))
            .attr('stroke', '#333')
            .attr('stroke-width', 1.5)
            .attr('opacity', 0.7);
        
        // Tooltip
        g.on('mouseover', function(event, d) {
            const tooltip = container.append('div')
                .attr('class', 'tooltip')
                .style('position', 'absolute')
                .style('background', 'rgba(0,0,0,0.9)')
                .style('color', 'white')
                .style('padding', '10px')
                .style('border-radius', '5px')
                .style('pointer-events', 'none')
                .style('z-index', 1000);
            
            tooltip.html(`
                <strong>${d.year}</strong><br>
                Mostres: ${d.concentrations.length}<br>
                Mediana: ${median.toFixed(4)} pieces/m³<br>
                Q1: ${q1.toFixed(4)} pieces/m³<br>
                Q3: ${q3.toFixed(4)} pieces/m³<br>
                Min: ${d3.min(sorted).toFixed(4)} pieces/m³<br>
                Max: ${d3.max(sorted).toFixed(4)} pieces/m³
            `);
        })
        .on('mousemove', function(event) {
            const tooltip = container.select('.tooltip');
            tooltip
                .style('left', (event.pageX + 10) + 'px')
                .style('top', (event.pageY + 10) + 'px');
        })
        .on('mouseout', function() {
            container.select('.tooltip').remove();
        });
    });
    
    // Eixos
    svg.append('g')
        .attr('transform', `translate(0,${height - margin.bottom})`)
        .call(d3.axisBottom(xScale).tickFormat(d3.format('d')))
        .selectAll('text')
        .attr('transform', 'rotate(-45)')
        .style('text-anchor', 'end')
        .style('font-size', '10px');
    
    svg.append('g')
        .attr('transform', `translate(${margin.left},0)`)
        .call(d3.axisLeft(yScale));
    
    svg.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('y', 20)
        .attr('x', -height / 2)
        .style('text-anchor', 'middle')
        .style('font-size', '12px')
        .text('Concentració (pieces/m³) - escala logarítmica');
}

// Ridgeline Plots (Joy Plots)
function createRidgelinePlots(container, processedData) {
    const violinData = processedData.temporalAdvanced?.violinData || [];
    
    if (!violinData || violinData.length === 0) {
        container.html('<div class="error">No hi ha dades per crear ridgeline plots.</div>');
        return;
    }
    
    container.append('h3')
        .text('Ridgeline Plots: Evolució de la Distribució Temporal')
        .style('margin-bottom', '1rem');
    
    container.append('p')
        .style('color', '#666')
        .style('margin-bottom', '1rem')
        .style('margin-top', '0.5rem')
        .style('font-size', '14px')
        .style('line-height', '1.6')
        .html(`
            <strong>Processament de dades:</strong> Per a cada any, es crea un histograma de les concentracions de les mostres 
            recollides aquell any. Cada ridgeline representa la distribució de concentracions per any, apilades verticalment 
            amb una lleugera superposició per facilitar la comparació temporal. L'alçada de cada corba indica la freqüència 
            relativa de mostres amb concentracions similars. L'escala horitzontal és logarítmica per visualitzar millor el rang 
            ampli de concentracions. Els colors varien segons l'any per facilitar la identificació temporal.
        `);
    
    // Filtrar i ordenar dades
    const validData = violinData
        .filter(d => 
            d.year != null && 
            d.concentrations && 
            Array.isArray(d.concentrations) && 
            d.concentrations.length >= 5
        )
        .sort((a, b) => a.year - b.year)
        .slice(0, 25); // Top 25 anys per rendiment
    
    if (validData.length === 0) {
        container.html('<div class="error">No hi ha suficients dades vàlides per mostrar ridgeline plots.</div>');
        return;
    }
    
    const width = 1000;
    const height = validData.length * 40 + 100; // Altura dinàmica basada en nombre d'anys
    const margin = { top: 40, right: 80, bottom: 60, left: 100 };
    
    const svg = container.append('svg')
        .attr('width', width)
        .attr('height', height)
        .style('background', '#fafafa');
    
    // Escales
    const allConcentrations = validData.flatMap(d => d.concentrations).filter(c => c > 0);
    const xScale = d3.scaleLog()
        .domain(d3.extent(allConcentrations))
        .nice()
        .range([margin.left, width - margin.right]);
    
    const ySpacing = (height - margin.top - margin.bottom) / validData.length;
    
    // Color scale per any
    const yearExtent = d3.extent(validData, d => d.year);
    const colorScale = d3.scaleSequential(d3.interpolateViridis)
        .domain(yearExtent);
    
    // Crear ridgeline per cada any
    validData.forEach((d, i) => {
        const concentrations = d.concentrations.filter(c => c > 0 && !isNaN(c));
        if (concentrations.length === 0) return;
        
        const yBase = margin.top + i * ySpacing;
        const histHeight = ySpacing * 0.7;
        
        // Crear histograma
        const bins = d3.bin()
            .domain(d3.extent(concentrations))
            .thresholds(20)(concentrations);
        
        const maxCount = d3.max(bins.map(b => b.length));
        const countScale = d3.scaleLinear()
            .domain([0, maxCount])
            .range([0, histHeight]);
        
        // Crear punts per al ridgeline
        const ridgelinePoints = bins
            .filter(bin => bin.length > 0)
            .map(bin => ({
                x: bin.x0 + (bin.x1 - bin.x0) / 2,
                count: bin.length,
                yTop: yBase - countScale(bin.length)
            }));
        
        if (ridgelinePoints.length === 0) return;
        
        // Crear path tancat per al ridgeline (forma simètrica)
        const leftStart = [xScale(ridgelinePoints[0].x), yBase];
        const topPoints = ridgelinePoints.map(d => [xScale(d.x), d.yTop]);
        const rightEnd = [xScale(ridgelinePoints[ridgelinePoints.length - 1].x), yBase];
        
        // Crear path tancat (base esquerra -> top -> base dreta -> base esquerra)
        const allPoints = [
            leftStart,
            ...topPoints,
            rightEnd,
            leftStart // Tancar
        ];
        
        // Crear path amb corbes suaus
        const line = d3.line()
            .x(d => d[0])
            .y(d => d[1])
            .curve(d3.curveBasis);
        
        const pathString = line(allPoints) + ' Z';
        
        const pathElement = svg.append('path')
            .attr('d', pathString)
            .attr('fill', colorScale(d.year))
            .attr('opacity', 0.7)
            .attr('stroke', '#333')
            .attr('stroke-width', 0.5)
            .on('mouseover', function(event) {
                d3.select(this).attr('opacity', 0.9).attr('stroke-width', 1.5);
                
                const tooltip = container.append('div')
                    .attr('class', 'tooltip')
                    .style('position', 'absolute')
                    .style('background', 'rgba(0,0,0,0.9)')
                    .style('color', 'white')
                    .style('padding', '10px')
                    .style('border-radius', '5px')
                    .style('pointer-events', 'none')
                    .style('z-index', 1000);
                
                const sorted = [...concentrations].sort((a, b) => a - b);
                const q1 = d3.quantile(sorted, 0.25);
                const median = d3.median(sorted);
                const q3 = d3.quantile(sorted, 0.75);
                
                tooltip.html(`
                    <strong>Any: ${d.year}</strong><br>
                    Mostres: ${concentrations.length}<br>
                    Mediana: ${median.toFixed(4)} pieces/m³<br>
                    Q1: ${q1.toFixed(4)} pieces/m³<br>
                    Q3: ${q3.toFixed(4)} pieces/m³<br>
                    Min: ${d3.min(sorted).toFixed(4)} pieces/m³<br>
                    Max: ${d3.max(sorted).toFixed(4)} pieces/m³
                `);
            })
            .on('mousemove', function(event) {
                const tooltip = container.select('.tooltip');
                tooltip
                    .style('left', (event.pageX + 10) + 'px')
                    .style('top', (event.pageY - 10) + 'px');
            })
            .on('mouseout', function() {
                d3.select(this).attr('opacity', 0.7).attr('stroke-width', 0.5);
                container.select('.tooltip').remove();
            });
        
        // Etiqueta d'any
        svg.append('text')
            .attr('x', margin.left - 10)
            .attr('y', yBase)
            .attr('dy', '0.35em')
            .attr('text-anchor', 'end')
            .style('font-size', '11px')
            .style('font-weight', 'bold')
            .text(d.year);
        
        // Línia base
        svg.append('line')
            .attr('x1', margin.left)
            .attr('x2', width - margin.right)
            .attr('y1', yBase)
            .attr('y2', yBase)
            .attr('stroke', '#ddd')
            .attr('stroke-width', 0.5)
            .lower();
    });
    
    // Eix X (només al final)
    svg.append('g')
        .attr('transform', `translate(0,${height - margin.bottom})`)
        .call(d3.axisBottom(xScale))
        .selectAll('text')
        .style('font-size', '10px');
    
    svg.append('text')
        .attr('x', width / 2)
        .attr('y', height - 10)
        .style('text-anchor', 'middle')
        .style('font-size', '12px')
        .text('Concentració (pieces/m³) - escala logarítmica');
    
    // Llegenda de color
    const legendWidth = 200;
    const legendHeight = 15;
    const legendX = width - margin.right - legendWidth;
    const legendY = margin.top;
    
    const defs = svg.append('defs');
    const gradient = defs.append('linearGradient')
        .attr('id', 'year-gradient')
        .attr('x1', '0%')
        .attr('x2', '100%');
    
    for (let i = 0; i <= 10; i++) {
        const year = yearExtent[0] + (yearExtent[1] - yearExtent[0]) * (i / 10);
        gradient.append('stop')
            .attr('offset', `${(i / 10) * 100}%`)
            .attr('stop-color', colorScale(year));
    }
    
    svg.append('rect')
        .attr('x', legendX)
        .attr('y', legendY)
        .attr('width', legendWidth)
        .attr('height', legendHeight)
        .attr('fill', 'url(#year-gradient)')
        .attr('stroke', '#333');
    
    svg.append('text')
        .attr('x', legendX)
        .attr('y', legendY - 5)
        .style('font-size', '11px')
        .style('font-weight', 'bold')
        .text('Any');
    
    svg.append('text')
        .attr('x', legendX)
        .attr('y', legendY + legendHeight + 12)
        .style('font-size', '10px')
        .text(yearExtent[0]);
    
    svg.append('text')
        .attr('x', legendX + legendWidth)
        .attr('y', legendY + legendHeight + 12)
        .style('font-size', '10px')
        .style('text-anchor', 'end')
        .text(yearExtent[1]);
}


// Visualització d'evolució temporal
// d3 està disponible globalment des de index.html



function initTemporalViz(selector, processedData) {
    const container = d3.select(selector);
    container.html('<div class="loading">Carregant visualitzacions temporals...</div>');
    
    const byYear = processedData.temporal.byYear || [];
    const byYearRegion = processedData.temporal.byYearRegion || [];
    const TCT = processedData.temporal.TCT || [];
    
    console.log("Temporal data loaded:", { 
        byYearCount: byYear.length, 
        byYearRegionCount: byYearRegion.length,
        TCTCount: TCT.length 
    });
    
    // Netejar el loader i crear contenidor únic per a totes les visualitzacions temporals
    container.html(''); // Netejar el loader
    const contentContainer = container.append('div')
        .attr('class', 'temporal-content');
    
    // Inicialitzar totes les visualitzacions en ordre
    createOverviewViz(contentContainer, processedData);
    
    // Afegir separador visual
    contentContainer.append('hr')
        .style('margin', '4rem 0 2rem 0')
        .style('border', 'none')
        .style('border-top', '2px solid #e0e0e0');
    
    // Afegir títol per a les distribucions
    contentContainer.append('h2')
        .text('Distribucions Temporals')
        .style('margin-bottom', '1rem')
        .style('color', '#333');
    
    contentContainer.append('p')
        .style('color', '#666')
        .style('margin-bottom', '2rem')
        .style('font-size', '14px')
        .text('Visualitzacions detallades de la distribució de concentracions per any.');
    
    // Afegir violin plots
    createViolinPlots(contentContainer, processedData);
    
    // Afegir separador visual
    contentContainer.append('hr')
        .style('margin', '4rem 0 2rem 0')
        .style('border', 'none')
        .style('border-top', '2px solid #e0e0e0');
    
    // Afegir ridgeline plots
    createRidgelinePlots(contentContainer, processedData);
}

// Funció eliminada: ja no calen tabs, tot està en una sola vista

    // Funció per crear la visualització de vista general (la que ja existia)
function createOverviewViz(container, processedData) {
    const byYear = processedData.temporal.byYear || [];
    const TCT = processedData.temporal.TCT || [];
    
    // Verificar que hi hagi dades
    if (!byYear || byYear.length === 0) {
        container.html('<div class="error">No hi ha dades temporals disponibles. Assegura\'t d\'haver executat el script de processament.</div>');
        return;
    }
    
    // Filtrar dades vàlides (amb any i concentració)
    const validData = byYear.filter(d => 
        d.year != null && 
        d.year !== undefined && 
        !isNaN(d.year) &&
        d.meanConcentration != null && 
        d.meanConcentration !== undefined &&
        !isNaN(d.meanConcentration)
    );
    
    console.log("Valid temporal data:", validData.length, "out of", byYear.length);
    
    if (validData.length === 0) {
        container.html('<div class="error">No hi ha dades vàlides per mostrar.</div>');
        return;
    }
    
    // Controls de zoom temporal
    const yearExtent = d3.extent(validData, d => d.year);
    const controlsDiv = container.append('div')
        .attr('class', 'temporal-zoom-controls')
        .style('margin-bottom', '1rem')
        .style('padding', '1rem')
        .style('background', '#f0f0f0')
        .style('border-radius', '5px');
    
    controlsDiv.append('label')
        .text('Rang d\'anys: ')
        .style('margin-right', '10px')
        .style('font-weight', 'bold');
    
    const minYearInput = controlsDiv.append('input')
        .attr('type', 'number')
        .attr('min', yearExtent[0])
        .attr('max', yearExtent[1])
        .attr('value', yearExtent[0])
        .style('width', '80px')
        .style('margin-right', '10px')
        .style('padding', '5px');
    
    controlsDiv.append('span').text(' - ');
    
    const maxYearInput = controlsDiv.append('input')
        .attr('type', 'number')
        .attr('min', yearExtent[0])
        .attr('max', yearExtent[1])
        .attr('value', yearExtent[1])
        .style('width', '80px')
        .style('margin-left', '10px')
        .style('margin-right', '10px')
        .style('padding', '5px');
    
    const applyButton = controlsDiv.append('button')
        .text('Aplicar Zoom')
        .style('padding', '5px 15px')
        .style('cursor', 'pointer')
        .style('background', '#667eea')
        .style('color', 'white')
        .style('border', 'none')
        .style('border-radius', '3px');
    
    const resetButton = controlsDiv.append('button')
        .text('Reset')
        .style('padding', '5px 15px')
        .style('margin-left', '10px')
        .style('cursor', 'pointer')
        .style('background', '#999')
        .style('color', 'white')
        .style('border', 'none')
        .style('border-radius', '3px');
    
    // Funció per actualitzar la visualització amb el zoom
    let currentFilteredData = validData;
    
    function updateVisualization(filteredData) {
        const vizContainer = container.select('.temporal-viz-content');
        if (vizContainer.empty()) {
            const newViz = container.append('div').attr('class', 'temporal-viz-content');
            drawTemporalChart(newViz, filteredData, TCT);
        } else {
            vizContainer.remove();
            const newViz = container.append('div').attr('class', 'temporal-viz-content');
            drawTemporalChart(newViz, filteredData, TCT);
        }
    }
    
    // Funció per dibuixar el gràfic temporal
    function drawTemporalChart(vizContainer, data, tctData) {
        vizContainer.html(''); // Netejar contenidor
        
        // Descripció de com es calcula la concentració mitjana
        vizContainer.append('p')
            .style('color', '#666')
            .style('margin-bottom', '1rem')
            .style('font-size', '14px')
            .style('line-height', '1.6')
            .html(`
                <strong>Concentració mitjana anual:</strong> Es calcula agregant totes les mostres recollides cada any 
                i calculant la mitjana aritmètica de les concentracions. Cada punt representa la concentració mitjana 
                global de microplàstics per a aquell any.
            `);
        
        // Dimensions
        const width = 1000;
        const height = 500;
        const margin = { top: 20, right: 80, bottom: 60, left: 60 };
        
        // Crear SVG
        const svg = vizContainer
            .append('svg')
            .attr('width', width)
            .attr('height', height)
            .attr('viewBox', `0 0 ${width} ${height}`)
            .style('background', '#fafafa');
        
        // Escales basades en les dades filtrades
        const yearExtentData = d3.extent(data, d => d.year);
        const concMax = d3.max(data, d => d.meanConcentration);
    
        if (!yearExtentData[0] || !yearExtentData[1] || !concMax || concMax === 0) {
            console.error("Invalid data extent:", { yearExtentData, concMax });
            vizContainer.html('<div class="error">Error en les dades: extents invàlids.</div>');
            return;
        }
        
        const xScale = d3.scaleLinear()
            .domain(yearExtentData)
            .range([margin.left, width - margin.right]);
        
        const yScale = d3.scaleLinear()
            .domain([0, concMax * 1.1])
            .nice()
            .range([height - margin.bottom, margin.top]);
        
        // Línia de concentració mitjana
        const line = d3.line()
            .x(d => xScale(d.year))
            .y(d => yScale(d.meanConcentration))
            .curve(d3.curveMonotoneX)
            .defined(d => d.year != null && d.meanConcentration != null && !isNaN(d.meanConcentration));
        
        svg.append('path')
            .datum(data)
            .attr('fill', 'none')
            .attr('stroke', '#667eea')
            .attr('stroke-width', 3)
            .attr('d', line);
        
        // Punts
        svg.selectAll('circle')
            .data(data)
            .enter()
            .append('circle')
            .attr('cx', d => xScale(d.year))
            .attr('cy', d => yScale(d.meanConcentration))
            .attr('r', 4)
            .attr('fill', '#667eea')
            .attr('stroke', 'white')
            .attr('stroke-width', 2)
            .on('mouseover', function(event, d) {
                d3.select(this).attr('r', 6);
                
                const tooltip = vizContainer.append('div')
                    .attr('class', 'tooltip')
                    .style('position', 'absolute')
                    .style('background', 'rgba(0,0,0,0.8)')
                    .style('color', 'white')
                    .style('padding', '10px')
                    .style('border-radius', '5px')
                    .style('pointer-events', 'none')
                    .style('z-index', 1000);
                
                // Format de la concentració i TCT
                const concFormatted = (d.meanConcentration || 0).toLocaleString('ca-ES', {maximumFractionDigits: 2});
                let tctFormatted = '';
                if (d.TCT != null && !isNaN(d.TCT)) {
                    if (Math.abs(d.TCT) >= 1000) {
                        tctFormatted = `TCT: ${d.TCT.toExponential(2)}%`;
                    } else {
                        tctFormatted = `TCT: ${d.TCT.toFixed(2)}%`;
                    }
                }
                
                tooltip.html(`
                    <strong>${d.year}</strong><br>
                    Concentració mitjana: ${concFormatted} pieces/m³<br>
                    Mostres: ${(d.nSamples || 0).toLocaleString('ca-ES')}<br>
                    ${tctFormatted}
                `);
            })
            .on('mousemove', function(event) {
                const tooltip = vizContainer.select('.tooltip');
                tooltip
                    .style('left', (event.pageX + 10) + 'px')
                    .style('top', (event.pageY - 10) + 'px');
            })
            .on('mouseout', function() {
                d3.select(this).attr('r', 4);
                vizContainer.select('.tooltip').remove();
            });
        
        // Eixos
        svg.append('g')
            .attr('transform', `translate(0,${height - margin.bottom})`)
            .call(d3.axisBottom(xScale).tickFormat(d3.format('d')));
        
        svg.append('text')
            .attr('x', width / 2)
            .attr('y', height - 10)
            .style('text-anchor', 'middle')
            .style('font-size', '12px')
            .text('Any');
        
        svg.append('g')
            .attr('transform', `translate(${margin.left},0)`)
            .call(d3.axisLeft(yScale));
        
        svg.append('text')
            .attr('transform', 'rotate(-90)')
            .attr('y', 15)
            .attr('x', -height / 2)
            .style('text-anchor', 'middle')
            .style('font-size', '12px')
            .text('Concentració mitjana (pieces/m³)');
    }
    
    // Crear contenidor inicial
    const vizContainer = container.append('div').attr('class', 'temporal-viz-content');
    drawTemporalChart(vizContainer, validData, TCT);
    
    // Event listeners per controls de zoom
    applyButton.on('click', function() {
        const minYear = parseInt(minYearInput.node().value);
        const maxYear = parseInt(maxYearInput.node().value);
        
        if (isNaN(minYear) || isNaN(maxYear) || minYear > maxYear) {
            alert('Rang d\'anys invàlid. Introdueix valors vàlids.');
            return;
        }
        
        const filtered = validData.filter(d => d.year >= minYear && d.year <= maxYear);
        if (filtered.length === 0) {
            alert('No hi ha dades per al rang seleccionat.');
            return;
        }
        
        currentFilteredData = filtered;
        updateVisualization(filtered);
    });
    
    resetButton.on('click', function() {
        minYearInput.node().value = yearExtent[0];
        maxYearInput.node().value = yearExtent[1];
        currentFilteredData = validData;
        updateVisualization(validData);
    });
    
    // Gràfic de TCT (separat)
    const tctContainer = container.append('div')
        .style('margin-top', '3rem');
    
    tctContainer.append('h3')
        .text('Taxa de Canvi Temporal (TCT)');
    
    // Descripció de com es calcula el TCT
    tctContainer.append('p')
        .style('color', '#666')
        .style('margin-bottom', '1rem')
        .style('margin-top', '0.5rem')
        .style('font-size', '14px')
        .style('line-height', '1.6')
        .html(`
            <strong>Taxa de Canvi Temporal (TCT):</strong> Mesura el canvi percentual en la concentració de microplàstics 
            respecte a l'any anterior. Es calcula com: <code>TCT = ((C<sub>t</sub> - C<sub>t-1</sub>) / C<sub>t-1</sub>) × 100</code>, 
            on C<sub>t</sub> és la concentració mitjana de l'any actual i C<sub>t-1</sub> és la de l'any anterior. 
            Valors positius indiquen augment i valors negatius disminució. El primer any no té TCT perquè no hi ha any anterior per comparar.
        `);
    
    // Filtrar dades TCT vàlides (amb any i TCT no null)
    // Si TCT és un array separat, usar-lo; sinó filtrar des de byYear
    let validTCT = [];
    if (TCT && TCT.length > 0) {
        validTCT = TCT.filter(d => d.year != null && d.TCT != null && d.TCT !== null && !isNaN(d.TCT));
    } else {
        validTCT = byYear.filter(d => d.year != null && d.TCT != null && d.TCT !== null && !isNaN(d.TCT));
    }
    
    console.log("Valid TCT data:", validTCT.length);
    
    if (validTCT.length === 0) {
        tctContainer.append('p')
            .style('color', '#666')
            .style('font-style', 'italic')
            .style('padding', '1rem')
            .text('No hi ha dades de TCT disponibles (necessita almenys 2 anys de dades consecutius).');
        return;
    }
    
    const tctWidth = 1000;
    const tctHeight = 300;
    const tctMargin = { top: 20, right: 20, bottom: 60, left: 60 };
    
    const tctSvg = tctContainer.append('svg')
        .attr('width', tctWidth)
        .attr('height', tctHeight)
        .attr('viewBox', `0 0 ${tctWidth} ${tctHeight}`);
    
    // Escales TCT
    const tctYearExtent = d3.extent(validTCT, d => d.year);
    const tctExtent = d3.extent(validTCT, d => d.TCT);
    
    // Detectar si hi ha valors extrems (més de 1000% o menys de -1000%)
    const hasExtremeValues = Math.abs(tctExtent[0]) > 1000 || Math.abs(tctExtent[1]) > 1000;
    
    const tctXScale = d3.scaleLinear()
        .domain(tctYearExtent)
        .range([tctMargin.left, tctWidth - tctMargin.right]);
    
    // Usar escala logarítmica simètrica si hi ha valors extrems, sinó lineal
    let tctYScale;
    let useLogScale = false;
    
    if (hasExtremeValues) {
        // Per valors extrems, usar escala logarítmica simètrica
        const maxAbs = Math.max(Math.abs(tctExtent[0]), Math.abs(tctExtent[1]));
        const logMax = Math.log10(maxAbs);
        tctYScale = d3.scaleSymlog()
            .domain([tctExtent[0] * 1.1, tctExtent[1] * 1.1])
            .range([tctHeight - tctMargin.bottom, tctMargin.top]);
        useLogScale = true;
    } else {
        tctYScale = d3.scaleLinear()
            .domain([Math.min(0, tctExtent[0] * 1.1), Math.max(0, tctExtent[1] * 1.1)])
            .nice()
            .range([tctHeight - tctMargin.bottom, tctMargin.top]);
    }
    
    // Línia de referència a zero
    tctSvg.append('line')
        .attr('x1', tctMargin.left)
        .attr('x2', tctWidth - tctMargin.right)
        .attr('y1', tctYScale(0))
        .attr('y2', tctYScale(0))
        .attr('stroke', '#999')
        .attr('stroke-dasharray', '5,5')
        .attr('stroke-width', 1);
    
    // Àrea per sobre/baix de zero
    const area = d3.area()
        .x(d => tctXScale(d.year))
        .y0(tctYScale(0))
        .y1(d => tctYScale(d.TCT))
        .curve(d3.curveMonotoneX)
        .defined(d => d.year != null && d.TCT != null && !isNaN(d.TCT));
    
    const meanTCT = d3.mean(validTCT, d => d.TCT);
    tctSvg.append('path')
        .datum(validTCT)
        .attr('fill', meanTCT > 0 ? 'rgba(231, 76, 60, 0.3)' : 'rgba(46, 204, 113, 0.3)')
        .attr('d', area);
    
    // Línia TCT
    const tctLine = d3.line()
        .x(d => tctXScale(d.year))
        .y(d => tctYScale(d.TCT))
        .curve(d3.curveMonotoneX)
        .defined(d => d.year != null && d.TCT != null && !isNaN(d.TCT));
    
    tctSvg.append('path')
        .datum(validTCT)
        .attr('fill', 'none')
        .attr('stroke', '#e74c3c')
        .attr('stroke-width', 2)
        .attr('d', tctLine);
    
    // Punts TCT
    tctSvg.selectAll('circle')
        .data(validTCT)
        .enter()
        .append('circle')
        .attr('cx', d => tctXScale(d.year))
        .attr('cy', d => tctYScale(d.TCT))
        .attr('r', 3)
        .attr('fill', '#e74c3c')
        .attr('stroke', 'white')
        .attr('stroke-width', 1)
        .on('mouseover', function(event, d) {
            d3.select(this).attr('r', 5);
            
            const tooltip = container.append('div')
                .attr('class', 'tooltip')
                .style('position', 'absolute')
                .style('background', 'rgba(0,0,0,0.8)')
                .style('color', 'white')
                .style('padding', '10px')
                .style('border-radius', '5px')
                .style('pointer-events', 'none')
                .style('z-index', 1000);
            
            // Format del TCT: usar notació científica si és molt gran
            let tctFormatted;
            if (Math.abs(d.TCT) >= 1000) {
                tctFormatted = d.TCT.toExponential(2) + '%';
            } else {
                tctFormatted = d.TCT.toFixed(2) + '%';
            }
            
            tooltip.html(`
                <strong>${d.year}</strong><br>
                TCT: ${tctFormatted}<br>
                ${d.meanConcentration ? `Concentració: ${d.meanConcentration.toLocaleString('ca-ES', {maximumFractionDigits: 2})} pieces/m³` : ''}
            `);
        })
        .on('mousemove', function(event) {
            const tooltip = container.select('.tooltip');
            tooltip
                .style('left', (event.pageX + 10) + 'px')
                .style('top', (event.pageY - 10) + 'px');
        })
        .on('mouseout', function() {
            d3.select(this).attr('r', 3);
            container.select('.tooltip').remove();
        });
    
    // Eixos TCT
    tctSvg.append('g')
        .attr('transform', `translate(0,${tctHeight - tctMargin.bottom})`)
        .call(d3.axisBottom(tctXScale).tickFormat(d3.format('d')));
    
    tctSvg.append('text')
        .attr('x', tctWidth / 2)
        .attr('y', tctHeight - 10)
        .style('text-anchor', 'middle')
        .style('font-size', '12px')
        .text('Any');
    
    // Format de l'eix Y: usar format llegible per valors grans
    const formatTCTAxis = (d) => {
        if (Math.abs(d) >= 1000000) {
            return (d / 1000000).toFixed(1) + 'M%';
        } else if (Math.abs(d) >= 1000) {
            return (d / 1000).toFixed(1) + 'k%';
        } else {
            return d.toFixed(0) + '%';
        }
    };
    
    tctSvg.append('g')
        .attr('transform', `translate(${tctMargin.left},0)`)
        .call(d3.axisLeft(tctYScale).tickFormat(formatTCTAxis));
    
    tctSvg.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('y', 15)
        .attr('x', -tctHeight / 2)
        .style('text-anchor', 'middle')
        .style('font-size', '12px')
        .text('TCT (%)');
    
    // Afegir l'àrea apilada per oceà a la vista general
    const streamgraphContainer = container.append('div')
        .style('margin-top', '3rem');
    
    createStreamgraphViz(streamgraphContainer, processedData);
}

// Funció eliminada: les distribucions s'afegeixen directament al contenidor principal



// ===== src/visualizations/factors.js =====

// ===== src/visualizations/factors-extended.js =====

// Funcions addicionals per visualitzacions de factors
// d3 està disponible globalment des de index.html

// Violin plots per mètode de mostreig (millorat amb box plots)
function createMethodViolinPlot(container, processedData) {
    const methodData = processedData.factors.methodData || [];
    
    if (!methodData || methodData.length === 0) {
        container.html('<div class="error">No hi ha dades de mètodes disponibles.</div>');
        return;
    }
    
    container.append('h3')
        .text('Concentració per Mètode de Mostreig')
        .style('margin-bottom', '1rem');
    
    container.append('p')
        .style('color', '#666')
        .style('margin-bottom', '1rem')
        .style('margin-top', '0.5rem')
        .style('font-size', '14px')
        .style('line-height', '1.6')
        .html(`
            <strong>Processament de dades:</strong> Les mostres s'agrupen per mètode de mostreig i es calculen les estadístiques 
            de distribució (quartils, mediana, mínim, màxim) per a cada mètode. La visualització mostra box plots amb punts 
            jittered per representar la densitat de dades. L'escala de concentració és logarítmica per visualitzar millor el 
            rang ampli de valors. El color de cada box plot indica el nombre de mostres (blau més fosc = més mostres).
        `);
    
    // Filtrar mètodes amb suficients dades i ordenar per nombre de mostres
    const filteredMethods = methodData
        .filter(d => d.concentrations && d.concentrations.length >= 5)
        .sort((a, b) => (b.concentrations?.length || 0) - (a.concentrations?.length || 0))
        .slice(0, 15); // Top 15 mètodes
    
    if (filteredMethods.length === 0) {
        container.html('<div class="error">No hi ha suficients dades per mostrar els mètodes.</div>');
        return;
    }
    
    const width = 1000;
    const height = 500;
    const margin = { top: 40, right: 40, bottom: 120, left: 80 };
    
    const svg = container.append('svg')
        .attr('width', width)
        .attr('height', height)
        .style('background', '#fafafa');
    
    const xScale = d3.scaleBand()
        .domain(filteredMethods.map(d => d.method))
        .range([margin.left, width - margin.right])
        .padding(0.3);
    
    const allConcentrations = filteredMethods.flatMap(d => d.concentrations || []).filter(c => c > 0);
    // Utilitzar escala logarítmica per millor visualització
    const yScale = d3.scaleLog()
        .domain(d3.extent(allConcentrations))
        .nice()
        .range([height - margin.bottom, margin.top]);
    
    // Color scale per nombre de mostres
    const sampleScale = d3.scaleSequential(d3.interpolateBlues)
        .domain(d3.extent(filteredMethods, d => d.concentrations?.length || 0));
    
    // Crear box plots amb jitter
    filteredMethods.forEach((d, i) => {
        if (!d.concentrations || d.concentrations.length === 0) return;
        
        const x = xScale(d.method);
        const bandWidth = xScale.bandwidth();
        
        const sorted = [...d.concentrations].sort((a, b) => a - b).filter(c => c > 0);
        if (sorted.length === 0) return;
        
        const q1 = d3.quantile(sorted, 0.25);
        const median = d3.median(sorted);
        const q3 = d3.quantile(sorted, 0.75);
        const iqr = q3 - q1;
        const min = Math.max(d3.min(sorted), q1 - 1.5 * iqr);
        const max = Math.min(d3.max(sorted), q3 + 1.5 * iqr);
        
        const color = sampleScale(d.concentrations.length);
        
        // Whiskers
        svg.append('line')
            .attr('x1', x + bandWidth / 2)
            .attr('x2', x + bandWidth / 2)
            .attr('y1', yScale(min))
            .attr('y2', yScale(max))
            .attr('stroke', '#666')
            .attr('stroke-width', 1.5);
        
        // Box
        const boxRect = svg.append('rect')
            .attr('x', x + bandWidth * 0.2)
            .attr('y', yScale(q3))
            .attr('width', bandWidth * 0.6)
            .attr('height', yScale(q1) - yScale(q3))
            .attr('fill', color)
            .attr('opacity', 0.7)
            .attr('stroke', '#333')
            .attr('stroke-width', 1.5)
            .on('mouseover', function(event) {
                d3.select(this).attr('opacity', 1).attr('stroke-width', 2.5);
                svg.selectAll(`.jitter-${i} circle`).attr('opacity', 0.7).attr('r', 2);
                
                const tooltip = container.append('div')
                    .attr('class', 'tooltip')
                    .style('position', 'absolute')
                    .style('background', 'rgba(0,0,0,0.9)')
                    .style('color', 'white')
                    .style('padding', '10px')
                    .style('border-radius', '5px')
                    .style('pointer-events', 'none')
                    .style('z-index', 1000);
                
                tooltip.html(`
                    <strong>${d.method}</strong><br>
                    Mostres: ${d.concentrations.length.toLocaleString('ca-ES')}<br>
                    Mediana: ${median.toFixed(4)} pieces/m³<br>
                    Q1: ${q1.toFixed(4)} pieces/m³<br>
                    Q3: ${q3.toFixed(4)} pieces/m³<br>
                    Min: ${d3.min(sorted).toFixed(4)} pieces/m³<br>
                    Max: ${d3.max(sorted).toFixed(4)} pieces/m³<br>
                    IQR: ${iqr.toFixed(4)} pieces/m³
                `);
            })
            .on('mousemove', function(event) {
                const tooltip = container.select('.tooltip');
                tooltip
                    .style('left', (event.pageX + 10) + 'px')
                    .style('top', (event.pageY - 10) + 'px');
            })
            .on('mouseout', function() {
                d3.select(this).attr('opacity', 0.7).attr('stroke-width', 1.5);
                svg.selectAll(`.jitter-${i} circle`).attr('opacity', 0.4).attr('r', 1.5);
                container.select('.tooltip').remove();
            });
        
        // Median line
        svg.append('line')
            .attr('x1', x + bandWidth * 0.2)
            .attr('x2', x + bandWidth * 0.8)
            .attr('y1', yScale(median))
            .attr('y2', yScale(median))
            .attr('stroke', '#333')
            .attr('stroke-width', 2);
        
        // Jitter scatter per mostrar densitat
        const jitterGroup = svg.append('g')
            .attr('class', `jitter-${i}`);
        
        sorted.slice(0, 200).forEach((val, j) => { // Limitar a 200 punts per rendiment
            const jitterX = x + bandWidth * 0.1 + Math.random() * bandWidth * 0.8;
            jitterGroup.append('circle')
                .attr('cx', jitterX)
                .attr('cy', yScale(val))
                .attr('r', 1.5)
                .attr('fill', color)
                .attr('opacity', 0.4)
                .attr('stroke', 'none');
        });
    });
    
    // Eixos
    svg.append('g')
        .attr('transform', `translate(0,${height - margin.bottom})`)
        .call(d3.axisBottom(xScale))
        .selectAll('text')
        .attr('transform', 'rotate(-45)')
        .style('text-anchor', 'end')
        .style('font-size', '10px');
    
    svg.append('g')
        .attr('transform', `translate(${margin.left},0)`)
        .call(d3.axisLeft(yScale));
    
    svg.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('y', 20)
        .attr('x', -height / 2)
        .style('text-anchor', 'middle')
        .style('font-size', '12px')
        .text('Concentració (pieces/m³) - escala logarítmica');
}

// Treemap per mètode i ambient marí
function createTreemapViz(container, processedData) {
    const treemapData = processedData.factors.treemapData || [];
    
    if (!treemapData || treemapData.length === 0) {
        container.html('<div class="error">No hi ha dades per crear el treemap.</div>');
        return;
    }
    
    container.append('h3')
        .text('Distribució per Mètode de Mostreig i Ambient Marí')
        .style('margin-bottom', '1rem');
    
    container.append('p')
        .style('color', '#666')
        .style('margin-bottom', '1rem')
        .style('margin-top', '0.5rem')
        .style('font-size', '14px')
        .style('line-height', '1.6')
        .html(`
            <strong>Processament de dades:</strong> Les mostres s'agrupen per combinació de mètode de mostreig i ambient marí. 
            Cada rectangle del treemap representa una combinació única, on la <strong>mida</strong> és proporcional al nombre de mostres 
            i el <strong>color</strong> representa la concentració mitjana (groguenc = baixa, vermell fosc = alta). 
            Aquesta visualització permet identificar quines combinacions mètode-ambient tenen més mostres i quines mostren concentracions més altes.
        `);
    
    // Filtrar dades vàlides i ordenar per nombre de mostres
    const validData = treemapData
        .filter(d => d.nSamples > 0 && d.meanConcentration != null)
        .sort((a, b) => b.nSamples - a.nSamples);
    
    if (validData.length === 0) {
        container.html('<div class="error">No hi ha dades vàlides per mostrar.</div>');
        return;
    }
    
    const width = 1000;
    const height = 600;
    const margin = { top: 20, right: 20, bottom: 20, left: 20 };
    
    const svg = container.append('svg')
        .attr('width', width)
        .attr('height', height)
        .style('background', '#fafafa');
    
    // Crear jerarquia per treemap
    const root = d3.hierarchy({
        children: validData.map(d => ({
            name: `${d.method || 'N/A'} - ${d.marineSetting || 'N/A'}`,
            value: d.nSamples,
            meanConcentration: d.meanConcentration,
            method: d.method,
            marineSetting: d.marineSetting,
            nSamples: d.nSamples
        }))
    })
    .sum(d => d.value)
    .sort((a, b) => b.value - a.value);
    
    // Generar treemap
    const treemap = d3.treemap()
        .size([width - margin.left - margin.right, height - margin.top - margin.bottom])
        .padding(2);
    
    treemap(root);
    
    const colorScale = d3.scaleSequential(d3.interpolateYlOrRd)
        .domain(d3.extent(validData, d => d.meanConcentration));
    
    const cells = svg.selectAll('g')
        .data(root.leaves())
        .enter()
        .append('g')
        .attr('transform', d => `translate(${d.x0 + margin.left},${d.y0 + margin.top})`);
    
    // Rectangles
    cells.append('rect')
        .attr('width', d => d.x1 - d.x0)
        .attr('height', d => d.y1 - d.y0)
        .attr('fill', d => colorScale(d.data.meanConcentration))
        .attr('stroke', '#fff')
        .attr('stroke-width', 1.5)
        .on('mouseover', function(event, d) {
            d3.select(this).attr('stroke-width', 3).attr('stroke', '#000');
            
            const tooltip = container.append('div')
                .attr('class', 'tooltip')
                .style('position', 'absolute')
                .style('background', 'rgba(0,0,0,0.9)')
                .style('color', 'white')
                .style('padding', '10px')
                .style('border-radius', '5px')
                .style('pointer-events', 'none')
                .style('z-index', 1000);
            
            tooltip.html(`
                <strong>${d.data.method || 'N/A'}</strong><br>
                Ambient: ${d.data.marineSetting || 'N/A'}<br>
                Mostres: ${d.data.nSamples.toLocaleString()}<br>
                Conc. mitjana: ${d.data.meanConcentration.toFixed(4)} pieces/m³
            `);
        })
        .on('mousemove', function(event) {
            const tooltip = container.select('.tooltip');
            tooltip
                .style('left', (event.pageX + 10) + 'px')
                .style('top', (event.pageY + 10) + 'px');
        })
        .on('mouseout', function() {
            d3.select(this).attr('stroke-width', 1.5).attr('stroke', '#fff');
            container.select('.tooltip').remove();
        });
    
    // Etiquetes (només per cel·les prou grans)
    cells.filter(d => (d.x1 - d.x0) > 80 && (d.y1 - d.y0) > 30)
        .append('text')
        .attr('x', d => (d.x1 - d.x0) / 2)
        .attr('y', d => (d.y1 - d.y0) / 2)
        .attr('dy', '0.35em')
        .attr('text-anchor', 'middle')
        .style('font-size', d => Math.min((d.x1 - d.x0) / 8, 11) + 'px')
        .style('fill', '#333')
        .style('font-weight', 'bold')
        .text(d => {
            const method = d.data.method || 'N/A';
            return method.length > 20 ? method.substring(0, 20) + '...' : method;
        });
    
    // Llegenda de color
    const legendWidth = 200;
    const legendHeight = 15;
    const legendX = width - margin.right - legendWidth;
    const legendY = margin.top;
    
    const defs = svg.append('defs');
    const gradient = defs.append('linearGradient')
        .attr('id', 'treemap-gradient')
        .attr('x1', '0%')
        .attr('x2', '100%');
    
    const concExtent = d3.extent(validData, d => d.meanConcentration);
    for (let i = 0; i <= 10; i++) {
        gradient.append('stop')
            .attr('offset', `${(i / 10) * 100}%`)
            .attr('stop-color', colorScale(concExtent[0] + (concExtent[1] - concExtent[0]) * (i / 10)));
    }
    
    svg.append('rect')
        .attr('x', legendX)
        .attr('y', legendY)
        .attr('width', legendWidth)
        .attr('height', legendHeight)
        .attr('fill', 'url(#treemap-gradient)')
        .attr('stroke', '#333');
    
    svg.append('text')
        .attr('x', legendX)
        .attr('y', legendY - 5)
        .style('font-size', '11px')
        .style('font-weight', 'bold')
        .text('Concentració mitjana');
    
    svg.append('text')
        .attr('x', legendX)
        .attr('y', legendY + legendHeight + 12)
        .style('font-size', '10px')
        .text(concExtent[0].toFixed(2));
    
    svg.append('text')
        .attr('x', legendX + legendWidth)
        .attr('y', legendY + legendHeight + 12)
        .style('font-size', '10px')
        .style('text-anchor', 'end')
        .text(concExtent[1].toFixed(2));
}

// Matriu de correlació visual
function createCorrelationMatrix(container, processedData) {
    const scatterData = processedData.factors.scatterData || [];
    
    if (!scatterData || scatterData.length === 0) {
        container.html('<div class="error">No hi ha dades per crear la matriu de correlació.</div>');
        return;
    }
    
    container.append('h3')
        .text('Matriu de Correlació entre Factors')
        .style('margin-bottom', '1rem');
    
    container.append('p')
        .style('color', '#666')
        .style('margin-bottom', '2rem')
        .style('font-size', '14px')
        .text('Visualització de les correlacions entre diferents factors que influeixen en la concentració de microplàstics.');
    
    // Preparar dades numèriques
    const numericData = scatterData
        .filter(d => 
            d.concentration != null && 
            d.depth != null && 
            d.concentration > 0 && 
            d.depth > 0
        )
        .map(d => ({
            concentration: d.concentration,
            depth: d.depth,
            year: d.Year || d.year || null
        }))
        .filter(d => d.year != null);
    
    if (numericData.length < 10) {
        container.html('<div class="error">No hi ha suficients dades numèriques per calcular correlacions.</div>');
        return;
    }
    
    // Calcular correlacions
    const variables = ['concentration', 'depth', 'year'];
    const correlations = {};
    
    variables.forEach((var1, i) => {
        variables.slice(i + 1).forEach(var2 => {
            const data1 = numericData.map(d => d[var1]).filter(v => v != null && !isNaN(v));
            const data2 = numericData.map(d => d[var2]).filter(v => v != null && !isNaN(v));
            
            if (data1.length === data2.length && data1.length > 10) {
                const mean1 = d3.mean(data1);
                const mean2 = d3.mean(data2);
                
                let numerator = 0;
                let denom1 = 0;
                let denom2 = 0;
                
                for (let j = 0; j < data1.length; j++) {
                    const diff1 = data1[j] - mean1;
                    const diff2 = data2[j] - mean2;
                    numerator += diff1 * diff2;
                    denom1 += diff1 * diff1;
                    denom2 += diff2 * diff2;
                }
                
                const correlation = numerator / Math.sqrt(denom1 * denom2);
                correlations[`${var1}_${var2}`] = {
                    var1, var2,
                    correlation: isNaN(correlation) ? 0 : correlation
                };
            }
        });
    });
    
    const width = 600;
    const height = 600;
    const margin = { top: 80, right: 80, bottom: 80, left: 80 };
    
    const svg = container.append('svg')
        .attr('width', width)
        .attr('height', height)
        .style('background', '#fafafa');
    
    const cellSize = (width - margin.left - margin.right) / variables.length;
    
    // Crear matriu
    const colorScale = d3.scaleSequential(d3.interpolateRdBu)
        .domain([-1, 1]);
    
    variables.forEach((var1, i) => {
        variables.forEach((var2, j) => {
            const x = margin.left + j * cellSize;
            const y = margin.top + i * cellSize;
            
            let value = 0;
            if (i === j) {
                value = 1; // Correlació perfecta amb si mateix
            } else {
                const key1 = `${var1}_${var2}`;
                const key2 = `${var2}_${var1}`;
                const corr = correlations[key1] || correlations[key2];
                value = corr ? corr.correlation : 0;
            }
            
            // Cèl·lula
            svg.append('rect')
                .attr('x', x)
                .attr('y', y)
                .attr('width', cellSize - 2)
                .attr('height', cellSize - 2)
                .attr('fill', colorScale(value))
                .attr('stroke', '#fff')
                .attr('stroke-width', 2)
                .attr('rx', 4);
            
            // Valor numèric
            svg.append('text')
                .attr('x', x + cellSize / 2)
                .attr('y', y + cellSize / 2)
                .attr('dy', '0.35em')
                .attr('text-anchor', 'middle')
                .style('font-size', '14px')
                .style('font-weight', 'bold')
                .style('fill', Math.abs(value) > 0.5 ? '#fff' : '#333')
                .text(value.toFixed(3));
        });
        
        // Etiquetes de variables
        const labels = {
            'concentration': 'Concentració',
            'depth': 'Profunditat',
            'year': 'Any'
        };
        
        // Etiqueta fila
        svg.append('text')
            .attr('x', margin.left - 10)
            .attr('y', margin.top + i * cellSize + cellSize / 2)
            .attr('dy', '0.35em')
            .attr('text-anchor', 'end')
            .style('font-size', '12px')
            .style('font-weight', 'bold')
            .text(labels[var1] || var1);
        
        // Etiqueta columna
        svg.append('text')
            .attr('x', margin.left + i * cellSize + cellSize / 2)
            .attr('y', margin.top - 10)
            .attr('dy', '0.35em')
            .attr('text-anchor', 'middle')
            .style('font-size', '12px')
            .style('font-weight', 'bold')
            .text(labels[var1] || var1);
    });
    
    // Llegenda
    const legendWidth = 200;
    const legendHeight = 15;
    const legendX = width - margin.right - legendWidth;
    const legendY = margin.top + variables.length * cellSize + 20;
    
    const defs = svg.append('defs');
    const gradient = defs.append('linearGradient')
        .attr('id', 'correlation-gradient')
        .attr('x1', '0%')
        .attr('x2', '100%');
    
    for (let i = 0; i <= 10; i++) {
        const val = -1 + (i / 10) * 2;
        gradient.append('stop')
            .attr('offset', `${(i / 10) * 100}%`)
            .attr('stop-color', colorScale(val));
    }
    
    svg.append('rect')
        .attr('x', legendX)
        .attr('y', legendY)
        .attr('width', legendWidth)
        .attr('height', legendHeight)
        .attr('fill', 'url(#correlation-gradient)')
        .attr('stroke', '#333');
    
    svg.append('text')
        .attr('x', legendX)
        .attr('y', legendY - 5)
        .style('font-size', '11px')
        .style('font-weight', 'bold')
        .text('Coeficient de Correlació');
    
    svg.append('text')
        .attr('x', legendX)
        .attr('y', legendY + legendHeight + 12)
        .style('font-size', '10px')
        .text('-1 (negativa)');
    
    svg.append('text')
        .attr('x', legendX + legendWidth / 2)
        .attr('y', legendY + legendHeight + 12)
        .style('font-size', '10px')
        .style('text-anchor', 'middle')
        .text('0 (no correlació)');
    
    svg.append('text')
        .attr('x', legendX + legendWidth)
        .attr('y', legendY + legendHeight + 12)
        .style('font-size', '10px')
        .style('text-anchor', 'end')
        .text('+1 (positiva)');
}

// Scatterplot matrix (simplificat)
function createScatterplotMatrix(container, processedData) {
    const scatterData = processedData.factors.scatterData || [];
    
    if (!scatterData || scatterData.length === 0) {
        container.html('<div class="error">No hi ha dades per crear el scatterplot matrix.</div>');
        return;
    }
    
    container.append('h3')
        .text('Scatterplot Matrix: Relacions entre Factors')
        .style('margin-bottom', '1rem');
    
    container.append('p')
        .style('color', '#666')
        .style('margin-bottom', '2rem')
        .style('font-size', '14px')
        .text('Matriu de scatterplots mostrant les relacions entre concentració, profunditat i any.');
    
    // Filtrar i preparar dades
    const validData = scatterData
        .filter(d => 
            d.concentration != null && 
            d.depth != null && 
            d.Year != null &&
            d.concentration > 0 && 
            d.depth > 0
        )
        .slice(0, 500); // Limitar per rendiment
    
    if (validData.length < 10) {
        container.html('<div class="error">No hi ha suficients dades vàlides per crear el scatterplot matrix.</div>');
        return;
    }
    
    const variables = [
        { name: 'concentration', label: 'Concentració', key: 'concentration', log: true },
        { name: 'depth', label: 'Profunditat (m)', key: 'depth', log: true },
        { name: 'year', label: 'Any', key: 'Year', log: false }
    ];
    
    const width = 800;
    const height = 800;
    const margin = { top: 60, right: 60, bottom: 60, left: 60 };
    const cellSize = (width - margin.left - margin.right) / variables.length;
    
    const svg = container.append('svg')
        .attr('width', width)
        .attr('height', height)
        .style('background', '#fafafa');
    
    variables.forEach((var1, i) => {
        variables.forEach((var2, j) => {
            const x = margin.left + j * cellSize;
            const y = margin.top + i * cellSize;
            
            const g = svg.append('g')
                .attr('transform', `translate(${x},${y})`);
            
            if (i === j) {
                // Diagonal: histograma o densitat
                const values = validData.map(d => d[var1.key]).filter(v => v != null && !isNaN(v));
                if (values.length === 0) return;
                
                const extent = d3.extent(values);
                const histScale = d3.scaleLinear()
                    .domain(extent)
                    .nice()
                    .range([cellSize - 10, 0]);
                
                const valueScale = d3.scaleLinear()
                    .domain(extent)
                    .nice()
                    .range([5, cellSize - 5]);
                
                const bins = d3.bin()
                    .domain(extent)
                    .thresholds(20)(values);
                
                const maxCount = d3.max(bins.map(b => b.length));
                const countScale = d3.scaleLinear()
                    .domain([0, maxCount])
                    .range([0, cellSize - 10]);
                
                bins.forEach(bin => {
                    if (bin.length > 0) {
                        const x = valueScale(bin.x0);
                        const width = valueScale(bin.x1) - valueScale(bin.x0) - 1;
                        const height = countScale(bin.length);
                        const y = cellSize - 10 - height;
                        
                        g.append('rect')
                            .attr('x', x)
                            .attr('y', y)
                            .attr('width', Math.max(1, width))
                            .attr('height', height)
                            .attr('fill', '#667eea')
                            .attr('opacity', 0.6);
                    }
                });
            } else {
                // Scatterplot
                const scatterData = validData.filter(d => 
                    d[var2.key] != null && 
                    d[var1.key] != null && 
                    !isNaN(d[var2.key]) && 
                    !isNaN(d[var1.key]) &&
                    d[var2.key] > 0 &&
                    d[var1.key] > 0
                );
                
                if (scatterData.length === 0) return;
                
                const xValues = scatterData.map(d => d[var2.key]);
                const yValues = scatterData.map(d => d[var1.key]);
                
                const xExtent = d3.extent(xValues);
                const yExtent = d3.extent(yValues);
                
                if (!xExtent[0] || !xExtent[1] || !yExtent[0] || !yExtent[1]) return;
                
                let xScale, yScale;
                
                try {
                    xScale = var2.log 
                        ? d3.scaleLog().domain(xExtent).nice().range([5, cellSize - 5])
                        : d3.scaleLinear().domain(xExtent).nice().range([5, cellSize - 5]);
                    
                    yScale = var1.log 
                        ? d3.scaleLog().domain(yExtent).nice().range([cellSize - 5, 5])
                        : d3.scaleLinear().domain(yExtent).nice().range([cellSize - 5, 5]);
                } catch (e) {
                    console.warn('Error creating scales:', e);
                    return;
                }
                
                // Filtrar dades vàlides per les escales
                const validScatterData = scatterData
                    .slice(0, 300)
                    .filter(d => {
                        try {
                            const xVal = xScale(d[var2.key]);
                            const yVal = yScale(d[var1.key]);
                            return !isNaN(xVal) && !isNaN(yVal) && isFinite(xVal) && isFinite(yVal) &&
                                   xVal >= 0 && xVal <= cellSize && yVal >= 0 && yVal <= cellSize;
                        } catch {
                            return false;
                        }
                    });
                
                // Punts (limitats per rendiment)
                g.selectAll('circle')
                    .data(validScatterData)
                    .enter()
                    .append('circle')
                    .attr('cx', d => xScale(d[var2.key]))
                    .attr('cy', d => yScale(d[var1.key]))
                    .attr('r', 1.5)
                    .attr('fill', '#667eea')
                    .attr('opacity', 0.4)
                    .attr('stroke', 'none');
                
                // Eixos
                try {
                    if (i === variables.length - 1) {
                        g.append('g')
                            .attr('transform', `translate(0,${cellSize - 5})`)
                            .call(d3.axisBottom(xScale).ticks(3))
                            .selectAll('text')
                            .style('font-size', '8px');
                    }
                    
                    if (j === 0) {
                        g.append('g')
                            .attr('transform', `translate(5,0)`)
                            .call(d3.axisLeft(yScale).ticks(3))
                            .selectAll('text')
                            .style('font-size', '8px');
                    }
                } catch (e) {
                    console.warn('Error creating axes:', e);
                }
            }
            
            // Etiquetes
            if (j === 0 && i > 0) {
                g.append('text')
                    .attr('x', -5)
                    .attr('y', cellSize / 2)
                    .attr('dy', '0.35em')
                    .attr('text-anchor', 'end')
                    .style('font-size', '10px')
                    .style('font-weight', 'bold')
                    .text(var1.label);
            }
            
            if (i === 0 && j > 0) {
                g.append('text')
                    .attr('x', cellSize / 2)
                    .attr('y', -10)
                    .attr('dy', '0.35em')
                    .attr('text-anchor', 'middle')
                    .style('font-size', '10px')
                    .style('font-weight', 'bold')
                    .text(var2.label);
            }
        });
    });
}

// Parallel Coordinates Plot
function createParallelCoordinates(container, processedData) {
    const parallelData = processedData.factors.parallelData || [];
    
    if (!parallelData || parallelData.length === 0) {
        container.html('<div class="error">No hi ha dades per crear el parallel coordinates plot.</div>');
        return;
    }
    
    container.append('h3')
        .text('Parallel Coordinates: Relacions Multi-Dimensionals')
        .style('margin-bottom', '1rem');
    
    container.append('p')
        .style('color', '#666')
        .style('margin-bottom', '1rem')
        .style('margin-top', '0.5rem')
        .style('font-size', '14px')
        .style('line-height', '1.6')
        .html(`
            <strong>Processament de dades:</strong> Cada línia representa una mostra individual, connectant els seus valors a través de 
            múltiples dimensions (concentració, profunditat, any, oceà). Les dimensions numèriques utilitzen escales logarítmiques 
            quan és apropiat per visualitzar millor el rang ampli de valors. Les línies es codifiquen per color segons l'oceà d'origen. 
            Aquesta visualització permet identificar patrons i relacions complexes entre múltiples factors simultàniament. 
            Passa el cursor sobre una línia per veure els detalls de la mostra.
        `);
    
    // Filtrar dades vàlides
    const validData = parallelData.filter(d => 
        d.concentration != null && 
        d.concentration > 0 &&
        d.Year != null
    ).slice(0, 300); // Limitar per rendiment
    
    if (validData.length === 0) {
        container.html('<div class="error">No hi ha dades vàlides per mostrar.</div>');
        return;
    }
    
    const width = 1000;
    const height = 500;
    const margin = { top: 40, right: 40, bottom: 60, left: 60 };
    
    const svg = container.append('svg')
        .attr('width', width)
        .attr('height', height)
        .style('background', '#fafafa');
    
    // Definir dimensions
    const dimensions = [
        { name: 'concentration', label: 'Concentració', key: 'concentration', type: 'numeric', log: true },
        { name: 'depth', label: 'Profunditat (m)', key: 'depth', type: 'numeric', log: true },
        { name: 'year', label: 'Any', key: 'Year', type: 'numeric', log: false },
        { name: 'ocean', label: 'Oceà', key: 'ocean', type: 'categorical' }
    ];
    
    // Filtrar dimensions disponibles
    const availableDims = dimensions.filter(dim => {
        if (dim.type === 'numeric') {
            const values = validData.map(d => d[dim.key]).filter(v => v != null && !isNaN(v) && v > 0);
            return values.length > 0;
        } else {
            const values = validData.map(d => d[dim.key]).filter(v => v != null && v !== '');
            return values.length > 0;
        }
    });
    
    if (availableDims.length < 2) {
        container.html('<div class="error">No hi ha suficients dimensions vàlides per crear el parallel coordinates plot.</div>');
        return;
    }
    
    const xScale = d3.scalePoint()
        .domain(availableDims.map(d => d.name))
        .range([margin.left, width - margin.right]);
    
    // Crear escales per cada dimensió
    const yScales = {};
    availableDims.forEach(dim => {
        if (dim.type === 'numeric') {
            const values = validData.map(d => d[dim.key]).filter(v => v != null && !isNaN(v) && v > 0);
            if (values.length > 0) {
                const extent = d3.extent(values);
                if (dim.log) {
                    yScales[dim.name] = d3.scaleLog()
                        .domain(extent)
                        .nice()
                        .range([height - margin.bottom, margin.top]);
                } else {
                    yScales[dim.name] = d3.scaleLinear()
                        .domain(extent)
                        .nice()
                        .range([height - margin.bottom, margin.top]);
                }
            }
        } else {
            const values = Array.from(new Set(validData.map(d => d[dim.key]).filter(v => v != null && v !== '')));
            if (values.length > 0) {
                yScales[dim.name] = d3.scalePoint()
                    .domain(values)
                    .range([height - margin.bottom, margin.top])
                    .padding(0.5);
            }
        }
    });
    
    // Color scale per oceà
    const oceans = Array.from(new Set(validData.map(d => d.ocean).filter(v => v != null && v !== '')));
    const colorScale = d3.scaleOrdinal(d3.schemeCategory10)
        .domain(oceans);
    
    // Crear línies
    const line = d3.line()
        .defined((d, i) => {
            const dim = availableDims[i];
            const value = d[dim.key];
            return value != null && value !== '' && !isNaN(value) && 
                   (dim.type === 'categorical' || (dim.type === 'numeric' && value > 0));
        })
        .x((d, i) => xScale(availableDims[i].name))
        .y((d, i) => {
            const dim = availableDims[i];
            const value = d[dim.key];
            if (value == null || value === '' || isNaN(value)) return null;
            const scale = yScales[dim.name];
            if (!scale) return null;
            
            if (dim.type === 'numeric' && value <= 0) return null;
            try {
                return scale(value);
            } catch {
                return null;
            }
        })
        .curve(d3.curveMonotoneX);
    
    // Filtrar dades vàlides per al plot
    const plotData = validData.filter(d => {
        // Almenys 2 dimensions vàlides
        const validCount = availableDims.filter(dim => {
            const value = d[dim.key];
            return value != null && value !== '' && !isNaN(value) && 
                   (dim.type === 'categorical' || (dim.type === 'numeric' && value > 0));
        }).length;
        return validCount >= 2;
    });
    
    // Crear paths per cada mostra
    const paths = svg.append('g')
        .attr('class', 'parallel-lines')
        .selectAll('path')
        .data(plotData)
        .enter()
        .append('path')
        .attr('d', d => {
            const points = availableDims.map(dim => ({ [dim.key]: d[dim.key], key: dim.key }));
            return line(points.map(p => p));
        })
        .attr('fill', 'none')
        .attr('stroke', d => colorScale(d.ocean) || '#999')
        .attr('stroke-width', 1)
        .attr('opacity', 0.3)
        .on('mouseover', function(event, d) {
            d3.selectAll('.parallel-lines path').attr('opacity', 0.1);
            d3.select(this).attr('opacity', 1).attr('stroke-width', 2);
            
            const tooltip = container.append('div')
                .attr('class', 'tooltip')
                .style('position', 'absolute')
                .style('background', 'rgba(0,0,0,0.9)')
                .style('color', 'white')
                .style('padding', '10px')
                .style('border-radius', '5px')
                .style('pointer-events', 'none')
                .style('z-index', 1000);
            
            tooltip.html(`
                <strong>Mostra</strong><br>
                ${d.ocean ? `Oceà: ${d.ocean}<br>` : ''}
                ${d.method ? `Mètode: ${d.method}<br>` : ''}
                ${d.marineSetting ? `Ambient: ${d.marineSetting}<br>` : ''}
                Concentració: ${d.concentration ? d.concentration.toFixed(4) : 'N/A'} pieces/m³<br>
                ${d.depth ? `Profunditat: ${d.depth.toFixed(2)} m<br>` : ''}
                ${d.Year ? `Any: ${d.Year}` : ''}
            `);
        })
        .on('mousemove', function(event) {
            const tooltip = container.select('.tooltip');
            tooltip
                .style('left', (event.pageX + 10) + 'px')
                .style('top', (event.pageY + 10) + 'px');
        })
        .on('mouseout', function() {
            d3.selectAll('.parallel-lines path').attr('opacity', 0.3);
            d3.select(this).attr('stroke-width', 1);
            container.select('.tooltip').remove();
        });
    
    // Crear eixos per cada dimensió
    availableDims.forEach(dim => {
        const g = svg.append('g')
            .attr('class', `axis axis-${dim.name}`)
            .attr('transform', `translate(${xScale(dim.name)},0)`);
        
        const scale = yScales[dim.name];
        if (!scale) return;
        
        if (dim.type === 'numeric') {
            g.call(d3.axisLeft(scale).ticks(5));
        } else {
            g.call(d3.axisLeft(scale));
        }
        
        // Etiqueta de dimensió
        g.append('text')
            .attr('text-anchor', 'middle')
            .attr('y', -10)
            .attr('x', 0)
            .style('font-size', '12px')
            .style('font-weight', 'bold')
            .text(dim.label);
    });
    
    // Llegenda de colors per oceans
    if (oceans.length > 0) {
        const legendWidth = 200;
        const legendHeight = 20 * oceans.length;
        const legendX = width - margin.right - legendWidth;
        const legendY = margin.top;
        
        const legend = svg.append('g')
            .attr('class', 'legend')
            .attr('transform', `translate(${legendX},${legendY})`);
        
        legend.append('text')
            .attr('x', 0)
            .attr('y', 0)
            .style('font-size', '12px')
            .style('font-weight', 'bold')
            .text('Oceans');
        
        oceans.forEach((ocean, i) => {
            const legendItem = legend.append('g')
                .attr('transform', `translate(0,${20 + i * 20})`);
            
            legendItem.append('line')
                .attr('x1', 0)
                .attr('x2', 15)
                .attr('y1', 0)
                .attr('y2', 0)
                .attr('stroke', colorScale(ocean))
                .attr('stroke-width', 2);
            
            legendItem.append('text')
                .attr('x', 20)
                .attr('y', 5)
                .style('font-size', '11px')
                .text(ocean || 'N/A');
        });
    }
}

// Sankey Diagram per flux entre factors
function createSankeyDiagram(container, processedData) {
    const sankeyData = processedData.factors.sankeyData || [];
    
    if (!sankeyData || sankeyData.length === 0) {
        container.html('<div class="error">No hi ha dades per crear el diagrama Sankey.</div>');
        return;
    }
    
    container.append('h3')
        .text('Diagrama Sankey: Flux entre Factors')
        .style('margin-bottom', '1rem');
    
    container.append('p')
        .style('color', '#666')
        .style('margin-bottom', '2rem')
        .style('font-size', '14px')
        .text('Visualització del flux de dades entre mètode de mostreig, ambient marí i rang de concentració.');
    
    // Preparar dades per Sankey (simplificat: només top combinacions)
    const topData = sankeyData
        .sort((a, b) => (b.count || 0) - (a.count || 0))
        .slice(0, 30); // Top 30 combinacions
    
    if (topData.length === 0) {
        container.html('<div class="error">No hi ha dades vàlides per mostrar.</div>');
        return;
    }
    
    // Crear nodes (únics)
    const methodNodes = Array.from(new Set(topData.map(d => d.method))).filter(v => v != null && v !== '');
    const settingNodes = Array.from(new Set(topData.map(d => d.marineSetting))).filter(v => v != null && v !== '');
    const rangeNodes = Array.from(new Set(topData.map(d => d.concentration_range))).filter(v => v != null && v !== '');
    
    // Crear índexs de nodes
    const nodeIndex = {};
    let nodeIdx = 0;
    
    methodNodes.forEach(method => {
        nodeIndex[`method_${method}`] = nodeIdx++;
    });
    settingNodes.forEach(setting => {
        nodeIndex[`setting_${setting}`] = nodeIdx++;
    });
    rangeNodes.forEach(range => {
        nodeIndex[`range_${range}`] = nodeIdx++;
    });
    
    // Crear links
    const links = [];
    topData.forEach(d => {
        if (d.method && d.marineSetting && d.concentration_range && d.count > 0) {
            const sourceId = `method_${d.method}`;
            const targetId = `setting_${d.marineSetting}`;
            const rangeId = `range_${d.concentration_range}`;
            
            if (nodeIndex[sourceId] != null && nodeIndex[targetId] != null) {
                links.push({
                    source: nodeIndex[sourceId],
                    target: nodeIndex[targetId],
                    value: d.count,
                    method: d.method,
                    setting: d.marineSetting
                });
            }
            
            if (nodeIndex[targetId] != null && nodeIndex[rangeId] != null) {
                links.push({
                    source: nodeIndex[targetId],
                    target: nodeIndex[rangeId],
                    value: d.count,
                    setting: d.marineSetting,
                    range: d.concentration_range
                });
            }
        }
    });
    
    // Agregar links per node pair
    const linkMap = {};
    links.forEach(link => {
        const key = `${link.source}-${link.target}`;
        if (!linkMap[key]) {
            linkMap[key] = { ...link, value: 0 };
        }
        linkMap[key].value += link.value;
    });
    
    const aggregatedLinks = Object.values(linkMap);
    
    // Crear nodes array
    const nodes = [];
    methodNodes.forEach(method => nodes.push({ name: method, type: 'method' }));
    settingNodes.forEach(setting => nodes.push({ name: setting, type: 'setting' }));
    rangeNodes.forEach(range => nodes.push({ name: range, type: 'range' }));
    
    const width = 1000;
    const height = 600;
    const margin = { top: 20, right: 40, bottom: 20, left: 40 };
    
    const svg = container.append('svg')
        .attr('width', width)
        .attr('height', height)
        .style('background', '#fafafa');
    
    // Posicionar nodes en columnes
    const nodeWidth = 200;
    const nodeHeight = 20;
    const nodePadding = 5;
    const columnWidth = (width - margin.left - margin.right - 2 * nodeWidth) / 2;
    
    let methodY = margin.top;
    methodNodes.forEach((method, i) => {
        nodes[i].x = margin.left;
        nodes[i].y = methodY;
        methodY += nodeHeight + nodePadding;
    });
    
    let settingY = margin.top;
    settingNodes.forEach((setting, i) => {
        const idx = methodNodes.length + i;
        nodes[idx].x = margin.left + nodeWidth + columnWidth;
        nodes[idx].y = settingY;
        settingY += nodeHeight + nodePadding;
    });
    
    let rangeY = margin.top;
    rangeNodes.forEach((range, i) => {
        const idx = methodNodes.length + settingNodes.length + i;
        nodes[idx].x = margin.left + nodeWidth + columnWidth * 2 + nodeWidth;
        nodes[idx].y = rangeY;
        rangeY += nodeHeight + nodePadding;
    });
    
    // Color scale per tipus
    const typeColor = {
        'method': '#667eea',
        'setting': '#f093fb',
        'range': '#f5576c'
    };
    
    // Crear paths per links (Sankey simplificat)
    const maxValue = d3.max(aggregatedLinks, d => d.value);
    const linkScale = d3.scaleLinear()
        .domain([0, maxValue])
        .range([2, 20]);
    
    aggregatedLinks.forEach(link => {
        const source = nodes[link.source];
        const target = nodes[link.target];
        
        if (!source || !target) return;
        
        // Crear path curvat (simplificat)
        const path = svg.append('path')
            .datum(link)
            .attr('d', () => {
                const x1 = source.x + nodeWidth;
                const y1 = source.y + nodeHeight / 2;
                const x2 = target.x;
                const y2 = target.y + nodeHeight / 2;
                const xmid = (x1 + x2) / 2;
                
                return `M ${x1} ${y1} C ${xmid} ${y1}, ${xmid} ${y2}, ${x2} ${y2}`;
            })
            .attr('fill', 'none')
            .attr('stroke', '#999')
            .attr('stroke-width', d => linkScale(d.value))
            .attr('opacity', 0.4)
            .lower();
    });
    
    // Crear nodes (rectangles)
    const nodeGroups = svg.selectAll('.sankey-node')
        .data(nodes)
        .enter()
        .append('g')
        .attr('class', 'sankey-node')
        .attr('transform', d => `translate(${d.x},${d.y})`);
    
    nodeGroups.append('rect')
        .attr('width', nodeWidth)
        .attr('height', nodeHeight)
        .attr('fill', d => typeColor[d.type] || '#999')
        .attr('opacity', 0.8)
        .attr('stroke', '#333')
        .attr('stroke-width', 1);
    
    nodeGroups.append('text')
        .attr('x', nodeWidth / 2)
        .attr('y', nodeHeight / 2)
        .attr('dy', '0.35em')
        .attr('text-anchor', 'middle')
        .style('font-size', '10px')
        .style('fill', '#333')
        .text(d => {
            const name = d.name || 'N/A';
            return name.length > 25 ? name.substring(0, 22) + '...' : name;
        });
    
    // Etiquetes de columnes
    svg.append('text')
        .attr('x', margin.left + nodeWidth / 2)
        .attr('y', margin.top - 5)
        .attr('text-anchor', 'middle')
        .style('font-size', '12px')
        .style('font-weight', 'bold')
        .text('Mètode');
    
    svg.append('text')
        .attr('x', margin.left + nodeWidth + columnWidth + nodeWidth / 2)
        .attr('y', margin.top - 5)
        .attr('text-anchor', 'middle')
        .style('font-size', '12px')
        .style('font-weight', 'bold')
        .text('Ambient Marí');
    
    svg.append('text')
        .attr('x', margin.left + nodeWidth + columnWidth * 2 + nodeWidth / 2)
        .attr('y', margin.top - 5)
        .attr('text-anchor', 'middle')
        .style('font-size', '12px')
        .style('font-weight', 'bold')
        .text('Rang Concentració');
    
    // Llegenda
    const legend = svg.append('g')
        .attr('class', 'legend')
        .attr('transform', `translate(${width - margin.right - 150},${margin.top + 50})`);
    
    Object.entries(typeColor).forEach(([type, color], i) => {
        const item = legend.append('g')
            .attr('transform', `translate(0,${i * 25})`);
        
        item.append('rect')
            .attr('width', 15)
            .attr('height', 15)
            .attr('fill', color)
            .attr('opacity', 0.8);
        
        const labels = {
            'method': 'Mètode',
            'setting': 'Ambient',
            'range': 'Rang'
        };
        
        item.append('text')
            .attr('x', 20)
            .attr('y', 12)
            .style('font-size', '11px')
            .text(labels[type] || type);
    });
}


// Visualització de factors que influeixen
// d3 està disponible globalment des de index.html



function initFactorsViz(selector, processedData) {
    const container = d3.select(selector);
    container.html('<div class="loading">Carregant visualitzacions de factors...</div>');
    
    // Netejar el loader i crear contenidor únic per a totes les visualitzacions
    container.html('');
    const contentContainer = container.append('div')
        .attr('class', 'factors-content');
    
    // Inicialitzar totes les visualitzacions en ordre
    createMethodViolinPlot(contentContainer, processedData);
    
    // Afegir separador visual
    contentContainer.append('hr')
        .style('margin', '4rem 0 2rem 0')
        .style('border', 'none')
        .style('border-top', '2px solid #e0e0e0');
    
    createMethodDiversityViz(contentContainer, processedData);
    
    // Afegir separador visual
    contentContainer.append('hr')
        .style('margin', '4rem 0 2rem 0')
        .style('border', 'none')
        .style('border-top', '2px solid #e0e0e0');
    
    createIGRMViz(contentContainer, processedData);
    
    // Afegir separador visual
    contentContainer.append('hr')
        .style('margin', '4rem 0 2rem 0')
        .style('border', 'none')
        .style('border-top', '2px solid #e0e0e0');
    
    createTreemapViz(contentContainer, processedData);
    
    // Afegir separador visual
    contentContainer.append('hr')
        .style('margin', '4rem 0 2rem 0')
        .style('border', 'none')
        .style('border-top', '2px solid #e0e0e0');
    
    createParallelCoordinates(contentContainer, processedData);
}

// Funció eliminada: createDepthScatter - eliminat per ser redundant (correlació molt feble)
// La funció createDepthScatter ja no s'utilitza
function _createDepthScatter_ELIMINADA(container, processedData) {
    const scatterData = processedData.factors.scatterData || [];
    const depthCorr = processedData.factors.depthCorrelation;
    
    container.append('h3')
        .text('Relació entre Profunditat i Concentració')
        .style('margin-bottom', '1rem');
    
    container.append('p')
        .style('color', '#666')
        .style('margin-bottom', '2rem')
        .style('font-size', '14px')
        .text('Anàlisi de la relació entre la profunditat de mostreig i la concentració de microplàstics. Utilitza escales logarítmiques per visualitzar millor la distribució dels valors.');
    
    // Filtrar dades amb profunditat vàlida
    const depthData = scatterData.filter(d => 
        d.depth != null && 
        d.depth > 0 && 
        d.concentration != null &&
        d.concentration > 0
    );
    
    if (depthData.length === 0) {
        container.html('<div class="error">No hi ha dades vàlides de profunditat disponibles.</div>');
        return;
    }
    
    // Scatterplot profunditat vs concentració
    const width = 800;
    const height = 500;
    const margin = { top: 20, right: 20, bottom: 60, left: 60 };
    
    const svg = container
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .attr('viewBox', `0 0 ${width} ${height}`)
        .style('background', '#fafafa');
    
    // Escales
    const xScale = d3.scaleLog()
        .domain(d3.extent(depthData, d => d.depth))
        .nice()
        .range([margin.left, width - margin.right]);
    
    const yScale = d3.scaleLog()
        .domain(d3.extent(depthData, d => d.concentration))
        .nice()
        .range([height - margin.bottom, margin.top]);
    
    // Punts
    svg.selectAll('circle')
        .data(depthData)
        .enter()
        .append('circle')
        .attr('cx', d => xScale(d.depth))
        .attr('cy', d => yScale(d.concentration))
        .attr('r', 3)
        .attr('fill', '#667eea')
        .attr('opacity', 0.5)
        .attr('stroke', '#333')
        .attr('stroke-width', 0.5)
        .on('mouseover', function(event, d) {
            d3.select(this).attr('opacity', 1).attr('r', 5);
            
            const tooltip = container.append('div')
                .attr('class', 'tooltip')
                .style('position', 'absolute')
                .style('background', 'rgba(0,0,0,0.8)')
                .style('color', 'white')
                .style('padding', '10px')
                .style('border-radius', '5px')
                .style('pointer-events', 'none')
                .style('z-index', 1000);
            
            tooltip.html(`
                Profunditat: ${d.depth.toFixed(2)} m<br>
                Concentració: ${d.concentration.toFixed(2)} pieces/m³<br>
                ${d.region ? `Regió: ${d.region}` : ''}
            `);
        })
        .on('mousemove', function(event) {
            const tooltip = container.select('.tooltip');
            tooltip
                .style('left', (event.pageX + 10) + 'px')
                .style('top', (event.pageY - 10) + 'px');
        })
        .on('mouseout', function() {
            d3.select(this).attr('opacity', 0.5).attr('r', 3);
            container.select('.tooltip').remove();
        });
    
    // Eixos
    svg.append('g')
        .attr('transform', `translate(0,${height - margin.bottom})`)
        .call(d3.axisBottom(xScale))
        .append('text')
        .attr('x', width / 2)
        .attr('y', 40)
        .style('text-anchor', 'middle')
        .text('Profunditat (m) - escala logarítmica');
    
    svg.append('g')
        .attr('transform', `translate(${margin.left},0)`)
        .call(d3.axisLeft(yScale))
        .append('text')
        .attr('transform', 'rotate(-90)')
        .attr('y', -40)
        .attr('x', -height / 2)
        .style('text-anchor', 'middle')
        .text('Concentració (pieces/m³) - escala logarítmica');
    
    // Informació de correlació
    const corrInfo = container.append('div')
        .style('margin-top', '2rem')
        .style('padding', '1rem')
        .style('background', '#e3f2fd')
        .style('border-radius', '5px');
    
    if (depthCorr.correlation != null) {
        corrInfo.html(`
            <h4>Correlació Profunditat-Concentració</h4>
            <p><strong>Coeficient de correlació:</strong> ${depthCorr.correlation.toFixed(3)}</p>
            <p><strong>Força:</strong> ${depthCorr.strength === 'strong' ? 'Forta' : 
                                        depthCorr.strength === 'moderate' ? 'Moderada' : 'Feble'}</p>
            <p><strong>Direcció:</strong> ${depthCorr.direction === 'positive' ? 'Positiva' : 'Negativa'}</p>
            <p><strong>Nombre de mostres:</strong> ${depthCorr.nSamples}</p>
            <p><em>Una correlació positiva indica que a major profunditat, major concentració. 
            Una correlació negativa indica el contrari.</em></p>
        `);
    } else {
        corrInfo.html(`
            <p>No hi ha suficients dades per calcular la correlació (es requereixen almenys 10 mostres vàlides).</p>
        `);
    }
}

// Funció per crear visualització de Diversitat de Mètodes
function createMethodDiversityViz(container, processedData) {
    const diversityData = processedData.factors.methodDiversity || [];
    
    if (!diversityData || diversityData.length === 0) {
        container.html('<div class="error">No hi ha dades de diversitat de mètodes disponibles.</div>');
        return;
    }
    
    container.append('h3')
        .text('Índex de Diversitat de Mètodes de Mostreig per Regió')
        .style('margin-bottom', '1rem');
    
    container.append('p')
        .style('color', '#666')
        .style('margin-bottom', '1rem')
        .style('margin-top', '0.5rem')
        .style('font-size', '14px')
        .style('line-height', '1.6')
        .html(`
            <strong>Índex de Diversitat de Mètodes:</strong> Mesura la varietat de mètodes de mostreig utilitzats per regió, 
            utilitzant l'índex de Shannon (H'). Valors més alts indiquen major diversitat de mètodes, 
            cosa que suggereix dades més robustes i representatives. L'índex està normalitzat de 0 a 1, 
            on 1 representa la màxima diversitat possible (tots els mètodes igualment representats).
        `);
    
    // Filtrar i ordenar dades
    const validData = diversityData
        .filter(d => d.normalizedDiversity != null && !isNaN(d.normalizedDiversity))
        .sort((a, b) => b.normalizedDiversity - a.normalizedDiversity);
    
    if (validData.length === 0) {
        container.append('p')
            .style('color', '#999')
            .style('font-style', 'italic')
            .text('No hi ha dades vàlides de diversitat.');
        return;
    }
    
    const width = 1000;
    const height = Math.max(400, validData.length * 30);
    const margin = { top: 20, right: 20, bottom: 100, left: 80 };
    
    const svg = container.append('svg')
        .attr('width', width)
        .attr('height', height)
        .attr('viewBox', `0 0 ${width} ${height}`)
        .style('background', '#fafafa');
    
    const xScale = d3.scaleLinear()
        .domain([0, 1])
        .nice()
        .range([margin.left, width - margin.right]);
    
    const yScale = d3.scaleBand()
        .domain(validData.map(d => d.region || `${d.ocean} (general)`))
        .range([margin.top, height - margin.bottom])
        .padding(0.2);
    
    // Escala de colors per diversitat
    const colorScale = d3.scaleSequential(d3.interpolateRdYlGn)
        .domain([1, 0]); // Invertit: verd = alta diversitat, vermell = baixa
    
    // Barres
    svg.selectAll('rect')
        .data(validData)
        .enter()
        .append('rect')
        .attr('x', margin.left)
        .attr('y', d => yScale(d.region || `${d.ocean} (general)`))
        .attr('width', d => xScale(d.normalizedDiversity) - margin.left)
        .attr('height', yScale.bandwidth())
        .attr('fill', d => colorScale(d.normalizedDiversity))
        .attr('stroke', '#fff')
        .attr('stroke-width', 1.5)
        .attr('opacity', 0.9)
        .on('mouseover', function(event, d) {
            d3.select(this).attr('opacity', 1).attr('stroke', '#000').attr('stroke-width', 2);
            
            const tooltip = container.append('div')
                .attr('class', 'tooltip')
                .style('position', 'absolute')
                .style('background', 'rgba(0,0,0,0.9)')
                .style('color', 'white')
                .style('padding', '10px')
                .style('border-radius', '5px')
                .style('pointer-events', 'none')
                .style('z-index', 1000);
            
            const methodsList = Object.entries(d.methodDistribution || {})
                .map(([method, count]) => `${method}: ${count}`)
                .join('<br>');
            
            tooltip.html(`
                <strong>${d.region || `${d.ocean} (general)`}</strong><br>
                Diversitat normalitzada: ${d.normalizedDiversity.toFixed(3)}<br>
                Índex de Shannon: ${d.shannonIndex.toFixed(3)}<br>
                Nombre de mètodes: ${d.nMethods}<br>
                Mostres totals: ${d.nSamples}<br>
                <br><strong>Distribució de mètodes:</strong><br>
                ${methodsList || 'No disponible'}
            `);
        })
        .on('mousemove', function(event) {
            const tooltip = container.select('.tooltip');
            tooltip
                .style('left', (event.pageX + 10) + 'px')
                .style('top', (event.pageY - 10) + 'px');
        })
        .on('mouseout', function() {
            d3.select(this).attr('opacity', 0.9).attr('stroke', '#fff').attr('stroke-width', 1.5);
            container.select('.tooltip').remove();
        });
    
    // Valors sobre les barres
    svg.selectAll('.diversity-value')
        .data(validData)
        .enter()
        .append('text')
        .attr('class', 'diversity-value')
        .attr('x', d => xScale(d.normalizedDiversity) + 5)
        .attr('y', d => yScale(d.region || `${d.ocean} (general)`) + yScale.bandwidth() / 2)
        .attr('dy', '0.35em')
        .attr('font-size', '10px')
        .attr('font-weight', 'bold')
        .attr('fill', '#333')
        .text(d => d.normalizedDiversity.toFixed(3));
    
    // Eixos
    svg.append('g')
        .attr('transform', `translate(0,${height - margin.bottom})`)
        .call(d3.axisBottom(xScale).tickFormat(d3.format('.2f')));
    
    svg.append('g')
        .attr('transform', `translate(${margin.left},0)`)
        .call(d3.axisLeft(yScale));
    
    svg.append('text')
        .attr('x', width / 2)
        .attr('y', height - 10)
        .style('text-anchor', 'middle')
        .style('font-size', '12px')
        .text('Diversitat Normalitzada (0-1)');
    
    svg.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('y', 15)
        .attr('x', -height / 2)
        .style('text-anchor', 'middle')
        .style('font-size', '12px')
        .text('Regió');
}

// Funció per crear visualització de IGRM
function createIGRMViz(container, processedData) {
    const igrmData = processedData.factors.IGRM || [];
    
    if (!igrmData || igrmData.length === 0) {
        container.html('<div class="error">No hi ha dades d\'IGRM disponibles.</div>');
        return;
    }
    
    container.append('h3')
        .text('IGRM Simplificat (Índex Global de Risc de Microplàstics) per Regió')
        .style('margin-bottom', '1rem');
    
    container.append('p')
        .style('color', '#666')
        .style('margin-bottom', '1rem')
        .style('margin-top', '0.5rem')
        .style('font-size', '14px')
        .style('line-height', '1.6')
        .html(`
            <strong>IGRM Simplificat:</strong> Mètrica composta que integra l'ICR (40%), la completitud de dades inversa (30%) 
            i la diversitat de mètodes inversa (30%). Valors més alts indiquen major risc de contaminació per microplàstics. 
            Aquest índex combina múltiples dimensions per proporcionar una visió global del risc per regió.
        `);
    
    // Filtrar i ordenar dades
    const validData = igrmData
        .filter(d => d.IGRM != null && !isNaN(d.IGRM))
        .sort((a, b) => b.IGRM - a.IGRM);
    
    if (validData.length === 0) {
        container.append('p')
            .style('color', '#999')
            .style('font-style', 'italic')
            .text('No hi ha dades vàlides d\'IGRM.');
        return;
    }
    
    const width = 1000;
    const height = Math.max(400, validData.length * 30);
    const margin = { top: 20, right: 20, bottom: 100, left: 80 };
    
    const svg = container.append('svg')
        .attr('width', width)
        .attr('height', height)
        .attr('viewBox', `0 0 ${width} ${height}`)
        .style('background', '#fafafa');
    
    const xScale = d3.scaleLinear()
        .domain([0, d3.max(validData, d => d.IGRM) * 1.1])
        .nice()
        .range([margin.left, width - margin.right]);
    
    const yScale = d3.scaleBand()
        .domain(validData.map(d => d.region || `${d.ocean} (general)`))
        .range([margin.top, height - margin.bottom])
        .padding(0.2);
    
    // Escala de colors per IGRM (similar a la del mapa)
    const igrmMax = d3.max(validData, d => d.IGRM);
    const colorScale = (value) => {
        const normalized = value / igrmMax;
        if (normalized < 0.2) return '#2ecc71'; // Verd
        if (normalized < 0.4) return '#f1c40f'; // Groc
        if (normalized < 0.6) return '#e67e22'; // Taronja
        if (normalized < 0.8) return '#e74c3c'; // Vermell
        return '#8e44ad'; // Morat
    };
    
    // Barres
    svg.selectAll('rect')
        .data(validData)
        .enter()
        .append('rect')
        .attr('x', margin.left)
        .attr('y', d => yScale(d.region || `${d.ocean} (general)`))
        .attr('width', d => xScale(d.IGRM) - margin.left)
        .attr('height', yScale.bandwidth())
        .attr('fill', d => colorScale(d.IGRM))
        .attr('stroke', '#fff')
        .attr('stroke-width', 1.5)
        .attr('opacity', 0.9)
        .on('mouseover', function(event, d) {
            d3.select(this).attr('opacity', 1).attr('stroke', '#000').attr('stroke-width', 2);
            
            const tooltip = container.append('div')
                .attr('class', 'tooltip')
                .style('position', 'absolute')
                .style('background', 'rgba(0,0,0,0.9)')
                .style('color', 'white')
                .style('padding', '10px')
                .style('border-radius', '5px')
                .style('pointer-events', 'none')
                .style('z-index', 1000);
            
            tooltip.html(`
                <strong>${d.region || `${d.ocean} (general)`}</strong><br>
                IGRM: ${d.IGRM.toFixed(3)}<br>
                ICR: ${(d.ICR || 0).toFixed(3)}<br>
                Completitud: ${(d.completenessIndex || 0).toFixed(2)}%<br>
                Diversitat: ${(d.normalizedDiversity || 0).toFixed(3)}<br>
                Concentració mitjana: ${(d.meanConcentration || 0).toLocaleString('ca-ES', {maximumFractionDigits: 2})} pieces/m³<br>
                Mostres: ${d.nSamples || 0}
            `);
        })
        .on('mousemove', function(event) {
            const tooltip = container.select('.tooltip');
            tooltip
                .style('left', (event.pageX + 10) + 'px')
                .style('top', (event.pageY - 10) + 'px');
        })
        .on('mouseout', function() {
            d3.select(this).attr('opacity', 0.9).attr('stroke', '#fff').attr('stroke-width', 1.5);
            container.select('.tooltip').remove();
        });
    
    // Valors sobre les barres
    svg.selectAll('.igrm-value')
        .data(validData)
        .enter()
        .append('text')
        .attr('class', 'igrm-value')
        .attr('x', d => xScale(d.IGRM) + 5)
        .attr('y', d => yScale(d.region || `${d.ocean} (general)`) + yScale.bandwidth() / 2)
        .attr('dy', '0.35em')
        .attr('font-size', '10px')
        .attr('font-weight', 'bold')
        .attr('fill', '#333')
        .text(d => d.IGRM.toFixed(3));
    
    // Eixos
    svg.append('g')
        .attr('transform', `translate(0,${height - margin.bottom})`)
        .call(d3.axisBottom(xScale).tickFormat(d3.format('.2f')));
    
    svg.append('g')
        .attr('transform', `translate(${margin.left},0)`)
        .call(d3.axisLeft(yScale));
    
    svg.append('text')
        .attr('x', width / 2)
        .attr('y', height - 10)
        .style('text-anchor', 'middle')
        .style('font-size', '12px')
        .text('IGRM (0-1)');
    
    svg.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('y', 15)
        .attr('x', -height / 2)
        .style('text-anchor', 'middle')
        .style('font-size', '12px')
        .text('Regió');
}


// Main application file
// Carrega les dades i inicialitza la visualització
// d3 està disponible globalment des de index.html



// Comentat: només utilitzem la visualització bàsica per ara
// 
// 
// 



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
