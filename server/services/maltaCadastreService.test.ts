import test from 'node:test';
import assert from 'node:assert/strict';
import { applyMaltaCadastreToReport, queryMaltaCadastre } from './maltaCadastreService';

const caps='<WFS_Capabilities><FeatureTypeList><FeatureType><Name xmlns:mt="urn:mt">mt:registered_parcels</Name></FeatureType></FeatureTypeList></WFS_Capabilities>';
const schema='<schema><element name="geometry" type="gml:MultiSurfacePropertyType"/></schema>';
const response=(body:any,status=200,type='application/json')=>new Response(typeof body==='string'?body:JSON.stringify(body),{status,headers:{'content-type':type}});

test('Malta registered-land service returns containing parcel without claiming legal boundary conclusiveness',async()=>{
  const fetcher:typeof fetch=async(input:any)=>{
    const url=new URL(String(input));
    if(url.searchParams.get('REQUEST')==='GetCapabilities') return response(caps,200,'text/xml');
    if(url.searchParams.get('REQUEST')==='DescribeFeatureType') return response(schema,200,'text/xml');
    return response({type:'FeatureCollection',features:[{
      type:'Feature',id:'feature-1',
      geometry:{type:'Polygon',coordinates:[[[14.50,35.89],[14.52,35.89],[14.52,35.91],[14.50,35.91],[14.50,35.89]]]},
      properties:{localId:'MT-1234',label:'Parcel 1234',area_m2:'625'}
    }]});
  };
  const result=await queryMaltaCadastre(35.9,14.51,fetcher);
  assert.equal(result.success,true);
  assert.equal(result.parcel?.parcelId,'MT-1234');
  assert.equal(result.parcel?.officialAreaM2,625);
  assert.match(result.evidence[0].limitation,/should not be treated as an official record|does not establish ownership/i);

  const report:any={parcel:{countryCode:'MT',isOfficialGeometry:false,areaCalculatedM2:600},evidenceRegistry:[{id:'cadastre-spatial-index'}]};
  applyMaltaCadastreToReport(report,result,600);
  assert.equal(report.parcel.status,'VERIFIED');
  assert.equal(report.parcel.isOfficialGeometry,false);
  assert.equal(report.parcel.officialAreaM2,625);
  assert.equal(report.parcel.geometryPoints,undefined);
  assert.ok(Array.isArray(report.malta_cadastre.geometryScreeningOnly));
});

test('Malta registered-land source failure remains requires verification',async()=>{
  const fetcher:typeof fetch=async()=>response('unavailable',503,'text/plain');
  const result=await queryMaltaCadastre(35.9,14.51,fetcher);
  assert.equal(result.success,false);
  assert.equal(result.reasonCode,'SOURCE_UNAVAILABLE');
  assert.equal(result.evidence[0].status,'REQUIRES_VERIFICATION');
});
