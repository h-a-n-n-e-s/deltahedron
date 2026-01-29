const QUANTIZE_FACTOR = 2097152;
const DEQUANTIZE_FACTOR = 1.0/2097152.0;
const VOLUME_QUANTIZE_FACTOR = 65536;
const PI = 3.1415926535897;

struct GlobalParameter {
  ballCount: u32,
  rodCount: u32,
  triangleCount: u32,
  timeStep: f32,

  mouseRay: vec3f,
  mouseChanged: f32,

  eye: vec3f,
  repulsion: f32,

  empty: u32,
  ballsVisible: u32,
  rodsVisible: u32,
  trianglesVisible: u32,

  empty2: u32,
  newBallRodIndex: u32,
  rodScanBranch: u32,
}

struct Object {
  position: vec3f,
  size: f32,

  quarternion: vec4f,

  color: vec4f,

  velocity: vec3f,
  mass: f32,

  radius: f32,
  length: f32,
  distanceToCamera: i32,
  maxError: i32, // only used for rods

  glossyness: f32,
  triangleCount: u32,
  valence: u32, // only used for balls
}

// array to get dynamic data out of the shader
struct Out {
  minDistanceToCamera: atomic<i32>,
  closestRodIndex: atomic<i32>,
  closestBallIndex: atomic<i32>,
  maxError: atomic<i32>,
  dihedralAngle: atomic<i32>,
  centroidX: atomic<i32>,
  centroidY: atomic<i32>,
  centroidZ: atomic<i32>,
  volume: atomic<i32>,
}

struct HalfEdge {
  face: u32,
  prev: u32,
  next: u32,
  vertex: u32
}
