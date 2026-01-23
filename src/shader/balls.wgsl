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
      atomicMin(&out[0], i32(distance * QUANTIZE_FACTOR));
    }
    else {
      newBall.distanceToMouse = -1;
    }
  }

  // damping
  newBall.velocity *= 0.7;

  let up = vec3i(velocityUpdate[4*i], velocityUpdate[4*i+1], velocityUpdate[4*i+2]);

  let displacementSum = vec3f(up) * DEQUANTIZE_FACTOR;

  // Diagonal Newton approximation ________________________
  let inverseEffectiveMass = 1.0 / max(1.0, f32(velocityUpdate[4*i+3])); // valence

  let correctionVelocity = displacementSum * inverseEffectiveMass / global.timeStep;

  newBall.velocity += correctionVelocity * 1.5; // SOR omega 1.5

  velocityUpdate[4*i] = 0;
  velocityUpdate[4*i+1] = 0;
  velocityUpdate[4*i+2] = 0;
  velocityUpdate[4*i+3] = 0;

  if global.repulsion != 0.0 {
    // radius is the radius of the ball
    let repulsionFactor = 10.0 / f32(global.ballCount);

    for (var j=0u; j<global.ballCount; j++) {
      if i == j {continue;}
      let b = balls[j];
      let ab = a.position - b.position;
      let d = a.radius + b.radius;
      let lenab = length(ab);

      newBall.velocity += repulsionFactor * global.repulsion * ab / (0.01 + lenab * lenab) * inverseEffectiveMass;
    }
  }

  newBall.position += newBall.velocity * global.timeStep;

  // This creates a race condition cuz balls[j] is used in the repulsion
  // routine but we don't care if the ball position is a time step ahead
  // since it's not noticable visually. Since the repulsion has a soft
  // potential there is also no danger from "struct tearing" in a single frame.
  balls[i] = newBall;

  // centroid
  atomicAdd(&out[4], i32(newBall.position.x * QUANTIZE_FACTOR));
  atomicAdd(&out[5], i32(newBall.position.y * QUANTIZE_FACTOR));
  atomicAdd(&out[6], i32(newBall.position.z * QUANTIZE_FACTOR));
}
