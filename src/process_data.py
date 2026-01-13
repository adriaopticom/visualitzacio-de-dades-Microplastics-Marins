#!/usr/bin/env python3
"""
Script per processar les dades de microplàstics i calcular mètriques
Genera fitxers JSON per a la visualització web
"""

import pandas as pd
import json
import numpy as np
from datetime import datetime
from pathlib import Path
import sys

# Configuració de paths
BASE_DIR = Path(__file__).parent.parent
DATA_RAW = BASE_DIR / "data" / "raw"
DATA_PROCESSED = BASE_DIR / "data" / "processed"
CSV_FILE = DATA_RAW / "microplastics.csv"

# Crear directori processed si no existeix
DATA_PROCESSED.mkdir(parents=True, exist_ok=True)

print("=" * 60)
print("PROCESSAMENT DE DADES DE MICROPLÀSTICS")
print("=" * 60)

# Carregar dades
print(f"\n1. Carregant dades de {CSV_FILE}...")
try:
    microplastics = pd.read_csv(CSV_FILE, low_memory=False)
    print(f"   ✓ Dades carregades: {len(microplastics)} registres, {len(microplastics.columns)} variables")
except FileNotFoundError:
    print(f"   ✗ Error: No s'ha trobat el fitxer {CSV_FILE}")
    sys.exit(1)
except Exception as e:
    print(f"   ✗ Error carregant dades: {e}")
    sys.exit(1)

# Preparació de dades
print("\n2. Preparant dades...")
microplastics = microplastics.copy()

# Netejar i parsejar dates
def parse_date(date_str):
    """Parseja dates en format MM/DD/YYYY (amb o sense temps)"""
    if pd.isna(date_str) or date_str == '':
        return None
    try:
        # Intentar primer amb el format complet (amb temps): "7/13/1989 12:00:00 AM"
        date_obj = pd.to_datetime(date_str, format='%m/%d/%Y %I:%M:%S %p', errors='coerce')
        if pd.isna(date_obj):
            # Si falla, intentar sense temps
            date_obj = pd.to_datetime(date_str, format='%m/%d/%Y', errors='coerce')
        if pd.isna(date_obj):
            # Si encara falla, deixar que pandas ho intenti automàticament
            date_obj = pd.to_datetime(date_str, errors='coerce')
        return date_obj if not pd.isna(date_obj) else None
    except:
        return None

microplastics['Date_parsed'] = microplastics['Date (MM-DD-YYYY)'].apply(parse_date)
# Extraure l'any només si Date_parsed no és null
microplastics['Year'] = microplastics['Date_parsed'].apply(lambda x: x.year if pd.notna(x) else None)

print(f"   ✓ Dates parsejades: {microplastics['Date_parsed'].notna().sum()} / {len(microplastics)}")
print(f"   ✓ Anys vàlids: {microplastics['Year'].notna().sum()} / {len(microplastics)}")

# Netejar concentracions
microplastics['Microplastics measurement'] = pd.to_numeric(
    microplastics['Microplastics measurement'], 
    errors='coerce'
)

# Filtrar dades vàlides
initial_count = len(microplastics)
microplastics = microplastics[
    (microplastics['Microplastics measurement'].notna()) &
    (microplastics['Microplastics measurement'] > 0) &
    (microplastics['Latitude (degree)'].notna()) &
    (microplastics['Longitude(degree)'].notna())
].copy()

print(f"   ✓ Dades vàlides: {len(microplastics)} registres (filtrades {initial_count - len(microplastics)} invàlides)")

# Crear columnes auxiliars
microplastics['concentration'] = microplastics['Microplastics measurement']
microplastics['lat'] = pd.to_numeric(microplastics['Latitude (degree)'], errors='coerce')
microplastics['lon'] = pd.to_numeric(microplastics['Longitude(degree)'], errors='coerce')
microplastics['depth'] = pd.to_numeric(microplastics['Water Sample Depth (m)'], errors='coerce')
microplastics['ocean'] = microplastics['Ocean']
microplastics['region'] = microplastics['Region']
microplastics['country'] = microplastics['Country']
microplastics['method'] = microplastics['Sampling Method']
microplastics['marineSetting'] = microplastics['Marine Setting']

# ============================================================================
# MÈTRIQUES: Índex de Contaminació Regional (ICR)
# ============================================================================
print("\n3. Calculant Índex de Contaminació Regional (ICR)...")

