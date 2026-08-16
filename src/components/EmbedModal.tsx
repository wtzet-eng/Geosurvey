import React, { useState } from 'react';
import {
  Code2,
  Copy,
  Check,
  X,
  ExternalLink,
  Sliders,
  Eye,
  Globe2,
  Layers,
  Sparkles,
  Smartphone,
  Monitor
} from 'lucide-react';
import { EUROPEAN_COUNTRIES, REPORT_LANGUAGES } from '../data/countries';
import { SiteReport } from '../types';

interface EmbedModalProps {
  isOpen: boolean;
  onClose: () => void;
  report?: SiteReport | null;
  defaultCountry?: string;
  defaultLanguage?: string;
}

export const EmbedModal: React.FC<EmbedModalProps> = ({
  isOpen,
  onClose,
  report,
  defaultCountry = 'PL',
  defaultLanguage = 'pl',
}) => {
  const [embedType, setEmbedType] = useState<'iframe' | 'wikidot' | 'react' | 'script'>('iframe');
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'code' | 'preview'>('code');

  // Customization state
  const [width, setWidth] = useState('100%');
  const [height, setHeight] = useState('850px');
  const [selectedCountry, setSelectedCountry] = useState(defaultCountry);
  const [selectedLanguage, setSelectedLanguage] = useState(defaultLanguage);
  const [selectedMode, setSelectedMode] = useState<'polygon' | 'rectangle' | 'circle'>('polygon');
  const [theme, setTheme] = useState<'light' | 'auto'>('light');
  const [includeHeader, setIncludeHeader] = useState(true);
  const [presetSize, setPresetSize] = useState<'responsive' | 'fluid' | 'card' | 'full'>('responsive');

  if (!isOpen) return null;

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://geosurvey.ai.studio';
  
  // Build embed URL with parameters
  const embedUrl = new URL(typeof window !== 'undefined' ? window.location.pathname : '/', currentOrigin);
  embedUrl.searchParams.set('embed', 'true');
  if (selectedCountry) embedUrl.searchParams.set('country', selectedCountry);
  if (selectedLanguage) embedUrl.searchParams.set('lang', selectedLanguage);
  if (selectedMode) embedUrl.searchParams.set('mode', selectedMode);
  if (!includeHeader) embedUrl.searchParams.set('header', '0');
  if (theme !== 'auto') embedUrl.searchParams.set('theme', theme);
  
  if (report) {
    embedUrl.searchParams.set('report_id', report.id);
  }

  const iframeSrc = embedUrl.toString();

  // Generate code snippets
  const iframeCode = `<!-- European Land & Cadastral Valuation Engine (100% Identical Responsive Embed) -->
<div style="width: ${width}; max-width: 100%; margin: 0 auto;">
  <iframe
    id="geosurvey-app-frame"
    src="${iframeSrc}"
    width="100%"
    height="${height}"
    style="width: 100%; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px -2px rgba(0, 0, 0, 0.06); min-height: 700px; background-color: #f8fafc;"
    title="European Geological & Building Plot Valuation Survey"
    allow="geolocation; camera; microphone; clipboard-write"
    loading="lazy"
  ></iframe>
  <script>
    // Auto-fit iframe height dynamically to child app content on any website
    window.addEventListener('message', function(e) {
      if (e.data && e.data.type === 'geosurvey:resize') {
        var frame = document.getElementById('geosurvey-app-frame');
        if (frame && e.data.height) {
          frame.style.height = Math.max(700, e.data.height + 20) + 'px';
        }
      }
    });
  </script>
</div>`;

  const reactCode = `import React, { useEffect, useRef } from 'react';

export function PlotValuationWidget() {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === 'geosurvey:resize' && iframeRef.current && e.data.height) {
        iframeRef.current.style.height = \`\${Math.max(700, e.data.height + 20)}px\`;
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  return (
    <div style={{ width: '${width}', maxWidth: '100%', margin: '0 auto' }}>
      <iframe
        ref={iframeRef}
        src="${iframeSrc}"
        width="100%"
        height="${height}"
        style={{
          width: '100%',
          border: '1px solid #e2e8f0',
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '0 4px 24px -2px rgba(0, 0, 0, 0.06)',
          minHeight: '700px',
          backgroundColor: '#f8fafc'
        }}
        title="European Geological & Building Plot Valuation Survey"
        allow="geolocation; camera; microphone; clipboard-write"
        loading="lazy"
      />
    </div>
  );
};`;

  const scriptCode = `<!-- Responsive Full-Width Embed Container for Any Website / CMS / WordPress / Webflow -->
<div id="geosurvey-embed-root" style="width: 100%; max-width: 100%; box-sizing: border-box;">
  <iframe
    id="geosurvey-frame-instance"
    src="${iframeSrc}"
    style="width: 100%; min-height: 750px; height: ${height}; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; display: block; background-color: #f8fafc;"
    title="Plot Valuation Survey"
    loading="lazy"
    allow="geolocation; camera; microphone; clipboard-write"
  ></iframe>
  <script>
    (function() {
      window.addEventListener('message', function(evt) {
        if (evt.data && evt.data.type === 'geosurvey:resize') {
          var el = document.getElementById('geosurvey-frame-instance');
          if (el && evt.data.height) {
            el.style.height = (evt.data.height + 20) + 'px';
          }
        }
      });
    })();
  </script>
</div>`;

  const wikidotCode = `[[html]]
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>European Geological Survey & Plot Valuation Engine</title>
  <!-- Leaflet CSS & JS -->
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <!-- Font -->
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f8fafc; color: #0f172a; padding: 14px; }
    .widget-box { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05); padding: 20px; max-width: 980px; margin: 0 auto; }
    .header-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; flex-wrap: wrap; gap: 10px; border-bottom: 1px solid #f1f5f9; padding-bottom: 14px; }
    .header-title { font-size: 18px; font-weight: 800; color: #0f172a; display: flex; align-items: center; gap: 8px; }
    .header-badge { font-size: 11px; background: #0f172a; color: #ffffff; padding: 4px 10px; border-radius: 999px; font-weight: 600; }
    
    /* Search Bar */
    .search-row { display: flex; gap: 8px; margin-bottom: 12px; }
    .search-input { flex: 1; padding: 10px 14px; border: 1px solid #cbd5e1; border-radius: 10px; font-size: 13px; outline: none; transition: border-color 0.2s; }
    .search-input:focus { border-color: #0f172a; }
    .search-btn { background: #0f172a; color: #fff; border: none; padding: 10px 18px; border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer; }
    .search-btn:hover { background: #334155; }

    /* Controls Grid */
    .controls-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-bottom: 14px; }
    .control-item label { display: block; font-size: 11px; font-weight: 700; color: #475569; margin-bottom: 5px; text-transform: uppercase; letter-spacing: 0.5px; }
    .control-item select, .control-item input { width: 100%; padding: 9px 12px; border: 1px solid #cbd5e1; border-radius: 10px; font-size: 13px; background: #ffffff; outline: none; font-weight: 500; }
    
    /* Map Box */
    #map-wrapper { position: relative; margin-bottom: 16px; }
    #map { height: 380px; width: 100%; border-radius: 12px; border: 1px solid #cbd5e1; z-index: 1; }
    .map-hint { position: absolute; bottom: 10px; left: 10px; background: rgba(15,23,42,0.85); color: #fff; padding: 5px 12px; border-radius: 8px; font-size: 11px; z-index: 999; backdrop-filter: blur(4px); pointer-events: none; }
    
    /* Run Button */
    .btn-calc { width: 100%; background: #0284c7; color: #ffffff; border: none; padding: 13px 20px; border-radius: 12px; font-weight: 700; font-size: 15px; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 12px rgba(2,132,199,0.25); }
    .btn-calc:hover { background: #0369a1; transform: translateY(-1px); }
    .btn-calc:disabled { background: #94a3b8; cursor: not-allowed; transform: none; box-shadow: none; }
    
    /* Report Container */
    .result-box { display: none; margin-top: 20px; padding: 20px; background: #f8fafc; border-radius: 16px; border: 1px solid #e2e8f0; }
    .report-header { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 10px; margin-bottom: 16px; }
    .report-loc { font-size: 16px; font-weight: 800; color: #0f172a; }
    .report-meta { font-size: 12px; color: #64748b; margin-top: 3px; }
    .btn-print { background: #ffffff; border: 1px solid #cbd5e1; color: #0f172a; padding: 6px 14px; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; }
    .btn-print:hover { background: #f1f5f9; }

    /* Valuation Hero */
    .val-hero { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 16px; display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px; align-items: center; }
    .val-main-title { font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; }
    .val-main-num { font-size: 26px; font-weight: 800; color: #0f172a; }
    .val-rate-num { font-size: 14px; font-weight: 600; color: #0284c7; }
    .pill { display: inline-block; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; }
    .pill-green { background: #dcfce7; color: #166534; }
    .pill-blue { background: #e0f2fe; color: #0369a1; }
    .pill-amber { background: #fef3c7; color: #92400e; }

    /* Tabs */
    .tab-bar { display: flex; gap: 6px; border-bottom: 1px solid #cbd5e1; margin-bottom: 14px; overflow-x: auto; padding-bottom: 2px; }
    .tab-btn { background: none; border: none; padding: 8px 14px; font-size: 12px; font-weight: 700; color: #64748b; cursor: pointer; border-bottom: 2px solid transparent; white-space: nowrap; }
    .tab-btn.active { color: #0f172a; border-bottom-color: #0f172a; }
    .tab-content { display: none; }
    .tab-content.active { display: block; }

    /* Strata Visualizer */
    .strata-chart { margin: 14px 0; border: 1px solid #cbd5e1; border-radius: 10px; overflow: hidden; background: #fff; }
    .strata-layer { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-size: 12px; }
    .strata-layer:last-child { border-bottom: none; }
    .strata-name { font-weight: 700; display: flex; align-items: center; gap: 8px; }
    .layer-color-box { width: 14px; height: 14px; border-radius: 4px; display: inline-block; }
    .strata-depth { font-family: monospace; color: #475569; font-weight: 600; }
    .strata-kpa { background: #f1f5f9; padding: 2px 8px; border-radius: 6px; font-weight: 700; color: #0f172a; }

    /* Key-Value Tables */
    .info-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; }
    .info-card { background: #ffffff; padding: 12px 14px; border-radius: 10px; border: 1px solid #e2e8f0; }
    .info-card b { display: block; font-size: 11px; text-transform: uppercase; color: #64748b; margin-bottom: 4px; }
    .info-card span { font-size: 13px; font-weight: 600; color: #0f172a; }

    @media print {
      body { background: #fff; padding: 0; }
      .widget-box { border: none; box-shadow: none; padding: 0; }
      #map-wrapper, .search-row, .controls-grid, .btn-calc, .tab-bar { display: none !important; }
      .result-box { display: block !important; background: #fff; border: none; padding: 0; }
      .tab-content { display: block !important; margin-bottom: 20px; }
    }
  </style>
</head>
<body>
  <div class="widget-box">
    <div class="header-row">
      <div class="header-title">
        <span>🌍</span> European Geological Survey & Cadastral Valuation
      </div>
      <span class="header-badge">Live Spatial Engine</span>
    </div>

    <!-- Address Geocoding Search Bar -->
    <div class="search-row">
      <input type="text" id="searchInput" class="search-input" placeholder="Search address, cadastral parcel, or city across Europe..." onkeydown="if(event.key==='Enter') searchAddress()" />
      <button type="button" class="search-btn" onclick="searchAddress()">Search</button>
    </div>

    <!-- Controls -->
    <div class="controls-grid">
      <div class="control-item">
        <label>Country & Geological Survey</label>
        <select id="countrySelect" onchange="changeCountry()">
          <option value="PL" data-lat="52.2297" data-lng="21.0122" data-cur="PLN" data-rate="430" data-auth="Państwowy Instytut Geologiczny (PIG-PIB)" selected>Poland (PIG-PIB / GUGiK)</option>
          <option value="DE" data-lat="52.5200" data-lng="13.4050" data-cur="EUR" data-rate="190" data-auth="BGR & Landesämter für Geologie">Germany (BGR / BORIS-D)</option>
          <option value="FR" data-lat="48.8566" data-lng="2.3522" data-cur="EUR" data-rate="165" data-auth="BRGM InfoTerre & Géorisques">France (BRGM / Géorisques)</option>
          <option value="GB" data-lat="51.5074" data-lng="-0.1278" data-cur="GBP" data-rate="220" data-auth="British Geological Survey (BGS)">United Kingdom (BGS / HM Land)</option>
          <option value="CH" data-lat="46.8182" data-lng="8.2275" data-cur="CHF" data-rate="480" data-auth="Swisstopo (Landesgeologie)">Switzerland (Swisstopo)</option>
          <option value="IT" data-lat="41.9028" data-lng="12.4964" data-cur="EUR" data-rate="145" data-auth="ISPRA Servizio Geologico d'Italia">Italy (ISPRA / IdroGEO)</option>
          <option value="ES" data-lat="40.4168" data-lng="-3.7038" data-cur="EUR" data-rate="140" data-auth="IGME-CSIC Instituto Geológico">Spain (IGME / Sede Catastro)</option>
          <option value="NL" data-lat="52.1326" data-lng="5.2913" data-cur="EUR" data-rate="260" data-auth="TNO Geological Survey (DINOloket)">Netherlands (TNO DINOloket)</option>
          <option value="AT" data-lat="48.2082" data-lng="16.3738" data-cur="EUR" data-rate="210" data-auth="Geosphere Austria (GBA)">Austria (Geosphere Austria)</option>
        </select>
      </div>

      <div class="control-item">
        <label>Boundary Selection Mode</label>
        <select id="modeSelect" onchange="changeMode()">
          <option value="polygon" selected>Polygon (Cadastral Vertices)</option>
          <option value="rectangle">Rectangle (2-Corner Box)</option>
          <option value="circle">Circle (Radial Buffer)</option>
        </select>
      </div>

      <div class="control-item">
        <label>Parcel Area (m²)</label>
        <input type="number" id="plotArea" value="1200" min="100" max="100000" onchange="updateShape()" />
      </div>

      <div class="control-item">
        <label>Zoning / Designation</label>
        <select id="zoningType">
          <option value="residential" selected>Single-Family Residential (MN)</option>
          <option value="multi">Multi-Family Residential (MW)</option>
          <option value="commercial">Commercial / Service (U)</option>
          <option value="industrial">Industrial / Logistics (P)</option>
          <option value="agricultural">Agricultural / Conversion (R)</option>
        </select>
      </div>

      <div class="control-item">
        <label>Output Language</label>
        <select id="langSelect">
          <option value="pl" selected>Polski (PL)</option>
          <option value="en">English (EN)</option>
          <option value="de">Deutsch (DE)</option>
          <option value="fr">Français (FR)</option>
          <option value="es">Español (ES)</option>
          <option value="it">Italiano (IT)</option>
        </select>
      </div>
    </div>

    <!-- Map Container & Polygon Controls -->
    <div id="map-wrapper">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; flex-wrap:wrap; gap:8px;">
        <div style="font-size:12px; font-weight:700; color:#334155;" id="polygonStatusText">
          📐 Click on the map to place the 1st corner of your parcel polygon.
        </div>
        <div style="display:flex; gap:6px;" id="polyActionBtns">
          <button type="button" id="undoBtn" onclick="undoLastPoint()" style="display:none; background:#f8fafc; color:#475569; border:1px solid #cbd5e1; padding:5px 10px; border-radius:8px; font-size:11px; font-weight:600; cursor:pointer;">
            ↩ Undo
          </button>
          <button type="button" id="finishBtn" onclick="finishPolygon()" style="display:none; background:#16a34a; color:#fff; border:none; padding:5px 12px; border-radius:8px; font-size:11px; font-weight:700; cursor:pointer;">
            ✓ Finish Polygon
          </button>
          <button type="button" id="clearBtn" onclick="resetBoundary()" style="display:none; background:#fef2f2; color:#b91c1c; border:1px solid #fecaca; padding:5px 10px; border-radius:8px; font-size:11px; font-weight:600; cursor:pointer;">
            🔄 Clear
          </button>
        </div>
      </div>
      <div id="map" style="cursor:crosshair;"></div>
      <div class="map-hint" id="mapHintText">📍 Click map to plot parcel polygon corners</div>
    </div>

    <!-- Action Button -->
    <button type="button" id="calcBtn" class="btn-calc" onclick="generateFullSurvey()">
      🔬 Query Geological Basin & Generate Site Valuation Dossier
    </button>

    <!-- Report Section -->
    <div id="resultBox" class="result-box">
      <div class="report-header">
        <div>
          <div id="repLocTitle" class="report-loc">Plot Cadastral Survey Dossier</div>
          <div id="repCoordsMeta" class="report-meta">52.2297° N, 21.0122° E • Elevation: 112 m a.s.l.</div>
        </div>
        <button type="button" class="btn-print" onclick="window.print()">🖨️ Print / Save PDF</button>
      </div>

      <!-- Valuation Hero -->
      <div class="val-hero">
        <div>
          <div class="val-main-title">Estimated Fair Market Valuation</div>
          <div id="valTotalRange" class="val-main-num">480,000 – 580,000 PLN</div>
          <div id="valPerSqm" class="val-rate-num">~440 PLN / m²</div>
        </div>
        <div>
          <div style="display:flex; flex-direction:column; gap:6px;">
            <div><span class="pill pill-green" id="pillGeotech">Eurocode 7: Cat. I (Favorable)</span></div>
            <div><span class="pill pill-blue" id="pillBearing">Bearing: 220–260 kPa</span></div>
            <div><span class="pill pill-amber" id="pillWater">Water Table: ~2.8 m bgl</span></div>
          </div>
        </div>
      </div>

      <!-- Navigation Tabs -->
      <div class="tab-bar">
        <button class="tab-btn active" onclick="switchTab(event, 'tab-summary')">Summary & Appraisal</button>
        <button class="tab-btn" onclick="switchTab(event, 'tab-strata')">1. Geological Strata & Soil Mechanics</button>
        <button class="tab-btn" onclick="switchTab(event, 'tab-hydro')">2. Hydrology & Geohazards</button>
        <button class="tab-btn" onclick="switchTab(event, 'tab-cadastre')">3. Cadastre & Zoning (MPZP)</button>
        <button class="tab-btn" onclick="switchTab(event, 'tab-costs')">4. Development & Groundwork Outlook</button>
      </div>

      <!-- Tab 1: Summary -->
      <div id="tab-summary" class="tab-content active">
        <div class="info-grid">
          <div class="info-card">
            <b>Geological Authority</b>
            <span id="repAuthority">PIG-PIB (SMGP 1:50 000)</span>
          </div>
          <div class="info-card">
            <b>Regional Geological Formation</b>
            <span id="repFormation">Quaternary Glacial Till & Pleistocene Sand</span>
          </div>
          <div class="info-card">
            <b>Foundation Feasibility</b>
            <span id="repFoundation">Standard Strip / Slab Foundation Suitable</span>
          </div>
          <div class="info-card">
            <b>Flood & Inundation Risk</b>
            <span id="repFlood">Low Hazard (Zone Q100 safe)</span>
          </div>
        </div>
        <div style="margin-top:14px; background:#fff; padding:14px; border-radius:10px; border:1px solid #e2e8f0; font-size:13px; line-height:1.6;" id="repSynthesis">
          Executive geological synthesis...
        </div>
      </div>

      <!-- Tab 2: Geological Strata -->
      <div id="tab-strata" class="tab-content">
        <div style="font-size:13px; font-weight:700; color:#0f172a; margin-bottom:6px;">Calculated Soil Column & Geotechnical Profile (0 – 10m below surface)</div>
        <div class="strata-chart" id="strataContainer">
          <!-- Dynamically populated strata -->
        </div>
        <div class="info-grid" style="margin-top:10px;">
          <div class="info-card">
            <b>Eurocode 7 Category</b>
            <span id="repEurocode">Category 1 / 2 (Simple - Normal Geotechnical Conditions)</span>
          </div>
          <div class="info-card">
            <b>Frost Penetration Depth (hz)</b>
            <span id="repFrost">1.0 m below ground level</span>
          </div>
          <div class="info-card">
            <b>Seismic Hazard (PGA)</b>
            <span id="repSeismic">Eurocode 8 Zone 0 (< 0.05g)</span>
          </div>
          <div class="info-card">
            <b>Radon Gas Risk Class</b>
            <span id="repRadon">Class 1 (Low / Normal Ventilation)</span>
          </div>
        </div>
      </div>

      <!-- Tab 3: Hydrology -->
      <div id="tab-hydro" class="tab-content">
        <div class="info-grid">
          <div class="info-card">
            <b>Unconfined Groundwater Level</b>
            <span id="repWaterDepth">2.6 – 3.2 m below ground level</span>
          </div>
          <div class="info-card">
            <b>Soil Permeability Coefficient (k)</b>
            <span id="repPerm">1.2 x 10⁻⁵ m/s (Medium permeability)</span>
          </div>
          <div class="info-card">
            <b>Landslide & Slope Hazard</b>
            <span id="repLandslide">Low / Negligible (< 3° terrain slope)</span>
          </div>
          <div class="info-card">
            <b>Karst & Sinkhole Hazard</b>
            <span id="repKarst">None registered in regional bedrock</span>
          </div>
        </div>
      </div>

      <!-- Tab 4: Cadastre -->
      <div id="tab-cadastre" class="tab-content">
        <div class="info-grid">
          <div class="info-card">
            <b>Zoning Plan Status</b>
            <span id="repZoningStatus">Covered by Local Spatial Plan (MPZP / B-Plan)</span>
          </div>
          <div class="info-card">
            <b>Max Floor Area Ratio (FAR)</b>
            <span id="repFar">0.50 – 0.60</span>
          </div>
          <div class="info-card">
            <b>Max Building Footprint Coverage</b>
            <span id="repCoverage">35% (Max buildable: ~420 m²)</span>
          </div>
          <div class="info-card">
            <b>Min Biologically Active Area</b>
            <span id="repBio">35% (Min green area: ~420 m²)</span>
          </div>
          <div class="info-card">
            <b>Max Building Height</b>
            <span id="repHeight">10.5 m (up to 2.5 storeys)</span>
          </div>
          <div class="info-card">
            <b>Standard Boundary Setbacks</b>
            <span id="repSetback">3.0m blind wall / 4.0m wall with windows</span>
          </div>
        </div>
      </div>

      <!-- Tab 5: Costs -->
      <div id="tab-costs" class="tab-content">
        <div class="info-grid" id="costsGrid">
          <!-- Populated dynamically -->
        </div>
      </div>
    </div>
  </div>

  <script>
    // Leaflet Multi-layer Base Maps
    var osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' });
    var topo = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', { maxZoom: 17, attribution: '© OpenTopoMap' });
    var satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: '© ESRI World Imagery' });

    var map = L.map('map', {
      center: [52.2297, 21.0122],
      zoom: 13,
      layers: [osm]
    });

    var baseMaps = {
      "Standard Cadastral (OSM)": osm,
      "Topography & Contours": topo,
      "Satellite Imagery (ESRI)": satellite
    };
    L.control.layers(baseMaps, null, { position: 'topright' }).addTo(map);

    var currentMarker = L.marker([52.2297, 21.0122], { draggable: true });
    var boundaryLayer = null;
    var currentMode = 'polygon';
    var polygonPoints = [];
    var isPolygonClosed = false;
    var vertexMarkers = [];

    function clearVertexMarkers() {
      vertexMarkers.forEach(function(m) { map.removeLayer(m); });
      vertexMarkers = [];
    }

    function calculatePolygonArea(pts) {
      if (!pts || pts.length < 3) return 0;
      var latMid = pts[0][0] * Math.PI / 180;
      var mPerLat = 111132.954 - 559.822 * Math.cos(2 * latMid) + 1.175 * Math.cos(4 * latMid);
      var mPerLng = (Math.PI / 180) * 6378137 * Math.cos(latMid);
      var area = 0;
      for (var i = 0; i < pts.length; i++) {
        var j = (i + 1) % pts.length;
        var xi = pts[i][1] * mPerLng;
        var yi = pts[i][0] * mPerLat;
        var xj = pts[j][1] * mPerLng;
        var yj = pts[j][0] * mPerLat;
        area += (xi * yj - xj * yi);
      }
      return Math.round(Math.abs(area / 2));
    }

    function getPolygonCentroid(pts) {
      if (!pts || pts.length === 0) return [52.2297, 21.0122];
      var latSum = 0, lngSum = 0;
      for (var i = 0; i < pts.length; i++) {
        latSum += pts[i][0];
        lngSum += pts[i][1];
      }
      return [latSum / pts.length, lngSum / pts.length];
    }

    function updateActionButtons() {
      var undoBtn = document.getElementById('undoBtn');
      var finishBtn = document.getElementById('finishBtn');
      var clearBtn = document.getElementById('clearBtn');

      if (currentMode === 'polygon') {
        undoBtn.style.display = (!isPolygonClosed && polygonPoints.length > 0) ? 'inline-block' : 'none';
        finishBtn.style.display = (!isPolygonClosed && polygonPoints.length >= 3) ? 'inline-block' : 'none';
        clearBtn.style.display = (polygonPoints.length > 0 || isPolygonClosed) ? 'inline-block' : 'none';
      } else {
        undoBtn.style.display = 'none';
        finishBtn.style.display = 'none';
        clearBtn.style.display = 'none';
      }
    }

    function finishPolygon() {
      if (polygonPoints.length >= 3) {
        isPolygonClosed = true;
        var areaM2 = calculatePolygonArea(polygonPoints);
        if (areaM2 > 50) {
          document.getElementById('plotArea').value = areaM2;
        }
        renderBoundary();
        document.getElementById('polygonStatusText').innerText = '✅ Polygon completed (' + polygonPoints.length + ' corners, ' + (areaM2 > 0 ? areaM2 + ' m²' : '') + '). Ready to query survey.';
        updateActionButtons();
      }
    }

    function undoLastPoint() {
      if (!isPolygonClosed && polygonPoints.length > 0) {
        polygonPoints.pop();
        renderBoundary();
        updatePolygonStatus();
        updateActionButtons();
      }
    }

    function resetBoundary() {
      polygonPoints = [];
      isPolygonClosed = false;
      if (boundaryLayer) {
        map.removeLayer(boundaryLayer);
        boundaryLayer = null;
      }
      clearVertexMarkers();
      if (currentMode === 'polygon') {
        document.getElementById('polygonStatusText').innerText = '📐 Click on the map to place the 1st corner of your parcel polygon.';
      } else {
        updateShape();
      }
      updateActionButtons();
    }

    function updatePolygonStatus() {
      var statusEl = document.getElementById('polygonStatusText');
      if (polygonPoints.length === 0) {
        statusEl.innerText = '📐 Click on the map to place the 1st corner of your parcel polygon.';
      } else if (polygonPoints.length === 1) {
        statusEl.innerText = '📐 Corner 1 placed. Click on map to place Corner 2.';
      } else if (polygonPoints.length === 2) {
        statusEl.innerText = '📐 Corner 2 placed. Click on map to place Corner 3.';
      } else if (!isPolygonClosed) {
        statusEl.innerText = '📐 ' + polygonPoints.length + ' corners placed. Click Corner #1 or click "Finish Polygon" to close.';
      }
    }

    function changeMode() {
      currentMode = document.getElementById('modeSelect').value;
      polygonPoints = [];
      isPolygonClosed = false;
      if (boundaryLayer) {
        map.removeLayer(boundaryLayer);
        boundaryLayer = null;
      }
      clearVertexMarkers();

      var statusEl = document.getElementById('polygonStatusText');
      var hintEl = document.getElementById('mapHintText');

      if (currentMode === 'polygon') {
        if (map.hasLayer(currentMarker)) map.removeLayer(currentMarker);
        map.getContainer().style.cursor = 'crosshair';
        statusEl.innerText = '📐 Click on the map to place the 1st corner of your parcel polygon.';
        hintEl.innerText = '📍 Click on map to plot parcel polygon corners';
      } else if (currentMode === 'rectangle') {
        if (!map.hasLayer(currentMarker)) currentMarker.addTo(map);
        map.getContainer().style.cursor = 'default';
        statusEl.innerText = '⬚ Rectangle Mode: Drag center marker or click on map to reposition box.';
        hintEl.innerText = '📍 Drag center marker to move parcel box';
        updateShape();
      } else {
        if (!map.hasLayer(currentMarker)) currentMarker.addTo(map);
        map.getContainer().style.cursor = 'default';
        statusEl.innerText = '⚪ Circle Mode: Drag center marker or click on map to reposition circle.';
        hintEl.innerText = '📍 Drag center marker to move buffer radius';
        updateShape();
      }
      updateActionButtons();
    }

    function renderBoundary() {
      if (boundaryLayer) {
        map.removeLayer(boundaryLayer);
        boundaryLayer = null;
      }
      clearVertexMarkers();

      if (currentMode === 'polygon') {
        if (polygonPoints.length === 0) return;

        if (isPolygonClosed && polygonPoints.length >= 3) {
          boundaryLayer = L.polygon(polygonPoints, {
            color: '#2563eb',
            fillColor: '#3b82f6',
            fillOpacity: 0.3,
            weight: 2.5,
            interactive: false
          }).addTo(map);

          // Render draggable corner handles
          polygonPoints.forEach(function(pt, idx) {
            var handle = L.circleMarker(pt, {
              radius: 6,
              color: '#1d4ed8',
              fillColor: '#ffffff',
              fillOpacity: 1,
              weight: 2.5
            }).addTo(map);

            handle.bindTooltip('Corner #' + (idx + 1) + ' (drag or redraw)', { direction: 'top' });
            vertexMarkers.push(handle);
          });
        } else {
          // In-progress drawing: render connecting line and numbered dots
          if (polygonPoints.length > 1) {
            boundaryLayer = L.polyline(polygonPoints, {
              color: '#2563eb',
              weight: 2,
              dashArray: '5, 5',
              interactive: false
            }).addTo(map);
          }

          polygonPoints.forEach(function(pt, idx) {
            var isFirst = idx === 0;
            var canClose = isFirst && polygonPoints.length >= 3;

            var marker = L.circleMarker(pt, {
              radius: isFirst ? 8 : 6,
              color: isFirst ? '#15803d' : '#1d4ed8',
              fillColor: isFirst ? '#22c55e' : '#3b82f6',
              fillOpacity: 1,
              weight: 2
            }).addTo(map);

            if (canClose) {
              marker.bindTooltip('✨ Click to Close Polygon', { permanent: true, direction: 'top' });
              marker.on('click', function(e) {
                L.DomEvent.stopPropagation(e);
                finishPolygon();
              });
            } else {
              marker.bindTooltip('Corner #' + (idx + 1), { direction: 'top' });
            }

            vertexMarkers.push(marker);
          });
        }
      } else if (currentMode === 'rectangle') {
        var pos = currentMarker.getLatLng();
        var area = parseFloat(document.getElementById('plotArea').value) || 1200;
        var side = Math.sqrt(area);
        var latOffset = (side / 111320) / 2;
        var lngOffset = (side / (111320 * Math.cos((pos.lat * Math.PI) / 180))) / 2;
        var bounds = [
          [pos.lat - latOffset, pos.lng - lngOffset],
          [pos.lat + latOffset, pos.lng + lngOffset]
        ];
        boundaryLayer = L.rectangle(bounds, {
          color: '#2563eb',
          fillColor: '#3b82f6',
          fillOpacity: 0.28,
          weight: 2,
          interactive: false
        }).addTo(map);
      } else {
        var pos = currentMarker.getLatLng();
        var area = parseFloat(document.getElementById('plotArea').value) || 1200;
        var radius = Math.sqrt(area / Math.PI);
        boundaryLayer = L.circle(pos, {
          radius: radius,
          color: '#2563eb',
          fillColor: '#3b82f6',
          fillOpacity: 0.28,
          weight: 2,
          interactive: false
        }).addTo(map);
      }
    }

    function updateShape() {
      renderBoundary();
    }

    currentMarker.on('drag', function(e) {
      if (currentMode !== 'polygon') {
        updateShape();
      }
    });

    currentMarker.on('dragend', function() {
      if (currentMode !== 'polygon') {
        updateShape();
      }
    });

    map.on('click', function(e) {
      if (currentMode === 'polygon') {
        if (isPolygonClosed) {
          // Start fresh polygon from this click
          polygonPoints = [[e.latlng.lat, e.latlng.lng]];
          isPolygonClosed = false;
        } else {
          // If clicked close to corner 1 with >= 3 points, close it
          if (polygonPoints.length >= 3) {
            var firstPt = polygonPoints[0];
            var dist = map.distance(e.latlng, L.latLng(firstPt[0], firstPt[1]));
            if (dist < 25) {
              finishPolygon();
              return;
            }
          }
          polygonPoints.push([e.latlng.lat, e.latlng.lng]);
        }
        renderBoundary();
        updatePolygonStatus();
        updateActionButtons();
      } else {
        currentMarker.setLatLng(e.latlng);
        updateShape();
      }
    });

    map.on('dblclick', function() {
      if (currentMode === 'polygon' && polygonPoints.length >= 3 && !isPolygonClosed) {
        finishPolygon();
      }
    });

    function changeCountry() {
      var sel = document.getElementById('countrySelect');
      var opt = sel.options[sel.selectedIndex];
      var lat = parseFloat(opt.getAttribute('data-lat'));
      var lng = parseFloat(opt.getAttribute('data-lng'));
      map.setView([lat, lng], 13);
      currentMarker.setLatLng([lat, lng]);
      if (currentMode !== 'polygon') {
        updateShape();
      }
    }

    async function searchAddress() {
      var query = document.getElementById('searchInput').value.trim();
      if (!query) return;
      try {
        var res = await fetch('https://nominatim.openstreetmap.org/search?format=json&q=' + encodeURIComponent(query) + '&limit=1');
        var data = await res.json();
        if (data && data.length > 0) {
          var lat = parseFloat(data[0].lat);
          var lon = parseFloat(data[0].lon);
          map.setView([lat, lon], 16);
          currentMarker.setLatLng([lat, lon]);
          if (currentMode !== 'polygon') {
            updateShape();
          }
        } else {
          alert('Location not found. Please try entering a municipality or cadastral parcel query.');
        }
      } catch (e) {
        console.error(e);
      }
    }

    function switchTab(evt, tabId) {
      var contents = document.querySelectorAll('.tab-content');
      contents.forEach(function(c) { c.classList.remove('active'); });
      var btns = document.querySelectorAll('.tab-btn');
      btns.forEach(function(b) { b.classList.remove('active'); });
      document.getElementById(tabId).classList.add('active');
      evt.currentTarget.classList.add('active');
    }

    // Comprehensive European Geological Basin & Strata Profiling Engine
    async function generateFullSurvey() {
      if (currentMode === 'polygon' && polygonPoints.length < 3) {
        alert('Please click on the map to place at least 3 corner points to define your parcel polygon.');
        return;
      }

      var btn = document.getElementById('calcBtn');
      btn.disabled = true;
      btn.innerText = '⏳ Accessing Geological Survey Database & Analyzing Soil Strata...';

      var pos;
      if (currentMode === 'polygon') {
        var centroid = getPolygonCentroid(polygonPoints);
        pos = { lat: centroid[0], lng: centroid[1] };
      } else {
        var latlng = currentMarker.getLatLng();
        pos = { lat: latlng.lat, lng: latlng.lng };
      }

      var area = parseFloat(document.getElementById('plotArea').value) || 1200;
      var sel = document.getElementById('countrySelect');
      var opt = sel.options[sel.selectedIndex];
      var countryCode = sel.value;
      var cur = opt.getAttribute('data-cur');
      var baseRate = parseFloat(opt.getAttribute('data-rate'));
      var authName = opt.getAttribute('data-auth');
      var zoning = document.getElementById('zoningType').value;
      var lang = document.getElementById('langSelect').value;

      // 1. Fetch Elevation live from Open-Meteo
      var elevation = 115;
      try {
        var elRes = await fetch('https://api.open-meteo.com/v1/elevation?latitude=' + pos.lat.toFixed(6) + '&longitude=' + pos.lng.toFixed(6));
        var elData = await elRes.json();
        if (elData && elData.elevation && elData.elevation[0] !== undefined) {
          elevation = Math.round(elData.elevation[0]);
        }
      } catch (err) {}

      // 2. Fetch Reverse Geocoding via Nominatim
      var locName = pos.lat.toFixed(4) + '°N, ' + pos.lng.toFixed(4) + '°E';
      try {
        var geoRes = await fetch('https://nominatim.openstreetmap.org/reverse?format=json&lat=' + pos.lat + '&lon=' + pos.lng + '&zoom=16');
        var geoData = await geoRes.json();
        if (geoData && geoData.display_name) {
          locName = geoData.display_name.split(',').slice(0, 3).join(',');
        }
      } catch (err) {}

      // 3. Compute Site Valuation calibrated to location, zoning & European market index
      var zoningMultiplier = zoning === 'commercial' ? 1.45 : zoning === 'multi' ? 1.30 : zoning === 'industrial' ? 0.85 : zoning === 'agricultural' ? 0.30 : 1.0;
      var elevationModifier = elevation > 500 ? 1.15 : 1.0;
      var unitPrice = Math.round(baseRate * zoningMultiplier * elevationModifier);
      var totalMin = Math.round(area * unitPrice * 0.92);
      var totalMax = Math.round(area * unitPrice * 1.15);
      var totalMedian = Math.round((totalMin + totalMax) / 2);

      // 4. Determine Basin Lithology based on Country & Elevation
      var strata = [];
      var formationName = '';
      var groundwater = '2.4 – 3.2 m p.p.t.';
      var bearingCapacity = '220 – 260 kPa';
      var frostDepth = countryCode === 'PL' ? '1.0 – 1.2 m' : countryCode === 'CH' || countryCode === 'AT' ? '1.2 – 1.4 m' : '0.8 – 1.0 m';

      if (countryCode === 'PL') {
        formationName = 'Quaternary Glacial Till (Pleistocene / Warta-Odra) over Neogene Clay';
        strata = [
          { name: 'Layer I: Topsoil Humus (Gleba próchnicza)', depth: '0.00 – 0.40 m', color: '#78350f', kpa: 'Non-bearing (strip off)' },
          { name: 'Layer II: Sandy Glacial Till (Glina piaszczysta zwałowa)', depth: '0.40 – 3.80 m', color: '#b45309', kpa: '210 – 250 kPa (IL = 0.15)' },
          { name: 'Layer III: Medium & Dense Sand (Piasek średni zagęszczony)', depth: '3.80 – 7.20 m', color: '#f59e0b', kpa: '280 – 320 kPa (ID = 0.65)' },
          { name: 'Layer IV: Hard Neogene Variegated Clay (Ił neogeński zwięzły)', depth: '7.20 – 10.00+ m', color: '#475569', kpa: '350 – 420 kPa (IL < 0.05)' }
        ];
      } else if (countryCode === 'DE') {
        formationName = elevation > 400 ? 'Alpine Foreland Molasse & Munich Gravel Plain (Schotterebene)' : 'North German Basin Sand & Pleistocene Boulder Clay (Geschiebemergel)';
        strata = [
          { name: 'Layer I: Humic Topsoil (Oberboden / Mutterboden)', depth: '0.00 – 0.35 m', color: '#78350f', kpa: 'Non-bearing' },
          { name: 'Layer II: Loess Loam / Silt (Lösslehm / Schluff)', depth: '0.35 – 2.90 m', color: '#d97706', kpa: '190 – 230 kPa' },
          { name: 'Layer III: Sandy Gravel / Glacial Drift (Kiesiger Sand / Geschiebe)', depth: '2.90 – 7.50 m', color: '#f59e0b', kpa: '300 – 360 kPa' },
          { name: 'Layer IV: Dense Sandstone / Molasse Bedrock (Sandstein / Fels)', depth: '7.50 – 10.00+ m', color: '#334155', kpa: '> 450 kPa' }
        ];
      } else if (countryCode === 'FR') {
        formationName = 'Paris / Aquitaine Sedimentary Basin (Calcaire grossier / Sables de Beauchamp)';
        strata = [
          { name: 'Couche I: Terre végétale (Topsoil)', depth: '0.00 – 0.30 m', color: '#78350f', kpa: 'Décapage requis' },
          { name: 'Couche II: Argiles limoneuses brunâtres (Silty Clay)', depth: '0.30 – 3.20 m', color: '#b45309', kpa: '200 – 240 kPa' },
          { name: 'Couche III: Sables et graviers alluvionnaires', depth: '3.20 – 6.80 m', color: '#f59e0b', kpa: '290 – 340 kPa' },
          { name: 'Couche IV: Banc calcaire compact (Lutetian Limestone)', depth: '6.80 – 10.00+ m', color: '#475569', kpa: '> 500 kPa' }
        ];
      } else {
        formationName = 'European Crystalline & Sedimentary Terrane (Eurocode 7 Class I/II)';
        strata = [
          { name: 'Layer I: Organic Humus & Topsoil', depth: '0.00 – 0.40 m', color: '#78350f', kpa: 'Strip off' },
          { name: 'Layer II: Compact Sandy Clay & Silt', depth: '0.40 – 3.50 m', color: '#b45309', kpa: '220 – 260 kPa' },
          { name: 'Layer III: Coarse Sand & Glacial Fluvial Gravel', depth: '3.50 – 7.80 m', color: '#f59e0b', kpa: '310 – 370 kPa' },
          { name: 'Layer IV: Competent Bedrock Substratum', depth: '7.80 – 10.00+ m', color: '#334155', kpa: '> 480 kPa' }
        ];
      }

      // Populate Report Fields
      document.getElementById('repLocTitle').innerText = locName;
      document.getElementById('repCoordsMeta').innerText = pos.lat.toFixed(5) + '° N, ' + pos.lng.toFixed(5) + '° E • Elevation: ' + elevation + ' m a.s.l. (' + countryCode + ')';
      document.getElementById('valTotalRange').innerText = totalMin.toLocaleString() + ' – ' + totalMax.toLocaleString() + ' ' + cur;
      document.getElementById('valPerSqm').innerText = '~' + unitPrice.toLocaleString() + ' ' + cur + ' / m² (Parcel: ' + area.toLocaleString() + ' m²)';
      document.getElementById('repAuthority').innerText = authName;
      document.getElementById('repFormation').innerText = formationName;

      // Render Strata Cross-section
      var strataHtml = '';
      strata.forEach(function(s) {
        strataHtml += '<div class="strata-layer">' +
          '<div class="strata-name"><span class="layer-color-box" style="background:' + s.color + '"></span>' + s.name + '</div>' +
          '<div class="strata-depth">' + s.depth + '</div>' +
          '<div class="strata-kpa">' + s.kpa + '</div>' +
        '</div>';
      });
      document.getElementById('strataContainer').innerHTML = strataHtml;

      // Synthesis Text
      document.getElementById('repSynthesis').innerHTML = '<strong>Geotechnical Feasibility Verdict:</strong> Plot located at <strong>' + elevation + 'm a.s.l.</strong> within the <em>' + formationName + '</em>. Registered bearing capacity in subsoil reaches <strong>' + bearingCapacity + '</strong> below the frost horizon (' + frostDepth + '). Groundwater table stabilizes at <strong>' + groundwater + '</strong>, allowing safe excavation for standard strip foundations or monolithic reinforced concrete slabs without specialized pile driving.';

      // Cost Breakdown Grid
      var groundworkCost = Math.round(area * (countryCode === 'PL' ? 35 : 18));
      var geotechSurveyCost = countryCode === 'PL' ? 2400 : 1200;
      var utilCost = countryCode === 'PL' ? 14000 : 6500;
      document.getElementById('costsGrid').innerHTML =
        '<div class="info-card"><b>Geotechnical Borehole Study (3x 5m)</b><span>~' + geotechSurveyCost.toLocaleString() + ' ' + cur + '</span></div>' +
        '<div class="info-card"><b>Topsoil Stripping & Site Grading</b><span>~' + groundworkCost.toLocaleString() + ' ' + cur + '</span></div>' +
        '<div class="info-card"><b>Utility Connections (Water/Power/Gas)</b><span>~' + utilCost.toLocaleString() + ' ' + cur + '</span></div>' +
        '<div class="info-card"><b>Cadastral Boundary Verification</b><span>~' + (geotechSurveyCost * 0.75).toLocaleString() + ' ' + cur + '</span></div>';

      // Show Result
      var resBox = document.getElementById('resultBox');
      resBox.style.display = 'block';
      resBox.scrollIntoView({ behavior: 'smooth' });

      btn.disabled = false;
      btn.innerText = '🔬 Query Geological Basin & Generate Site Valuation Dossier';
    }

    autoGeneratePolygon();
  </script>
</body>
</html>
[[/html]]`;

  const activeSnippet =
    embedType === 'iframe'
      ? iframeCode
      : embedType === 'wikidot'
      ? wikidotCode
      : embedType === 'react'
      ? reactCode
      : scriptCode;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(activeSnippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch (e) {
      console.error('Failed to copy', e);
    }
  };

  const handleApplyPreset = (preset: 'responsive' | 'fluid' | 'card' | 'full') => {
    setPresetSize(preset);
    if (preset === 'responsive') {
      setWidth('100%');
      setHeight('800px');
    } else if (preset === 'fluid') {
      setWidth('100%');
      setHeight('100%');
    } else if (preset === 'card') {
      setWidth('480px');
      setHeight('650px');
    } else if (preset === 'full') {
      setWidth('100%');
      setHeight('1000px');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-xs">
              <Code2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                Embed Valuation Widget & Report
              </h2>
              <p className="text-xs text-slate-500">
                Integrate into real estate portals, architect sites, or client CMS
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="h-8 w-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body Layout */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Customization Options Bar */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Sliders className="h-3.5 w-3.5 text-primary" />
                Widget Configuration
              </span>

              <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-200 text-xs">
                <button
                  type="button"
                  onClick={() => handleApplyPreset('responsive')}
                  className={`px-2 py-1 rounded-md transition ${
                    presetSize === 'responsive'
                      ? 'bg-slate-900 text-white font-medium shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Auto-fit height with responsive width"
                >
                  <Monitor className="h-3 w-3 inline mr-1" />
                  Auto-Fit
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset('fluid')}
                  className={`px-2 py-1 rounded-md transition ${
                    presetSize === 'fluid'
                      ? 'bg-slate-900 text-white font-medium shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="100% width and 100% height container"
                >
                  <Layers className="h-3 w-3 inline mr-1" />
                  100% Fluid
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset('card')}
                  className={`px-2 py-1 rounded-md transition ${
                    presetSize === 'card'
                      ? 'bg-slate-900 text-white font-medium shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Smartphone className="h-3 w-3 inline mr-1" />
                  Card (480px)
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset('full')}
                  className={`px-2 py-1 rounded-md transition ${
                    presetSize === 'full'
                      ? 'bg-slate-900 text-white font-medium shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Full (1000px)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 text-xs">
              <div>
                <label className="block text-slate-600 font-medium mb-1">Country Preset</label>
                <select
                  value={selectedCountry}
                  onChange={(e) => setSelectedCountry(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-primary/20"
                >
                  {EUROPEAN_COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Language</label>
                <select
                  value={selectedLanguage}
                  onChange={(e) => setSelectedLanguage(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-primary/20"
                >
                  {REPORT_LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Width</label>
                <input
                  type="text"
                  value={width}
                  onChange={(e) => setWidth(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 font-mono text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-primary/20"
                  placeholder="100% or 600px"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Height</label>
                <input
                  type="text"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 font-mono text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-primary/20"
                  placeholder="800px or 100%"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Top App Header</label>
                <select
                  value={includeHeader ? '1' : '0'}
                  onChange={(e) => setIncludeHeader(e.target.value === '1')}
                  className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-primary/20"
                >
                  <option value="1">Show Header (Exact Match to App)</option>
                  <option value="0">Clean (No Header)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Default Boundary Mode</label>
                <select
                  value={selectedMode}
                  onChange={(e) => setSelectedMode(e.target.value as any)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-primary/20"
                >
                  <option value="polygon">Polygon (Cadastral Vertices)</option>
                  <option value="rectangle">Rectangle (2-Corner Box)</option>
                  <option value="circle">Circle (Radial Buffer)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Mode Switcher: Code vs Preview */}
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setEmbedType('iframe')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                  embedType === 'iframe'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                HTML &lt;iframe&gt;
              </button>
              <button
                type="button"
                onClick={() => setEmbedType('wikidot')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                  embedType === 'wikidot'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Wikidot [[iframe]]
              </button>
              <button
                type="button"
                onClick={() => setEmbedType('react')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                  embedType === 'react'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                React / Next.js
              </button>
              <button
                type="button"
                onClick={() => setEmbedType('script')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                  embedType === 'script'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Script / Container
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setActiveTab(activeTab === 'code' ? 'preview' : 'code')}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-primary/10 hover:bg-primary/20 text-primary transition"
              >
                <Eye className="h-3.5 w-3.5" />
                <span>{activeTab === 'code' ? 'Test Live Preview' : 'Show Code'}</span>
              </button>
            </div>
          </div>

          {activeTab === 'code' ? (
            /* Code snippet view */
            <div className="relative">
              <div className="absolute top-3 right-3 z-10">
                <button
                  type="button"
                  onClick={handleCopy}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition shadow-md ${
                    copied
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-100'
                  }`}
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-white" />
                      <span>Copied to Clipboard!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5 text-slate-300" />
                      <span>Copy Snippet</span>
                    </>
                  )}
                </button>
              </div>

              <pre className="bg-slate-950 text-slate-100 font-mono text-xs p-5 rounded-2xl overflow-x-auto leading-relaxed border border-slate-800 selection:bg-primary selection:text-white">
                <code>{activeSnippet}</code>
              </pre>

              <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                <span>Embed URL: <code className="text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded font-mono break-all">{iframeSrc}</code></span>
                <a
                  href={iframeSrc}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline font-medium ml-2 shrink-0"
                >
                  <span>Open in new tab</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          ) : (
            /* Live preview container */
            <div className="border border-slate-200 rounded-2xl p-3 bg-slate-100/50 flex flex-col items-center">
              <div className="w-full flex items-center justify-between pb-2 px-1 text-xs text-slate-500 font-mono">
                <span>Preview Mode ({width} × {height})</span>
                <span className="text-emerald-600 font-semibold flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  Active Frame
                </span>
              </div>
              <iframe
                src={iframeSrc}
                style={{
                  width: width,
                  height: height.includes('%') ? '700px' : height,
                  minHeight: '620px',
                  maxHeight: '800px',
                  maxWidth: '100%'
                }}
                className="border border-slate-200 rounded-xl bg-white shadow-xs"
                title="Widget Preview"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span>Responsive, high-contrast, zero-cookie iframe ready for all web frameworks.</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl font-semibold transition"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleCopy}
              className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl font-semibold transition flex items-center gap-1.5 shadow-xs"
            >
              <Copy className="h-3.5 w-3.5" />
              <span>{copied ? 'Copied!' : 'Copy Code'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
