
const repulsion = 5000.0;
const dissipation = 10.0;//100.0;
const cohesion = 20.0;//200.0;

@group(0) @binding(0) var<uniform> global: GlobalParameter;
@group(0) @binding(2) var<storage, read> edges: array<vec2u>;
@group(0) @binding(3) var<storage, read_write> balls: array<Object>;
@group(0) @binding(4) var<storage, read_write> rods: array<Object>;

@compute @workgroup_size(64)

fn main(@builtin(global_invocation_id) global_id: vec3u) {

  let i = global_id.x;
  let numberOfRods = arrayLength(&rods);
  if i >= numberOfRods {return;}

  let e = edges[i];
  
  let j = e.x;
  let k = e.y;

  let a = balls[j];
  let b = balls[k];

  rods[i].position = (a.position+b.position)/2;
  rods[i].quarternion = quaternionFromDirection(a.position - b.position);
}

fn quaternionFromDirection(v:vec3f) -> vec4f {
  let l = length(v);
  let f = 1 / sqrt(2 * l * (l + v.y));
  return vec4f(v.z * f, 0, - v.x * f, (l + v.y) * f);
}
