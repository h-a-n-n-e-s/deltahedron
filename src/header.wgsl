
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
  velocity: vec3f,
  mass: f32,
  color: vec4f,
  quarternion: vec4f
}