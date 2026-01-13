// Visualització de distribució geogràfica
// d3 està disponible globalment des de index.html

export function initGeographicViz(selector, processedData) {
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
export function initGeographicSmallMultiples(selector, processedData) {
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
