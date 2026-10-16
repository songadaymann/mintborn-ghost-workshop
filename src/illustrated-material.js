import * as THREE from 'three';

// Same palette and shadow direction as Clock Square, softened to retain cotton folds.
export function addIllustratedCloth(material) {
  // v4 (2026-09-28): finish 1 = velvet rim sheen, 2 = glow-in-the-dark (emits with `night`).
  const controls={ink:{value:1},illustration:{value:.72},markings:{value:null},hasMarks:{value:0},starlight:{value:0},
    finish:{value:0},night:{value:0},glowColor:{value:new THREE.Color('#72ffae')},sheenColor:{value:new THREE.Color('#ffffff')}};
  material.onBeforeCompile=shader=>{
    shader.uniforms.ghostIllustration=controls.illustration;
    shader.uniforms.ghostMarkings=controls.markings;
    shader.uniforms.ghostHasMarks=controls.hasMarks;
    shader.uniforms.ghostStarlight=controls.starlight;
    shader.uniforms.ghostFinish=controls.finish;shader.uniforms.ghostNight=controls.night;shader.uniforms.ghostGlowColor=controls.glowColor;shader.uniforms.ghostSheenColor=controls.sheenColor;
    shader.vertexShader='varying vec2 vGhostUv;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nvGhostUv=uv;');
    shader.fragmentShader='varying vec2 vGhostUv;\nuniform float ghostIllustration;\nuniform sampler2D ghostMarkings;\nuniform float ghostHasMarks;\nuniform float ghostStarlight;\nuniform float ghostFinish;\nuniform float ghostNight;\nuniform vec3 ghostGlowColor;\nuniform vec3 ghostSheenColor;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      float ghostPrintMask=0.;
      if(ghostStarlight>.5){
        // UV-anchored flecks: stable under motion, filtered once below a pixel.
        vec2 starUv=vGhostUv*vec2(70.,54.);
        vec2 cell=floor(starUv),f=fract(starUv)-.5;
        float seed=fract(sin(dot(cell,vec2(127.1,311.7)))*43758.5453);
        float aa=max(fwidth(starUv.x),fwidth(starUv.y));
        float speck=1.-smoothstep(.025,.065+aa,length(f));
        float visible=step(.94,seed)*(1.-smoothstep(.5,1.5,aa));
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.78,.84,.97),speck*visible*.82);
      }
      if(ghostHasMarks>.5){vec4 textile=texture2D(ghostMarkings,vGhostUv);diffuseColor.rgb=mix(diffuseColor.rgb,textile.rgb,textile.a);ghostPrintMask=textile.a;}`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <shadowmap_pars_fragment>','#include <shadowmap_pars_fragment>\n#include <shadowmask_pars_fragment>');
    shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
      float ghostNd=.8;
      #if NUM_DIR_LIGHTS > 0
        ghostNd=dot(normal,directionalLights[0].direction);
      #endif
      float broadLight=.52+.26*smoothstep(-.15,.12,ghostNd)+.22*smoothstep(.40,.59,ghostNd);
      float ghostShadow=mix(.48,1.,smoothstep(.28,.72,getShadowMask()));
      vec3 painted=diffuseColor.rgb*mix(vec3(.42,.58,.68),vec3(1.21,1.16,1.04),broadLight*ghostShadow);
      if(ghostFinish>.5&&ghostFinish<1.5){
        // Velvet: pile darkens where it faces you and catches light along the rim.
        float facing=abs(dot(normalize(normal),normalize(vViewPosition)));
        float rim=pow(1.-facing,2.4);
        painted=painted*mix(.72,1.05,facing)+ghostSheenColor*rim*.62*broadLight;
        outgoingLight=outgoingLight*mix(.8,1.,facing)+ghostSheenColor*rim*.35;
      }
      outgoingLight=mix(outgoingLight,painted,ghostIllustration);
      if(ghostFinish>1.5){
        // Glow-in-the-dark: phosphor paint (print) glows brightest, the cloth itself softly.
        float ghostGlowMask=mix(.5,1.9,ghostPrintMask);
        outgoingLight=mix(outgoingLight,outgoingLight*.35+ghostGlowColor*ghostGlowMask,ghostNight);
      }
      #include <opaque_fragment>`);
  };
  material.customProgramCacheKey=()=> 'mintborn-illustrated-cloth-04';
  return controls;
}

export function makeContour(geometry) {
  const material=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{resolution:{value:new THREE.Vector2(970,720)},width:{value:.85},inkColor:{value:new THREE.Color('#43524f')},openwork:{value:null},hasOpenwork:{value:0}},
    vertexShader:`uniform vec2 resolution;uniform float width;varying vec2 vOpenUv;
      void main(){vOpenUv=uv;vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.);vec3 n=normalMatrix*normal;
      vec2 q=(projectionMatrix*vec4(n,0.)).xy;q/=max(length(q),.001);p.xy+=q*width*2./resolution*p.w;gl_Position=p;}`,
    fragmentShader:`uniform vec3 inkColor;uniform sampler2D openwork;uniform float hasOpenwork;varying vec2 vOpenUv;
      void main(){if(hasOpenwork>.5&&texture2D(openwork,vOpenUv).g<.5)discard;gl_FragColor=vec4(inkColor,1.);
      #include <colorspace_fragment>
    }`});
  const mesh=new THREE.Mesh(geometry,material);mesh.renderOrder=1;mesh.name='Fine cloth contour';
  return mesh;
}