def calculate_ICR(df):
    """Calcula l'ICR per regió"""
    grouped = df.groupby(['Ocean', 'Region'], dropna=False).agg({
        'concentration': ['count', 'mean', 'std'],
        'lat': 'mean',
        'lon': 'mean',
        'country': 'first'
    }).reset_index()
    
    grouped.columns = ['ocean', 'region', 'nSamples', 'meanConcentration', 'sdConcentration', 'meanLat', 'meanLon', 'country']
    
    # Calcular CV
    grouped['cvConcentration'] = grouped.apply(
        lambda x: x['sdConcentration'] / x['meanConcentration'] if x['meanConcentration'] > 0 else 0,
        axis=1
    )
    
    # Normalitzar components (0-1)
    n_min, n_max = grouped['nSamples'].min(), grouped['nSamples'].max()
    mean_min, mean_max = grouped['meanConcentration'].min(), grouped['meanConcentration'].max()
    cv_min, cv_max = grouped['cvConcentration'].min(), grouped['cvConcentration'].max()
    
    grouped['nSamples_norm'] = (grouped['nSamples'] - n_min) / (n_max - n_min + 1)
    grouped['meanConc_norm'] = (grouped['meanConcentration'] - mean_min) / (mean_max - mean_min + 1)
    grouped['cv_norm'] = (grouped['cvConcentration'] - cv_min) / (cv_max - cv_min + 1) if cv_max > cv_min else 0.5
    
    # ICR: combinació ponderada
    grouped['ICR'] = 0.4 * grouped['meanConc_norm'] + 0.3 * grouped['cv_norm'] + 0.3 * grouped['nSamples_norm']
    
    return grouped.sort_values('ICR', ascending=False)

icr_data = calculate_ICR(microplastics)
print(f"   ✓ ICR calculat per {len(icr_data)} regions")

# ============================================================================
# MÈTRIQUES: Taxa de Canvi Temporal (TCT)
# ============================================================================
print("\n4. Calculant Taxa de Canvi Temporal (TCT)...")

def calculate_TCT(df):
    """Calcula TCT per any"""
    yearly = df[df['Year'].notna()].groupby('Year').agg({
        'concentration': ['mean', 'median', 'std', 'count']
    }).reset_index()
    
    yearly.columns = ['year', 'meanConcentration', 'medianConcentration', 'sdConcentration', 'nSamples']
    yearly = yearly.sort_values('year')
    
    # Calcular TCT
    yearly['prev_year_conc'] = yearly['meanConcentration'].shift(1)
    yearly['TCT'] = ((yearly['meanConcentration'] - yearly['prev_year_conc']) / yearly['prev_year_conc'] * 100).round(2)
    
    return yearly

by_year = calculate_TCT(microplastics)
print(f"   ✓ TCT calculat per {len(by_year)} anys")

# TCT per any i regió
def calculate_TCT_by_region(df):
    """Calcula TCT per any i regió"""
    yearly_region = df[df['Year'].notna()].groupby(['Year', 'Ocean', 'Region']).agg({
        'concentration': ['mean', 'count']
    }).reset_index()
    
    yearly_region.columns = ['year', 'ocean', 'region', 'meanConcentration', 'nSamples']
    yearly_region = yearly_region.sort_values(['ocean', 'region', 'year'])
    
    # Calcular TCT per cada regió
    result = []
    for (ocean, region), group in yearly_region.groupby(['ocean', 'region']):
        group = group.sort_values('year').copy()
        group['prev_year_conc'] = group['meanConcentration'].shift(1)
        group['TCT'] = ((group['meanConcentration'] - group['prev_year_conc']) / group['prev_year_conc'] * 100).round(2)
        result.append(group)
    
    if result:
        return pd.concat(result, ignore_index=True)
    return pd.DataFrame()

by_year_region = calculate_TCT_by_region(microplastics)
print(f"   ✓ TCT per regió calculat per {len(by_year_region)} combinacions any-regió")

# ============================================================================
# MÈTRIQUES: Correlació Profunditat-Concentració
# ============================================================================
print("\n5. Calculant correlació profunditat-concentració...")

