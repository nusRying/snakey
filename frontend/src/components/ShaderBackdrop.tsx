import React, { useEffect, useRef } from 'react';

type ShaderBackdropProps = {
  className?: string;
  variant?: 'title' | 'lobby' | 'intro';
};

const FRAGMENT_SHADER = `
precision mediump float;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_variant;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  vec2 p = uv * 2.0 - 1.0;
  p.x *= u_resolution.x / u_resolution.y;

  float t = u_time * (0.12 + u_variant * 0.03);
  float wave = sin(p.x * 7.0 + t * 3.0) * 0.08 + cos(p.y * 6.0 - t * 2.6) * 0.08;
  float nebula = noise(p * (2.8 + u_variant * 0.7) + vec2(t, -t * 0.8));
  float glow = 0.25 / (0.12 + length(p + vec2(sin(t) * 0.3, cos(t * 0.7) * 0.2)));
  float grid = smoothstep(0.98, 1.0, sin((p.x + wave) * 16.0) * sin((p.y - wave) * 16.0));

  vec3 cold = vec3(0.00, 0.95, 1.00);
  vec3 warm = vec3(0.96, 0.24, 0.50);
  vec3 base = mix(vec3(0.02, 0.03, 0.08), cold, nebula * 0.22 + glow * 0.18);
  base += warm * (grid * 0.12 + glow * 0.08);
  base += vec3(0.15, 0.08, 0.22) * wave;

  gl_FragColor = vec4(base, 0.58 + u_variant * 0.08);
}`;

const VERTEX_SHADER = `
attribute vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

function createShader(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

const ShaderBackdrop = ({ className = '', variant = 'title' }: ShaderBackdropProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl', { alpha: true, antialias: true });
    if (!gl) return;

    const vertexShader = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (!vertexShader || !fragmentShader) {
      return;
    }

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.useProgram(program);

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

    const positionLocation = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    const resolutionLocation = gl.getUniformLocation(program, 'u_resolution');
    const timeLocation = gl.getUniformLocation(program, 'u_time');
    const variantLocation = gl.getUniformLocation(program, 'u_variant');
    const variantValue = variant === 'intro' ? 1.3 : variant === 'lobby' ? 0.7 : 1.0;
    let animationFrame = 0;

    const resize = () => {
      const width = canvas.clientWidth || window.innerWidth;
      const height = canvas.clientHeight || window.innerHeight;
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
    };

    const render = (time: number) => {
      resize();
      gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
      gl.uniform1f(timeLocation, time * 0.001);
      gl.uniform1f(variantLocation, variantValue);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      animationFrame = window.requestAnimationFrame(render);
    };

    resize();
    animationFrame = window.requestAnimationFrame(render);
    window.addEventListener('resize', resize);

    return () => {
      window.removeEventListener('resize', resize);
      window.cancelAnimationFrame(animationFrame);
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      if (positionBuffer) {
        gl.deleteBuffer(positionBuffer);
      }
    };
  }, [variant]);

  return <canvas ref={canvasRef} className={`shader-backdrop ${className}`.trim()} aria-hidden="true" />;
};

export default ShaderBackdrop;