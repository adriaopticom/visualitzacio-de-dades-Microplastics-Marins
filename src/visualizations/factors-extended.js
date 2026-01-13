// Funcions addicionals per visualitzacions de factors
// d3 està disponible globalment des de index.html

// Violin plots per mètode de mostreig (millorat amb box plots)
export function createMethodViolinPlot(container, processedData) {
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
export function createTreemapViz(container, processedData) {
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
export function createCorrelationMatrix(container, processedData) {
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
export function createScatterplotMatrix(container, processedData) {
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
export function createParallelCoordinates(container, processedData) {
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
export function createSankeyDiagram(container, processedData) {
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