def calculate_depth_correlation(df):
    """Calcula correlació entre profunditat i concentració"""
    valid = df[(df['depth'].notna()) & (df['depth'] > 0) & (df['concentration'] > 0)]
    
    if len(valid) < 10:
        return {
            'correlation': None,
            'nSamples': len(valid),
            'p_value': None,
            'direction': None,
            'strength': None
        }
    
    correlation = valid['depth'].corr(valid['concentration'])
    
    # Calcular força
    abs_corr = abs(correlation)
    if abs_corr >= 0.7:
        strength = 'strong'
    elif abs_corr >= 0.4:
        strength = 'moderate'
    else:
        strength = 'weak'
    
    return {
        'correlation': round(correlation, 3),
        'nSamples': len(valid),
        'direction': 'positive' if correlation > 0 else 'negative',
        'strength': strength
    }

depth_corr = calculate_depth_correlation(microplastics)
print(f"   ✓ Correlació: {depth_corr['correlation']} ({depth_corr['strength']})")

# ============================================================================
# MÈTRIQUES: Índex de Completitud de Dades per Regió
# ============================================================================
print("\n6. Calculant Índex de Completitud de Dades per Regió...")

def calculate_data_completeness(df):
    """Calcula l'índex de completitud de dades per regió"""
    # Variables importants a considerar per la completitud
    # Excloem variables que sempre poden ser null (com identificadors opcionals)
    important_vars = [
        'Latitude (degree)', 'Longitude(degree)', 'Ocean', 'Region',
        'Marine Setting', 'Sampling Method', 'Water Sample Depth (m)',
        'Microplastics measurement', 'Date (MM-DD-YYYY)', 'Country',
        'Ocean Bottom Depth (m)', 'Sediment Sample Depth (m)', 'Mesh size (mm)',
        'Unit', 'ORGANIZATION', 'KEYWORDS'
    ]
    
    # Agregar per regió
    grouped = df.groupby(['Ocean', 'Region'], dropna=False).agg({
        'concentration': 'count'  # Nombre de mostres per regió
    }).reset_index()
    
    grouped.columns = ['ocean', 'region', 'nSamples']
    
    # Per cada regió, calcular completitud
    completeness_data = []
    for _, row in grouped.iterrows():
        ocean = row['ocean']
        region = row['region']
        
        # Filtrar mostres d'aquesta regió
        region_data = df[(df['Ocean'] == ocean) & (df['Region'] == region)]
        
        if len(region_data) == 0:
            continue
        
        # Per cada variable important, comptar quants registres tenen valor
        var_completeness = {}
        total_records = len(region_data)
        
        for var in important_vars:
            if var in region_data.columns:
                non_null_count = region_data[var].notna().sum()
                var_completeness[var] = (non_null_count / total_records) * 100 if total_records > 0 else 0
        
        # Calcular completitud mitjana (mitjana de totes les variables)
        avg_completeness = sum(var_completeness.values()) / len(var_completeness) if var_completeness else 0
        
        # Completitud ponderada (donar més pes a variables més importants)
        critical_vars = ['Microplastics measurement', 'Latitude (degree)', 'Longitude(degree)', 'Date (MM-DD-YYYY)']
        critical_completeness = sum(var_completeness.get(var, 0) for var in critical_vars) / len(critical_vars) if critical_vars else 0
        
        # Índex de completitud: 60% variables crítiques + 40% mitjana general
        completeness_index = 0.6 * critical_completeness + 0.4 * avg_completeness
        
        completeness_data.append({
            'ocean': ocean,
            'region': region,
            'nSamples': total_records,
            'completenessIndex': round(completeness_index, 2),
            'avgCompleteness': round(avg_completeness, 2),
            'criticalCompleteness': round(critical_completeness, 2),
            'varCompleteness': var_completeness
        })
    
    return pd.DataFrame(completeness_data).sort_values('completenessIndex', ascending=False)

completeness_data = calculate_data_completeness(microplastics)
print(f"   ✓ Completitud calculada per {len(completeness_data)} regions")
print(f"   ✓ Completitud mitjana: {completeness_data['completenessIndex'].mean():.2f}%")
print(f"   ✓ Completitud mínima: {completeness_data['completenessIndex'].min():.2f}%")
print(f"   ✓ Completitud màxima: {completeness_data['completenessIndex'].max():.2f}%")

# ============================================================================
# MÈTRIQUES: Índex de Diversitat de Mètodes de Mostreig
# ============================================================================
print("\n7. Calculant Índex de Diversitat de Mètodes de Mostreig...")

