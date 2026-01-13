#!/usr/bin/env python3
"""
Script per crear una versió estàtica del projecte per GitHub Pages.
Combina tots els mòduls JavaScript en un sol bundle.js
"""

import os
import re
from pathlib import Path

def read_file(filepath):
    """Llegeix un fitxer i retorna el seu contingut"""
    with open(filepath, 'r', encoding='utf-8') as f:
        return f.read()

def write_file(filepath, content):
    """Escriu contingut a un fitxer"""
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

def resolve_imports(content, base_dir, file_path, processed=None):
    """Resol imports i els substitueix pel contingut dels mòduls"""
    if processed is None:
        processed = set()
    
    file_key = str(file_path)
    if file_key in processed:
        return ""
    processed.add(file_key)
    
    # Trobar tots els imports
    import_pattern = r"import\s+{([^}]+)}\s+from\s+['\"]([^'\"]+)['\"];?"
    imports = re.findall(import_pattern, content)
    
    bundle_parts = []
    
    # Processar cada import
    for imports_list, module_path in imports:
        # Resoldre el path del mòdul
        if module_path.startswith('./') or module_path.startswith('../'):
            module_full_path = (file_path.parent / module_path).resolve()
        else:
            module_full_path = (base_dir / module_path).resolve()
        
        if module_full_path.exists() and module_full_path.suffix == '.js':
            # Llegir el mòdul importat
            module_content = read_file(module_full_path)
            # Resoldre imports recursivament
            resolved_content = resolve_imports(module_content, base_dir, module_full_path, processed)
            bundle_parts.append(f"\n// ===== {module_full_path.relative_to(base_dir)} =====\n{resolved_content}\n")
    
    # Eliminar exports (ja que tot estarà en el mateix scope)
    content = re.sub(r'export\s+', '', content)
    
    # Eliminar imports (ja que els hem resolt)
    content = re.sub(import_pattern, '', content)
    
    return '\n'.join(bundle_parts) + '\n' + content

def build_bundle():
    """Crea el bundle principal"""
    base_dir = Path(__file__).parent
    main_file = base_dir / 'main.js'
    
    print("Building bundle for GitHub Pages...")
    
    if not main_file.exists():
        print(f"Error: {main_file} not found!")
        return False
    
    # Llegir main.js
    main_content = read_file(main_file)
    
    # Resoldre imports
    bundle_content = resolve_imports(main_content, base_dir, main_file, set())
    
    # Afegir header
    header = f"""// Bundle generat automàticament per GitHub Pages
// Generat el: {__import__('datetime').datetime.now().isoformat()}
// d3 està disponible globalment des de index.html

"""
    
    full_bundle = header + bundle_content
    
    # Escriure bundle
    bundle_path = base_dir / 'bundle.js'
    write_file(bundle_path, full_bundle)
    
    size_kb = bundle_path.stat().st_size / 1024
    print(f"✓ Bundle creat: {bundle_path}")
    print(f"✓ Mida: {size_kb:.2f} KB")
    
    return True

if __name__ == '__main__':
    build_bundle()
