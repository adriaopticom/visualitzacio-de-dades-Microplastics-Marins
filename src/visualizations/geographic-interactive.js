// Visualització geogràfica interactiva amb Leaflet
// Mapa de fons amb zoom i pan

export function initGeographicVizInteractive(selector, processedData) {
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