def calculate_method_diversity_index(df):
    """Calcula l'índex de diversitat de mètodes de mostreig per regió (índex de Shannon)"""
    # Filtrar dades amb mètode vàlid
    valid_data = df[df['method'].notna()].copy()
    
    if len(valid_data) == 0:
        return pd.DataFrame()
    
    # Agregar per regió i comptar mètodes
    diversity_results = []
    
    for (ocean, region), group in valid_data.groupby(['Ocean', 'Region'], dropna=False):
        total_samples = len(group)
        if total_samples == 0:
            continue
        
        # Comptar mostres per mètode
        method_counts = group['method'].value_counts()
        n_methods = len(method_counts)
        
        if n_methods == 0:
            continue
        
        # Calcular índex de Shannon (H')
        # H' = -Σ(pi * ln(pi)), on pi és la proporció de mostres del mètode i
        shannon_index = 0
        for method, count in method_counts.items():
            pi = count / total_samples
            if pi > 0:
                shannon_index -= pi * np.log(pi)
        
        # Normalitzar a 0-1 (dividir per ln(n_mètodes) per obtenir equitat)
        max_diversity = np.log(n_methods) if n_methods > 1 else 1
        normalized_diversity = shannon_index / max_diversity if max_diversity > 0 else 0
        
        diversity_results.append({
            'ocean': ocean,
            'region': region,
            'nSamples': total_samples,
            'nMethods': n_methods,
            'shannonIndex': round(shannon_index, 3),
            'normalizedDiversity': round(normalized_diversity, 3),
            'methodDistribution': method_counts.to_dict()
        })
    
    return pd.DataFrame(diversity_results).sort_values('normalizedDiversity', ascending=False)

method_diversity = calculate_method_diversity_index(microplastics)
print(f"   ✓ Diversitat calculada per {len(method_diversity)} regions")
if len(method_diversity) > 0:
    print(f"   ✓ Diversitat mitjana: {method_diversity['normalizedDiversity'].mean():.3f}")
    print(f"   ✓ Diversitat mínima: {method_diversity['normalizedDiversity'].min():.3f}")
    print(f"   ✓ Diversitat màxima: {method_diversity['normalizedDiversity'].max():.3f}")

# ============================================================================
# MÈTRIQUES: IGRM Simplificat (Índex Global de Risc de Microplàstics)
# ============================================================================
print("\n8. Calculant IGRM Simplificat...")

def calculate_IGRM_simplified(df, icr_data, completeness_data, method_diversity):
    """Calcula l'IGRM simplificat com a mètrica composta que integra altres mètriques"""
    # Agregar dades per regió
    by_region_base = df.groupby(['Ocean', 'Region'], dropna=False).agg({
        'concentration': ['count', 'mean'],
        'lat': 'mean',
        'lon': 'mean'
    }).reset_index()
    
    by_region_base.columns = ['ocean', 'region', 'nSamples', 'meanConcentration', 'meanLat', 'meanLon']
    
    # Fusionar amb ICR
    by_region_merged = by_region_base.merge(
        icr_data[['ocean', 'region', 'ICR']],
        on=['ocean', 'region'],
        how='left'
    )
    
    # Fusionar amb Completitud
    by_region_merged = by_region_merged.merge(
        completeness_data[['ocean', 'region', 'completenessIndex']],
        on=['ocean', 'region'],
        how='left'
    )
    
    # Fusionar amb Diversitat de Mètodes
    by_region_merged = by_region_merged.merge(
        method_diversity[['ocean', 'region', 'normalizedDiversity']],
        on=['ocean', 'region'],
        how='left'
    )
    
    # Normalitzar components a 0-1
    # ICR ja està normalitzat (0-1)
    # Completitud: convertir de 0-100% a 0-1
    by_region_merged['completeness_norm'] = by_region_merged['completenessIndex'] / 100.0
    # Diversitat ja està normalitzada (0-1)
    
    # Invertir completitud i diversitat perquè valors alts siguin millors (menys risc)
    # Per a l'IGRM, volem que valors alts indiquin major risc
    # Per tant, invertim: risc = 1 - qualitat
    by_region_merged['completeness_risk'] = 1 - by_region_merged['completeness_norm'].fillna(0.5)
    by_region_merged['diversity_risk'] = 1 - by_region_merged['normalizedDiversity'].fillna(0.5)
    
    # IGRM simplificat: combinació ponderada
    # Pesos: ICR (40%), Completitud inversa (30%), Diversitat inversa (30%)
    by_region_merged['IGRM'] = (
        0.4 * by_region_merged['ICR'].fillna(0.5) +
        0.3 * by_region_merged['completeness_risk'].fillna(0.5) +
        0.3 * by_region_merged['diversity_risk'].fillna(0.5)
    )
    
    # Seleccionar columnes rellevants
    igrm_result = by_region_merged[[
        'ocean', 'region', 'nSamples', 'meanConcentration', 
        'meanLat', 'meanLon', 'ICR', 'completenessIndex', 
        'normalizedDiversity', 'IGRM'
    ]].copy()
    
    return igrm_result.sort_values('IGRM', ascending=False)

