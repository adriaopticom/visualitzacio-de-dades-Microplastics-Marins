// Script simple per combinar tots els mòduls en un sol bundle per GitHub Pages
const fs = require('fs');
const path = require('path');

// Funció per llegir un fitxer i substituir imports
function readAndResolveImports(filePath, baseDir, processed = new Set()) {
    const fullPath = path.resolve(baseDir, filePath);
    const fileKey = path.relative(baseDir, fullPath);
    
    // Evitar processar el mateix fitxer dues vegades
    if (processed.has(fileKey)) {
        return '';
    }
    processed.add(fileKey);
    
    if (!fs.existsSync(fullPath)) {
        console.warn(`Warning: File not found: ${fullPath}`);
        return '';
    }
    
    let content = fs.readFileSync(fullPath, 'utf8');
    
    // Substituir imports per crides a funcions
    const importRegex = /import\s+{([^}]+)}\s+from\s+['"]([^'"]+)['"];?/g;
    const importDefaultRegex = /import\s+(\w+)\s+from\s+['"]([^'"]+)['"];?/g;
    
    // Processar imports amb destructuring
    content = content.replace(importRegex, (match, imports, modulePath) => {
        const resolvedPath = path.resolve(path.dirname(fullPath), modulePath);
        const relativePath = path.relative(baseDir, resolvedPath);
        const moduleName = relativePath.replace(/[\/\\]/g, '_').replace(/\.js$/, '');
        
        // Llegir el mòdul importat
        const moduleContent = readAndResolveImports(relativePath, baseDir, processed);
        
        return `// Import from ${modulePath}\n${moduleContent}\n`;
    });
    
    // Processar imports per defecte
    content = content.replace(importDefaultRegex, (match, defaultImport, modulePath) => {
        const resolvedPath = path.resolve(path.dirname(fullPath), modulePath);
        const relativePath = path.relative(baseDir, resolvedPath);
        
        // Llegir el mòdul importat
        const moduleContent = readAndResolveImports(relativePath, baseDir, processed);
        
        return `// Import ${defaultImport} from ${modulePath}\n${moduleContent}\n`;
    });
    
    // Eliminar exports (ja que tot estarà en el mateix scope)
    content = content.replace(/export\s+/g, '');
    
    return `\n// ===== ${fileKey} =====\n${content}\n`;
}

// Funció principal
function build() {
    const baseDir = __dirname;
    const mainFile = path.join(baseDir, 'main.js');
    
    console.log('Building bundle for GitHub Pages...');
    
    // Llegir i processar main.js
    const bundle = readAndResolveImports('main.js', baseDir, new Set());
    
    // Crear el bundle final
    const bundleContent = `// Bundle generat automàticament per GitHub Pages
// Generat el: ${new Date().toISOString()}

// d3 està disponible globalment des de index.html
${bundle}
`;
    
    // Escriure el bundle
    const outputPath = path.join(baseDir, 'bundle.js');
    fs.writeFileSync(outputPath, bundleContent, 'utf8');
    
    console.log(`✓ Bundle creat: ${outputPath}`);
    console.log(`✓ Mida: ${(fs.statSync(outputPath).size / 1024).toFixed(2)} KB`);
}

build();
