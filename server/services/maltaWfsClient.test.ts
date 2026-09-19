import test from 'node:test';
import assert from 'node:assert/strict';
import { pointInGeometry, queryMaltaWfs } from './maltaWfsClient';

const response=(body:string,status=200,contentType='application/json')=>new Response(body,{status,headers:{'content-type':contentType}});
const caps='<WFS_Capabilities><FeatureTypeList><FeatureType><Name xmlns:mt="urn:mt">mt:test_layer</Name><Title>Test layer</Title></FeatureType></FeatureTypeList></WFS_Capabilities>';
const schema='<schema><element name="geometry" type="gml:GeometryPropertyType"/></schema>';

test('Malta WFS client discovers the feature type and returns GeoJSON features',async()=>{
  const fetcher:typeof fetch=async(input:any)=>{
    const url=new URL(String(input));
    if(url.searchParams.get('REQUEST')==='GetCapabilities') return response(caps,200,'text/xml');
    if(url.searchParams.get('REQUEST')==='DescribeFeatureType') return response(schema,200,'text/xml');
    assert.match(url.searchParams.get('FILTER') || '', /ValueReference>geometry<\/fes:ValueReference/);
    assert.match(url.searchParams.get('FILTER') || '', /lowerCorner>35\./);
    return response(JSON.stringify({type:'FeatureCollection',features:[{type:'Feature',geometry:{type:'Point',coordinates:[14.51,35.9]},properties:{name:'test'}}]}));
  };
  const result=await queryMaltaWfs('https://example.test/wfs',35.9,14.51,20,fetcher);
  assert.equal(result.status,'OK');
  assert.equal(result.typeName,'mt:test_layer');
  assert.equal(result.features.length,1);
});

test('Malta WFS client fails closed when the feature schema has no geometry property',async()=>{
  const fetcher:typeof fetch=async(input:any)=>{
    const url=new URL(String(input));
    if(url.searchParams.get('REQUEST')==='GetCapabilities') return response(caps,200,'text/xml');
    if(url.searchParams.get('REQUEST')==='DescribeFeatureType') return response('<schema><element name="name" type="string"/></schema>',200,'text/xml');
    return response(JSON.stringify({type:'FeatureCollection',features:[]}));
  };
  const result=await queryMaltaWfs('https://example.test/wfs',35.9,14.51,20,fetcher);
  assert.equal(result.status,'MALFORMED_DATA');
});

test('Malta WFS client fails closed when capabilities are malformed',async()=>{
  const fetcher:typeof fetch=async()=>response('<WFS_Capabilities/>',200,'text/xml');
  const result=await queryMaltaWfs('https://example.test/wfs',35.9,14.51,20,fetcher);
  assert.equal(result.status,'MALFORMED_DATA');
});

test('point-in-polygon helper distinguishes containing and nearby polygons',()=>{
  const polygon={type:'Polygon',coordinates:[[[14.50,35.89],[14.52,35.89],[14.52,35.91],[14.50,35.91],[14.50,35.89]]]};
  assert.equal(pointInGeometry(polygon,14.51,35.9),true);
  assert.equal(pointInGeometry(polygon,14.55,35.9),false);
});

test('Malta WFS treats a successful empty FeatureCollection as no features, not source failure',async()=>{
  const fetcher:typeof fetch=async(input:any)=>{
    const url=new URL(String(input));
    if(url.searchParams.get('REQUEST')==='GetCapabilities') return response(caps,200,'text/xml');
    if(url.searchParams.get('REQUEST')==='DescribeFeatureType') return response(schema,200,'text/xml');
    return response(JSON.stringify({type:'FeatureCollection'}));
  };
  const result=await queryMaltaWfs('https://example.test/wfs',35.9,14.51,20,fetcher);
  assert.equal(result.status,'OK');
  assert.deepEqual(result.features,[]);
});
