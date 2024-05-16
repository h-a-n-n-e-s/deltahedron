const QUANTIZE_FACTOR = 2097152;
const DEQUANTIZE_FACTOR = 1.0/2097152.0;

struct GlobalParameter {
  ballCount: u32,
  rodCount: u32,
  timeStep: f32,
  gravity: f32,
  mouseRay: vec3f,
  mouseChanged: f32,
  eye: vec3f,
  empty: u32
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
  prop4: i32
}

struct HalfEdge {
  twin: u32,
  prev: u32,
  next: u32,
  targetVertex: u32
}

struct Out {
  selectedEdge: i32,
  e1: i32,
  e2: i32,
  e3: i32
}