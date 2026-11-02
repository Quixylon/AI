'use strict';

// One WebGL 1 context bends the same canvas pixels that form the background.
// No DOM screenshots or external textures. SVG filters provide a live CPU fallback.
const GLASS_VERTEX = `
attribute vec2 a_position;
void main() { gl_Position = vec4(a_position, 0.0, 1.0); }
`;
const GLASS_FRAGMENT = `
precision highp float;
uniform sampler2D u_scene;
uniform vec2 u_view;
uniform vec2 u_pixels;
uniform vec4 u_rect;
uniform mat3 u_projection;
uniform float u_radius;
uniform vec3 u_pointer;

vec3 scene(vec2 p) {
  return texture2D(u_scene, clamp(p / u_view, vec2(0.0), vec2(1.0))).rgb;
}
void main() {
  vec2 halfSize = u_rect.zw * 0.5;
  vec2 local = vec2(gl_FragCoord.x, u_pixels.y - gl_FragCoord.y) * u_rect.zw / u_pixels - halfSize;
  vec3 plane = u_projection * vec3(local, 1.0);
  vec2 p = plane.xy / plane.z;
  vec2 q = abs(local) - halfSize + u_radius;
  float distance = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - u_radius;
  float depth = max(0.0, -distance);
  // Blend edge normals through the corner instead of switching axes abruptly.
  vec2 gradient = max(q, 0.0) + exp((q-max(q.x,q.y))/6.0)*3.0;
  vec2 normal = normalize(gradient+vec2(0.0001))*sign(local);

  // A smooth rounded bevel: refract a view ray through a finite glass slab.
  // The centre is flat (no displacement); edge normals drive the lens.
  float band = min(28.0, min(halfSize.x, halfSize.y) * 0.65);
  float phase = clamp(depth / max(band, 1.0), 0.0, 1.0);
  float bevel = sin(phase * 3.14159265);
  vec3 surfaceNormal = normalize(vec3(normal * bevel * 1.35, 1.0));
  vec3 ray = refract(vec3(0.0, 0.0, -1.0), surfaceNormal, 1.0 / 1.46);
  float thickness = 20.0 * smoothstep(0.0, 0.25, phase);
  vec2 offset = ray.xy * thickness / max(0.1, -ray.z);
  float viewEdge = clamp(min(min(p.x,u_view.x-p.x),min(p.y,u_view.y-p.y))/20.0,0.0,1.0);
  vec2 bent = local + offset * viewEdge;
  vec3 refracted = u_projection * vec3(bent, 1.0);
  vec2 samplePoint = refracted.xy / refracted.z;
  // Frost the interior while retaining a crisp optical edge. Nine close taps
  // approximate diffusion instead of splitting each dot into offset copies.
  float haze = mix(0.25, 0.85, smoothstep(0.0, 24.0, depth));
  vec3 color = scene(samplePoint) * 0.40;
  color += (scene(samplePoint + vec2(haze, 0.0)) + scene(samplePoint - vec2(haze, 0.0))
         + scene(samplePoint + vec2(0.0, haze)) + scene(samplePoint - vec2(0.0, haze))) * 0.10;
  color += (scene(samplePoint + vec2(haze, haze)) + scene(samplePoint - vec2(haze, haze))
         + scene(samplePoint + vec2(haze, -haze)) + scene(samplePoint + vec2(-haze, haze))) * 0.05;
  color = mix(color, vec3(0.18, 0.20, 0.23), 0.22);
  color = mix(color, vec3(0.06, 0.07, 0.09), 0.08);

  // Reflection follows the normal of the curved edge, not a circular spotlight.
  float fresnel=0.04+0.96*pow(1.0-surfaceNormal.z,5.0);
  vec3 reflection=mix(vec3(0.20,0.29,0.43),vec3(0.65,0.76,0.85),clamp(0.5-dot(normal,vec2(.32,.5)),0.0,1.0));
  color=mix(color,reflection,fresnel*bevel*0.8);
  vec2 towardPointer=u_pointer.xy-p;
  float proximity=exp(-dot(towardPointer,towardPointer)/(125.0*125.0))*u_pointer.z;
  vec3 lightDirection=normalize(vec3(towardPointer/150.0,0.7));
  vec3 halfVector=normalize(lightDirection+vec3(0.0,0.0,1.0));
  float specular=pow(max(dot(surfaceNormal,halfVector),0.0),48.0)*bevel*proximity;
  float rim=exp(-depth/1.35);
  float orientation=pow(max(0.0,dot(normal,normalize(vec2(-0.6,-0.8)))),3.0);
  color+=vec3(0.67,0.80,0.91)*(rim*(0.025+0.11*orientation)+specular*0.12);
  gl_FragColor = vec4(color, 1.0);
}
`;

