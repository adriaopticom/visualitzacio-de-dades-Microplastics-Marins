// Visualització de distribució geogràfica amb corrents oceàniques
// d3 està disponible globalment des de index.html

export function initGeographicVizWithCurrents(selector, processedData) {
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
