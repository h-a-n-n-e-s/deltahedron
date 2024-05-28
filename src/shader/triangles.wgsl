@group(0) @binding(0) var<uniform> global: GlobalParameter;
@group(0) @binding(3) var<storage, read_write> balls: array<Object>;
@group(0) @binding(5) var<storage, read_write> out: array< atomic<i32>, 4>;
@group(0) @binding(6) var<storage, read_write> triVert: array<f32>;
@group(0) @binding(7) var<storage, read_write> triNorm: array<f32>;
@group(0) @binding(8) var<storage, read> triIndex: array<u32>;

@compute @workgroup_size(64)

fn main(@builtin(global_invocation_id) global_id: vec3u) {

  let i = global_id.x;
  if i >= global.triangleCount {return;}

  let j = triIndex[3*i];
  let k = triIndex[3*i+1];
  let l = triIndex[3*i+2];

  let a = balls[j].position;
  let b = balls[k].position;
  let c = balls[l].position;

  // mouse pick test
  if global.mouseChanged > 0 && global.trianglesVisible == 1 {

    let distance = rayTriangleIntersection(global, a, b, c);

    if distance > 0 {
      // balls[j].color = vec4f(0,0,0,1);
      atomicMin(&out[0], i32(distance * QUANTIZE_FACTOR));
    }
  }

  triVert[9 * i    ] = a.x;
  triVert[9 * i + 1] = a.y;
  triVert[9 * i + 2] = a.z;
  triVert[9 * i + 3] = b.x;
  triVert[9 * i + 4] = b.y;
  triVert[9 * i + 5] = b.z;
  triVert[9 * i + 6] = c.x;
  triVert[9 * i + 7] = c.y;
  triVert[9 * i + 8] = c.z;

  let norm = normalize(cross(b - a, c - a));
  triNorm[9 * i    ] = norm.x;
  triNorm[9 * i + 1] = norm.y;
  triNorm[9 * i + 2] = norm.z;
  triNorm[9 * i + 3] = norm.x;
  triNorm[9 * i + 4] = norm.y;
  triNorm[9 * i + 5] = norm.z;
  triNorm[9 * i + 6] = norm.x;
  triNorm[9 * i + 7] = norm.y;
  triNorm[9 * i + 8] = norm.z;
}