// Invert the element's projected plane, including CSS perspective and entrance
// scale. An axis-aligned bounding box alone would make the lens spill on tilt.
function glassInverse(rect, width, height, transform = 'none', scale = 'none', invert = true) {
  const values = transform.match(/^matrix(3d)?\((.+)\)$/);
  let m = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  if (values) {
    const v = values[2].split(',').map(Number);
    m = values[1] ? v : [v[0], v[1], 0, 0, v[2], v[3], 0, 0, 0, 0, 1, 0, v[4], v[5], 0, 1];
  }
  const scales = scale === 'none' ? [1] : scale.split(/\s+/).map(Number);
  const sx = scales[0] || 1, sy = scales[1] || sx;
  let a = m[0] * sx, b = m[4] * sx, c = m[12] * sx;
  let d = m[1] * sy, e = m[5] * sy, f = m[13] * sy;
  const g = m[3], h = m[7], i = m[15];
  let minX = Infinity, minY = Infinity;
  for (const x of [-width / 2, width / 2]) for (const y of [-height / 2, height / 2]) {
    const w = g * x + h * y + i;
    minX = Math.min(minX, (a * x + b * y + c) / w);
    minY = Math.min(minY, (d * x + e * y + f) / w);
  }
  const ox = rect.left - minX, oy = rect.top - minY;
  a += ox * g; b += ox * h; c += ox * i;
  d += oy * g; e += oy * h; f += oy * i;
  if (!invert) return new Float32Array([a, d, g, b, e, h, c, f, i]);
  const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
  return new Float32Array([
    e * i - f * h, f * g - d * i, d * h - e * g,
    c * h - b * i, a * i - c * g, b * g - a * h,
    b * f - c * e, c * d - a * f, a * e - b * d
  ].map(value => value / det));
}

class GlassRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = null;
    this.ready = false;
    this.elements = [];
    this.surfaces = new Map();
    this.textureWidth = this.textureHeight = 0;
    this.filterGeneration = 0;
    this.onLost = event => { event.preventDefault(); this.fallback(); };
    this.onRestored = () => { this.init(); this.onRestore?.(); };
    canvas?.addEventListener('webglcontextlost', this.onLost);
    canvas?.addEventListener('webglcontextrestored', this.onRestored);
  }
  register() {
    this.elements = [...document.querySelectorAll('.glass-surface')];
    for (const element of this.elements) {
      if (this.surfaces.has(element)) continue;
      const canvas = document.createElement('canvas');
      canvas.className = 'glass-texture';
      canvas.setAttribute('aria-hidden', 'true');
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) continue;
      element.prepend(canvas);
      this.surfaces.set(element, { canvas, ctx });
    }
    for (const [element, surface] of this.surfaces) {
      if (this.elements.includes(element)) continue;
      surface.canvas.remove(); surface.filter?.remove(); this.surfaces.delete(element);
    }
  }
  fallback() {
    this.ready = false;
    document.documentElement.classList.remove('has-refraction');
  }
  init() {
    if (!this.canvas || this.ready) return;
    try {
      const gl = this.canvas.getContext('webgl', { alpha: true, antialias: false, depth: false, stencil: false, premultipliedAlpha: false });
      if (!gl) { this.canvas.dataset.glassState = 'svg-fallback'; this.register(); return; }
      this.gl = gl;
      const compile = (type, source) => {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
          const message = gl.getShaderInfoLog(shader);
          gl.deleteShader(shader);
          throw new Error('Glass shader unavailable: ' + message);
        }
        return shader;
      };
      const vertex = compile(gl.VERTEX_SHADER, GLASS_VERTEX);
      const fragment = compile(gl.FRAGMENT_SHADER, GLASS_FRAGMENT);
      this.program = gl.createProgram();
      gl.attachShader(this.program, vertex); gl.attachShader(this.program, fragment);
      gl.linkProgram(this.program);
      gl.deleteShader(vertex); gl.deleteShader(fragment);
      if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) throw new Error('Glass program unavailable');
      gl.useProgram(this.program);
      this.buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const position = gl.getAttribLocation(this.program, 'a_position');
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      this.texture = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      this.uniforms = Object.fromEntries(['scene', 'view', 'pixels', 'rect', 'projection', 'radius', 'pointer'].map(name => [name, gl.getUniformLocation(this.program, `u_${name}`)]));
      gl.uniform1i(this.uniforms.scene, 0);
      this.textureWidth = this.textureHeight = 0;
      this.ready = true;
      this.canvas.dataset.glassState = 'ready';
      this.register();
      for (const surface of this.surfaces.values()) surface.canvas.style.filter = '';
    } catch (error) {
      this.canvas.dataset.glassState = 'shader-failed';
      console.warn(error.message);
      this.fallback();
    }
  }
  // SVG filter on a copy of our own canvas, not an SVG backdrop-filter.
  // This path needs no WebGL and never filters foreground text/controls.
  drawSVG(scene, width, height) {
    if (!this.canvas || !document.createElementNS) return;
    let painted = false;
    for (const element of this.elements) {
      const surface = this.surfaces.get(element), rect = element.getBoundingClientRect();
      if (!surface || !element.offsetWidth || element.closest('[hidden]') || rect.bottom <= 0 || rect.top >= height) continue;
      const w = Math.max(1,Math.round(rect.width)), h = Math.max(1,Math.round(rect.height));
      // CSS-space map is regenerated on resize only; the live scene is copied each frame.
      if (surface.width !== w || surface.height !== h) {
        surface.filter?.remove();
        const radius = parseFloat(getComputedStyle(element).borderTopLeftRadius) || 20;
        const map = document.createElement('canvas'); map.width = w; map.height = h;
        const ctx = map.getContext('2d'), pixels = ctx.createImageData(w,h);
        const band = Math.min(28,Math.min(w,h)*.325);
        for (let y=0;y<h;y++) for (let x=0;x<w;x++) {
          const lx=x+.5-w/2, ly=y+.5-h/2;
          const qx=Math.abs(lx)-w/2+radius, qy=Math.abs(ly)-h/2+radius;
          const distance=Math.hypot(Math.max(qx,0),Math.max(qy,0))+Math.min(Math.max(qx,qy),0)-radius;
          const phase=Math.min(1,Math.max(0,-distance)/band), bevel=phase>=1?0:Math.sin(phase*Math.PI);
          let nx=Math.max(qx,0)+Math.exp((qx-Math.max(qx,qy))/6)*3;
          let ny=Math.max(qy,0)+Math.exp((qy-Math.max(qx,qy))/6)*3;
          const length=Math.hypot(nx,ny)||1;
          nx=nx/length*Math.sign(lx)*bevel*1.35; ny=ny/length*Math.sign(ly)*bevel*1.35;
          const norm=Math.hypot(nx,ny,1), nz=1/norm; nx/=norm; ny/=norm;
          const eta=1/1.46, f=eta*nz-Math.sqrt(1-eta*eta*(1-nz*nz));
          const t=Math.min(1,phase/.25), travel=20*t*t*(3-2*t)/Math.max(.1,eta-f*nz);
          const offset=(y*w+x)*4;
          pixels.data[offset]=Math.round(255*(.5+nx*f*travel/32));
          pixels.data[offset+1]=Math.round(255*(.5+ny*f*travel/32));
          pixels.data[offset+2]=128; pixels.data[offset+3]=255;
        }
        ctx.putImageData(pixels,0,0);
        const ns='http://www.w3.org/2000/svg', svg=document.createElementNS(ns,'svg');
        svg.setAttribute('width','0'); svg.setAttribute('height','0'); svg.setAttribute('aria-hidden','true');
        svg.style.position='absolute'; svg.style.pointerEvents='none';
        const filter=document.createElementNS(ns,'filter'), id='qulon-lens-'+(++this.filterGeneration);
        filter.id=id; filter.setAttribute('x','0'); filter.setAttribute('y','0'); filter.setAttribute('width','100%'); filter.setAttribute('height','100%');
        filter.setAttribute('color-interpolation-filters','sRGB');
        const image=document.createElementNS(ns,'feImage');
        image.setAttribute('href',map.toDataURL()); image.setAttribute('result','map');
        image.setAttribute('x','0'); image.setAttribute('y','0'); image.setAttribute('width','100%'); image.setAttribute('height','100%'); image.setAttribute('preserveAspectRatio','none');
        const displacement=document.createElementNS(ns,'feDisplacementMap');
        for (const [key,value] of Object.entries({in:'SourceGraphic',in2:'map',scale:'32',xChannelSelector:'R',yChannelSelector:'G'})) displacement.setAttribute(key,value);
        filter.append(image,displacement); svg.append(filter); element.prepend(svg);
        surface.filter=svg; surface.width=w; surface.height=h;
        surface.canvas.style.filter='url(#'+id+')';
      }
      const density=Math.min(2,scene.width/width), pw=Math.round(w*density), ph=Math.round(h*density);
      if(surface.canvas.width!==pw)surface.canvas.width=pw;
      if(surface.canvas.height!==ph)surface.canvas.height=ph;
      const ctx=surface.ctx;
      ctx.fillStyle='#101319';ctx.fillRect(0,0,pw,ph);
      // Draw the complete scene offset into the panel; clipping happens at its bounds.
      ctx.drawImage(scene, -rect.left*density, -rect.top*density, width*density, height*density);
      ctx.fillStyle='rgba(46,51,59,.22)';ctx.fillRect(0,0,pw,ph);
      painted=true;
    }
    if (painted) document.documentElement.classList.add('has-refraction');
  }
  draw(scene, width, height, pointer={x:0,y:0,strength:0}) {
    if (document.hidden) return;
    if (!this.ready) { this.drawSVG(scene, width, height); return; }
    const gl = this.gl, panels = [], density = scene.width / width;
    // Native canvases travel with their own cards. Only source sampling uses
    // viewport coordinates; clipping/opacity/scale are applied exactly once by CSS.
    for (const element of this.elements) {
      const surface = this.surfaces.get(element);
      if (!surface || !element.offsetWidth || element.closest('[hidden]')) continue;
      const rect = element.getBoundingClientRect();
      if (rect.bottom <= 0 || rect.top >= height || rect.right <= 0 || rect.left >= width) continue;
      const style = getComputedStyle(element);
      const w = parseFloat(style.width) || element.offsetWidth, h = parseFloat(style.height) || element.offsetHeight;
      panels.push({ surface, width: w, height: h,
        projection: glassInverse(rect, w, h, style.transform, style.scale, false),
        radius: parseFloat(style.borderTopLeftRadius) || 24,
        pixelsX: Math.max(1, Math.round(w * density)), pixelsY: Math.max(1, Math.round(h * density)) });
    }
    // One reusable GPU buffer, shared across cards, with no full-screen ghost layer.
    const maxWidth = Math.max(1, ...panels.map(p => p.pixelsX));
    const maxHeight = Math.max(1, ...panels.map(p => p.pixelsY));
    if (this.canvas.width < maxWidth) this.canvas.width = maxWidth;
    if (this.canvas.height < maxHeight) this.canvas.height = maxHeight;
    gl.disable(gl.SCISSOR_TEST);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    if (this.textureWidth !== scene.width || this.textureHeight !== scene.height) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, scene);
      this.textureWidth = scene.width; this.textureHeight = scene.height;
    } else gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, scene);
    gl.uniform2f(this.uniforms.view, width, height);
    gl.uniform3f(this.uniforms.pointer,pointer.x,pointer.y,pointer.strength);
    for (const { surface, width: w, height: h, projection, radius, pixelsX, pixelsY } of panels) {
      gl.viewport(0, 0, pixelsX, pixelsY);
      gl.uniform2f(this.uniforms.pixels, pixelsX, pixelsY);
      gl.uniform4f(this.uniforms.rect, 0, 0, w, h);
      gl.uniformMatrix3fv(this.uniforms.projection, false, projection);
      gl.uniform1f(this.uniforms.radius, Math.min(radius, w / 2, h / 2));
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      if (surface.canvas.width !== pixelsX) surface.canvas.width = pixelsX;
      if (surface.canvas.height !== pixelsY) surface.canvas.height = pixelsY;
      surface.ctx.drawImage(this.canvas, 0, this.canvas.height - pixelsY, pixelsX, pixelsY, 0, 0, pixelsX, pixelsY);
    }
    document.documentElement.classList.add('has-refraction');
  }
}
