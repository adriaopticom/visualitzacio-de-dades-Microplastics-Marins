// Visualització de factors que influeixen
// d3 està disponible globalment des de index.html

import { createMethodViolinPlot, createTreemapViz, createParallelCoordinates } from './factors-extended.js';

export function initFactorsViz(selector, processedData) {
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
