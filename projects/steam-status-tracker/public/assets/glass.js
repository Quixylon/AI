'use strict';

// One WebGL 1 context bends the same canvas pixels that form the background.
// No DOM screenshots, external textures, SVG backdrop filters or per-card contexts.
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
  vec2 normal;
  if (max(q.x, q.y) > 0.0) normal = normalize(max(q, 0.0) + 0.0001) * sign(local);
  else normal = q.x > q.y ? vec2(sign(local.x), 0.0) : vec2(0.0, sign(local.y));

  // A thick, rounded bevel pulls the texture inward; the centre magnifies gently.
  float bevel = (1.0 - exp(-depth / 3.0)) * exp(-depth / 19.0);
  vec2 samplePoint = p - normal * bevel * 34.0 - local * 0.028 * smoothstep(0.0, 40.0, depth);
  float haze = 1.65 + bevel * 0.65;
  vec3 color = scene(samplePoint) * 0.4;
  color += (scene(samplePoint + vec2(haze, 0.0)) + scene(samplePoint - vec2(haze, 0.0))
         + scene(samplePoint + vec2(0.0, haze)) + scene(samplePoint - vec2(0.0, haze))) * 0.15;
  // Very small chromatic separation lives at the bevel, not across the text.
  vec2 split = normal * bevel * 1.3;
  color.r = mix(color.r, scene(samplePoint + split).r, 0.24);
  color.b = mix(color.b, scene(samplePoint - split).b, 0.24);
  color = mix(color, vec3(0.19, 0.26, 0.34), 0.13);
  // The native card owns its outline and clipping. A second luminous shader
  // silhouette would look like a displaced duplicate during motion.
  color = mix(color, vec3(0.055, 0.085, 0.14), 0.22);
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
      surface.canvas.remove(); this.surfaces.delete(element);
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
      if (!gl) return;
      this.gl = gl;
      const compile = (type, source) => {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
          gl.deleteShader(shader);
          throw new Error('Glass shader unavailable');
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
      this.uniforms = Object.fromEntries(['scene', 'view', 'pixels', 'rect', 'projection', 'radius'].map(name => [name, gl.getUniformLocation(this.program, `u_${name}`)]));
      gl.uniform1i(this.uniforms.scene, 0);
      this.textureWidth = this.textureHeight = 0;
      this.ready = true;
      this.register();
    } catch {
      this.fallback();
    }
  }
  draw(scene, width, height) {
    if (!this.ready || document.hidden) return;
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
