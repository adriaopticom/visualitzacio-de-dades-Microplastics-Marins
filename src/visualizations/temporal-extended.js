// Funcions addicionals per visualitzacions temporals
// d3 està disponible globalment des de index.html

// Small multiples per oceà
export function createByOceanViz(container, processedData) {
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
export function createHeatmapViz(container, processedData) {
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
export function createStreamgraphViz(container, processedData) {
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
export function createViolinPlots(container, processedData) {
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
        .sort((a, b) => a.year - b.year);
        // Mostrar tots els anys disponibles (no limitar per rendiment)
    
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
export function createRidgelinePlots(container, processedData) {
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
        .sort((a, b) => a.year - b.year);
        // Mostrar tots els anys disponibles (no limitar per rendiment)
    
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