igrm_data = calculate_IGRM_simplified(microplastics, icr_data, completeness_data, method_diversity)
print(f"   ✓ IGRM calculat per {len(igrm_data)} regions")
if len(igrm_data) > 0:
    print(f"   ✓ IGRM mitjà: {igrm_data['IGRM'].mean():.3f}")
    print(f"   ✓ IGRM mínim: {igrm_data['IGRM'].min():.3f}")
    print(f"   ✓ IGRM màxim: {igrm_data['IGRM'].max():.3f}")

# ============================================================================
# PREPARAR DADES PER VISUALITZACIÓ
# ============================================================================
print("\n9. Preparant dades per visualització...")

# 1. Dades agregades per regió
by_region = microplastics.groupby(['Ocean', 'Region', 'Country'], dropna=False).agg({
    'concentration': ['count', 'mean', 'median', 'std'],
    'lat': ['min', 'max', 'mean'],
    'lon': ['min', 'max', 'mean']
}).reset_index()

by_region.columns = ['ocean', 'region', 'country', 'nSamples', 'meanConcentration', 
                      'medianConcentration', 'sdConcentration', 'minLat', 'maxLat', 
                      'meanLat', 'minLon', 'maxLon', 'meanLon']

# Afegir ICR
by_region = by_region.merge(
    icr_data[['ocean', 'region', 'ICR']],
    on=['ocean', 'region'],
    how='left'
)

# Afegir Completitud de Dades
by_region = by_region.merge(
    completeness_data[['ocean', 'region', 'completenessIndex', 'avgCompleteness', 'criticalCompleteness']],
    on=['ocean', 'region'],
    how='left'
)

by_region = by_region[by_region['meanLat'].notna() & by_region['meanLon'].notna()].copy()
print(f"   ✓ Dades per regió: {len(by_region)} regions")

# 2. Dades per a scatterplot (mostres individuals)
scatter_data = microplastics[[
    'concentration', 'depth', 'lat', 'lon', 'ocean', 'region', 'Year', 'method'
]].copy()

scatter_data = scatter_data[
    (scatter_data['concentration'].notna()) &
    (scatter_data['depth'].notna()) &
    (scatter_data['depth'] > 0)
].sample(min(1000, len(scatter_data))).copy()  # Limitar per rendiment

print(f"   ✓ Dades scatterplot: {len(scatter_data)} mostres")

# 3. Dades per box plot (mètodes de mostreig)
method_data = microplastics[
    (microplastics['method'].notna()) &
    (microplastics['concentration'] > 0)
].groupby('method')['concentration'].apply(lambda x: x.tolist()).reset_index()

method_data.columns = ['method', 'concentrations']
method_data = method_data[method_data['concentrations'].apply(len) > 0].copy()
# Convertir llistes de numpy arrays a llistes de Python
method_data['concentrations'] = method_data['concentrations'].apply(
    lambda x: [float(val) for val in x if not (isinstance(val, float) and (np.isnan(val) or np.isinf(val)))]
)

print(f"   ✓ Dades per mètodes: {len(method_data)} mètodes")

# 4. Dades per treemap (mètode i ambient marí)
treemap_data = microplastics[
    (microplastics['method'].notna()) &
    (microplastics['marineSetting'].notna()) &
    (microplastics['concentration'] > 0)
].groupby(['method', 'marineSetting']).agg({
    'concentration': ['count', 'mean']
}).reset_index()

treemap_data.columns = ['method', 'marineSetting', 'nSamples', 'meanConcentration']
treemap_data = treemap_data.sort_values('nSamples', ascending=False)

