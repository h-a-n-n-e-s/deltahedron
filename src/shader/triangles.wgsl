@group(0) @binding(0) var<uniform> global: GlobalParameter;
@group(0) @binding(1) var<storage, read_write> velocityUpdate: array< atomic<i32> >;
@group(0) @binding(2) var<storage, read_write> balls: array<Object>;
@group(0) @binding(3) var<storage, read_write> out: Out;
@group(0) @binding(4) var<storage, read_write> triVert: array<f32>;
@group(0) @binding(5) var<storage, read_write> triNorm: array<f32>;
@group(0) @binding(6) var<storage, read_write> triTang: array<f32>;
@group(0) @binding(7) var<storage, read> triIndex: array<u32>;


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
      atomicMin(&out.minDistanceToCamera, i32(distance * QUANTIZE_FACTOR));
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

  let orth = cross(b - a, c - a);
  let volume = dot(a, orth) / 6;
  atomicAdd(&out.volume, i32(volume * SMALL_QUANTIZE_FACTOR));

  let n = normalize(orth);
  triNorm[9 * i    ] = n.x;
  triNorm[9 * i + 1] = n.y;
  triNorm[9 * i + 2] = n.z;
  triNorm[9 * i + 3] = n.x;
  triNorm[9 * i + 4] = n.y;
  triNorm[9 * i + 5] = n.z;
  triNorm[9 * i + 6] = n.x;
  triNorm[9 * i + 7] = n.y;
  triNorm[9 * i + 8] = n.z;

  let t = normalize(b - a);
  triTang[9 * i    ] = t.x;
  triTang[9 * i + 1] = t.y;
  triTang[9 * i + 2] = t.z;
  triTang[9 * i + 3] = t.x;
  triTang[9 * i + 4] = t.y;
  triTang[9 * i + 5] = t.z;
  triTang[9 * i + 6] = t.x;
  triTang[9 * i + 7] = t.y;
  triTang[9 * i + 8] = t.z;

  // do centroid correction here cuz in rods.wgsl it is
  // interfering with other velocity updates
  let centroid = - vec3i(atomicLoad(&out.centroidX), atomicLoad(&out.centroidY), atomicLoad(&out.centroidZ)) / max(10, i32(global.ballCount));

  if dot(centroid, centroid) > 0 {
    // divide by valence because it is added as many times as the valence
    var corr = centroid / max(1, i32(balls[j].valence));
    atomicAdd(&velocityUpdate[4 * j    ], corr.x);
    atomicAdd(&velocityUpdate[4 * j + 1], corr.y);
    atomicAdd(&velocityUpdate[4 * j + 2], corr.z);
    corr = centroid / max(1, i32(balls[k].valence));
    atomicAdd(&velocityUpdate[4 * k    ], corr.x);
    atomicAdd(&velocityUpdate[4 * k + 1], corr.y);
    atomicAdd(&velocityUpdate[4 * k + 2], corr.z);
    corr = centroid / max(1, i32(balls[l].valence));
    atomicAdd(&velocityUpdate[4 * l    ], corr.x);
    atomicAdd(&velocityUpdate[4 * l + 1], corr.y);
    atomicAdd(&velocityUpdate[4 * l + 2], corr.z);
  }
}
