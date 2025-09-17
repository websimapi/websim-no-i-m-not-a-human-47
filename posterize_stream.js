export function createPosterizeStream(canvas, width, height, levels=5.0, edgeMix=0.12){
  const gl = canvas.getContext('webgl'); if(!gl) return null;
  const vs=`attribute vec2 a;attribute vec2 b;varying vec2 v;void main(){v=b;gl_Position=vec4(a,0.,1.);}`;
  const fs=`precision highp float;uniform sampler2D t;uniform vec2 px;uniform float lv,em,tm,fg;varying vec2 v;
float l(vec3 c){return dot(c,vec3(0.299,0.587,0.114));}vec3 pz(vec3 c,float k){return floor(c*k)/k;}
float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);float a=h(i),b=h(i+vec2(1,0)),c=h(i+vec2(0,1)),d=h(i+vec2(1,1));return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);}
float f(vec2 p){float v=0.,a=0.5;for(int i=0;i<4;i++){v+=a*n(p);p*=2.;a*=.5;}return v;}
void main(){float m=smoothstep(fg,fg-0.5,v.y);
 vec2 mo=vec2(f(v*2.5+tm*.08),f(v*2.5-tm*.08)); vec2 uv=v+(mo-0.5)*0.1*m;
 vec3 col=texture2D(t,uv).rgb; float dl=lv+mo.x*3.0*m; col=pow(col,vec3(1./2.2)); vec3 post=pz(col,dl); post=pow(post,vec3(2.2));
 float tl=l(texture2D(t,v+px*vec2(-1,-1)).rgb),tc=l(texture2D(t,v+px*vec2(0,-1)).rgb),tr=l(texture2D(t,v+px*vec2(1,-1)).rgb);
 float ml=l(texture2D(t,v+px*vec2(-1,0)).rgb),mr=l(texture2D(t,v+px*vec2(1,0)).rgb);
 float bl=l(texture2D(t,v+px*vec2(-1,1)).rgb),bc=l(texture2D(t,v+px*vec2(0,1)).rgb),br=l(texture2D(t,v+px*vec2(1,1)).rgb);
 float gx=-tl-2.0*ml-bl+tr+2.0*mr+br, gy=-tl-2.0*tc-tr+bl+2.0*bc+br, ed=clamp(length(vec2(gx,gy))*0.9,0.,1.);
 vec3 edc=vec3(1.-ed), pe=mix(post,post*edc,em), orig=texture2D(t,uv).rgb; float mk=smoothstep(0.40,0.80,v.y);
 gl_FragColor=vec4(mix(pe,orig,mk*0.5),1.0);} `;
  const prog=gl.createProgram(), cs=(t,s)=>{const x=gl.createShader(t);gl.shaderSource(x,s);gl.compileShader(x);return x;};
  gl.attachShader(prog,cs(gl.VERTEX_SHADER,vs)); gl.attachShader(prog,cs(gl.FRAGMENT_SHADER,fs)); gl.linkProgram(prog); gl.useProgram(prog);
  const buf=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,buf);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,0,1, 1,-1,1,1, -1,1,0,0, 1,1,1,0]),gl.STATIC_DRAW);
  const a=gl.getAttribLocation(prog,'a'), b=gl.getAttribLocation(prog,'b'); gl.vertexAttribPointer(a,2,gl.FLOAT,false,16,0); gl.enableVertexAttribArray(a);
  gl.vertexAttribPointer(b,2,gl.FLOAT,false,16,8); gl.enableVertexAttribArray(b);
  const tex=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,tex);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  const uPx=gl.getUniformLocation(prog,'px'), uLv=gl.getUniformLocation(prog,'lv'), uEm=gl.getUniformLocation(prog,'em'), uTm=gl.getUniformLocation(prog,'tm'), uFg=gl.getUniformLocation(prog,'fg');
  gl.uniform2f(uPx,1/width,1/height); gl.uniform1f(uLv,levels); gl.uniform1f(uEm,0.12); gl.uniform1f(uFg,0.5);
  let t0=performance.now(), af=null; function draw(){gl.viewport(0,0,canvas.width,canvas.height); gl.useProgram(prog); gl.uniform1f(uTm,(performance.now()-t0)/1000); gl.drawArrays(gl.TRIANGLE_STRIP,0,4);}
  function animate(){draw(); af=requestAnimationFrame(animate);} animate();
  function updateFrame(src){ gl.bindTexture(gl.TEXTURE_2D,tex); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false); gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,src); }
  return { updateFrame, setFogCoverage:v=>{gl.useProgram(prog); gl.uniform1f(uFg,v);}, cleanup:()=>{ if(af) cancelAnimationFrame(af); } };
}

