@group(0) @binding(0) var<uniform> global: GlobalParameter;
@group(0) @binding(1) var<storage, read> halfEdges: array<HalfEdge>;
@group(0) @binding(2) var<storage, read_write> velocityUpdate: array< atomic<i32> >;
@group(0) @binding(3) var<storage, read_write> balls: array<Object>;
@group(0) @binding(4) var<storage, read_write> rods: array<Object>;
@group(0) @binding(5) var<storage, read_write> out: Out;

@compute @workgroup_size(64)

fn main(@builtin(global_invocation_id) global_id: vec3u) {

  let i = global_id.x;
  if i >= global.rodCount {return;}

  let j = halfEdges[2 * i].vertex;
  let k = halfEdges[2 * i + 1].vertex;

  let a = balls[j];
  let b = balls[k];

  let ab = a.position - b.position;
  let abMean = (a.position+b.position)/2;
  let d = 1.0;
  let lenab = length(ab);
  var nor = vec3f(0);
  if lenab > 0.0 {nor = normalize(ab);}
  let error = abs(1 - lenab / d);
  let velocity = (d - lenab) * nor;

  // error check
  rods[i].maxError = i32(error * QUANTIZE_FACTOR);

  // mouse pick test
  if global.mouseChanged > 0 && global.rodsVisible == 1 && rods[i].size > 0 {

    // for factor 1000 see intersection.wgsl l.28
    let distance = 1000 * rayCylinderIntersection(global, rods[i]);
    if distance > 0 {

      rods[i].distanceToCamera = i32(distance * QUANTIZE_FACTOR);
      atomicMin(&out.minDistanceToCamera, rods[i].distanceToCamera);
    }
    else {
      rods[i].distanceToCamera = -1;
    }
  }

  rods[i].position = abMean;
  rods[i].quarternion = quaternionFromDirection(nor);

  atomicAdd(&velocityUpdate[4 * j    ], i32(velocity.x * QUANTIZE_FACTOR));
  atomicAdd(&velocityUpdate[4 * j + 1], i32(velocity.y * QUANTIZE_FACTOR));
  atomicAdd(&velocityUpdate[4 * j + 2], i32(velocity.z * QUANTIZE_FACTOR));
  atomicAdd(&velocityUpdate[4 * j + 3], 1); // valence count for diagonal newton

  atomicAdd(&velocityUpdate[4 * k    ], i32(-velocity.x * QUANTIZE_FACTOR));
  atomicAdd(&velocityUpdate[4 * k + 1], i32(-velocity.y * QUANTIZE_FACTOR));
  atomicAdd(&velocityUpdate[4 * k + 2], i32(-velocity.z * QUANTIZE_FACTOR));
  atomicAdd(&velocityUpdate[4 * k + 3], 1); // valence count for diagonal newton
}

fn quaternionFromDirection(nor:vec3f) -> vec4f {
  // handle singularity: if pointing straight down (v.y == -1)
  if (nor.y < -0.9999) {
    return vec4f(1.0, 0.0, 0.0, 0.0); // 180 degree rotation around X axis
  }
  let f = 1 / sqrt(2 * (1 + nor.y));
  return vec4f(nor.z * f, 0, - nor.x * f, (1 + nor.y) * f);
}