print(f"   ✓ Dades treemap: {len(treemap_data)} combinacions")

# 5. Dades per parallel coordinates plot (mostres amb múltiples dimensions)
parallel_data = microplastics[[
    'concentration', 'depth', 'Year', 'ocean', 'method', 'marineSetting', 
    'lat', 'lon', 'region'
]].copy()

parallel_data = parallel_data[
    (parallel_data['concentration'].notna()) &
    (parallel_data['concentration'] > 0)
].sample(min(500, len(parallel_data))).copy()  # Limitar per rendiment

# Normalitzar variables numèriques per parallel coordinates
parallel_data['concentration_norm'] = (parallel_data['concentration'] - parallel_data['concentration'].min()) / (parallel_data['concentration'].max() - parallel_data['concentration'].min()) if parallel_data['concentration'].max() > parallel_data['concentration'].min() else 0
parallel_data['depth_norm'] = parallel_data['depth'].apply(
    lambda x: (x - microplastics['depth'].min()) / (microplastics['depth'].max() - microplastics['depth'].min()) if pd.notna(x) and microplastics['depth'].max() > microplastics['depth'].min() else None
)
parallel_data['year_norm'] = (parallel_data['Year'] - parallel_data['Year'].min()) / (parallel_data['Year'].max() - parallel_data['Year'].min()) if parallel_data['Year'].max() > parallel_data['Year'].min() else 0

print(f"   ✓ Dades parallel coordinates: {len(parallel_data)} mostres")

# 6. Dades per violin plots temporals (concentracions per any)
violin_data = microplastics[
    (microplastics['concentration'].notna()) &
    (microplastics['concentration'] > 0) &
    (microplastics['Year'].notna())
].groupby('Year')['concentration'].apply(lambda x: x.tolist()).reset_index()
violin_data.columns = ['year', 'concentrations']
violin_data['concentrations'] = violin_data['concentrations'].apply(
    lambda x: [float(val) for val in x if not (isinstance(val, float) and (np.isnan(val) or np.isinf(val)))]
)
violin_data = violin_data[violin_data['concentrations'].apply(len) > 0].copy()
violin_data = violin_data.sort_values('year')

print(f"   ✓ Dades violin plots: {len(violin_data)} anys")

# 7. Dades per Sankey diagrams (flux: mètode → ambient marí → rang de concentració)
# Crear rangs de concentració
microplastics['concentration_range'] = pd.cut(
    microplastics['concentration'],
    bins=[0, 0.1, 0.5, 1.0, 5.0, float('inf')],
    labels=['Molt Baixa (0-0.1)', 'Baixa (0.1-0.5)', 'Mitjana (0.5-1.0)', 'Alta (1.0-5.0)', 'Molt Alta (>5.0)']
)

sankey_data = microplastics[
    (microplastics['method'].notna()) &
    (microplastics['marineSetting'].notna()) &
    (microplastics['concentration_range'].notna())
].groupby(['method', 'marineSetting', 'concentration_range']).size().reset_index(name='count')
sankey_data = sankey_data.sort_values('count', ascending=False)

print(f"   ✓ Dades Sankey: {len(sankey_data)} combinacions")

# ============================================================================
# EXPORTAR A JSON
# ============================================================================
print("\n10. Exportant a JSON...")

def to_json_serializable(obj):
    """Converteix a format JSON serializable"""
    # Gestionar None primer
    if obj is None:
        return None
    
    # Gestionar NaN i Inf
    if isinstance(obj, (float, np.floating)):
        if np.isnan(obj) or np.isinf(obj):
            return None
        return float(obj)
    
    # Gestionar enters
    if isinstance(obj, (np.integer, np.int64, int)):
        return int(obj)
    
    # Gestionar arrays
    if isinstance(obj, np.ndarray):
        return [to_json_serializable(item) for item in obj.tolist()]
    
    # Gestionar llistes
    if isinstance(obj, (list, tuple)):
        return [to_json_serializable(item) for item in obj]
    
    # Gestionar pandas
    if isinstance(obj, pd.Timestamp):
        return obj.isoformat()
    if isinstance(obj, (pd.Series, pd.DataFrame)):
        return obj.to_dict() if hasattr(obj, 'to_dict') else str(obj)
    
    # Gestionar strings
    if isinstance(obj, str):
        return obj
    
    # Intentar pd.isna per a valors escalars
    try:
        if pd.isna(obj):
            return None
    except (TypeError, ValueError):
        pass
    
    return obj

