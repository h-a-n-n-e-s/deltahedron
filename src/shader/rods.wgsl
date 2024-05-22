@group(0) @binding(0) var<uniform> global: GlobalParameter;
@group(0) @binding(1) var<storage, read> halfEdges: array<HalfEdge>;
@group(0) @binding(2) var<storage, read_write> velocityUpdate: array< atomic<i32> >;
@group(0) @binding(3) var<storage, read_write> balls: array<Object>;
@group(0) @binding(4) var<storage, read_write> rods: array<Object>;
@group(0) @binding(5) var<storage, read_write> out: array< atomic<i32>, 4>;
@group(0) @binding(6) var<storage, read_write> triVert: array<f32>;
@group(0) @binding(7) var<storage, read_write> triNorm: array<f32>;

@compute @workgroup_size(64)

fn main(@builtin(global_invocation_id) global_id: vec3u) {

  let i = global_id.x;
  if i >= global.rodCount {return;}
  
  // inactive edge
  if halfEdges[2 * i].prev == halfEdges[2 * i].next {
    setTriangles(i, vec3f(0), vec3f(0), vec3f(0), vec3f(0));
    return;
  }

  let j = halfEdges[2 * i].targetVertex;
  let k = halfEdges[2 * i + 1].targetVertex;
  let l = halfEdges[halfEdges[2 * i].next].targetVertex;
  let m = halfEdges[halfEdges[2 * i + 1].next].targetVertex;

  let a = balls[j];
  let b = balls[k];
  let e = balls[l];
  let f = balls[m];

  let ab = a.position - b.position;
  let abMean = (a.position+b.position)/2;
  let d = 0.8;
  let lenab = length(ab);
  var nor = vec3f(0);
  if lenab > 0.0 {nor = normalize(ab);}
  let velocity = (d - lenab) * nor;

  // mouse pick test
  if global.mouseChanged > 0 {

    // for factor 1000 see intersection.wgsl l.28 
    let distance = 1000 * rayCylinderIntersection(global, rods[i]);
    if distance > 0 {

      rods[i].prop3 = i32(distance * QUANTIZE_FACTOR);
      atomicMin(&out[0], rods[i].prop3);

      // orientation
      // let o = balls[0].position;
      // out.e1 = i32(100 * dot(balls[1].position-o, cross(balls[2].position-o, balls[3].position-o)));
    }
    else {
      rods[i].prop3 = -1;
    }
  }

  rods[i].position = abMean;
  rods[i].quarternion = quaternionFromDirection(ab);

  atomicAdd(&velocityUpdate[3 * j    ], i32(velocity.x * QUANTIZE_FACTOR));
  atomicAdd(&velocityUpdate[3 * j + 1], i32(velocity.y * QUANTIZE_FACTOR));
  atomicAdd(&velocityUpdate[3 * j + 2], i32(velocity.z * QUANTIZE_FACTOR));

  atomicAdd(&velocityUpdate[3 * k    ], i32(-velocity.x * QUANTIZE_FACTOR));
  atomicAdd(&velocityUpdate[3 * k + 1], i32(-velocity.y * QUANTIZE_FACTOR));
  atomicAdd(&velocityUpdate[3 * k + 2], i32(-velocity.z * QUANTIZE_FACTOR));

  setTriangles(i, a.position, b.position, e.position, f.position);

}

fn quaternionFromDirection(v:vec3f) -> vec4f {
  let l = length(v);
  let f = 1 / sqrt(2 * l * (l + v.y));
  return vec4f(v.z * f, 0, - v.x * f, (l + v.y) * f);
}

fn setTriangles(i:u32, a:vec3f, b:vec3f, e:vec3f, f:vec3f) {

  var p = (a+b+e)/3;
  triVert[18 * i    ] = a.x;
  triVert[18 * i + 1] = a.y;
  triVert[18 * i + 2] = a.z;
  triVert[18 * i + 3] = b.x;
  triVert[18 * i + 4] = b.y;
  triVert[18 * i + 5] = b.z;
  triVert[18 * i + 6] = p.x;
  triVert[18 * i + 7] = p.y;
  triVert[18 * i + 8] = p.z;

  var norm = normalize(cross(a - p, b - p));
  triNorm[18 * i    ] = norm.x;
  triNorm[18 * i + 1] = norm.y;
  triNorm[18 * i + 2] = norm.z;
  triNorm[18 * i + 3] = norm.x;
  triNorm[18 * i + 4] = norm.y;
  triNorm[18 * i + 5] = norm.z;
  triNorm[18 * i + 6] = norm.x;
  triNorm[18 * i + 7] = norm.y;
  triNorm[18 * i + 8] = norm.z;

  p = (a+b+f)/3;
  triVert[18 * i + 9] = b.x;
  triVert[18 * i +10] = b.y;
  triVert[18 * i +11] = b.z;
  triVert[18 * i +12] = a.x;
  triVert[18 * i +13] = a.y;
  triVert[18 * i +14] = a.z;
  triVert[18 * i +15] = p.x;
  triVert[18 * i +16] = p.y;
  triVert[18 * i +17] = p.z;

  norm = normalize(cross(b - p, a - p));
  triNorm[18 * i + 9] = norm.x;
  triNorm[18 * i +10] = norm.y;
  triNorm[18 * i +11] = norm.z;
  triNorm[18 * i +12] = norm.x;
  triNorm[18 * i +13] = norm.y;
  triNorm[18 * i +14] = norm.z;
  triNorm[18 * i +15] = norm.x;
  triNorm[18 * i +16] = norm.y;
  triNorm[18 * i +17] = norm.z;
}