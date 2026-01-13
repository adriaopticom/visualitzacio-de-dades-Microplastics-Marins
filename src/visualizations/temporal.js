// Visualització d'evolució temporal
// d3 està disponible globalment des de index.html

import { createStreamgraphViz, createViolinPlots, createRidgelinePlots } from './temporal-extended.js';

export function initTemporalViz(selector, processedData) {
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
