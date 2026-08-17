/* Relativistic thin-disk ray marcher. No Node globals. */
(function () {
  const VERT = `#version 300 es
  in vec2 a;
  void main(){ gl_Position = vec4(a,0.0,1.0); }`;

  const FRAG = `#version 300 es
  precision highp float;
  out vec4 o;
  uniform vec2 uRes;
  uniform float uTime;
  uniform float uMass;
  uniform float uSpin;
  uniform float uDist;

  float hash(vec2 p){
    return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453);
  }

  vec3 starfield(vec3 dir){
    vec2 p = dir.xy / (abs(dir.z)+0.18);
    float n = hash(floor(p*220.0));
    float s = smoothstep(0.996, 1.0, n);
    float tw = 0.55 + 0.45*sin(uTime*2.0 + n*40.0);
    return vec3(0.75,0.82,1.0) * s * tw;
  }

  vec3 diskColor(float r, float doppler){
    float t = pow(clamp(3.2 / r, 0.0, 1.6), 0.75) * doppler;
    vec3 cool = vec3(0.55, 0.18, 0.06);
    vec3 mid  = vec3(1.0, 0.42, 0.12);
    vec3 hot  = vec3(1.0, 0.92, 0.78);
    vec3 c = mix(cool, mid, smoothstep(0.15, 0.55, t));
    c = mix(c, hot, smoothstep(0.55, 1.2, t));
    return c * (0.35 + 1.8*t);
  }

  void main(){
    vec2 uv = (gl_FragCoord.xy - 0.5*uRes) / uRes.y;
    float ang = uTime * 0.07;
    float rad = 18.0 + uDist * 0.15;
    vec3 ro = vec3(sin(ang)*rad, 3.6 + 0.4*sin(uTime*0.2), cos(ang)*rad);
    vec3 ta = vec3(0.0, -0.15, 0.0);
    vec3 ww = normalize(ta - ro);
    vec3 uu = normalize(cross(ww, vec3(0.0,1.0,0.0)));
    vec3 vv = cross(uu, ww);
    vec3 rd = normalize(uv.x*uu + uv.y*vv + 1.35*ww);

    float rs = max(uMass * 0.22, 0.55);
    float horizon = rs * 1.02;
    float photon = rs * 1.5;
    float isco = rs * (3.0 - uSpin);
    float rout = rs * 14.0;

    vec3 pos = ro;
    vec3 vel = rd;
    vec3 col = vec3(0.0);
    float trans = 1.0;
    bool captured = false;

    for(int i=0;i<160;i++){
      float r = length(pos);
      if(r < horizon){ captured = true; break; }

      if(abs(pos.y) < 0.045 * rs && r > isco && r < rout){
        float omega = sqrt(rs / max(r, 0.001));
        vec3 tang = normalize(vec3(-pos.z, 0.0, pos.x));
        float mu = clamp(dot(normalize(vel), tang), -1.0, 1.0);
        float doppler = 1.0 / max(0.18, (1.0 - uSpin*0.35*mu) * sqrt(max(0.05, 1.0 - rs/r)));
        float dens = smoothstep(rout, isco*1.1, r) * (0.55 + 0.45*sin(r*3.5 + atan(pos.z,pos.x)*9.0 - uTime*1.6));
        vec3 emit = diskColor(r/rs, doppler) * dens;
        col += trans * emit * 0.22;
        trans *= 0.72;
        if(trans < 0.02) break;
      }

      float r2 = r*r;
      vec3 acc = -1.5 * rs * pos / max(r2*r2*r, 1e-4);
      float dt = mix(0.09, 0.28, smoothstep(horizon, rout*1.4, r));
      vel += acc * dt;
      pos += vel * dt;
    }

    if(!captured){
      col += trans * starfield(normalize(vel));
      col += trans * vec3(0.03,0.04,0.06);
    } else {
      col += vec3(0.0);
    }

    float ring = smoothstep(0.08, 0.0, abs(length(uv)-0.0));
    col += vec3(0.015, 0.02, 0.03) * (1.0 - smoothstep(0.0, 1.4, length(uv)));
    col = col / (1.0 + col*0.35);
    col = pow(max(col, 0.0), vec3(0.82));
    o = vec4(col, 1.0);
    ring *= 0.0;
    photon *= 1.0;
  }`;

  function init(canvas) {
    const gl = canvas.getContext("webgl2", { antialias: false, alpha: false });
    if (!gl) return { error: "WebGL2 unavailable" };

    function compile(type, src) {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(s) || "shader");
      }
      return s;
    }

    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(prog) || "link");
    }

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "a");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(prog, "uRes");
    const uTime = gl.getUniformLocation(prog, "uTime");
    const uMass = gl.getUniformLocation(prog, "uMass");
    const uSpin = gl.getUniformLocation(prog, "uSpin");
    const uDist = gl.getUniformLocation(prog, "uDist");

    const state = { mass: 14.2, spin: 0.72, dist: 11.4, running: true };

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
      const w = Math.max(2, Math.floor(canvas.clientWidth * dpr));
      const h = Math.max(2, Math.floor(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
    }

    let t0 = performance.now();
    function frame(now) {
      if (!state.running) return;
      resize();
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(prog);
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, (now - t0) * 0.001);
      gl.uniform1f(uMass, state.mass);
      gl.uniform1f(uSpin, state.spin);
      gl.uniform1f(uDist, state.dist);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    return state;
  }

  window.AphelionHorizon = { init };
})();