# Funció helper per exportar
def export_json(data, filename):
    """Exporta dades a JSON"""
    filepath = DATA_PROCESSED / filename
    
    if isinstance(data, pd.DataFrame):
        data_dict = data.to_dict('records')
    else:
        data_dict = data
    
    # Netejar valors NaN i convertir a JSON serializable
    def clean_dict(d):
        if isinstance(d, dict):
            cleaned_dict = {}
            for k, v in d.items():
                cleaned_value = to_json_serializable(v)
                # Eliminar claus amb valors None si es vol, o mantenir-les
                cleaned_dict[k] = cleaned_value
            return cleaned_dict
        elif isinstance(d, list):
            return [clean_dict(item) for item in d]
        else:
            return to_json_serializable(d)
    
    cleaned = clean_dict(data_dict)
    
    # Netejar recursivament qualsevol NaN que hagi quedat
    def remove_nan(obj):
        if isinstance(obj, dict):
            return {k: remove_nan(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [remove_nan(item) for item in obj]
        elif isinstance(obj, float) and (np.isnan(obj) or np.isinf(obj)):
            return None
        elif pd.isna(obj) if hasattr(pd, 'isna') else False:
            return None
        return obj
    
    cleaned = remove_nan(cleaned)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(cleaned, f, indent=2, ensure_ascii=False, allow_nan=False)
    
    print(f"   ✓ {filename}")

# Exportar cada dataset
export_json(by_region, 'by_region.json')
# Convertir by_year a llista de diccionaris abans d'exportar
by_year_dict = by_year.to_dict('records') if isinstance(by_year, pd.DataFrame) else by_year
export_json(by_year_dict, 'by_year.json')

# Convertir by_year_region a llista de diccionaris abans d'exportar
by_year_region_dict = by_year_region.to_dict('records') if isinstance(by_year_region, pd.DataFrame) else by_year_region
export_json(by_year_region_dict, 'by_year_region.json')
export_json(scatter_data.to_dict('records'), 'scatter_data.json')
export_json(method_data.to_dict('records'), 'method_data.json')
export_json(treemap_data, 'treemap_data.json')
export_json(parallel_data.to_dict('records'), 'parallel_data.json')
export_json(violin_data.to_dict('records'), 'violin_data.json')
export_json(sankey_data.to_dict('records'), 'sankey_data.json')

# Exportar mètriques
metrics = {
    'ICR': icr_data.to_dict('records'),
    'depthCorrelation': depth_corr,
    'dataCompleteness': completeness_data.to_dict('records'),
    'methodDiversity': method_diversity.to_dict('records'),
    'IGRM': igrm_data.to_dict('records'),
    'summary': {
        'totalSamples': len(microplastics),
        'dateRange': {
            'min': microplastics['Date_parsed'].min().isoformat() if microplastics['Date_parsed'].notna().any() else None,
            'max': microplastics['Date_parsed'].max().isoformat() if microplastics['Date_parsed'].notna().any() else None
        },
        'nRegions': microplastics['region'].nunique(),
        'nOceans': microplastics['ocean'].nunique(),
        'nCountries': microplastics['country'].nunique(),
        'avgCompleteness': float(completeness_data['completenessIndex'].mean()) if len(completeness_data) > 0 else None,
        'avgMethodDiversity': float(method_diversity['normalizedDiversity'].mean()) if len(method_diversity) > 0 else None,
        'avgIGRM': float(igrm_data['IGRM'].mean()) if len(igrm_data) > 0 else None
    }
}

export_json(metrics, 'metrics.json')

print("\n" + "=" * 60)
print("✓ PROCESSAMENT COMPLETAT")
print("=" * 60)
print(f"\nFitxers generats a: {DATA_PROCESSED}")
print("\nFitxers JSON generats:")
print("  - by_region.json")
print("  - by_year.json")
print("  - by_year_region.json")
print("  - scatter_data.json")
print("  - method_data.json")
print("  - treemap_data.json")
print("  - parallel_data.json")
print("  - violin_data.json")
print("  - sankey_data.json")
print("  - metrics.json")
print("\nAra pots carregar aquests fitxers a la visualització JavaScript!")
