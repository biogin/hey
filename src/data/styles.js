// Visual signature of each epoch world. Everything is procedural: primitives, palettes, arrangements.
// shape: box|sphere|cylinder|cone|torus|knot|ico|card|ring|capsule|tetra|octa|disc|bar
// arrange: ring|spiral|grid|scatter|wall|pillars|orbit|tower|halo
// motion: spin|bob|pulse|orbit|scroll|flicker|sway|still
// material: metal|neon|glass|matte|wire

export const STYLES = {
  baroque: {
    sky: ['#2a0a14', '#0a0306'], fog: '#1a0810', ground: 'tiles', groundColor: '#3a2416', groundAlt: '#120a06',
    primary: '#e2b55a', secondary: '#7a1f2e', accent: '#ffd98a',
    layers: [
      { shape: 'cylinder', count: 14, arrange: 'pillars', radius: 10, size: [0.5, 7], color: 'primary', material: 'metal', motion: 'still' },
      { shape: 'knot', count: 6, arrange: 'orbit', radius: 6, size: [0.5, 0.9], color: 'primary', material: 'metal', motion: 'spin', height: 4 },
      { shape: 'sphere', count: 90, arrange: 'scatter', radius: 12, size: [0.06, 0.14], color: 'accent', material: 'neon', motion: 'flicker', height: 3 },
    ],
  },
  classical: {
    sky: ['#3c3f78', '#e9e3d2'], fog: '#8d8fb8', ground: 'disc', groundColor: '#e8e2d4', groundAlt: '#c9c2b0',
    primary: '#f4efe6', secondary: '#c9a24a', accent: '#6c6fb5',
    layers: [
      { shape: 'sphere', count: 24, arrange: 'ring', radius: 8, size: [0.5, 0.9], color: 'primary', material: 'matte', motion: 'bob' },
      { shape: 'torus', count: 12, arrange: 'ring', radius: 5, size: [0.4, 0.4], color: 'secondary', material: 'metal', motion: 'pulse', height: 2.5 },
      { shape: 'capsule', count: 8, arrange: 'pillars', radius: 12, size: [0.3, 5], color: 'primary', material: 'matte', motion: 'still' },
    ],
  },
  romantic: {
    sky: ['#2b1b3d', '#0b0a14'], fog: '#1a1428', ground: 'water', groundColor: '#0d0b18', groundAlt: '#2a1f44',
    primary: '#8d6bd1', secondary: '#2d2546', accent: '#f1ecff',
    layers: [
      { shape: 'tetra', count: 40, arrange: 'scatter', radius: 11, size: [0.3, 1.4], color: 'primary', material: 'glass', motion: 'spin', height: 5 },
      { shape: 'bar', count: 7, arrange: 'pillars', radius: 9, size: [0.06, 14], color: 'accent', material: 'neon', motion: 'flicker' },
      { shape: 'ico', count: 3, arrange: 'orbit', radius: 4, size: [1.2, 1.8], color: 'secondary', material: 'glass', motion: 'orbit', height: 5 },
    ],
  },
  ragtime: {
    sky: ['#6b4a2a', '#f0dcb8'], fog: '#a98a62', ground: 'grid', groundColor: '#d9c39a', groundAlt: '#2b1d10',
    primary: '#c98a3a', secondary: '#2b1d10', accent: '#f6e7c6',
    layers: [
      { shape: 'card', count: 48, arrange: 'wall', radius: 9, size: [0.5, 2.2], color: 'accent', material: 'matte', motion: 'scroll', height: 2 },
      { shape: 'cone', count: 6, arrange: 'ring', radius: 5, size: [0.7, 1.5], color: 'primary', material: 'metal', motion: 'sway', height: 1.2 },
      { shape: 'cylinder', count: 10, arrange: 'ring', radius: 7, size: [0.2, 1.1], color: 'primary', material: 'metal', motion: 'bob', height: 0.6 },
    ],
  },
  jazzage: {
    sky: ['#071a1c', '#000000'], fog: '#06100f', ground: 'disc', groundColor: '#0b0b0b', groundAlt: '#b8902e',
    primary: '#e4b24a', secondary: '#0c3b3a', accent: '#fff2c4',
    layers: [
      { shape: 'cone', count: 14, arrange: 'ring', radius: 6.5, size: [0.6, 1.4], color: 'primary', material: 'metal', motion: 'pulse', height: 1.5, faceOut: true },
      { shape: 'box', count: 30, arrange: 'wall', radius: 10, size: [0.5, 1.6], color: 'primary', material: 'metal', motion: 'still', height: 2, tilt: 0.785 },
      { shape: 'sphere', count: 60, arrange: 'scatter', radius: 10, size: [0.08, 0.3], color: 'accent', material: 'glass', motion: 'bob', height: 4 },
    ],
  },
  swing: {
    sky: ['#0a1838', '#02050f'], fog: '#070f22', ground: 'disc', groundColor: '#1b1a2a', groundAlt: '#2f2a4a',
    primary: '#dfd3b4', secondary: '#1f2c5c', accent: '#ffe9b0',
    layers: [
      { shape: 'bar', count: 6, arrange: 'pillars', radius: 11, size: [0.5, 30], color: 'accent', material: 'neon', motion: 'sway', opacity: 0.35 },
      { shape: 'card', count: 16, arrange: 'wall', radius: 7, size: [0.9, 1.3], color: 'secondary', material: 'matte', motion: 'still', height: 1 },
      { shape: 'capsule', count: 8, arrange: 'ring', radius: 4.5, size: [0.25, 0.8], color: 'primary', material: 'metal', motion: 'bob', height: 1.4 },
    ],
  },
  rocknroll: {
    sky: ['#3a0a3a', '#05020a'], fog: '#1a0620', ground: 'grid', groundColor: '#1a1a1a', groundAlt: '#f1efe6',
    primary: '#ff4fa3', secondary: '#4fd8ff', accent: '#fff6a8',
    layers: [
      { shape: 'torus', count: 8, arrange: 'ring', radius: 8, size: [1.4, 1.4], color: 'primary', material: 'neon', motion: 'pulse', height: 2 },
      { shape: 'cone', count: 12, arrange: 'ring', radius: 5.5, size: [0.4, 1.6], color: 'secondary', material: 'metal', motion: 'spin', height: 0.8, tilt: 1.3 },
      { shape: 'disc', count: 40, arrange: 'orbit', radius: 10, size: [0.5, 0.9], color: 'secondary', material: 'matte', motion: 'spin', height: 4 },
    ],
  },
  sixties: {
    sky: ['#ff7a2a', '#5a0f7a'], fog: '#8a2a6a', ground: 'tiles', groundColor: '#f0c23a', groundAlt: '#e23c8a',
    primary: '#ffcc33', secondary: '#ff4f9a', accent: '#5ae0ff',
    layers: [
      { shape: 'knot', count: 10, arrange: 'ring', radius: 7, size: [0.5, 0.8], color: 'secondary', material: 'matte', motion: 'spin', height: 2 },
      { shape: 'torus', count: 28, arrange: 'scatter', radius: 11, size: [0.3, 1.0], color: 'accent', material: 'neon', motion: 'pulse', height: 5 },
      { shape: 'sphere', count: 50, arrange: 'orbit', radius: 9, size: [0.15, 0.5], color: 'primary', material: 'glass', motion: 'orbit', height: 3 },
    ],
  },
  seventies: {
    sky: ['#ff8a3a', '#2a0a3a'], fog: '#4a1a3a', ground: 'grid', groundColor: '#2a1030', groundAlt: '#ff5fa0',
    primary: '#f0e0c0', secondary: '#ff5fa0', accent: '#ffd36a',
    layers: [
      { shape: 'ico', count: 1, arrange: 'ring', radius: 0, size: [1.6, 1.6], color: 'primary', material: 'metal', motion: 'spin', height: 6, flat: true },
      { shape: 'cylinder', count: 30, arrange: 'scatter', radius: 10, size: [0.05, 1.2], color: 'accent', material: 'metal', motion: 'spin', height: 3 },
      { shape: 'disc', count: 24, arrange: 'orbit', radius: 8, size: [0.6, 0.9], color: 'secondary', material: 'matte', motion: 'orbit', height: 3 },
    ],
  },
  mtv: {
    sky: ['#ff2a8a', '#07001a'], fog: '#2a0040', ground: 'grid', groundColor: '#0a0020', groundAlt: '#ff3ad0',
    primary: '#ff3ad0', secondary: '#3af0ff', accent: '#ffe14a', sun: true,
    layers: [
      { shape: 'box', count: 20, arrange: 'grid', radius: 9, size: [0.8, 1.4], color: 'secondary', material: 'neon', motion: 'pulse', height: 0.6 },
      { shape: 'card', count: 30, arrange: 'orbit', radius: 10, size: [0.6, 1.0], color: 'primary', material: 'matte', motion: 'spin', height: 4 },
      { shape: 'bar', count: 12, arrange: 'ring', radius: 13, size: [0.1, 9], color: 'accent', material: 'neon', motion: 'flicker' },
    ],
  },
  nineties: {
    sky: ['#3b4a3a', '#0a0c0a'], fog: '#1c221c', ground: 'tiles', groundColor: '#2a2d2a', groundAlt: '#1a1c1a',
    primary: '#b8c4a0', secondary: '#8aff5a', accent: '#d8d8ff',
    layers: [
      { shape: 'box', count: 16, arrange: 'wall', radius: 8, size: [1.0, 1.4], color: 'accent', material: 'neon', motion: 'flicker', height: 1.2 },
      { shape: 'ring', count: 30, arrange: 'orbit', radius: 9, size: [0.4, 0.7], color: 'accent', material: 'metal', motion: 'spin', height: 4 },
      { shape: 'bar', count: 8, arrange: 'pillars', radius: 11, size: [0.05, 22], color: 'secondary', material: 'neon', motion: 'sway', opacity: 0.5 },
    ],
  },
  y2k: {
    sky: ['#eef3ff', '#8aa0c0'], fog: '#b9c6dc', ground: 'disc', groundColor: '#f2f4f8', groundAlt: '#d8dde8',
    primary: '#ffffff', secondary: '#ff4fd8', accent: '#50e0ff',
    layers: [
      { shape: 'box', count: 16, arrange: 'ring', radius: 7, size: [0.5, 1.6], color: 'primary', material: 'glass', motion: 'bob', height: 1 },
      { shape: 'box', count: 120, arrange: 'grid', radius: 11, size: [0.2, 0.35], color: 'secondary', material: 'neon', motion: 'pulse', height: 3, mixColor: 'accent' },
      { shape: 'sphere', count: 80, arrange: 'scatter', radius: 12, size: [0.05, 0.12], color: 'accent', material: 'neon', motion: 'flicker', height: 5 },
    ],
  },
  streaming: {
    sky: ['#0b2a5a', '#02050f'], fog: '#061428', ground: 'water', groundColor: '#030916', groundAlt: '#1db954',
    primary: '#5ad1ff', secondary: '#1db954', accent: '#ffffff',
    layers: [
      { shape: 'card', count: 24, arrange: 'spiral', radius: 7, size: [0.7, 1.4], color: 'primary', material: 'glass', motion: 'bob', height: 1 },
      { shape: 'bar', count: 48, arrange: 'ring', radius: 10, size: [0.25, 2.5], color: 'secondary', material: 'neon', motion: 'pulse', eq: true },
      { shape: 'sphere', count: 10, arrange: 'orbit', radius: 9, size: [0.9, 1.8], color: 'accent', material: 'matte', motion: 'orbit', height: 7, opacity: 0.25 },
    ],
  },
  algorithm: {
    sky: ['#12001a', '#000000'], fog: '#0a0010', ground: 'grid', groundColor: '#050008', groundAlt: '#ff2d7a',
    primary: '#ff2d7a', secondary: '#25f4ee', accent: '#ffffff',
    layers: [
      { shape: 'card', count: 60, arrange: 'tower', radius: 8, size: [0.5, 0.9], color: 'accent', material: 'matte', motion: 'scroll', height: 0 },
      { shape: 'octa', count: 100, arrange: 'scatter', radius: 12, size: [0.05, 0.18], color: 'secondary', material: 'neon', motion: 'flicker', height: 5, mixColor: 'primary' },
      { shape: 'torus', count: 3, arrange: 'orbit', radius: 5, size: [2.2, 2.2], color: 'primary', material: 'wire', motion: 'orbit', height: 4 },
    ],
  },
  f1: {
    sky: ['#3a2410', '#050302'], fog: '#1a1008', ground: 'disc', groundColor: '#15100a', groundAlt: '#3a2a14',
    primary: '#ffb45a', secondary: '#5a3a1a', accent: '#fff0d0', ghost: 0.85,
    layers: [
      { shape: 'capsule', count: 40, arrange: 'ring', radius: 7, size: [0.3, 1.7], color: 'secondary', material: 'matte', motion: 'sway', height: 0.85 },
      { shape: 'cone', count: 5, arrange: 'pillars', radius: 9, size: [2.5, 20], color: 'primary', material: 'neon', motion: 'sway', opacity: 0.12 },
      { shape: 'sphere', count: 120, arrange: 'scatter', radius: 12, size: [0.03, 0.08], color: 'accent', material: 'neon', motion: 'flicker', height: 4 },
    ],
  },
  f5: {
    sky: ['#0a2a4a', '#1a0a3a'], fog: '#0d1a33', ground: 'grid', groundColor: '#040a14', groundAlt: '#25f4ee',
    primary: '#25f4ee', secondary: '#b35cff', accent: '#ffffff', ghost: 0.7,
    layers: [
      { shape: 'box', count: 80, arrange: 'grid', radius: 10, size: [0.3, 0.9], color: 'primary', material: 'wire', motion: 'pulse', height: 2, random: true },
      { shape: 'torus', count: 12, arrange: 'orbit', radius: 7, size: [0.6, 1.2], color: 'secondary', material: 'wire', motion: 'orbit', height: 4 },
      { shape: 'ico', count: 30, arrange: 'scatter', radius: 11, size: [0.1, 0.3], color: 'accent', material: 'neon', motion: 'bob', height: 5 },
    ],
  },
  f10: {
    sky: ['#ff6a1a', '#0a0208'], fog: '#2a0a10', ground: 'disc', groundColor: '#140608', groundAlt: '#ff9a3a',
    primary: '#ffd27a', secondary: '#ff5a3a', accent: '#ffffff', ghost: 0.6,
    layers: [
      { shape: 'sphere', count: 220, arrange: 'halo', radius: 13, size: [0.08, 0.16], color: 'primary', material: 'neon', motion: 'pulse', height: 2, wave: true },
      { shape: 'sphere', count: 1, arrange: 'ring', radius: 0, size: [2.4, 2.4], color: 'secondary', material: 'glass', motion: 'pulse', height: 6 },
      { shape: 'bar', count: 24, arrange: 'ring', radius: 11, size: [0.12, 6], color: 'accent', material: 'neon', motion: 'flicker', opacity: 0.4 },
    ],
  },
  f50: {
    sky: ['#0a3a30', '#020a0a'], fog: '#06201a', ground: 'water', groundColor: '#021210', groundAlt: '#2adfb0',
    primary: '#2adfb0', secondary: '#7affd6', accent: '#f0fff8', ghost: 0.4,
    layers: [
      { shape: 'sphere', count: 60, arrange: 'scatter', radius: 9, size: [0.3, 1.1], color: 'primary', material: 'glass', motion: 'bob', height: 3, opacity: 0.5 },
      { shape: 'capsule', count: 20, arrange: 'pillars', radius: 7, size: [0.1, 6], color: 'secondary', material: 'glass', motion: 'sway', opacity: 0.4 },
      { shape: 'sphere', count: 140, arrange: 'scatter', radius: 13, size: [0.02, 0.06], color: 'accent', material: 'neon', motion: 'flicker', height: 6 },
    ],
  },
};
