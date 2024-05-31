const QUANTIZE_FACTOR = 2097152;
const DEQUANTIZE_FACTOR = 1.0/2097152.0;

struct GlobalParameter {
  ballCount: u32,
  rodCount: u32,
  triangleCount: u32,
  timeStep: f32,

  mouseRay: vec3f,
  mouseChanged: f32,
  
  eye: vec3f,
  gravity: f32,
  
  empty: u32,
  ballsVisible: u32,
  rodsVisible: u32,
  trianglesVisible: u32,

  nextBallInPool: u32,
  newBallRodIndex: u32,
  justSetNextBallPosition: u32,
}

struct Object {
  position: vec3f,
  size: f32,

  quarternion: vec4f,
  
  color: vec4f,

  velocity: vec3f,
  mass: f32,

  prop1: f32,
  prop2: f32,
  prop3: i32,
  prop4: i32,

  used: u32,
}

struct HalfEdge {
  face: u32,
  prev: u32,
  next: u32,
  vertex: u32
}