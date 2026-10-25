// GLSL for the sky dome, the ground, the chronal tunnel and the post-process pass.

export const SKY_VERT = /* glsl */`
varying vec3 vPos;
void main(){ vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
export const SKY_FRAG = /* glsl */`
uniform vec3 uTop; uniform vec3 uBottom; uniform float uTime; uniform float uStars;
varying vec3 vPos;
float hash(vec3 p){ p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3)); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
void main(){
  vec3 d = normalize(vPos);
  float h = clamp(d.y * 0.5 + 0.5, 0.0, 1.0);
  vec3 col = mix(uBottom, uTop, pow(h, 0.65));
  // star field above the horizon
  vec3 cell = floor(d * 160.0);
  float s = step(0.997, hash(cell)) * smoothstep(0.0, 0.25, d.y) * uStars;
  float tw = 0.6 + 0.4 * sin(uTime * 2.0 + hash(cell + 1.0) * 6.28);
  col += vec3(s * tw);
  gl_FragColor = vec4(col, 1.0);
}
`;

export const GROUND_VERT = /* glsl */`
varying vec2 vUv; varying vec3 vWorld;
void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }
`;
export const GROUND_FRAG = /* glsl */`
uniform vec3 uColor; uniform vec3 uAlt; uniform vec3 uFog; uniform float uMode; uniform float uTime; uniform float uBeat; uniform float uReveal; uniform float uTravel;
varying vec2 vUv; varying vec3 vWorld;
void main(){
  vec2 p = vWorld.xz;
  float r = length(p);
  vec3 col = uColor;
  if (uMode < 0.5) {            // disc: soft radial sheen
    float ring = smoothstep(0.02, 0.0, abs(r - 4.0 - uBeat * 0.15) - 0.03);
    col = mix(uColor, uAlt, 0.25 * exp(-r * 0.12)) + uAlt * ring * 0.6;
  } else if (uMode < 1.5) {     // grid
    vec2 g = abs(fract(p * 0.5) - 0.5) / fwidth(p * 0.5);
    float line = 1.0 - min(min(g.x, g.y), 1.0);
    float pulse = 0.6 + 0.4 * uBeat;
    col = mix(uColor, uAlt, line * pulse * exp(-r * 0.03));
  } else if (uMode < 2.5) {     // tiles
    vec2 c = floor(p * 0.6);
    float chk = mod(c.x + c.y, 2.0);
    col = mix(uColor, uAlt, chk * 0.6);
    vec2 g = abs(fract(p * 0.6) - 0.5) / fwidth(p * 0.6);
    col *= 1.0 - 0.35 * (1.0 - min(min(g.x, g.y), 1.0));
  } else {                       // water
    float w = sin(r * 2.2 - uTime * 1.6) * 0.5 + sin(p.x * 1.3 + uTime * 0.7) * 0.25 + sin(p.y * 1.7 - uTime * 0.9) * 0.25;
    float crest = smoothstep(0.55, 0.95, w);
    col = mix(uColor, uAlt, 0.12 + crest * 0.35);
    col += uAlt * 0.25 * exp(-r * 0.25) * (0.5 + 0.5 * sin(uTime * 2.0 - r * 3.0));
  }
  // reveal from the centre outward
  float rev = smoothstep(uReveal * 40.0, uReveal * 40.0 - 6.0, r);
  col = mix(uFog, col, rev);
  float fogAmt = 1.0 - exp(-r * r * 0.0009);
  col = mix(col, uFog, fogAmt);
  col = mix(col, uFog * 0.6, smoothstep(0.1, 0.8, uTravel));
  gl_FragColor = vec4(col, 1.0);
}
`;

export const TUNNEL_VERT = /* glsl */`
varying vec2 vUv; varying float vDepth;
void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vDepth = -mv.z; gl_Position = projectionMatrix * mv; }
`;
export const TUNNEL_FRAG = /* glsl */`
uniform float uTime; uniform float uScroll; uniform float uSpeed; uniform float uDoppler; uniform vec3 uColA; uniform vec3 uColB; uniform float uOpacity;
varying vec2 vUv; varying float vDepth;
float hash21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
void main(){
  float along = vUv.y * 60.0 + uScroll;
  float around = vUv.x * 6.2831853;
  // ring lattice (the "frames" of time) and streaming filaments
  float rings = pow(abs(sin(along * 1.5707)), 24.0);
  float fil = 0.0;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float lane = floor(vUv.x * (18.0 + fi * 7.0) + fi * 3.1);
    float h = hash21(vec2(lane, fi));
    float sp = fract(along * (0.12 + h * 0.2) + h * 10.0 + uTime * (0.05 + fi * 0.02) * sign(uSpeed + 0.0001));
    float seg = smoothstep(0.0, 0.08, sp) * smoothstep(0.35 + uSpeed * 0.5, 0.1, sp);
    float cen = smoothstep(0.5, 0.0, abs(fract(vUv.x * (18.0 + fi * 7.0) + fi * 3.1) - 0.5) * 2.0);
    fil += seg * cen * (0.4 + h * 0.6);
  }
  float band = 0.5 + 0.5 * sin(along * 0.25 + uTime * 0.3);
  vec3 col = mix(uColA, uColB, band);
  vec3 dop = mix(vec3(1.0), vec3(0.6, 0.8, 1.6), max(0.0, uDoppler)) * mix(vec3(1.0), vec3(1.6, 0.75, 0.55), max(0.0, -uDoppler));
  col *= dop;
  float glow = rings * (0.6 + uSpeed * 1.2) + fil * (0.5 + uSpeed * 1.5);
  // hide the far end and the bit right at the camera
  float depthFade = smoothstep(0.0, 25.0, vDepth) * smoothstep(240.0, 90.0, vDepth);
  float a = glow * depthFade * uOpacity;
  gl_FragColor = vec4(col * glow * 1.4, a);
}
`;

export const POST_FRAG = /* glsl */`
uniform sampler2D tDiffuse; uniform float uAberration; uniform float uDoppler; uniform float uSpeed; uniform float uGhost; uniform float uTime; uniform float uVignette; uniform vec2 uShake;
varying vec2 vUv;
void main(){
  vec2 uv = vUv + uShake;
  vec2 d = uv - 0.5;
  float r2 = dot(d, d);
  float ca = uAberration * r2 * 0.9;
  vec3 col;
  col.r = texture2D(tDiffuse, uv + d * ca).r;
  col.g = texture2D(tDiffuse, uv).g;
  col.b = texture2D(tDiffuse, uv - d * ca).b;
  // radial streak at speed (time dilation smear)
  if (uSpeed > 0.01) {
    vec3 acc = vec3(0.0); float wsum = 0.0;
    for (int i = 1; i <= 6; i++) {
      float f = float(i) / 6.0;
      vec2 o = d * f * uSpeed * 0.12;
      float w = 1.0 - f * 0.6;
      acc += texture2D(tDiffuse, uv - o).rgb * w; wsum += w;
    }
    col = mix(col, acc / wsum, min(1.0, uSpeed * 1.5) * smoothstep(0.0, 0.3, r2));
  }
  // forecast uncertainty: a faint doubled image that drifts
  if (uGhost > 0.001) {
    vec2 go = vec2(sin(uTime * 0.7), cos(uTime * 0.9)) * 0.006 * uGhost;
    col = mix(col, texture2D(tDiffuse, uv + go).rgb, 0.35 * uGhost);
  }
  // Doppler grade
  col *= mix(vec3(1.0), vec3(0.78, 0.9, 1.25), max(0.0, uDoppler));
  col *= mix(vec3(1.0), vec3(1.25, 0.9, 0.78), max(0.0, -uDoppler));
  // vignette and faint scan texture
  float vig = 1.0 - uVignette * smoothstep(0.15, 0.75, r2);
  col *= vig;
  col *= 1.0 - 0.03 * sin(uv.y * 900.0);
  gl_FragColor = vec4(col, 1.0);
}
`;
