
struct GlobalParameter {
  bound: vec3f,
  wallDissipation: f32,
  ballDissipation: f32,
  timeStep: f32,
  gravity: f32,
  cohesion: f32,
  mouseRay: vec3f,
  mouseChanged: f32,
  eye: vec3f,
  bernd: f32
}

struct Object {
  position: vec3f,
  size: f32,
  quarternion: vec4f,
  color: vec4f,

  velocity: vec3f,
  mass: f32,

  shapePara1: f32,
  shapePara2: f32,
  shapePara3: f32,
  shapePara4: f32
}