@group(0) @binding(0) var<uniform> global: GlobalParameter;
@group(0) @binding(1) var<storage, read> edges: array<HalfEdge>;
@group(0) @binding(2) var<storage, read_write> velocityUpdate: array<i32>;
@group(0) @binding(3) var<storage, read_write> balls: array<Object>;
@group(0) @binding(5) var<storage, read_write> out: array< atomic<i32> >;

@compute @workgroup_size(64)

fn main(@builtin(global_invocation_id) global_id: vec3u) {

  let i = global_id.x;
  if i >= global.ballCount {return;}

  let a = balls[i];

  var newBall = a;

  // mouse pick test
  if global.mouseChanged > 0 && global.ballsVisible == 1 {

    let distance = raySphereIntersection(global, newBall);

    if distance > 0 {
      // newBall.color = vec4f(0,0,0,1);
      // newBall.prop3 = i32(distance * QUANTIZE_FACTOR);
      atomicMin(&out[0], i32(distance * QUANTIZE_FACTOR));
    }
    else {
      newBall.prop3 = -1;
    }
  }

  // newBall.velocity = vec3f(0);
  newBall.velocity *= 0.6;

  let up = vec3i(velocityUpdate[3*i], velocityUpdate[3*i+1], velocityUpdate[3*i+2]);
  newBall.velocity += vec3f(up) * DEQUANTIZE_FACTOR;
  velocityUpdate[3*i] = 0;
  velocityUpdate[3*i+1] = 0;
  velocityUpdate[3*i+2] = 0;

  if global.gravity != 0.0 {
    // prop1 is the radius of the ball
    let repulsionFactor = 1.0 / f32(global.ballCount);

    for (var j=0u; j<global.ballCount; j++) {
      if i == j {continue;}
      let b = balls[j];
      let ab = a.position - b.position;
      let d = a.prop1 + b.prop1;
      let lenab = length(ab);

      newBall.velocity += repulsionFactor * global.gravity * ab / (0.01 + lenab * lenab);
    }
  }

  newBall.position += newBall.velocity * global.timeStep;

  balls[i] = newBall;

  // centroid
  atomicAdd(&out[4], i32(newBall.position.x * QUANTIZE_FACTOR));
  atomicAdd(&out[5], i32(newBall.position.y * QUANTIZE_FACTOR));
  atomicAdd(&out[6], i32(newBall.position.z * QUANTIZE_FACTOR));
}